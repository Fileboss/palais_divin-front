import { redirect } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { getOidcConfig, redirectUri } from '$lib/server/oidc';
import { PKCE_COOKIE, RETURN_TO_COOKIE, STATE_COOKIE, tempCookieOpts } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const config = await getOidcConfig();
	const state = oidc.randomState();
	const codeVerifier = oidc.randomPKCECodeVerifier();
	const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

	cookies.set(STATE_COOKIE, state, tempCookieOpts());
	cookies.set(PKCE_COOKIE, codeVerifier, tempCookieOpts());

	const rawReturnTo = url.searchParams.get('return_to');
	const returnTo = rawReturnTo && rawReturnTo.startsWith('/') ? rawReturnTo : '/';
	cookies.set(RETURN_TO_COOKIE, returnTo, tempCookieOpts());

	const authorizationUrl = oidc.buildAuthorizationUrl(config, {
		scope: 'openid profile email',
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
		state,
		redirect_uri: redirectUri()
	});

	redirect(302, authorizationUrl.toString());
};
