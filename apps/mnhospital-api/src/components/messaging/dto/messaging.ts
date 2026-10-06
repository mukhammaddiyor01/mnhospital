import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { ConversationType, MemberType } from '../../member/enums/member.enum';

@ObjectType()
export class ChatParticipant {
	@Field(() => String)
	participantId: Types.ObjectId;

	@Field(() => MemberType)
	participantType: MemberType;

	@Field(() => String, { nullable: true })
	displayName?: string;

	@Field(() => String, { nullable: true })
	image?: string;
}

@ObjectType()
export class ChatConversation {
	@Field(() => String)
	_id: Types.ObjectId;

	@Field(() => ConversationType)
	conversationType: ConversationType;

	@Field(() => [ChatParticipant])
	participants: ChatParticipant[];

	participantKeys: string[];
	directKey: string;

	@Field(() => Date, { nullable: true })
	lastMessageAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class ChatMessage {
	@Field(() => String)
	_id: Types.ObjectId;

	@Field(() => String)
	conversationId: Types.ObjectId;

	@Field(() => String)
	senderId: Types.ObjectId;

	@Field(() => MemberType)
	senderType: MemberType;

	@Field(() => String)
	messageContent: string;

	@Field(() => String, { nullable: true })
	replyToMessageId?: Types.ObjectId;

	@Field(() => Date, { nullable: true })
	readAt?: Date;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;
}

@ObjectType()
export class ChatConversations {
	@Field(() => [ChatConversation])
	list: ChatConversation[];

	@Field(() => Int)
	total: number;
}

@ObjectType()
export class ChatMessages {
	@Field(() => [ChatMessage])
	list: ChatMessage[];

	@Field(() => Int)
	total: number;
}
