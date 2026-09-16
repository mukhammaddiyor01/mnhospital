import { Schema } from 'mongoose';
import { RoomStatus, RoomType } from '../enums/appointment.enum';

const RoomSchema = new Schema(
	{
		roomNumber: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		roomName: {
			type: String,
			trim: true,
		},
		roomType: {
			type: String,
			enum: RoomType,
			required: true,
		},
		roomStatus: {
			type: String,
			enum: RoomStatus,
			default: RoomStatus.AVAILABLE,
		},
		floor: {
			type: Number,
			min: 0,
		},
	},
	{ timestamps: true, collection: 'rooms' },
);

export default RoomSchema;
