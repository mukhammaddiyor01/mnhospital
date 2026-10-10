import { Schema } from 'mongoose';
import { MemberType } from '../enums/member.enum';

const MessageSchema = new Schema(
	{
		conversationId: {
			type: Schema.Types.ObjectId,
			ref: 'Conversation',
			required: true,
			index: true,
		},
		senderId: {
			type: Schema.Types.ObjectId,
			required: true,
		},
		senderType: { type: String, enum: MemberType, required: true },
		replyToMessageId: {
			type: Schema.Types.ObjectId,
			ref: 'Message',
		},
		messageTitle: {
			type: String,
			default: '',
		},
		messageContent: {
			type: String,
			required: true,
			trim: true,
			maxlength: 2000,
		},
		messageImages: {
			type: [String],
			default: [],
		},
		readAt: {
			type: Date,
		},
		editedAt: {
			type: Date,
		},
		deletedAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'message' },
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ conversationId: 1, readAt: 1, deletedAt: 1 });

export default MessageSchema;
