import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import MemberSchema from '../member/schema/Member.model';
import DoctorSchema from '../doctor/schema/Doctor.model';
import ReceptionistSchema from '../receptionist/schema/Receptionist.model';
import AdminSchema from '../admin/schema/Admin.model';
import RefreshTokenSchema from '../member/schema/RefreshToken.model';
import { AuthResolver } from './auth.resolver';
import { SessionAccessInterceptor, SessionLoginInterceptor } from './session.interceptor';

@Module({
	imports: [
		JwtModule.registerAsync({
			useFactory: () => {
				if (!process.env.SECRET_TOKEN) throw new Error('SECRET_TOKEN is required');
				return { secret: process.env.SECRET_TOKEN, signOptions: { expiresIn: '15m' } };
			},
		}),
		MongooseModule.forFeature([
			{ name: 'Member', schema: MemberSchema },
			{ name: 'Doctor', schema: DoctorSchema },
			{ name: 'Receptionist', schema: ReceptionistSchema },
			{ name: 'Admin', schema: AdminSchema },
			{ name: 'RefreshToken', schema: RefreshTokenSchema },
		]),
	],
	providers: [AuthService, AuthResolver, SessionLoginInterceptor, SessionAccessInterceptor],
	exports: [AuthService, SessionLoginInterceptor, SessionAccessInterceptor],
})
export class AuthModule {}
