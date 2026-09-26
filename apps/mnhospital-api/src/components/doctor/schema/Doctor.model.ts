import { Schema } from 'mongoose';
import { DoctorSpecialty } from '../enums/doctor.enum';
import { MemberAuthType, MemberStatus, MemberType } from '../../member/enums/member.enum';

const DoctorSchema = new Schema(
	{
		memberType: {
			type: String,
			enum: MemberType,
			default: MemberType.DOCTOR,
			immutable: true,
		},
		memberStatus: {
			type: String,
			enum: MemberStatus,
			default: MemberStatus.ACTIVE,
		},
		memberAuthType: {
			type: String,
			enum: MemberAuthType,
			default: MemberAuthType.PHONE,
		},
		servicesId: {
			type: Schema.Types.ObjectId,
			ref: 'Service',
			index: true,
		},
		docServices: {
			type: Number,
			default: 0,
			min: 0,
		},
		docArticles: {
			type: Number,
			default: 0,
			min: 0,
		},
		docLikes: {
			type: Number,
			default: 0,
			min: 0,
		},
		docFollowers: {
			type: Number,
			default: 0,
			min: 0,
		},
		departmentId: {
			type: Schema.Types.ObjectId,
			ref: 'Department',
			index: true,
		},
		docSpecialty: {
			type: String,
			enum: DoctorSpecialty,
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
			index: { unique: true, sparse: true },
			lowercase: true,
		},
		docFullName: {
			type: String,
			default: '',
		},
		docImage: {
			type: String,
			default: '',
		},
		docAddress: {
			type: String,
			default: '',
		},
		docDesc: {
			type: String,
			default: '',
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
