import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ServiceService } from './service.service';
import { ServiceResolver } from './service.resolver';
import ServiceSchema from './schema/Service.model';
import { AuthModule } from '../auth/auth.module';
import { ViewModule } from '../view/view.module';

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
	],
	exports: [MongooseModule],
	providers: [ServiceService, ServiceResolver],
})
export class ServiceModule {}
