import { Schema } from 'mongoose';
import { MemberStatus, MemberType } from '../../member/enums/member.enum';

const AdminSchema = new Schema(
	{
		sessionVersion: { type: Number, default: 0 },
		memberStatus: { type: String, enum: MemberStatus, default: MemberStatus.ACTIVE },
		deletedAt: { type: Date },
		memberType: {
			type: String,
			enum: MemberType,
			default: MemberType.ADMIN,
			immutable: true,
		},
		adminNick: {
			type: String,
			required: true,
			unique: true,
		},
		adminPassword: {
			type: String,
			required: true,
			select: false,
		},
		adminPhone: {
			type: String,
			required: true,
			unique: true,
		},
		adminMail: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
		},
		adminImage: {
			type: String,
			required: true,
		},
		adminDesc: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true, collection: 'admin' },
);

export default AdminSchema;
