import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MemberType } from '../components/member/enums/member.enum';

export const GENERAL_HISTORY_LIMIT = 50;
export const MAX_GENERAL_MESSAGE_LENGTH = 500;

export interface GeneralChatIdentity {
	name: string;
	role: MemberType | 'GUEST';
}
export interface GeneralChatMessage extends GeneralChatIdentity {
	id: string;
	text: string;
	createdAt: string;
}
export interface GeneralChatRecord extends GeneralChatIdentity {
	messageId: string;
	text: string;
	createdAt: Date;
}

@Injectable()
export class GeneralChatService {
	constructor(@InjectModel('GeneralChatMessage') private readonly messageModel: Model<GeneralChatRecord>) {}

	public async getRecentMessages(): Promise<GeneralChatMessage[]> {
		const messages = await this.messageModel.find({})
			.sort({ createdAt: -1, messageId: -1 })
			.limit(GENERAL_HISTORY_LIMIT)
			.select('messageId text name role createdAt')
			.lean().exec();
		return messages.reverse().map((message) => this.toMessage(message));
	}

	public async createMessage(identity: GeneralChatIdentity, text: string): Promise<GeneralChatMessage> {
		const message = await this.messageModel.create({ name: identity.name, role: identity.role, text });
		return this.toMessage(message);
	}

	private toMessage(message: GeneralChatRecord): GeneralChatMessage {
		return { id: message.messageId, text: message.text, name: message.name, role: message.role, createdAt: message.createdAt.toISOString() };
	}
}
