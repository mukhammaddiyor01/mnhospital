import { Schema } from 'mongoose';
import { AdminType } from '../enums/admin.enum';

const AdminSchema = new Schema(
	{
		memberType: {
			type: String,
			enum: AdminType,
			default: AdminType.ADMIN,
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
		adminFullName: {
			type: String,
			required: true,
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
