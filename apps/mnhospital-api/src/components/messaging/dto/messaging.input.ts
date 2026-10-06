import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { MemberType } from '../../member/enums/member.enum';

@InputType()
export class ChatInquiry {
	@IsInt()
	@Min(1)
	@Field(() => Int, { defaultValue: 1 })
	page = 1;

	@IsInt()
	@Min(1)
	@Max(50)
	@Field(() => Int, { defaultValue: 20 })
	limit = 20;
}

@InputType()
export class StartDirectConversationInput {
	@IsEnum(MemberType)
	@Field(() => MemberType)
	targetType: MemberType;

	@IsString()
	@Field(() => String)
	targetId: string;
}

@InputType()
export class SendDirectMessageInput {
	@IsString()
	@Length(1, 2000)
	@Field(() => String)
	messageContent: string;

	@IsOptional()
	@IsString()
	@Field(() => String, { nullable: true })
	replyToMessageId?: string;
}
