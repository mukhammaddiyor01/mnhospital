import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ServiceSchema from './schema/Service.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Service', schema: ServiceSchema }])],
	exports: [MongooseModule],
})
export class ServiceModule {}
