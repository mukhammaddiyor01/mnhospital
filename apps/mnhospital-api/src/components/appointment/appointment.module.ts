import RoomSchema from '../../libs/schemas/Room.model';
import { RoomResolver } from './room.resolver';
import { RoomService } from './room.service';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentService } from './appointment.service';
import { AppointmentResolver } from './appointment.resolver';
import AppointmentSchema from '../../libs/schemas/Appointment.model';
import { AuthModule } from '../auth/auth.module';
import { PatientModule } from '../patient/patient.module';
import ReceptionTaskSchema from '../receptionist/schema/ReceptionTask.model';
import { NotificationModule } from '../notification/notification.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Appointment', schema: AppointmentSchema },
			{ name: 'Room', schema: RoomSchema },
			{ name: 'ReceptionTask', schema: ReceptionTaskSchema },
		]),
		AuthModule,
		PatientModule,
		NotificationModule,
	],
	providers: [AppointmentService, AppointmentResolver, RoomService, RoomResolver],
	exports: [AppointmentService],
})
export class AppointmentModule {}
