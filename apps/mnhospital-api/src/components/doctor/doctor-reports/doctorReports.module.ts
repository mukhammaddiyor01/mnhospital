import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import AppointmentSchema from '../../../libs/schemas/Appointment.model';
import { PatientModule } from '../../patient/patient.module';
import DoctorReportSchema from './schema/DoctorReport.model';
import { DoctorReportsResolver } from './doctorReports.resolver';
import { DoctorReportsService } from './doctorReports.service';
import { AuthModule } from '../../auth/auth.module';
import { NotificationModule } from '../../notification/notification.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'DoctorReport', schema: DoctorReportSchema },
			{ name: 'Appointment', schema: AppointmentSchema },
		]),
		PatientModule,
		AuthModule,
		NotificationModule,
	],
	providers: [DoctorReportsService, DoctorReportsResolver],
	exports: [MongooseModule, DoctorReportsService],
})
export class DoctorReportsModule {}
