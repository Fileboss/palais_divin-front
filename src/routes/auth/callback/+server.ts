import { error, redirect } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { dev } from '$app/environment';
import { getOidcConfig } from '$lib/server/oidc';
import {
	PKCE_COOKIE,
	RETURN_TO_COOKIE,
	STATE_COOKIE,
	sessionFromTokens,
	writeSession
} from '$lib/server/auth';
import { safeReturnTo } from '$lib/server/safeRedirect';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, request }) => {
	const expectedState = cookies.get(STATE_COOKIE);
	const codeVerifier = cookies.get(PKCE_COOKIE);
	const returnTo = safeReturnTo(cookies.get(RETURN_TO_COOKIE));

	cookies.delete(STATE_COOKIE, { path: '/' });
	cookies.delete(PKCE_COOKIE, { path: '/' });
	cookies.delete(RETURN_TO_COOKIE, { path: '/' });

	if (!expectedState || !codeVerifier) {
		if (dev) {
			const cookieHeader = request.headers.get('cookie') ?? '<empty>';
			const names = cookieHeader === '<empty>' ? [] : cookieHeader.split(';').map((c) => c.split('=')[0].trim());
			console.error('[auth/callback] missing OAuth state cookies');
			console.error('  state cookie present:', Boolean(expectedState));
			console.error('  pkce cookie present:', Boolean(codeVerifier));
			console.error('  cookies received:', names);
			console.error('  referer:', request.headers.get('referer'));
		}
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

	redirect(302, returnTo);
};
