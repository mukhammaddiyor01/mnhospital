import { Schema } from 'mongoose';
import { ViewGroup } from '../enums/view.enum';

const ViewSchema = new Schema(
	{
		viewGroup: {
			type: String,
			enum: ViewGroup,
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
	{ timestamps: true, collection: 'views' },
);

ViewSchema.index({ memberId: 1, viewRefId: 1, viewGroup: 1 });

export default ViewSchema;
