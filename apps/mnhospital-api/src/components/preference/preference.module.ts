import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import AdminSchema from '../admin/schema/Admin.model';
import DoctorSchema from '../doctor/schema/Doctor.model';
import MemberSchema from '../member/schema/Member.model';
import ReceptionistSchema from '../receptionist/schema/Receptionist.model';
import { PreferenceResolver } from './preference.resolver';
import { PreferenceService } from './preference.service';
import UserPreferenceSchema from './schema/UserPreference.model';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'UserPreference', schema: UserPreferenceSchema },
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Doctor', schema: DoctorSchema },
			{ name: 'Receptionist', schema: ReceptionistSchema },
			{ name: 'Admin', schema: AdminSchema },
		]),
		AuthModule,
	],
	providers: [PreferenceService, PreferenceResolver],
})
export class PreferenceModule {}
