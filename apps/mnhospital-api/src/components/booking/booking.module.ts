import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PatientModule } from '../patient/patient.module';
import { ServiceModule } from '../service/service.module';
import { BookingResolver } from './booking.resolver';
import { BookingService } from './booking.service';

@Module({
	imports: [AuthModule, PatientModule, ServiceModule],
	providers: [BookingService, BookingResolver],
})
export class BookingModule {}
