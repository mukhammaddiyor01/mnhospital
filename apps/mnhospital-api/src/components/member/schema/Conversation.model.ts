import { Schema } from 'mongoose';
import { ConversationType } from '../enums/member.enum';

const ConversationSchema = new Schema(
	{
		conversationType: {
			type: String,
			enum: ConversationType,
			required: true,
		},
		conversationTitle: {
			type: String,
			required: true,
		},
		conversationRefId: {
			type: Schema.Types.ObjectId,
			required: true,
		},
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
	},
	{ timestamps: true, collection: 'conversation' },
);

export default ConversationSchema;
