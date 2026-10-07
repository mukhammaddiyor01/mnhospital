import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { AuthService } from '../src/components/auth/auth.service';
import { SessionAccessInterceptor, SessionLoginInterceptor } from '../src/components/auth/session.interceptor';

// Existing resolver integration tests mock domain persistence. Keep their authentication
// fixture independent of Mongo; production session persistence is tested separately.
@Module({
	imports: [JwtModule.register({ secret: 'resolver-fixture-secret' })],
	providers: [
		{
			provide: AuthService,
			inject: [JwtService],
			useFactory: (jwt: JwtService) => ({
				createToken: (profile: any, sid = String(new Types.ObjectId())) =>
					jwt.signAsync({ ...profile, _id: String(profile._id), sid }),
				verifyToken: async (token: string) => {
					const claims = await jwt.verifyAsync(token);
					return { ...claims, _id: new Types.ObjectId(claims._id) };
				},
				logoutCredential: async () => undefined,
				startSession: async (profile: any) => ({
					accessToken:
						profile.accessToken ??
						(await jwt.signAsync({ ...profile, _id: String(profile._id), sid: String(new Types.ObjectId()) })),
					refreshToken: 'fixture-only',
					expiresAt: new Date(Date.now() + 60000),
				}),
			}),
		},
		SessionLoginInterceptor,
		SessionAccessInterceptor,
	],
	exports: [AuthService, SessionLoginInterceptor, SessionAccessInterceptor],
})
export class TestAuthModule {}
