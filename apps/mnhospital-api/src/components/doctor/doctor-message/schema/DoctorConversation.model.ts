import { Schema } from 'mongoose';
import { DoctorConversationType } from '../enums/doctor-message.enum';

const DoctorConversationSchema = new Schema(
	{
		doctorConversationType: {
			type: String,
			enum: DoctorConversationType,
			required: true,
		},
		doctorConversationTitle: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true, collection: 'doctorConversation' },
);

export default DoctorConversationSchema;
