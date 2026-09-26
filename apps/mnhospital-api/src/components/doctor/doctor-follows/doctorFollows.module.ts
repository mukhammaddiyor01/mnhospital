import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorFollowSchema from './schema/DoctorFollow.model';
import { DoctorFollowResolver } from './doctorFollow.resolver';
import { DoctorFollowService } from './doctorFollow.service';
import { AuthModule } from '../../auth/auth.module';
import { LikeModule } from '../../like/like.module';
import { MemberModule } from '../../member/member.module';
import { DoctorModule } from '../doctor.module';

@Module({
	imports: [
		MongooseModule.forFeature([{ name: 'DoctorFollow', schema: DoctorFollowSchema }]),
		forwardRef(() => DoctorModule),
		AuthModule,
		LikeModule,
		MemberModule,
	],
	exports: [MongooseModule, DoctorFollowService],
	providers: [DoctorFollowService, DoctorFollowResolver],
})
export class DoctorFollowsModule {}
