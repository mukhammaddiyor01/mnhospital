import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { ChatConversation, ChatConversations, ChatMessage, ChatMessages } from './dto/messaging';
import { ChatInquiry, SendDirectMessageInput, StartDirectConversationInput } from './dto/messaging.input';
import { MessageActor, MessagingService } from './messaging.service';

const messagingRoles = [MemberType.PATIENT, MemberType.DOCTOR, MemberType.RECEPTIONIST, MemberType.ADMIN];
const parseConversationId = (value: string): Types.ObjectId => {
	if (!/^[0-9a-f]{24}$/i.test(value)) throw new BadRequestException('Invalid conversation ID');
	return new Types.ObjectId(value);
};

@Resolver()
export class MessagingResolver {
	constructor(private readonly messagingService: MessagingService) {}

	@Roles(...messagingRoles)
	@UseGuards(RolesGuard)
	@Mutation(() => ChatConversation)
	public async startDirectConversation(
		@Args('input') input: StartDirectConversationInput,
		@AuthMember() actor: MessageActor,
	): Promise<ChatConversation> {
		return this.messagingService.startDirectConversation(actor, input);
	}

	@Roles(...messagingRoles)
	@UseGuards(RolesGuard)
	@Query(() => ChatConversations)
	public async getMyConversations(
		@Args('input') input: ChatInquiry,
		@AuthMember() actor: MessageActor,
	): Promise<ChatConversations> {
		return this.messagingService.getMyConversations(actor, input);
	}

	@Roles(...messagingRoles)
	@UseGuards(RolesGuard)
	@Query(() => ChatConversation)
	public async getMyConversation(
		@Args('conversationId') conversationId: string,
		@AuthMember() actor: MessageActor,
	): Promise<ChatConversation> {
		return this.messagingService.getMyConversation(actor, parseConversationId(conversationId));
	}

	@Roles(...messagingRoles)
	@UseGuards(RolesGuard)
	@Query(() => ChatMessages)
	public async getMyMessages(
		@Args('conversationId') conversationId: string,
		@Args('input') input: ChatInquiry,
		@AuthMember() actor: MessageActor,
	): Promise<ChatMessages> {
		return this.messagingService.getMyMessages(actor, parseConversationId(conversationId), input);
	}

	@Roles(...messagingRoles)
	@UseGuards(RolesGuard)
	@Mutation(() => ChatMessage)
	public async sendDirectMessage(
		@Args('conversationId') conversationId: string,
		@Args('input') input: SendDirectMessageInput,
		@AuthMember() actor: MessageActor,
	): Promise<ChatMessage> {
		return this.messagingService.sendDirectMessage(actor, parseConversationId(conversationId), input);
	}

	@Roles(...messagingRoles)
	@UseGuards(RolesGuard)
	@Mutation(() => Int)
	public async markMyMessagesRead(
		@Args('conversationId') conversationId: string,
		@AuthMember() actor: MessageActor,
	): Promise<number> {
		return this.messagingService.markMyMessagesRead(actor, parseConversationId(conversationId));
	}
}
