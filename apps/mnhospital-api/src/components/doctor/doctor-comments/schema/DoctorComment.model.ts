import { Schema } from 'mongoose';
import { ReferenceGroup } from '../../../../libs/enums/reference.enum';
import { CommentStatus } from '../../../comment/enums/comment.enum';

const DoctorCommentSchema = new Schema(
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
		appointmentId: {
			type: Schema.Types.ObjectId,
			ref: 'Appointment',
			required: true,
			index: true,
		},
		commentStatus: {
			type: String,
			enum: CommentStatus,
			default: CommentStatus.ACTIVE,
		},
		commentGroup: {
			type: String,
			enum: ReferenceGroup,
			required: true,
		},
		commentContent: {
			type: String,
			required: true,
		},
		rating: {
			type: Number,
			min: 1,
			max: 5,
		},
		deletedAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'doctorComments' },
);

DoctorCommentSchema.index({ doctorId: 1, memberId: 1, appointmentId: 1 });

export default DoctorCommentSchema;
