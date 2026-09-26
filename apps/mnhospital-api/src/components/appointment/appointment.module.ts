import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentService } from './appointment.service';
import { AppointmentResolver } from './appointment.resolver';
import AppointmentSchema from '../../libs/schemas/Appointment.model';
import { AuthModule } from '../auth/auth.module';
import { PatientModule } from '../patient/patient.module';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Appointment', schema: AppointmentSchema }]), AuthModule, PatientModule],
	providers: [AppointmentService, AppointmentResolver],
})
export class AppointmentModule {}
