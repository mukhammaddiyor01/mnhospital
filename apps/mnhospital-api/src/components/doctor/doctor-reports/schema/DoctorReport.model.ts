import { Schema } from 'mongoose';
import { DoctorReportFollowUp } from '../enums/doctor-report.enum';

const DoctorReportSchema = new Schema(
	{
		doctorId: {
			type: Schema.Types.ObjectId,
			ref: 'Doctor',
			required: true,
			index: true,
		},
		patientId: {
			type: Schema.Types.ObjectId,
			ref: 'Patient',
			required: true,
			index: true,
		},
		appointmentId: {
			type: Schema.Types.ObjectId,
			ref: 'Appointment',
			required: true,
			unique: true,
		},
		serviceId: {
			type: Schema.Types.ObjectId,
			ref: 'Service',
			required: true,
		},
		docReportSymptoms: {
			type: String,
			required: true,
		},
		docReportObservations: {
			type: String,
		},
		docReportDiagnosis: {
			type: String,
			required: true,
		},
		docReportRecommendation: {
			type: String,
		},
		docReportMedication: {
			type: String,
			required: true,
		},
		docReportFollowUp: {
			type: String,
			enum: DoctorReportFollowUp,
			required: true,
		},
		docReportFollowUpDate: {
			type: Date,
		},
	},
	{ timestamps: true, collection: 'doctorReports' },
);

export default DoctorReportSchema;
