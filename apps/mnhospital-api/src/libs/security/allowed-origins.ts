/** Browser origins used by both CORS and cookie-backed session mutations. */
export function allowedBrowserOrigins(): Set<string> {
	const configured = process.env.AUTH_ALLOWED_ORIGINS ?? process.env.CLIENT_URL;
	const values = configured ?? (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:2002,http://localhost:3000');
	return new Set(
		values.split(',').flatMap((value) => {
			try {
				const candidate = value.trim();
				const url = new URL(candidate);
				// Do not silently widen an origin containing a path, query, or credentials.
				return ['http:', 'https:'].includes(url.protocol) &&
					!url.username && !url.password && !url.search && !url.hash &&
					(url.pathname === '/' || url.pathname === '')
					? [url.origin] : [];
			} catch {
				return [];
			}
		}),
	);
}

export function isAllowedBrowserOrigin(origin: string | undefined): boolean {
	return !!origin && allowedBrowserOrigins().has(origin);
}
