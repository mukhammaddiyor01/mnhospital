import { Schema } from 'mongoose';

const DoctorFollowSchema = new Schema(
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
	},
	{ timestamps: true, collection: 'doctorFollows' },
);

DoctorFollowSchema.index({ doctorId: 1, memberId: 1 }, { unique: true });

export default DoctorFollowSchema;
