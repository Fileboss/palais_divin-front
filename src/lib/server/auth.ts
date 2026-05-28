import type { Cookies } from '@sveltejs/kit';
import * as oidc from 'openid-client';
import { dev } from '$app/environment';
import { getOidcConfig } from './oidc';
import { decryptSession, encryptSession, type SessionPayload } from './session';

export const SESSION_COOKIE_PREFIX = 'pd_session';
export const STATE_COOKIE = 'pd_oauth_state';
export const PKCE_COOKIE = 'pd_oauth_pkce';
export const RETURN_TO_COOKIE = 'pd_oauth_return_to';

const REFRESH_SKEW_SECONDS = 60;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const OAUTH_TMP_MAX_AGE = 5 * 60;
const COOKIE_CHUNK_SIZE = 3500;

function baseCookieOpts() {
	return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: !dev };
}

export function tempCookieOpts() {
	return { ...baseCookieOpts(), maxAge: OAUTH_TMP_MAX_AGE };
}

function chunkName(i: number) {
	return `${SESSION_COOKIE_PREFIX}.${i}`;
}

export async function readSession(cookies: Cookies): Promise<SessionPayload | null> {
	const parts: string[] = [];
	for (let i = 0; ; i++) {
		const chunk = cookies.get(chunkName(i));
		if (chunk == null) break;
		parts.push(chunk);
	}
	if (parts.length === 0) return null;
	return decryptSession(parts.join(''));
}

export async function writeSession(cookies: Cookies, payload: SessionPayload): Promise<void> {
	const enc = await encryptSession(payload);
	const numChunks = Math.max(1, Math.ceil(enc.length / COOKIE_CHUNK_SIZE));
	for (let i = 0; i < numChunks; i++) {
		const slice = enc.slice(i * COOKIE_CHUNK_SIZE, (i + 1) * COOKIE_CHUNK_SIZE);
		cookies.set(chunkName(i), slice, { ...baseCookieOpts(), maxAge: SESSION_MAX_AGE });
	}
	// Trailing chunks from a previously-larger session — drop them.
	for (let i = numChunks; ; i++) {
		if (cookies.get(chunkName(i)) == null) break;
		cookies.delete(chunkName(i), { path: '/' });
	}
}

export function clearSession(cookies: Cookies): void {
	for (const { name } of cookies.getAll()) {
		if (name.startsWith(`${SESSION_COOKIE_PREFIX}.`)) {
			cookies.delete(name, { path: '/' });
		}
	}
}

export async function refreshIfNeeded(
	cookies: Cookies,
	session: SessionPayload
): Promise<SessionPayload | null> {
	const nowSec = Math.floor(Date.now() / 1000);
	if (session.expires_at - nowSec > REFRESH_SKEW_SECONDS) return session;
	if (!session.refresh_token) {
		clearSession(cookies);
		return null;
	}
	try {
		const config = await getOidcConfig();
		const tokens = await oidc.refreshTokenGrant(config, session.refresh_token);
		const updated = sessionFromTokens(tokens, session);
		await writeSession(cookies, updated);
		return updated;
	} catch {
		clearSession(cookies);
		return null;
	}
}

export function sessionFromTokens(
	tokens: oidc.TokenEndpointResponse,
	previous?: SessionPayload
): SessionPayload {
	const accessClaims = decodeJwtClaims(tokens.access_token);
	const expiresIn = tokens.expires_in ?? 60;
	return {
		access_token: tokens.access_token,
		refresh_token: tokens.refresh_token ?? previous?.refresh_token ?? '',
		id_token: tokens.id_token ?? previous?.id_token ?? '',
		expires_at: Math.floor(Date.now() / 1000) + expiresIn,
		sub: (accessClaims?.sub as string) ?? previous?.sub ?? '',
		preferred_username:
			(accessClaims?.preferred_username as string) ?? previous?.preferred_username ?? '',
		roles: extractRoles(accessClaims) ?? previous?.roles ?? []
	};
}

function decodeJwtClaims(jwt: string): Record<string, unknown> | null {
	const parts = jwt.split('.');
	if (parts.length !== 3) return null;
	try {
		const json = Buffer.from(parts[1], 'base64url').toString('utf8');
		return JSON.parse(json);
	} catch {
		return null;
	}
}

function extractRoles(claims: Record<string, unknown> | null): string[] {
	const realmAccess = claims?.realm_access as { roles?: string[] } | undefined;
	return realmAccess?.roles ?? [];
}
