import { Schema } from 'mongoose';

const FollowSchema = new Schema(
	{
		followingId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		followerId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
	},
	{ timestamps: true, collection: 'follows' },
);

FollowSchema.index({ followingId: 1, followerId: 1 }, { unique: true });

export default FollowSchema;
