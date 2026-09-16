import { Schema } from 'mongoose';
import { ReferenceGroup } from '../enums/reference.enum';

const ViewSchema = new Schema(
	{
		viewGroup: {
			type: String,
			enum: ReferenceGroup,
			required: true,
		},
		viewRefId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
	},
	{ timestamps: { createdAt: true, updatedAt: false }, collection: 'views' },
);

ViewSchema.index({ memberId: 1, viewRefId: 1, viewGroup: 1 });

export default ViewSchema;
