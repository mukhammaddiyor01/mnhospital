import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection } from 'mongoose';
import { BATCH_ROLLBACK, BATCH_TOP_AGENTS, BATCH_TOP_PROPERTIES } from './batch.constants';

@Injectable()
export class MnhospitalBatchService {
	private readonly logger = new Logger(MnhospitalBatchService.name);

	constructor(@InjectConnection() private readonly connection: Connection) {}

	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: BATCH_ROLLBACK })
	public async batchRollback(): Promise<void> {
		const [services, doctors] = await Promise.all([
			this.connection.collection('services').updateMany(
				{
					$or: [
						{ serviceStatus: { $in: ['INACTIVE', 'UNAVAILABLE', 'DELETED'] } },
						{ deletedAt: { $exists: true } },
					],
				},
				{ $set: { serviceRank: 0 } },
			),
			this.connection.collection('doctors').updateMany(
				{
					$or: [
						{ memberStatus: { $in: ['BLOCK', 'DELETE'] } },
						{ deletedAt: { $exists: true } },
					],
				},
				{ $set: { docPoints: 0 } },
			),
		]);

		this.logger.log(`${BATCH_ROLLBACK} finished: services=${services.modifiedCount}, doctors=${doctors.modifiedCount}`);
	}

	@Cron('0 5 * * *', { name: BATCH_TOP_PROPERTIES })
	public async batchProperties(): Promise<void> {
		const services = await this.connection
			.collection('services')
			.aggregate([
				{ $match: { serviceStatus: 'ACTIVE', deletedAt: { $exists: false } } },
				{
					$project: {
						_id: 1,
						serviceRank: {
							$add: [
								{ $multiply: [{ $ifNull: ['$serviceLikes', 0] }, 3] },
								{ $multiply: [{ $ifNull: ['$serviceComments', 0] }, 2] },
								{ $ifNull: ['$serviceViews', 0] },
							],
						},
					},
				},
			])
			.toArray();

		if (services.length) {
			await this.connection.collection('services').bulkWrite(
				services.map((service) => ({
					updateOne: {
						filter: { _id: service._id, serviceStatus: 'ACTIVE', deletedAt: { $exists: false } },
						update: { $set: { serviceRank: service.serviceRank } },
					},
				})),
			);
		}

		this.logger.log(`${BATCH_TOP_PROPERTIES} finished: services=${services.length}`);
	}

	@Cron('0 10 * * *', { name: BATCH_TOP_AGENTS })
	public async batchAgents(): Promise<void> {
		this.logger.log(`${BATCH_TOP_AGENTS} started`);
	}

	getHello(): string {
		return 'Welcome to MNHospital BATCH  Server!';
	}
}
