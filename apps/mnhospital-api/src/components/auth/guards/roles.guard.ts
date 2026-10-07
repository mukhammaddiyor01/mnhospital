import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service';
import { Message } from '../../../libs/enums/common.enum';
@Injectable()
export class RolesGuard implements CanActivate {
	constructor(
		private reflector: Reflector,
		private authService: AuthService,
	) {}

	async canActivate(context: ExecutionContext | any): Promise<boolean> {
		const roles = this.reflector.get<string[]>('roles', context.getHandler());
		if (!roles?.length) throw new ForbiddenException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);

		console.info(`--- @guard() Authentication [RolesGuard]: ${roles} ---`);

		if (context.contextType === 'graphql') {
			const request = context.getArgByIndex(2).req;
			const bearerToken = request.headers.authorization;
			if (typeof bearerToken !== 'string' || !/^Bearer [^\s]+$/.test(bearerToken))
				throw new UnauthorizedException(Message.TOKEN_NOT_EXIST);

			const authMember = await this.authService.verifyToken(bearerToken.slice(7));
			if (!authMember || !roles.includes(authMember.memberType))
				throw new ForbiddenException(Message.ONLY_SPECIFIC_ROLES_ALLOWED);

			console.log('accountNick[roles] =>', authMember.memberNick ?? authMember.docNick);
			request.body.authMember = authMember;
			return true;
		}

		return false;
	}
}
