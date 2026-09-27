import { Module } from '@nestjs/common';
import { MnhospitalBatchController } from './mnhospital-batch.controller';
import { MnhospitalBatchService } from './mnhospital-batch.service';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';

@Module({
	imports: [ConfigModule.forRoot(), DatabaseModule, ScheduleModule.forRoot()],
	controllers: [MnhospitalBatchController],
	providers: [MnhospitalBatchService],
})
export class MnhospitalBatchModule {}
