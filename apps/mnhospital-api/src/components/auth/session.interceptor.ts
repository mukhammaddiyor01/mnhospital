import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ForbiddenException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { mergeMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import {
	checkSessionRequest,
	readRefreshCookie,
	sessionRole,
	SessionContext,
	writeRefreshCookie,
} from './session-cookie';

@Injectable()
export class SessionLoginInterceptor implements NestInterceptor {
	constructor(private readonly authService: AuthService) {}
	intercept(context: ExecutionContext, next: CallHandler) {
		const http = GqlExecutionContext.create(context).getContext<SessionContext>();
		checkSessionRequest(http);
		return next.handle().pipe(
			mergeMap(async (profile) => {
				const selectedRole = sessionRole(http.req);
				if (selectedRole && selectedRole !== profile.memberType)
					throw new ForbiddenException('Session role does not match login');
				await this.authService.logoutCredential(readRefreshCookie(http.req));
				const session = await this.authService.startSession(profile);
				writeRefreshCookie(http.res, session.refreshToken, session.cookieExpiresAt, http.req);
				profile.accessToken = session.accessToken;
				http.req.body.authMember = {
					_id: profile._id,
					memberType: profile.memberType,
					sid: session.refreshToken.slice(0, 24),
				};
				return profile;
			}),
		);
	}
}

@Injectable()
export class SessionAccessInterceptor implements NestInterceptor {
	constructor(private readonly authService: AuthService) {}
	intercept(context: ExecutionContext, next: CallHandler) {
		const gql = GqlExecutionContext.create(context);
		const http = gql.getContext<SessionContext>();
		const passwordChanged = gql.getArgs()?.input?.memberPassword !== undefined;
		if (passwordChanged) checkSessionRequest(http);
		return next.handle().pipe(
			mergeMap(async (profile) => {
				if (passwordChanged) {
					const session = await this.authService.startSession(profile);
					writeRefreshCookie(http.res, session.refreshToken, session.cookieExpiresAt, http.req);
					profile.accessToken = session.accessToken;
				} else profile.accessToken = await this.authService.createToken(profile, http.req.body.authMember.sid);
				return profile;
			}),
		);
	}
}
