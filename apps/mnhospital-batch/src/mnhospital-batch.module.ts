import { Module } from '@nestjs/common';
import { MnhospitalBatchController } from './mnhospital-batch.controller';
import { MnhospitalBatchService } from './mnhospital-batch.service';
import { ConfigModule } from '@nestjs/config';

@Module({
	imports: [ConfigModule.forRoot()],
	controllers: [MnhospitalBatchController],
	providers: [MnhospitalBatchService],
})
export class MnhospitalBatchModule {}
