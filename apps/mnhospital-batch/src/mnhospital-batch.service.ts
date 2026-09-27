import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MnhospitalBatchService {
	private readonly logger = new Logger(MnhospitalBatchService.name);

	constructor(@InjectConnection() private readonly connection: Connection) {}

	public async batchRollback(): Promise<void> {
		const [services, doctors] = await Promise.all([
			this.connection.collection('services').updateMany(
				{
					serviceStatus: 'ACTIVE',
					deletedAt: { $exists: false },
				},
				{ $set: { serviceRank: 0 } },
			),
			this.connection.collection('doctors').updateMany(
				{
					memberStatus: 'ACTIVE',
					deletedAt: { $exists: false },
				},
				{ $set: { docPoints: 0 } },
			),
		]);

		this.logger.log(`Batch rollback finished: services=${services.modifiedCount}, doctors=${doctors.modifiedCount}`);
	}

	public async batchTopProperties(): Promise<void> {
		const services = await this.connection
			.collection('services')
			.find({ serviceStatus: 'ACTIVE', serviceRank: 0, deletedAt: { $exists: false } })
			.project({ _id: 1, serviceLikes: 1, serviceViews: 1, serviceComments: 1 })
			.toArray();

		await Promise.all(
			services.map((service) => {
				const serviceRank =
					Number(service.serviceLikes ?? 0) * 3 +
					Number(service.serviceViews ?? 0) +
					Number(service.serviceComments ?? 0) * 2;

				return this.connection.collection('services').updateOne(
					{ _id: service._id, serviceStatus: 'ACTIVE', serviceRank: 0, deletedAt: { $exists: false } },
					{ $set: { serviceRank } },
				);
			}),
		);

		this.logger.log(`Batch top properties finished: services=${services.length}`);
	}

	public async batchTopAgents(): Promise<void> {
		const [serviceCounters, patientCounters, doctors] = await Promise.all([
			this.connection
				.collection('services')
				.aggregate([
					{ $match: { serviceStatus: 'ACTIVE', deletedAt: { $exists: false } } },
					{ $group: { _id: '$memberId', serviceCount: { $sum: 1 } } },
				])
				.toArray(),
			this.connection
				.collection('appointment')
				.aggregate([
					{
						$match: {
							appointmentStatus: { $nin: ['CANCELLED', 'NO_SHOW'] },
							doctorId: { $exists: true },
						},
					},
					{ $group: { _id: '$doctorId', patientIds: { $addToSet: '$patientId' } } },
					{ $project: { _id: 1, patientCount: { $size: '$patientIds' } } },
				])
				.toArray(),
			this.connection
				.collection('doctors')
				.find({ memberType: 'DOCTOR', memberStatus: 'ACTIVE', docPoints: 0, deletedAt: { $exists: false } })
				.project({ _id: 1, docLikes: 1, docFollowers: 1, docArticles: 1 })
				.toArray(),
		]);

		const serviceCountByDoctor = new Map(serviceCounters.map((item) => [item._id.toString(), item.serviceCount]));
		const patientCountByDoctor = new Map(patientCounters.map((item) => [item._id.toString(), item.patientCount]));

		if (doctors.length) {
			await this.connection.collection('doctors').bulkWrite(
				doctors.map((doctor) => {
					const docServices = serviceCountByDoctor.get(doctor._id.toString()) ?? 0;
					const docPatients = patientCountByDoctor.get(doctor._id.toString()) ?? 0;
					const docPoints =
						Number(doctor.docLikes ?? 0) * 3 +
						Number(doctor.docFollowers ?? 0) * 2 +
						docPatients * 2 +
						docServices * 2 +
						Number(doctor.docArticles ?? 0);

					return {
						updateOne: {
							filter: { _id: doctor._id, memberStatus: 'ACTIVE', deletedAt: { $exists: false } },
							update: { $set: { docServices, docPatients, docPoints } },
						},
					};
				}),
			);
		}

		this.logger.log(`Batch top agents finished: doctors=${doctors.length}`);
	}

	getHello(): string {
		return 'Welcome to MNHospital BATCH  Server!';
	}
}
