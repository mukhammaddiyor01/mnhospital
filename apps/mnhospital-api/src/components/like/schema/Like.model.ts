import { Schema } from 'mongoose';
import { ReferenceGroup } from '../../../libs/enums/reference.enum';

const LikeSchema = new Schema(
	{
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		likeGroup: {
			type: String,
			enum: ReferenceGroup,
			required: true,
		},
	},
	{ timestamps: true, collection: 'likes' },
);

export default LikeSchema;
