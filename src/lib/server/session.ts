import { CompactEncrypt, compactDecrypt } from 'jose';
import { env } from '$env/dynamic/private';

export interface SessionPayload {
	access_token: string;
	refresh_token: string;
	id_token: string;
	expires_at: number;
	sub: string;
	preferred_username: string;
	roles: string[];
}

let keyBytes: Uint8Array | null = null;

function getKey(): Uint8Array {
	if (keyBytes) return keyBytes;
	const secret = env.SESSION_SECRET;
	if (!secret) throw new Error('SESSION_SECRET is not set');
	const raw = Uint8Array.from(Buffer.from(secret, 'base64'));
	if (raw.length < 32) {
		throw new Error('SESSION_SECRET must decode to at least 32 bytes (got ' + raw.length + ')');
	}
	keyBytes = raw.subarray(0, 32);
	return keyBytes;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function encryptSession(payload: SessionPayload): Promise<string> {
	return new CompactEncrypt(encoder.encode(JSON.stringify(payload)))
		.setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
		.encrypt(getKey());
}

export async function decryptSession(cookie: string): Promise<SessionPayload | null> {
	try {
		const { plaintext } = await compactDecrypt(cookie, getKey());
		return JSON.parse(decoder.decode(plaintext)) as SessionPayload;
	} catch {
		return null;
	}
}
