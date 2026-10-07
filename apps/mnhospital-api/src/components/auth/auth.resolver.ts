import { UnauthorizedException } from '@nestjs/common';
import { Context, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthSession } from './dto/auth-session';
import {
	SessionContext,
	checkSessionRequest,
	clearRefreshCookie,
	readRefreshCookie,
	writeRefreshCookie,
} from './session-cookie';

@Resolver()
export class AuthResolver {
	constructor(private readonly authService: AuthService) {}

	@Mutation(() => AuthSession)
	public async refreshSession(@Context() context: SessionContext): Promise<AuthSession> {
		checkSessionRequest(context);
		try {
			const session = await this.authService.refreshSession(readRefreshCookie(context.req));
			writeRefreshCookie(context.res, session.refreshToken, session.expiresAt);
			return { accessToken: session.accessToken };
		} catch (error) {
			if (error instanceof UnauthorizedException) clearRefreshCookie(context.res);
			throw error;
		}
	}

	@Mutation(() => Boolean)
	public async logoutSession(@Context() context: SessionContext): Promise<boolean> {
		checkSessionRequest(context);
		await this.authService.logoutCredential(readRefreshCookie(context.req));
		const authorization = context.req.headers.authorization;
		if (typeof authorization === 'string' && /^Bearer [^\s]+$/.test(authorization))
			await this.authService.logoutAccessToken(authorization.slice(7));
		clearRefreshCookie(context.res);
		return true;
	}
}
