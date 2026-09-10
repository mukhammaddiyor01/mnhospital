import { Injectable } from '@nestjs/common';

@Injectable()
export class MnhospitalBatchService {
	getHello(): string {
		return 'Welcome to MNHospital BATCH  Server!';
	}
}
