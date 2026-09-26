import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import AppointmentSchema from '../../../libs/schemas/Appointment.model';
import { PatientModule } from '../../patient/patient.module';
import DoctorReportSchema from './schema/DoctorReport.model';
import { DoctorReportsResolver } from './doctorReports.resolver';
import { DoctorReportsService } from './doctorReports.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'DoctorReport', schema: DoctorReportSchema },
			{ name: 'Appointment', schema: AppointmentSchema },
		]),
		PatientModule,
	],
	providers: [DoctorReportsService, DoctorReportsResolver],
	exports: [MongooseModule, DoctorReportsService],
})
export class DoctorReportsModule {}
