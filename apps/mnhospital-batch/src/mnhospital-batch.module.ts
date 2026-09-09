import { Module } from '@nestjs/common';
import { MnhospitalBatchController } from './mnhospital-batch.controller';
import { MnhospitalBatchService } from './mnhospital-batch.service';

@Module({
  imports: [],
  controllers: [MnhospitalBatchController],
  providers: [MnhospitalBatchService],
})
export class MnhospitalBatchModule {}
