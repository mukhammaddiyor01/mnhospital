import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentService } from './appointment.service';
import { AppointmentResolver } from './appointment.resolver';
import AppointmentSchema from '../../libs/schemas/Appointment.model';
import { AuthModule } from '../auth/auth.module';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Appointment', schema: AppointmentSchema }]), AuthModule],
	providers: [AppointmentService, AppointmentResolver],
})
export class AppointmentModule {}
