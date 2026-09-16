import { Schema } from 'mongoose';
import { ReferenceGroup } from '../../../../libs/enums/reference.enum';

const DoctorViewSchema = new Schema(
	{
		doctorId: {
			type: Schema.Types.ObjectId,
			ref: 'Doctor',
			required: true,
			index: true,
		},
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			index: true,
		},
		viewGroup: {
			type: String,
			enum: ReferenceGroup,
			required: true,
		},
	},
	{ timestamps: { createdAt: true, updatedAt: false }, collection: 'doctorViews' },
);

DoctorViewSchema.index({ doctorId: 1, memberId: 1, viewGroup: 1 });

export default DoctorViewSchema;
