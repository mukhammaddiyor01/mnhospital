import { Schema } from 'mongoose';
import StatusHistorySchema from '../../../libs/schemas/StatusHistory.model';
import { ReceptionTaskPriority, ReceptionTaskStatus, ReceptionTaskType } from '../enums/receptionist.enum';

const ReceptionTaskSchema = new Schema(
	{
		appointmentId: {
			type: Schema.Types.ObjectId,
			ref: 'Appointment',
		},
		patientId: {
			type: Schema.Types.ObjectId,
			ref: 'Patient',
			required: true,
			index: true,
		},
		doctorId: {
			type: Schema.Types.ObjectId,
			ref: 'Doctor',
			required: true,
		},
		receptionistId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			index: true,
		},
		createdByMemberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
		},
		taskType: {
			type: String,
			enum: ReceptionTaskType,
			required: true,
		},
		taskPriority: {
			type: String,
			enum: ReceptionTaskPriority,
			required: true,
		},
		taskStatus: {
			type: String,
			enum: ReceptionTaskStatus,
			default: ReceptionTaskStatus.PENDING,
		},
		taskInstruction: {
			type: String,
			required: true,
		},
		taskResult: {
			type: String,
		},
		statusHistory: {
			type: [StatusHistorySchema],
			required: true,
			default: [],
		},
		dueAt: {
			type: Date,
		},
		acceptedAt: {
			type: Date,
		},
		completedAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'receptionTasks' },
);

export default ReceptionTaskSchema;
