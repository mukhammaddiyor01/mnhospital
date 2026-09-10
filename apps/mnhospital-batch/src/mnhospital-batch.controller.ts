import { Controller, Get } from '@nestjs/common';
import { MnhospitalBatchService } from './mnhospital-batch.service';

@Controller()
export class MnhospitalBatchController {
	constructor(private readonly mnhospitalBatchService: MnhospitalBatchService) {}

	@Get()
	getHello(): string {
		return this.mnhospitalBatchService.getHello();
	}
}
