import { Controller, Get, Logger } from '@nestjs/common';
import { Cron, Timeout } from '@nestjs/schedule';
import { MnhospitalBatchService } from './mnhospital-batch.service';
import { BATCH_ROLLBACK, BATCH_TOP_AGENTS, BATCH_TOP_PROPERTIES } from './batch.constants';

@Controller()
export class MnhospitalBatchController {
	private readonly logger = new Logger(MnhospitalBatchController.name);

	constructor(private readonly mnhospitalBatchService: MnhospitalBatchService) {}

	@Timeout(1000)
	handleTimeout(): void {
		this.logger.debug('BATCH SERVER READY!');
	}

	@Cron('0 0 1 * * *', { name: BATCH_ROLLBACK })
	public async batchRollback(): Promise<void> {
		try {
			this.logger.debug(`${BATCH_ROLLBACK} EXECUTED!`);
			await this.mnhospitalBatchService.batchRollback();
		} catch (error) {
			this.logger.error(`${BATCH_ROLLBACK} FAILED`, error instanceof Error ? error.stack : String(error));
		}
	}

	@Cron('20 0 1 * * *', { name: BATCH_TOP_PROPERTIES })
	public async batchTopProperties(): Promise<void> {
		try {
			this.logger.debug(`${BATCH_TOP_PROPERTIES} EXECUTED!`);
			await this.mnhospitalBatchService.batchTopProperties();
		} catch (error) {
			this.logger.error(`${BATCH_TOP_PROPERTIES} FAILED`, error instanceof Error ? error.stack : String(error));
		}
	}

	@Cron('40 0 1 * * *', { name: BATCH_TOP_AGENTS })
	public async batchTopAgents(): Promise<void> {
		try {
			this.logger.debug(`${BATCH_TOP_AGENTS} EXECUTED!`);
			await this.mnhospitalBatchService.batchTopAgents();
		} catch (error) {
			this.logger.error(`${BATCH_TOP_AGENTS} FAILED`, error instanceof Error ? error.stack : String(error));
		}
	}

	@Get()
	getHello(): string {
		return this.mnhospitalBatchService.getHello();
	}
}
