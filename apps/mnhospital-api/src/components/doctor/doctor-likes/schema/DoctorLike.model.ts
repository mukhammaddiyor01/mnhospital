import { Schema } from 'mongoose';
import { ReferenceGroup } from '../../../../libs/enums/reference.enum';

const DoctorLikeSchema = new Schema(
	{
		likeRefId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		doctorId: {
			type: Schema.Types.ObjectId,
			ref: 'Doctor',
			required: true,
			index: true,
		},
		likeGroup: {
			type: String,
			enum: ReferenceGroup,
			required: true,
		},
	},
	{ timestamps: true, collection: 'doctorLikes' },
);

DoctorLikeSchema.index({ doctorId: 1, likeRefId: 1, likeGroup: 1 }, { unique: true });

export default DoctorLikeSchema;
