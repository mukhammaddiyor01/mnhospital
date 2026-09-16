import { Schema } from 'mongoose';

const StatusHistorySchema = new Schema(
	{
		previousStatus: {
			type: String,
		},
		newStatus: {
			type: String,
		},
		changedByMemberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
		},
		reason: {
			type: String,
		},
		changedAt: {
			type: Date,
			default: Date.now,
		},
	},
	{ _id: false },
);

export default StatusHistorySchema;
