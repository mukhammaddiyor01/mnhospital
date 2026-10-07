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
import {
	DirectMessageEvent,
	DirectReadEvent,
	MessagingEventsService,
} from '../components/messaging/messaging-events.service';
import { ChatParticipant } from '../components/messaging/dto/messaging';
import { GeneralChatService, MAX_GENERAL_MESSAGE_LENGTH } from './general-chat.service';

interface ChatIdentity {
	name: string;
	role: MemberType | 'GUEST';
	profileId?: string;
	accessToken?: string;
	sessionId?: string;
}

@WebSocketGateway({ transports: ['websocket'], secure: false })
export class SocketGateway
	implements OnGatewayInit, OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>, OnModuleDestroy
{
	private readonly logger = new Logger(SocketGateway.name);
	private readonly clients = new Map<WebSocket, ChatIdentity>();
	private messageSubscription?: Subscription;
	private readSubscription?: Subscription;
	private revocationSubscription?: Subscription;
	private sessionTimer?: ReturnType<typeof setInterval>;

	constructor(
		private readonly authService: AuthService,
		private readonly messagingEvents: MessagingEventsService,
		private readonly generalChat: GeneralChatService,
	) {}

	@WebSocketServer()
	server: Server;

	public afterInit(): void {
		this.messageSubscription = this.messagingEvents.onMessageCreated((event) =>
			this.deliverPrivateMessage(event).catch(() => this.logger.warn('Private message delivery failed')),
		);
		this.readSubscription = this.messagingEvents.onMessagesRead((event) =>
			this.deliverPrivateRead(event).catch(() => this.logger.warn('Private read delivery failed')),
		);
		this.revocationSubscription = this.authService.onRevoked((event) => {
			for (const [client, identity] of this.clients) {
				if (
					(event.sessionId && identity.sessionId === event.sessionId) ||
					(event.ownerId === identity.profileId && event.ownerType === identity.role)
				)
					this.closeSession(client);
			}
		});
		this.sessionTimer = setInterval(() => {
			for (const client of this.clients.keys()) void this.authorized(client);
		}, 30000);
		this.sessionTimer.unref();
		this.logger.log('WebSocket server initialized');
	}

	public onModuleDestroy(): void {
		this.messageSubscription?.unsubscribe();
		this.readSubscription?.unsubscribe();
		this.revocationSubscription?.unsubscribe();
		clearInterval(this.sessionTimer);
	}

	public async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
		const token = new URL(request.url ?? '/', 'http://localhost').searchParams.get('token');
		let identity: ChatIdentity = { name: 'Guest', role: 'GUEST' };
		if (token) {
			try {
				const member = await this.authService.verifyToken(token);
				if (!Object.values(MemberType).includes(member.memberType)) throw new Error('Invalid role');
				identity = {
					name:
						member.memberFullName ||
						member.docFullName ||
						member.receptionistFullName ||
						member.adminNick ||
						member.memberNick ||
						member.docNick ||
						member.receptionistNick ||
						'Member',
					role: member.memberType,
					profileId: member._id.toString(),
					accessToken: token,
					sessionId: member.sid,
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
			this.send(client, {
				event: 'error',
				code: 'GENERAL_HISTORY_UNAVAILABLE',
				message: 'Chat history could not be loaded.',
			});
		}
		if (!this.clients.has(client)) return;
		await this.broadcast({ event: 'info', totalClients: this.clients.size, action: 'Joined', name: identity.name });
	}

	public handleDisconnect(client: WebSocket): void {
		const identity = this.clients.get(client);
		if (!identity) return;
		this.clients.delete(client);
		void this.broadcast({ event: 'info', totalClients: this.clients.size, action: 'Left', name: identity.name });
	}

	@SubscribeMessage('message')
	public async handleMessage(
		client: WebSocket,
		payload: string | { text?: unknown; requestId?: unknown },
	): Promise<void> {
		const identity = this.clients.get(client);
		if (!identity || !(await this.authorized(client))) return;
		const rawText = typeof payload === 'string' ? payload : payload?.text;
		const text = typeof rawText === 'string' ? rawText.trim() : '';
		const requestId =
			typeof payload === 'object' && typeof payload?.requestId === 'string'
				? payload.requestId.slice(0, 64)
				: undefined;
		if (!text || text.length > MAX_GENERAL_MESSAGE_LENGTH) {
			this.send(client, {
				event: 'error',
				code: 'INVALID_GENERAL_MESSAGE',
				requestId,
				message: `Message must be 1–${MAX_GENERAL_MESSAGE_LENGTH} characters.`,
			});
			return;
		}

		try {
			const message = await this.generalChat.createMessage(identity, text);
			await this.broadcast({ event: 'message', data: message });
			if (requestId) this.send(client, { event: 'messageSent', requestId });
		} catch {
			this.logger.error('General chat message could not be saved');
			this.send(client, {
				event: 'error',
				code: 'GENERAL_SEND_FAILED',
				requestId,
				message: 'Your message could not be saved. Please try again.',
			});
		}
	}

	private send(client: WebSocket, payload: Record<string, unknown>): void {
		if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
	}

	private closeSession(client: WebSocket): void {
		this.clients.delete(client);
		client.close(1008, 'Session is unavailable');
	}
	private async authorized(client: WebSocket): Promise<boolean> {
		const identity = this.clients.get(client);
		if (!identity) return false;
		if (!identity.accessToken) return true;
		try {
			await this.authService.verifyToken(identity.accessToken);
			return this.clients.has(client);
		} catch {
			this.closeSession(client);
			return false;
		}
	}
	private async broadcast(payload: Record<string, unknown>): Promise<void> {
		await Promise.all(
			[...this.clients.keys()].map(async (client) => {
				if (await this.authorized(client)) this.send(client, payload);
			}),
		);
	}

	private async deliverPrivateMessage(event: DirectMessageEvent): Promise<void> {
		const payload = {
			event: 'privateMessage',
			data: { conversationId: event.conversationId.toString(), message: event.message },
		};
		await this.deliverToParticipants(event.participants, payload);
	}

	private async deliverPrivateRead(event: DirectReadEvent): Promise<void> {
		const payload = {
			event: 'privateRead',
			data: {
				conversationId: event.conversationId.toString(),
				readerId: event.readerId.toString(),
				readerType: event.readerType,
				readAt: event.readAt.toISOString(),
			},
		};
		await this.deliverToParticipants(event.participants, payload);
	}

	private async deliverToParticipants(
		participantList: ChatParticipant[],
		payload: Record<string, unknown>,
	): Promise<void> {
		const participants = new Set(
			participantList.map((item) => `${item.participantType}:${item.participantId.toString()}`),
		);
		for (const [client, identity] of this.clients) {
			if (
				identity.profileId &&
				participants.has(`${identity.role}:${identity.profileId}`) &&
				(await this.authorized(client))
			)
				this.send(client, payload);
		}
	}
}
