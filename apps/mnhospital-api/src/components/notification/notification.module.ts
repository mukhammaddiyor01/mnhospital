import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import NoticeSchema from './schema/Notice.model';
import NotificationSchema from './schema/Notification.model';
import { NotificationService } from './notification.service';
import { NotificationResolver } from './notification.resolver';
import { NoticeService } from './notice.service';
import { NoticeResolver } from './notice.resolver';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Notification', schema: NotificationSchema },
			{ name: 'Notice', schema: NoticeSchema },
		]),
	],
	exports: [MongooseModule, NotificationService],
	providers: [NotificationService, NotificationResolver, NoticeService, NoticeResolver],
})
export class NotificationModule {}
