import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
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

export const handle: Handle = sequence(handleSession, handleParaglide);
