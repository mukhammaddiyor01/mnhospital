import { Injectable } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { Types } from 'mongoose';
import { ChatMessage, ChatParticipant } from './dto/messaging';

export interface DirectMessageEvent {
	conversationId: Types.ObjectId;
	participants: ChatParticipant[];
	message: ChatMessage;
}

@Injectable()
export class MessagingEventsService {
	private readonly created = new Subject<DirectMessageEvent>();

	public onMessageCreated(handler: (event: DirectMessageEvent) => void): Subscription {
		return this.created.subscribe(handler);
	}

	public publishMessageCreated(event: DirectMessageEvent): void {
		this.created.next(event);
	}
}
