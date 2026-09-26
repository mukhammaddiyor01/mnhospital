import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceService } from './service.service';
import { ServiceResolver } from './service.resolver';
import ServiceSchema from './schema/Service.model';
import { AuthModule } from '../auth/auth.module';
import { ViewModule } from '../view/view.module';
import { MemberModule } from '../member/member.module';
import { DoctorModule } from '../doctor/doctor.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{
				name: 'Service',
				schema: ServiceSchema,
			},
		]),
		AuthModule,
		ViewModule,
		MemberModule,
		DoctorModule,
	],
	exports: [MongooseModule, ServiceService],
	providers: [ServiceService, ServiceResolver],
})
export class ServiceModule {}
