import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorLikeSchema from './schema/DoctorLike.model';

@Module({
	imports: [MongooseModule.forFeature([{ name: 'DoctorLike', schema: DoctorLikeSchema }])],
	exports: [MongooseModule],
})
export class DoctorLikesModule {}
