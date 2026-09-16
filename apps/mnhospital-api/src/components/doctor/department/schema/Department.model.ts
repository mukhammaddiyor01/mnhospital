import { Schema } from 'mongoose';
import { DepartmentStatus } from '../enums/department.enum';

const DepartmentSchema = new Schema(
	{
		departmentName: {
			type: String,
			required: true,
			unique: true,
			trim: true,
		},
		departmentStatus: {
			type: String,
			enum: DepartmentStatus,
			default: DepartmentStatus.ACTIVE,
		},
		departmentTitle: {
			type: String,
		},
		departmentDesc: {
			type: String,
		},
		departmentImage: {
			type: String,
		},
	},
	{ timestamps: true, collection: 'departments' },
);

export default DepartmentSchema;
