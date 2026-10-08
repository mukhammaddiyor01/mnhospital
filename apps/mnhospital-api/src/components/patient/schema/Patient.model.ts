import { Schema } from 'mongoose';
import { MemberAuthType, MemberStatus, MemberType } from '../../member/enums/member.enum';
import { PatientBloodType, PatientGender } from '../enums/patient.enum';

const PatientSchema = new Schema(
	{
		memberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			index: true,
			unique: true,
			sparse: true,
		},
		memberType: {
			type: String,
			enum: MemberType,
			default: MemberType.PATIENT,
		},
		memberStatus: {
			type: String,
			enum: MemberStatus,
			default: MemberStatus.ACTIVE,
		},
		patientBloodType: {
			type: String,
			enum: PatientBloodType,
		},
		patientGender: {
			type: String,
			enum: PatientGender,
		},
		memberAuthType: {
			type: String,
			enum: MemberAuthType,
			default: MemberAuthType.PHONE,
		},
		patientPhone: {
			type: String,
			index: { unique: true, sparse: true },
		},
		patientMail: {
			type: String,
			index: { unique: true, sparse: true },
			lowercase: true,
		},
		patientNick: {
			type: String,
			index: { unique: true, sparse: true },
		},
		patientPassword: {
			type: String,
			select: false,
		},
		patientFullName: {
			type: String,
		},
		patientBirthDate: {
			type: Date,
		},
		patientIdNumber: {
			type: String,
			unique: true,
			sparse: true,
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
