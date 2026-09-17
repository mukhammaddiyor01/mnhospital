import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReceptionistService } from './receptionist.service';
import { ReceptionistResolver } from './receptionist.resolver';
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
	providers: [ReceptionistService, ReceptionistResolver],
})
export class ReceptionistModule {}
