import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorConversationSchema from './schema/DoctorConversation.model';
import DoctorMessageSchema from './schema/DoctorMessage.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'DoctorConversation', schema: DoctorConversationSchema },
			{ name: 'DoctorMessage', schema: DoctorMessageSchema },
		]),
	],
	exports: [MongooseModule],
})
export class DoctorMessageModule {}
