import { PipelineStage } from 'mongoose';

// Only attach identity to rows already scoped by the staff appointment query.
export function appointmentPatientPreview(): (PipelineStage.Lookup | PipelineStage.Set)[] {
	return [
		{
			$lookup: {
				from: 'patients',
				localField: 'patientId',
				foreignField: '_id',
				pipeline: [
					{ $match: { deletedAt: { $exists: false } } },
					{ $project: { _id: 0, patientFullName: 1, patientImage: 1 } },
				],
				as: 'patientPreview',
			},
		},
		{ $set: { patientPreview: { $arrayElemAt: ['$patientPreview', 0] } } },
	];
}
