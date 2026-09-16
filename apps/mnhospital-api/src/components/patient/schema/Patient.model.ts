import { Schema } from 'mongoose';
import { MemberAuthType, MemberStatus, MemberType } from '../../member/enums/member.enum';
import { PatientBloodType, PatientGender } from '../enums/patient.enum';

const PatientSchema = new Schema(
	{
		memberType: {
			type: String,
			enum: MemberType,
			default: MemberType.USER,
		},
		memberStatus: {
			type: String,
			enum: MemberStatus,
			default: MemberStatus.ACTIVE,
		},
		patientBloodType: {
			type: String,
			enum: PatientBloodType,
			required: true,
		},
		patientGender: {
			type: String,
			enum: PatientGender,
			required: true,
		},
		memberAuthType: {
			type: String,
			enum: MemberAuthType,
			default: MemberAuthType.PHONE,
		},
		patientPhone: {
			type: String,
			required: true,
			unique: true,
		},
		patientMail: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
		},
		patientNick: {
			type: String,
			required: true,
			unique: true,
		},
		patientPassword: {
			type: String,
			required: true,
			select: false,
		},
		patientFullName: {
			type: String,
			required: true,
		},
		patientBirthDate: {
			type: Date,
			required: true,
		},
		patientIdNumber: {
			type: String,
			required: true,
			unique: true,
		},
		patientImage: {
			type: String,
			default: '',
		},
		patientDesc: {
			type: String,
		},
		patientAddress: {
			type: String,
			required: true,
		},
		patientConversation: {
			type: Number,
			default: 0,
		},
		patientServices: {
			type: Number,
			default: 0,
		},
		patientFollows: {
			type: Number,
			default: 0,
		},
		patientLikes: {
			type: Number,
			default: 0,
		},
		patientViews: {
			type: Number,
			default: 0,
		},
		patientComments: {
			type: Number,
			default: 0,
		},
		patientPoints: {
			type: Number,
			default: 0,
		},
		patientReports: {
			type: Number,
			default: 0,
		},
		deletedAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'patients' },
);

export default PatientSchema;
