import { Schema } from 'mongoose';
import { AppointmentStatus } from '../enums/appointment.enum';
import StatusHistorySchema from './StatusHistory.model';

const AppointmentSchema = new Schema(
	{
		slotKeys: { type: [String], default: undefined },
		holdExpiresAt: { type: Date },
		appointmentCode: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		appointmentType: {
			type: String,
			required: true,
			trim: true,
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
			index: true,
		},
		serviceId: {
			type: Schema.Types.ObjectId,
			ref: 'Service',
			required: true,
		},
		roomId: {
			type: Schema.Types.ObjectId,
			ref: 'Room',
			required: true,
		},
		bookingOrderId: {
			type: Schema.Types.ObjectId,
			ref: 'BookingOrder',
			required: true,
		},
		createdByMemberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
		},
		appointmentStatus: {
			type: String,
			enum: AppointmentStatus,
			default: AppointmentStatus.PENDING,
		},
		appointmentReason: {
			type: String,
			required: true,
		},
		appointmentDesc: {
			type: String,
			required: true,
		},
		statusHistory: {
			type: [StatusHistorySchema],
			default: [],
		},
		startsAt: {
			type: Date,
			required: true,
			index: true,
		},
		endsAt: {
			type: Date,
			required: true,
		},
		cancellationReason: {
			type: String,
		},
		cancelledAt: {
			type: Date,
		},
		completedAt: {
			type: Date,
		},
	},
	{ timestamps: true, optimisticConcurrency: true, collection: 'appointment' },
);

AppointmentSchema.index({ doctorId: 1, startsAt: 1, endsAt: 1 });
AppointmentSchema.index({ patientId: 1, startsAt: -1 });
AppointmentSchema.index({ roomId: 1, startsAt: 1, endsAt: 1 });

// Each occupied resource-minute can belong to only one appointment, across API processes.
AppointmentSchema.index({ slotKeys: 1 }, { unique: true, partialFilterExpression: { slotKeys: { $type: 'string' } } });

export default AppointmentSchema;
