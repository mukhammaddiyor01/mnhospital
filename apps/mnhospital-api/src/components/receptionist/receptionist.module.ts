import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ReceptionistSchema from './schema/Receptionist.model';
import ReceptionTaskSchema from './schema/ReceptionTask.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'Receptionist', schema: ReceptionistSchema },
			{ name: 'ReceptionTask', schema: ReceptionTaskSchema },
		]),
	],
	exports: [MongooseModule],
})
export class ReceptionistModule {}
