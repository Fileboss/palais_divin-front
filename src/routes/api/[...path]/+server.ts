import { env } from '$env/dynamic/private';
import { clearSession, readSession, refreshIfNeeded } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const PUBLIC_PREFIX = '/api/v1/public/';
const USER_PREFIX = '/api/v1/user/';
const ADMIN_PREFIX = '/api/v1/admin/';

const REQUEST_HEADER_ALLOWLIST = new Set([
	'content-type',
	'content-length',
	'accept',
	'accept-language',
	'idempotency-key',
	'if-none-match',
	'if-modified-since'
]);

const RESPONSE_HEADER_ALLOWLIST = new Set([
	'content-type',
	'content-length',
	'content-encoding',
	'content-disposition',
	'cache-control',
	'etag',
	'last-modified',
	'location',
	'vary'
]);

async function proxy(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const apiBase = env.API_BASE_URL;
	if (!apiBase) return new Response('API_BASE_URL not configured', { status: 500 });

	const upstreamPath = `/api/${event.params.path}`;
	const isPublic = upstreamPath.startsWith(PUBLIC_PREFIX);
	const isUser = upstreamPath.startsWith(USER_PREFIX);
	const isAdmin = upstreamPath.startsWith(ADMIN_PREFIX);

	if (!isPublic && !isUser && !isAdmin) {
		return new Response('Not Found', { status: 404 });
	}

	let session = await readSession(event.cookies);
	if (session) session = await refreshIfNeeded(event.cookies, session);

	if ((isUser || isAdmin) && !session) {
		return new Response(
			JSON.stringify({ type: 'about:blank', title: 'Unauthorized', status: 401 }),
			{ status: 401, headers: { 'content-type': 'application/problem+json' } }
		);
	}

	if (isAdmin && session && !session.roles.includes('ADMIN')) {
		return new Response(JSON.stringify({ type: 'about:blank', title: 'Forbidden', status: 403 }), {
			status: 403,
			headers: { 'content-type': 'application/problem+json' }
		});
	}

	const upstreamUrl = new URL(upstreamPath, apiBase);
	upstreamUrl.search = event.url.search;

	const headers = new Headers();
	for (const [name, value] of event.request.headers) {
		if (REQUEST_HEADER_ALLOWLIST.has(name.toLowerCase())) {
			headers.set(name, value);
		}
	}
	if (session) headers.set('Authorization', `Bearer ${session.access_token}`);

	const method = event.request.method.toUpperCase();
	const body = method === 'GET' || method === 'HEAD' ? undefined : event.request.body;

	let upstream: Response;
	try {
		upstream = await fetch(upstreamUrl.toString(), {
			method,
			headers,
			body,
			signal: AbortSignal.timeout(15_000),
			// @ts-expect-error — Node fetch needs this for streamed bodies
			duplex: body ? 'half' : undefined
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === 'TimeoutError') {
			return new Response(
				JSON.stringify({ type: 'about:blank', title: 'Gateway Timeout', status: 504 }),
				{ status: 504, headers: { 'content-type': 'application/problem+json' } }
			);
		}
		throw err;
	}

	if (upstream.status === 401 && (isUser || isAdmin) && session) {
		clearSession(event.cookies);
	}

	const responseHeaders = new Headers();
	for (const [name, value] of upstream.headers) {
		if (RESPONSE_HEADER_ALLOWLIST.has(name.toLowerCase())) {
			responseHeaders.set(name, value);
		}
	}

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: responseHeaders
	});
}

export const GET: RequestHandler = (event) => proxy(event);
export const POST: RequestHandler = (event) => proxy(event);
export const PUT: RequestHandler = (event) => proxy(event);
export const PATCH: RequestHandler = (event) => proxy(event);
export const DELETE: RequestHandler = (event) => proxy(event);
