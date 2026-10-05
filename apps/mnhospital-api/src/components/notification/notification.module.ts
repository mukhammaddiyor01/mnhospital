import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import NoticeSchema from './schema/Notice.model';
import NotificationSchema from './schema/Notification.model';
import { NotificationService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
import { NoticeService } from './notice.service';
import { NoticeResolver } from './notice.resolver';
import { AuthModule } from '../auth/auth.module';
import PatientSchema from '../patient/schema/Patient.model';
import { NotificationEventService } from './notification-event.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Notification', schema: NotificationSchema },
			{ name: 'Notice', schema: NoticeSchema },
			{ name: 'Patient', schema: PatientSchema },
		]),
		AuthModule,
	],
	exports: [MongooseModule, NotificationService, NotificationEventService],
	providers: [NotificationService, NotificationEventService, NotificationResolver, NoticeService, NoticeResolver],
})
export class NotificationModule {}
