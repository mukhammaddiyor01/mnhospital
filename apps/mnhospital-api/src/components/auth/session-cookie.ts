import { ForbiddenException } from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';
import { MemberType } from '../member/enums/member.enum';

export const REFRESH_COOKIE = 'mn-hospital-refresh';
export interface SessionContext {
	req: Request;
	res: Response;
}

// This header selects a cookie only. Verified JWT/session ownership still grants access.
export function sessionRole(req: Request): MemberType | undefined {
	const role = req.headers['x-mn-session-role'];
	if (role === undefined) return undefined; // Existing API clients retain the legacy cookie.
	if (typeof role !== 'string' || !['PATIENT', 'DOCTOR', 'RECEPTIONIST', 'ADMIN'].includes(role))
		throw new ForbiddenException('Invalid session role selector');
	return role as MemberType;
}
function refreshCookieName(req?: Request): string {
	const role = req && sessionRole(req);
	return role ? `${REFRESH_COOKIE}-${role.toLowerCase()}` : REFRESH_COOKIE;
}

export function checkSessionRequest({ req }: SessionContext): void {
	sessionRole(req);
	const allowed = (
		process.env.AUTH_ALLOWED_ORIGINS ??
		process.env.CLIENT_URL ??
		'http://localhost:2002,http://localhost:3000'
	)
		.split(',')
		.flatMap((value) => {
			try {
				const url = new URL(value.trim());
				return ['http:', 'https:'].includes(url.protocol) ? [url.origin] : [];
			} catch {
				return [];
			}
		});
	if (
		req.headers['apollo-require-preflight'] !== 'true' ||
		(req.headers.origin && !allowed.includes(req.headers.origin))
	) {
		throw new ForbiddenException('Session request origin is not allowed');
	}
}
export function readRefreshCookie(req: Request): string {
	const name = refreshCookieName(req);
	const values = (req.headers.cookie ?? '')
		.split(';')
		.map((part) => part.trim())
		.filter((part) => part.startsWith(`${name}=`));
	if (values.length !== 1) return '';
	try {
		return decodeURIComponent(values[0].slice(name.length + 1));
	} catch {
		return '';
	}
}
export function cookieOptions(): CookieOptions {
	const secure = process.env.NODE_ENV === 'production';
	return {
		httpOnly: true,
		secure,
		sameSite: secure && process.env.AUTH_COOKIE_SAMESITE === 'none' ? 'none' : 'lax',
		path: '/graphql',
	};
}
export function writeRefreshCookie(res: Response, token: string, expiresAt: Date, req?: Request): void {
	res.cookie(refreshCookieName(req), token, { ...cookieOptions(), expires: expiresAt });
}
export function clearRefreshCookie(res: Response, req?: Request): void {
	res.clearCookie(refreshCookieName(req), cookieOptions());
}
