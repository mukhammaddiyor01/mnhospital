import { Schema } from 'mongoose';
import { MemberAuthType, MemberStatus, MemberType } from '../../member/enums/member.enum';

const ReceptionistSchema = new Schema(
	{
		sessionVersion: { type: Number, default: 0 },
		memberType: {
			type: String,
			enum: MemberType,
			default: MemberType.RECEPTIONIST,
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
			default: '',
		},
		receptionistAddress: {
			type: String,
		},
		receptionistDesc: {
			type: String,
		},
		deletedAt: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'receptionist' },
);

export default ReceptionistSchema;
