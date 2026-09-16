import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorScheduleSchema from './schema/DoctorSchedule.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'DoctorSchedule', schema: DoctorScheduleSchema }])],
	exports: [MongooseModule],
})
export class DoctorScheduleModule {}
