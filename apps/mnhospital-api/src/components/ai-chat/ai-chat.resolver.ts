import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { AiChatService } from './ai-chat.service';
import { AskHospitalAssistantInput } from './dto/ai-chat.input';
import { HospitalAssistantReply } from './dto/ai-chat';

@Resolver()
export class AiChatResolver {
	constructor(private readonly aiChat: AiChatService) {}

	// Public website assistance only: guests and members get the same public information.
	@Mutation(() => HospitalAssistantReply)
	public async askHospitalAssistant(
		@Args('input') input: AskHospitalAssistantInput,
		@Context() context: any,
	): Promise<HospitalAssistantReply> {
		return this.aiChat.ask(input, context.req.ip ?? context.req.socket?.remoteAddress ?? 'unknown');
	}
}
