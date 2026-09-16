import { Schema } from 'mongoose';

const MessageSchema = new Schema(
	{
		conversationId: {
			type: Schema.Types.ObjectId,
			ref: 'Conversation',
			required: true,
			index: true,
		},
		senderMemberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
		},
		replyToMessageId: {
			type: Schema.Types.ObjectId,
			ref: 'Message',
		},
		messageTitle: {
			type: String,
			required: true,
		},
		messageContent: {
			type: String,
			required: true,
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

export default MessageSchema;
