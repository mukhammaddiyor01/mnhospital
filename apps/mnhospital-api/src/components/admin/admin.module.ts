import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminResolver } from './admin.resolver';
import AdminSchema from './schema/Admin.model';
import { AuthModule } from '../auth/auth.module';
import MemberSchema from '../member/schema/Member.model';
import ServiceSchema from '../service/schema/Service.model';
import { DoctorModule } from '../doctor/doctor.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: 'Admin',
				schema: AdminSchema,
			},
		]),
		MongooseModule.forFeature([
			{
				name: 'Member',
				schema: MemberSchema,
			},
			{
				name: 'Service',
				schema: ServiceSchema,
			},
		]),
		AuthModule,
		DoctorModule,
	],
	exports: [MongooseModule],
	providers: [AdminService, AdminResolver],
})
export class AdminModule {}
