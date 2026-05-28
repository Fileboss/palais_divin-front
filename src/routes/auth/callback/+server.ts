import { error, redirect } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { getOidcConfig } from '$lib/server/oidc';
import {
	PKCE_COOKIE,
	RETURN_TO_COOKIE,
	STATE_COOKIE,
	sessionFromTokens,
	writeSession
} from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const expectedState = cookies.get(STATE_COOKIE);
	const codeVerifier = cookies.get(PKCE_COOKIE);
	const returnTo = cookies.get(RETURN_TO_COOKIE) ?? '/';

	cookies.delete(STATE_COOKIE, { path: '/' });
	cookies.delete(PKCE_COOKIE, { path: '/' });
	cookies.delete(RETURN_TO_COOKIE, { path: '/' });

	if (!expectedState || !codeVerifier) {
		error(400, 'Missing OAuth state — try signing in again.');
	}

	const config = await getOidcConfig();
	let tokens;
	try {
		tokens = await oidc.authorizationCodeGrant(config, url, {
			expectedState,
			pkceCodeVerifier: codeVerifier
		});
	} catch {
		error(401, 'Authentication failed.');
	}

	await writeSession(cookies, sessionFromTokens(tokens));

	const safeReturn = returnTo.startsWith('/') ? returnTo : '/';
	redirect(302, safeReturn);
};
