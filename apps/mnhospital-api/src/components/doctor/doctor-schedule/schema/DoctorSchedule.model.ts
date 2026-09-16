import { Schema } from 'mongoose';
import { Weekday } from '../enums/doctor-schedule.enum';

const DoctorScheduleSchema = new Schema(
	{
		doctorId: {
			type: Schema.Types.ObjectId,
			ref: 'Doctor',
			required: true,
			index: true,
		},
		weekday: {
			type: Number,
			enum: Weekday,
			min: 0,
			max: 6,
		},
		startTime: {
			type: String,
			required: true,
		},
		endTime: {
			type: String,
			required: true,
		},
		breakStart: {
			type: String,
		},
		breakEnd: {
			type: String,
		},
		slotDurationMinutes: {
			type: Number,
			required: true,
			min: 1,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true, collection: 'doctorSchedule' },
);

DoctorScheduleSchema.index({ doctorId: 1, weekday: 1 }, { unique: true });

export default DoctorScheduleSchema;
