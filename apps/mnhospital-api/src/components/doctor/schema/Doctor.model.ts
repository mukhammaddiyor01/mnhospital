import { Schema } from 'mongoose';
import { DoctorSpecialty } from '../enums/doctor.enum';

const DoctorSchema = new Schema(
	{
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
			unique: true,
		},
		servicesId: {
			type: Schema.Types.ObjectId,
			ref: 'Service',
			required: true,
			index: true,
		},
		departmentId: {
			type: Schema.Types.ObjectId,
			ref: 'Department',
			required: true,
			index: true,
		},
		docSpecialty: {
			type: String,
			enum: DoctorSpecialty,
			required: true,
			index: true,
		},
		docNick: {
			type: String,
			required: true,
			unique: true,
		},
		docPassword: {
			type: String,
			required: true,
			select: false,
		},
		docPhone: {
			type: String,
			required: true,
			unique: true,
		},
		docMail: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
		},
		docFullName: {
			type: String,
			required: true,
		},
		docImage: {
			type: String,
			required: true,
		},
		docAddress: {
			type: String,
			required: true,
		},
		docDesc: {
			type: String,
			required: true,
		},
		docExperience: {
			type: Number,
			required: true,
			min: 0,
		},
		docRoom: {
			type: String,
			required: true,
		},
		docPoints: {
			type: Number,
			default: 0,
		},
		docPatients: {
			type: Number,
			default: 0,
		},
		deletedAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'doctors' },
);

export default DoctorSchema;
