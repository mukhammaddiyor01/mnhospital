import { Schema } from 'mongoose';
import { ConversationType, MemberType } from '../enums/member.enum';

const ConversationSchema = new Schema(
	{
		conversationType: {
			type: String,
			enum: ConversationType,
			required: true,
		},
		conversationTitle: {
			type: String,
			default: '',
		},
		participants: {
			type: [{
				participantId: { type: Schema.Types.ObjectId, required: true },
				participantType: { type: String, enum: MemberType, required: true },
				displayName: { type: String },
				image: { type: String },
			}],
			required: true,
		},
		participantKeys: {
			type: [String],
			required: true,
		},
		directKey: { type: String },
		lastMessageAt: { type: Date },
	},
	{ timestamps: true, collection: 'conversation' },
);

ConversationSchema.index({ participantKeys: 1, updatedAt: -1 });
ConversationSchema.index({ directKey: 1 }, { unique: true, partialFilterExpression: { conversationType: ConversationType.DIRECT } });

export default ConversationSchema;
