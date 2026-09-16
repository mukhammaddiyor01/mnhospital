import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorViewSchema from './schema/DoctorView.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'DoctorView', schema: DoctorViewSchema }])],
	exports: [MongooseModule],
})
export class DoctorViewsModule {}
