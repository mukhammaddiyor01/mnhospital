import { Schema } from 'mongoose';

const DoctorMessageSchema = new Schema(
	{
		doctorConversationId: {
			type: Schema.Types.ObjectId,
			ref: 'DoctorConversation',
			required: true,
			index: true,
		},
		adminId: {
			type: Schema.Types.ObjectId,
			ref: 'Admin',
			required: true,
		},
		patientId: {
			type: Schema.Types.ObjectId,
			ref: 'Patient',
			required: true,
		},
		receptionistId: {
			type: Schema.Types.ObjectId,
			ref: 'Receptionist',
			required: true,
		},
		doctorMessageContent: {
			type: String,
			required: true,
		},
		doctorMessageTitle: {
			type: String,
			required: true,
		},
		doctorMessageImage: {
			type: String,
		},
		readAt: {
			type: Date,
			required: true,
		},
	},
	{ timestamps: { createdAt: true, updatedAt: false }, collection: 'doctorMessage' },
);

export default DoctorMessageSchema;
