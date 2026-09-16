import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import NoticeSchema from './schema/Notice.model';
import NotificationSchema from './schema/Notification.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Notification', schema: NotificationSchema },
			{ name: 'Notice', schema: NoticeSchema },
		]),
	],
	exports: [MongooseModule],
})
export class NotificationModule {}
