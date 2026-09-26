import { Module } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { AppointmentResolver } from './appointment.resolver';

@Module({
  providers: [AppointmentService, AppointmentResolver]
})
export class AppointmentModule {}
