import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BATCH_ROLLBACK, BATCH_TOP_AGENTS, BATCH_TOP_PROPERTIES } from './batch.constants';

@Injectable()
export class MnhospitalBatchService {
	private readonly logger = new Logger(MnhospitalBatchService.name);

	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: BATCH_ROLLBACK })
	public async batchRollback(): Promise<void> {
		this.logger.log(`${BATCH_ROLLBACK} started`);
	}

	@Cron('0 5 * * *', { name: BATCH_TOP_PROPERTIES })
	public async batchProperties(): Promise<void> {
		this.logger.log(`${BATCH_TOP_PROPERTIES} started`);
	}

	@Cron('0 10 * * *', { name: BATCH_TOP_AGENTS })
	public async batchAgents(): Promise<void> {
		this.logger.log(`${BATCH_TOP_AGENTS} started`);
	}

	getHello(): string {
		return 'Welcome to MNHospital BATCH  Server!';
	}
}
