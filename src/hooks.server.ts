import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { dev } from '$app/environment';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { readSession, refreshIfNeeded } from '$lib/server/auth';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) =>
				html
					.replace('%paraglide.lang%', locale)
					.replace('%paraglide.dir%', getTextDirection(locale))
		});
	});

const handleSession: Handle = async ({ event, resolve }) => {
	let session = await readSession(event.cookies);
	if (session) session = await refreshIfNeeded(event.cookies, session);
	if (session) {
		event.locals.session = {
			sub: session.sub,
			username: session.preferred_username,
			roles: session.roles
		};
	}
	return resolve(event);
};

const CSP_DIRECTIVES = [
	"default-src 'self'",
	// Svelte 5 emits scoped <style> tags; tighten with nonces in a later pass.
	"style-src 'self' 'unsafe-inline'",
	"script-src 'self'",
	// Photo URLs are backend-presigned and env-dependent; allowing https: keeps
	// us flexible until the storage origin is fixed.
	"img-src 'self' data: https:",
	// LocationPicker hits Nominatim directly until the server-side geocode
	// proxy lands (see doc/missing.md).
	"connect-src 'self' https://nominatim.openstreetmap.org",
	"font-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-ancestors 'none'",
	"form-action 'self'"
].join('; ');

const DEV_CSP_DIRECTIVES = CSP_DIRECTIVES.replace(
	"script-src 'self'",
	"script-src 'self' 'unsafe-eval' 'unsafe-inline'"
)
	.replace("connect-src 'self'", "connect-src 'self' ws: http:")
	// Photos come from a local MinIO/backend over http in dev.
	.replace("img-src 'self' data: https:", "img-src 'self' data: https: http:");

const handleHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set(
		'Permissions-Policy',
		'camera=(), microphone=(), geolocation=(self), payment=()'
	);
	response.headers.set('Content-Security-Policy', dev ? DEV_CSP_DIRECTIVES : CSP_DIRECTIVES);
	return response;
};

export const handle: Handle = sequence(handleSession, handleParaglide, handleHeaders);
