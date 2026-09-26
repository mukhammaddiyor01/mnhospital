import { Logger } from '@nestjs/common';
import {
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';

@WebSocketGateway({ transports: ['websocket'], secure: false })
export class SocketGateway implements OnGatewayInit, OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket> {
	private readonly logger = new Logger('SocketEventsGateway');
	private summaryClient = 0;

	public afterInit(server: Server): void {
		this.logger.log(`WebSocket Server Initialized total: ${this.summaryClient}`);
	}

	public handleConnection(client: WebSocket): void {
		this.summaryClient++;
		this.logger.log(`== Client Connected total: ${this.summaryClient} ==`);
	}

	public handleDisconnect(client: WebSocket): void {
		this.summaryClient--;
		this.logger.log(`== Client Disconnected total: ${this.summaryClient} ==`);
	}

	@SubscribeMessage('message')
	public handleMessage(client: WebSocket, payload: any): string {
		return 'Hello world!';
	}
}
