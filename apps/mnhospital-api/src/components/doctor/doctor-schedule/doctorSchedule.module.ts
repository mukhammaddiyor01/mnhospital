import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorScheduleSchema from './schema/DoctorSchedule.model';
import DoctorSchema from '../schema/Doctor.model';
import ServiceSchema from '../../service/schema/Service.model';
import AppointmentSchema from '../../../libs/schemas/Appointment.model';
import { DoctorScheduleResolver } from './doctorSchedule.resolver';
import { DoctorScheduleService } from './doctorSchedule.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'DoctorSchedule', schema: DoctorScheduleSchema },
			{ name: 'Doctor', schema: DoctorSchema },
			{ name: 'Service', schema: ServiceSchema },
			{ name: 'Appointment', schema: AppointmentSchema },
		]),
	],
	exports: [MongooseModule],
	providers: [DoctorScheduleService, DoctorScheduleResolver],
})
export class DoctorScheduleModule {}
