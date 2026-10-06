import { randomUUID } from 'crypto';
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
import { DirectMessageEvent, MessagingEventsService } from '../components/messaging/messaging-events.service';

interface ChatIdentity {
	name: string;
	role: MemberType | 'GUEST';
	profileId?: string;
}

interface GeneralMessage {
	id: string;
	text: string;
	name: string;
	role: MemberType | 'GUEST';
	createdAt: string;
}

const MAX_GENERAL_MESSAGE_LENGTH = 500;
const GENERAL_HISTORY_LIMIT = 50;

@WebSocketGateway({ transports: ['websocket'], secure: false })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket>, OnModuleDestroy {
	private readonly logger = new Logger(SocketGateway.name);
	private readonly clients = new Map<WebSocket, ChatIdentity>();
	private readonly generalMessages: GeneralMessage[] = [];
	private messageSubscription?: Subscription;

	constructor(private readonly authService: AuthService, private readonly messagingEvents: MessagingEventsService) {}

	@WebSocketServer()
	server: Server;

	public afterInit(): void {
		this.messageSubscription = this.messagingEvents.onMessageCreated((event) => this.deliverPrivateMessage(event));
		this.logger.log('WebSocket server initialized');
	}

	public onModuleDestroy(): void {
		this.messageSubscription?.unsubscribe();
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

		this.clients.set(client, identity);
		this.send(client, { event: 'getMessages', list: this.generalMessages });
		this.broadcast({ event: 'info', totalClients: this.clients.size, action: 'Joined', name: identity.name });
	}

	public handleDisconnect(client: WebSocket): void {
		const identity = this.clients.get(client);
		if (!identity) return;
		this.clients.delete(client);
		this.broadcast({ event: 'info', totalClients: this.clients.size, action: 'Left', name: identity.name });
	}

	@SubscribeMessage('message')
	public handleMessage(client: WebSocket, payload: string | { text?: string }): void {
		const identity = this.clients.get(client);
		if (!identity) return;
		const text = (typeof payload === 'string' ? payload : payload?.text)?.trim();
		if (!text || text.length > MAX_GENERAL_MESSAGE_LENGTH) {
			this.send(client, { event: 'error', message: `Message must be 1–${MAX_GENERAL_MESSAGE_LENGTH} characters.` });
			return;
		}

		const message: GeneralMessage = { id: randomUUID(), text, name: identity.name, role: identity.role, createdAt: new Date().toISOString() };
		this.generalMessages.push(message);
		if (this.generalMessages.length > GENERAL_HISTORY_LIMIT) this.generalMessages.shift();
		this.broadcast({ event: 'message', data: message });
	}

	private send(client: WebSocket, payload: Record<string, unknown>): void {
		if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
	}

	private broadcast(payload: Record<string, unknown>): void {
		for (const client of this.clients.keys()) this.send(client, payload);
	}

	private deliverPrivateMessage(event: DirectMessageEvent): void {
		const participants = new Set(event.participants.map((item) => `${item.participantType}:${item.participantId.toString()}`));
		const payload = { event: 'privateMessage', data: { conversationId: event.conversationId.toString(), message: event.message } };
		for (const [client, identity] of this.clients) {
			if (identity.profileId && participants.has(`${identity.role}:${identity.profileId}`)) this.send(client, payload);
		}
	}
}
