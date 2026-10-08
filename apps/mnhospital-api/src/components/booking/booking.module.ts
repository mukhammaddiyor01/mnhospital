import { CheckoutService } from './checkout.service';
import { CheckoutResolver } from './checkout.resolver';
import { AppointmentModule } from '../appointment/appointment.module';
import { DoctorScheduleModule } from '../doctor/doctor-schedule/doctorSchedule.module';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { MemberModule } from '../member/member.module';
import { PatientModule } from '../patient/patient.module';
import { ServiceModule } from '../service/service.module';
import { BookingResolver } from './booking.resolver';
import { BookingService } from './booking.service';
import { EximbayService } from './eximbay.service';
import { BookingController } from './booking.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
	imports: [AuthModule, ConfigModule, MemberModule, PatientModule, ServiceModule, NotificationModule, AppointmentModule, DoctorScheduleModule],
	controllers: [BookingController],
	providers: [BookingService, BookingResolver, EximbayService, CheckoutService, CheckoutResolver],
})
export class BookingModule {}
