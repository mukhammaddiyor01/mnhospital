import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReceptionistService } from './receptionist.service';
import { ReceptionistResolver } from './receptionist.resolver';
import ReceptionistSchema from './schema/Receptionist.model';
import ReceptionTaskSchema from './schema/ReceptionTask.model';
import AppointmentSchema from '../../libs/schemas/Appointment.model';
import MemberSchema from '../member/schema/Member.model';
import { AuthModule } from '../auth/auth.module';
import { DoctorReportsModule } from '../doctor/doctor-reports/doctorReports.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Receptionist', schema: ReceptionistSchema },
			{ name: 'ReceptionTask', schema: ReceptionTaskSchema },
			{ name: 'Appointment', schema: AppointmentSchema },
			{ name: 'Member', schema: MemberSchema },
		]),
		AuthModule,
		DoctorReportsModule,
		AppointmentModule,
		NotificationModule,
	],
	exports: [MongooseModule],
	providers: [ReceptionistService, ReceptionistResolver],
})
export class ReceptionistModule {}
