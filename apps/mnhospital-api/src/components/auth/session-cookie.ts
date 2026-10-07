import { ForbiddenException } from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';

export const REFRESH_COOKIE = 'mn-hospital-refresh';
export interface SessionContext {
	req: Request;
	res: Response;
}

export function checkSessionRequest({ req }: SessionContext): void {
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
	const values = (req.headers.cookie ?? '')
		.split(';')
		.map((part) => part.trim())
		.filter((part) => part.startsWith(`${REFRESH_COOKIE}=`));
	if (values.length !== 1) return '';
	try {
		return decodeURIComponent(values[0].slice(REFRESH_COOKIE.length + 1));
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
export function writeRefreshCookie(res: Response, token: string, expiresAt: Date): void {
	res.cookie(REFRESH_COOKIE, token, { ...cookieOptions(), expires: expiresAt });
}
export function clearRefreshCookie(res: Response): void {
	res.clearCookie(REFRESH_COOKIE, cookieOptions());
}
