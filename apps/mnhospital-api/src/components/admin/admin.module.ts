import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import AdminSchema from './schema/Admin.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'Admin', schema: AdminSchema }])],
	exports: [MongooseModule],
})
export class AdminModule {}
