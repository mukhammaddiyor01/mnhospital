import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DepartmentSchema from './department/schema/Department.model';
import { DepartmentResolver } from './department/department.resolver';
import { DepartmentService } from './department/department.service';
import { DoctorCommentsModule } from './doctor-comments/doctorComments.module';
import { DoctorFollowsModule } from './doctor-follows/doctorFollows.module';
import { DoctorLikesModule } from './doctor-likes/doctorLikes.module';
import { DoctorMessageModule } from './doctor-message/doctorMessage.module';
import { DoctorReportsModule } from './doctor-reports/doctorReports.module';
import { DoctorScheduleModule } from './doctor-schedule/doctorSchedule.module';
import { DoctorViewsModule } from './doctor-views/doctorViews.module';
import { DoctorResolver } from './doctor.resolver';
import { DoctorService } from './doctor.service';
import DoctorSchema from './schema/Doctor.model';
import { AuthModule } from '../auth/auth.module';
import { LikeModule } from '../like/like.module';
import FollowSchema from '../follow/schema/Follow.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Doctor', schema: DoctorSchema },
			{ name: 'Department', schema: DepartmentSchema },
		]),

		MongooseModule.forFeature([
			{
				name: 'Follow',
				schema: FollowSchema,
			},
		]),
		DoctorCommentsModule,
		forwardRef(() => DoctorFollowsModule),
		DoctorLikesModule,
		DoctorMessageModule,
		DoctorReportsModule,
		DoctorScheduleModule,
		DoctorViewsModule,
		AuthModule,
		LikeModule,
	],
	providers: [DoctorResolver, DoctorService, DepartmentResolver, DepartmentService],
	exports: [MongooseModule, DoctorService, DepartmentService],
})
export class DoctorModule {}
