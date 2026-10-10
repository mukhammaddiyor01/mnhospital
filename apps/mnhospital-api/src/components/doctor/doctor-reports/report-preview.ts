import { PipelineStage } from 'mongoose';
export function reportPreview(): (PipelineStage.Lookup | PipelineStage.Set | PipelineStage.Unset)[] {
	return [
		{
			$lookup: {
				from: 'appointment',
				localField: 'appointmentId',
				foreignField: '_id',
				pipeline: [{ $project: { appointmentCode: 1, appointmentReason: 1, startsAt: 1 } }],
				as: 'visit',
			},
		},
		{
			$lookup: {
				from: 'patients',
				localField: 'patientId',
				foreignField: '_id',
				pipeline: [{ $project: { patientFullName: 1 } }],
				as: 'patient',
			},
		},
		{
			$set: {
				appointmentCode: { $arrayElemAt: ['$visit.appointmentCode', 0] },
				serviceName: { $arrayElemAt: ['$visit.appointmentReason', 0] },
				visitAt: { $arrayElemAt: ['$visit.startsAt', 0] },
				patientName: { $arrayElemAt: ['$patient.patientFullName', 0] },
			},
		},
		{ $unset: ['visit', 'patient'] },
	];
}
