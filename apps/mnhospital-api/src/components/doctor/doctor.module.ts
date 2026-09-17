import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DepartmentSchema from './department/schema/Department.model';
import { DoctorCommentsModule } from './doctor-comments/doctorComments.module';
import { DoctorFollowsModule } from './doctor-follows/doctorFollows.module';
import { DoctorLikesModule } from './doctor-likes/doctorLikes.module';
import { DoctorMessageModule } from './doctor-message/doctorMessage.module';
import DoctorReportSchema from './doctor-reports/schema/DoctorReport.model';
import { DoctorScheduleModule } from './doctor-schedule/doctorSchedule.module';
import { DoctorViewsModule } from './doctor-views/doctorViews.module';
import { DoctorResolver } from './doctor.resolver';
import { DoctorService } from './doctor.service';
import DoctorSchema from './schema/Doctor.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Doctor', schema: DoctorSchema },
			{ name: 'Department', schema: DepartmentSchema },
			{ name: 'DoctorReport', schema: DoctorReportSchema },
		]),
		DoctorCommentsModule,
		DoctorFollowsModule,
		DoctorLikesModule,
		DoctorMessageModule,
		DoctorScheduleModule,
		DoctorViewsModule,
	],
	exports: [MongooseModule],
	providers: [DoctorResolver, DoctorService],
})
export class DoctorModule {}
