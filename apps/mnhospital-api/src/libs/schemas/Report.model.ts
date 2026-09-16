import { Schema } from 'mongoose';
import { ReferenceGroup } from '../enums/reference.enum';
import { ReportStatus, ReportType } from '../enums/report.enum';

const ReportSchema = new Schema(
	{
		reportType: {
			type: String,
			enum: ReportType,
			required: true,
		},
		reportStatus: {
			type: String,
			enum: ReportStatus,
			default: ReportStatus.PENDING,
		},
		reportGroup: {
			type: String,
			enum: ReferenceGroup,
			required: true,
		},
		reportTitle: {
			type: String,
			required: true,
		},
		reportDesc: {
			type: String,
			required: true,
		},
		patientId: {
			type: Schema.Types.ObjectId,
			ref: 'Patient',
			required: true,
			index: true,
		},
		receptionistId: {
			type: Schema.Types.ObjectId,
			ref: 'Receptionist',
			required: true,
		},
		reportRefId: {
			type: Schema.Types.ObjectId,
			required: true,
			index: true,
		},
		resolvedByMemberId: {
			type: Schema.Types.ObjectId,
			ref: 'Member',
			required: true,
		},
		resolvedAt: {
			type: Date,
			required: true,
		},
	},
	{ timestamps: true, collection: 'reports' },
);

export default ReportSchema;
