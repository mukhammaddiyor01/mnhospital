import { Schema } from 'mongoose';

const FollowSchema = new Schema(
	{
		followingMemberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		followerMemberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
	},
	{ timestamps: true, collection: 'follows' },
);

FollowSchema.index({ followingMemberId: 1, followerMemberId: 1 }, { unique: true });

export default FollowSchema;
