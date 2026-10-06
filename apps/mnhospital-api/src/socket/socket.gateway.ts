import { IncomingMessage } from 'http';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Subscription } from 'rxjs';
import {
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { AuthService } from '../components/auth/auth.service';
import { MemberType } from '../components/member/enums/member.enum';
import { DirectMessageEvent, DirectReadEvent, MessagingEventsService } from '../components/messaging/messaging-events.service';
import { ChatParticipant } from '../components/messaging/dto/messaging';
import { GeneralChatService, MAX_GENERAL_MESSAGE_LENGTH } from './general-chat.service';

interface ChatIdentity {
	name: string;
	role: MemberType | 'GUEST';
	profileId?: string;
}

@WebSocketGateway({ transports: ['websocket'], secure: false })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>, OnModuleDestroy {
	private readonly logger = new Logger(SocketGateway.name);
	private readonly clients = new Map<WebSocket, ChatIdentity>();
	private messageSubscription?: Subscription;
	private readSubscription?: Subscription;

	constructor(
		private readonly authService: AuthService,
		private readonly messagingEvents: MessagingEventsService,
		private readonly generalChat: GeneralChatService,
	) {}

	@WebSocketServer()
	server: Server;

	public afterInit(): void {
		this.messageSubscription = this.messagingEvents.onMessageCreated((event) => this.deliverPrivateMessage(event));
		this.readSubscription = this.messagingEvents.onMessagesRead((event) => this.deliverPrivateRead(event));
		this.logger.log('WebSocket server initialized');
	}

	public onModuleDestroy(): void {
		this.messageSubscription?.unsubscribe();
		this.readSubscription?.unsubscribe();
	}

	public async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
		const token = new URL(request.url ?? '/', 'http://localhost').searchParams.get('token');
		let identity: ChatIdentity = { name: 'Guest', role: 'GUEST' };
		if (token) {
			try {
				const member = await this.authService.verifyToken(token);
				if (!Object.values(MemberType).includes(member.memberType)) throw new Error('Invalid role');
				identity = {
					name: member.memberFullName || member.docFullName || member.receptionistFullName || member.adminNick || member.memberNick || member.docNick || member.receptionistNick || 'Member',
					role: member.memberType,
					profileId: member._id.toString(),
				};
			} catch {
				client.close(1008, 'Invalid token');
				return;
			}
		}

		if (client.readyState !== WebSocket.OPEN) return;
		this.clients.set(client, identity);
		try {
			const list = await this.generalChat.getRecentMessages();
			this.send(client, { event: 'getMessages', list });
		} catch {
			this.logger.error('General chat history could not be loaded');
			this.send(client, { event: 'error', code: 'GENERAL_HISTORY_UNAVAILABLE', message: 'Chat history could not be loaded.' });
		}
		if (!this.clients.has(client)) return;
		this.broadcast({ event: 'info', totalClients: this.clients.size, action: 'Joined', name: identity.name });
	}

	public handleDisconnect(client: WebSocket): void {
		const identity = this.clients.get(client);
		if (!identity) return;
		this.clients.delete(client);
		this.broadcast({ event: 'info', totalClients: this.clients.size, action: 'Left', name: identity.name });
	}

	@SubscribeMessage('message')
	public async handleMessage(client: WebSocket, payload: string | { text?: unknown; requestId?: unknown }): Promise<void> {
		const identity = this.clients.get(client);
		if (!identity) return;
		const rawText = typeof payload === 'string' ? payload : payload?.text;
		const text = typeof rawText === 'string' ? rawText.trim() : '';
		const requestId = typeof payload === 'object' && typeof payload?.requestId === 'string' ? payload.requestId.slice(0, 64) : undefined;
		if (!text || text.length > MAX_GENERAL_MESSAGE_LENGTH) {
			this.send(client, { event: 'error', code: 'INVALID_GENERAL_MESSAGE', requestId, message: `Message must be 1–${MAX_GENERAL_MESSAGE_LENGTH} characters.` });
			return;
		}

		try {
			const message = await this.generalChat.createMessage(identity, text);
			this.broadcast({ event: 'message', data: message });
			if (requestId) this.send(client, { event: 'messageSent', requestId });
		} catch {
			this.logger.error('General chat message could not be saved');
			this.send(client, { event: 'error', code: 'GENERAL_SEND_FAILED', requestId, message: 'Your message could not be saved. Please try again.' });
		}
	}

	private send(client: WebSocket, payload: Record<string, unknown>): void {
		if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
	}

	private broadcast(payload: Record<string, unknown>): void {
		for (const client of this.clients.keys()) this.send(client, payload);
	}

	private deliverPrivateMessage(event: DirectMessageEvent): void {
		const payload = { event: 'privateMessage', data: { conversationId: event.conversationId.toString(), message: event.message } };
		this.deliverToParticipants(event.participants, payload);
	}

	private deliverPrivateRead(event: DirectReadEvent): void {
		const payload = { event: 'privateRead', data: {
			conversationId: event.conversationId.toString(), readerId: event.readerId.toString(),
			readerType: event.readerType, readAt: event.readAt.toISOString(),
		} };
		this.deliverToParticipants(event.participants, payload);
	}

	private deliverToParticipants(participantList: ChatParticipant[], payload: Record<string, unknown>): void {
		const participants = new Set(participantList.map((item) => `${item.participantType}:${item.participantId.toString()}`));
		for (const [client, identity] of this.clients) {
			if (identity.profileId && participants.has(`${identity.role}:${identity.profileId}`)) this.send(client, payload);
		}
	}
}
