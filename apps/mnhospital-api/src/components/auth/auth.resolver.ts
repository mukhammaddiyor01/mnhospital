import { ForbiddenException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { Roles } from './decorators/roles.decorator';
import { AuthMember } from './decorators/authMember.decorator';
import { RolesGuard } from './guards/roles.guard';
import { MemberType } from '../member/enums/member.enum';
import { T } from '../../libs/types/common';
import { AccountPasswordInput, AccountProfileInput } from './dto/account-profile.input';
import { AuthService } from './auth.service';
import { AuthSession } from './dto/auth-session';
import {
	SessionContext,
	checkSessionRequest,
	clearRefreshCookie,
	readRefreshCookie,
	sessionRole,
	writeRefreshCookie,
} from './session-cookie';

@Resolver()
export class AuthResolver {
	constructor(private readonly authService: AuthService) {}

	@Roles(MemberType.PATIENT, MemberType.DOCTOR, MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => AuthSession)
	public async updateMyAccountProfile(
		@Args('input') input: AccountProfileInput,
		@AuthMember() actor: T,
	): Promise<AuthSession> {
		return { accessToken: await this.authService.updateAccountProfile(actor._id, actor.memberType, input, actor.sid) };
	}

	@Roles(MemberType.PATIENT, MemberType.DOCTOR, MemberType.RECEPTIONIST, MemberType.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => AuthSession)
	public async changeMyAccountPassword(
		@Args('input') input: AccountPasswordInput,
		@AuthMember() actor: T,
		@Context() context: SessionContext,
	): Promise<AuthSession> {
		checkSessionRequest(context);
		const session = await this.authService.changeAccountPassword(actor._id, actor.memberType, input);
		writeRefreshCookie(context.res, session.refreshToken, session.cookieExpiresAt, context.req);
		return { accessToken: session.accessToken };
	}

	@Mutation(() => AuthSession)
	public async refreshSession(@Context() context: SessionContext): Promise<AuthSession> {
		checkSessionRequest(context);
		try {
			const authorization = context.req.headers.authorization;
			// Role cookies renew only a tab that already holds the matching access token.
			// Cookie-only refresh remains available to legacy API clients without a role selector.
			if (sessionRole(context.req) && authorization === undefined)
				throw new ForbiddenException('Session access token is required');
			if (authorization !== undefined && (typeof authorization !== 'string' || !/^Bearer [^\s]+$/.test(authorization)))
				throw new ForbiddenException('Invalid session access token');
			const expected = typeof authorization === 'string' ? authorization.slice(7) : undefined;
			const session = await this.authService.refreshSession(readRefreshCookie(context.req), expected);
			writeRefreshCookie(context.res, session.refreshToken, session.cookieExpiresAt, context.req);
			return { accessToken: session.accessToken };
		} catch (error) {
			if (error instanceof UnauthorizedException) clearRefreshCookie(context.res, context.req);
			throw error;
		}
	}

	@Mutation(() => Boolean)
	public async logoutSession(@Context() context: SessionContext): Promise<boolean> {
		checkSessionRequest(context);
		const credential = readRefreshCookie(context.req);
		const authorization = context.req.headers.authorization;
		if (sessionRole(context.req)) {
			// A stale same-role tab must not revoke/clear the replacement account's cookie.
			if (typeof authorization !== 'string' || !/^Bearer [^\s]+$/.test(authorization))
				throw new ForbiddenException('Session access token is required');
			const sid = await this.authService.logoutAccessToken(authorization.slice(7));
			if (sid && credential.slice(0, 24) === sid) clearRefreshCookie(context.res, context.req);
		} else {
			await this.authService.logoutCredential(credential);
			if (typeof authorization === 'string' && /^Bearer [^\s]+$/.test(authorization))
				await this.authService.logoutAccessToken(authorization.slice(7));
			clearRefreshCookie(context.res, context.req);
		}
		return true;
	}
}
