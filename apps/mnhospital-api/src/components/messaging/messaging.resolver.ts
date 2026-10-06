import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { ChatConversation, ChatConversations } from './dto/messaging';
import { ChatInquiry, StartDirectConversationInput } from './dto/messaging.input';
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

}
