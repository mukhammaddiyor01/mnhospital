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

@Module({
	imports: [AuthModule, ConfigModule, MemberModule, PatientModule, ServiceModule],
	controllers: [BookingController],
	providers: [BookingService, BookingResolver, EximbayService],
})
export class BookingModule {}
