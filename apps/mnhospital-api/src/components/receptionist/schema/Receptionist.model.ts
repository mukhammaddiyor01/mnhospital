import { Schema } from 'mongoose';

const ReceptionistSchema = new Schema(
	{
		receptionistNick: {
			type: String,
			required: true,
			unique: true,
		},
		receptionistPassword: {
			type: String,
			required: true,
			select: false,
		},
		receptionistPhone: {
			type: String,
			required: true,
			unique: true,
		},
		receptionistMail: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
		},
		receptionistFullName: {
			type: String,
			required: true,
		},
		receptionistImage: {
			type: String,
			required: true,
		},
		receptionistAddress: {
			type: String,
		},
		receptionistDesc: {
			type: String,
		},
	},
	{ timestamps: true, collection: 'receptionist' },
);

export default ReceptionistSchema;
