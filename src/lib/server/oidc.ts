import * as oidc from 'openid-client';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

let configPromise: Promise<oidc.Configuration> | null = null;

export function getOidcConfig(): Promise<oidc.Configuration> {
	if (!configPromise) {
		const issuer = env.KEYCLOAK_ISSUER_URI;
		const clientId = env.OIDC_CLIENT_ID;
		if (!issuer) throw new Error('KEYCLOAK_ISSUER_URI is not set');
		if (!clientId) throw new Error('OIDC_CLIENT_ID is not set');
		configPromise = oidc.discovery(
			new URL(issuer),
			clientId,
			undefined,
			oidc.None(),
			dev ? { execute: [oidc.allowInsecureRequests] } : undefined
		);
	}
	return configPromise;
}

export function redirectUri(): string {
	const origin = publicEnv.PUBLIC_ORIGIN;
	if (!origin) throw new Error('PUBLIC_ORIGIN is not set');
	return new URL('/auth/callback', origin).toString();
}
