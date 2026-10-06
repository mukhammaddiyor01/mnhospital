import { Injectable } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import { Types } from 'mongoose';
import { ChatMessage, ChatParticipant } from './dto/messaging';
import { MemberType } from '../member/enums/member.enum';

export interface DirectMessageEvent {
	conversationId: Types.ObjectId;
	participants: ChatParticipant[];
	message: ChatMessage;
}

export interface DirectReadEvent {
	conversationId: Types.ObjectId;
	participants: ChatParticipant[];
	readerId: Types.ObjectId;
	readerType: MemberType;
	readAt: Date;
}

@Injectable()
export class MessagingEventsService {
	private readonly created = new Subject<DirectMessageEvent>();
	private readonly read = new Subject<DirectReadEvent>();

	public onMessageCreated(handler: (event: DirectMessageEvent) => void): Subscription {
		return this.created.subscribe(handler);
	}

	public publishMessageCreated(event: DirectMessageEvent): void {
		this.created.next(event);
	}

	public onMessagesRead(handler: (event: DirectReadEvent) => void): Subscription {
		return this.read.subscribe(handler);
	}

	public publishMessagesRead(event: DirectReadEvent): void {
		this.read.next(event);
	}
}
