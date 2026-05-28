import { redirect } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { env as publicEnv } from '$env/dynamic/public';
import { getOidcConfig } from '$lib/server/oidc';
import { clearSession, readSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const session = await readSession(cookies);
	clearSession(cookies);

	const config = await getOidcConfig();
	const params: Record<string, string> = {
		post_logout_redirect_uri: publicEnv.PUBLIC_ORIGIN ?? '/'
	};
	if (session?.id_token) params.id_token_hint = session.id_token;

	const endSessionUrl = oidc.buildEndSessionUrl(config, params);
	redirect(302, endSessionUrl.toString());
};
