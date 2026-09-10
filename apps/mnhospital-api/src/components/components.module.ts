import { Module } from '@nestjs/common';
import { MemberModule } from './member/member.module';
import { ServiceModule } from './service/service.module';
import { DoctorModule } from './doctor/doctor.module';
import { AdminModule } from './admin/admin.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { PatientModule } from './patient/patient.module';

@Module({
  imports: [MemberModule, ServiceModule, DoctorModule, AdminModule, ReceptionistModule, PatientModule]
})
export class ComponentsModule {}
