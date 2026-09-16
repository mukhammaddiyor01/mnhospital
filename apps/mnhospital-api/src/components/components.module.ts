import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import AppointmentSchema from '../libs/schemas/Appointment.model';
import ReportSchema from '../libs/schemas/Report.model';
import RoomSchema from '../libs/schemas/Room.model';
import ViewSchema from '../libs/schemas/View.model';
import { MemberModule } from './member/member.module';
import { ServiceModule } from './service/service.module';
import { DoctorModule } from './doctor/doctor.module';
import { AdminModule } from './admin/admin.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { PatientModule } from './patient/patient.module';
import { ArticleModule } from './article/article.module';
import { CommentModule } from './comment/comment.module';
import { FollowModule } from './follow/follow.module';
import { LikeModule } from './like/like.module';
import { NotificationModule } from './notification/notification.module';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Appointment', schema: AppointmentSchema },
			{ name: 'Room', schema: RoomSchema },
			{ name: 'Report', schema: ReportSchema },
			{ name: 'View', schema: ViewSchema },
		]),
		MemberModule,
		ServiceModule,
		DoctorModule,
		AdminModule,
		ReceptionistModule,
		PatientModule,
		ArticleModule,
		CommentModule,
		FollowModule,
		LikeModule,
		NotificationModule,
	],
	exports: [MongooseModule],
})
export class ComponentsModule {}
