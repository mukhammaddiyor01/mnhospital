import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import AdminSchema from '../admin/schema/Admin.model';
import DoctorSchema from '../doctor/schema/Doctor.model';
import ConversationSchema from '../member/schema/Conversation.model';
import MemberSchema from '../member/schema/Member.model';
import MessageSchema from '../member/schema/Message.model';
import ReceptionistSchema from '../receptionist/schema/Receptionist.model';
import { NotificationModule } from '../notification/notification.module';
import { MessagingResolver } from './messaging.resolver';
import { MessagingService } from './messaging.service';
import { MessagingEventsService } from './messaging-events.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Conversation', schema: ConversationSchema },
			{ name: 'Message', schema: MessageSchema },
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Doctor', schema: DoctorSchema },
			{ name: 'Receptionist', schema: ReceptionistSchema },
			{ name: 'Admin', schema: AdminSchema },
		]),
		AuthModule,
		NotificationModule,
	],
	providers: [MessagingService, MessagingResolver, MessagingEventsService],
	exports: [MessagingService, MessagingEventsService],
})
export class MessagingModule {}
