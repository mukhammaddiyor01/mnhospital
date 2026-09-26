import { Schema } from 'mongoose';
import { LikeGroup } from '../enums/like.enum';

const LikeSchema = new Schema(
	{
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		likeRefId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		likeGroup: {
			type: String,
			enum: LikeGroup,
			required: true,
		},
	},
	{ timestamps: true, collection: 'likes' },
);

LikeSchema.index({ memberId: 1, likeRefId: 1, likeGroup: 1 }, { unique: true });

export default LikeSchema;
