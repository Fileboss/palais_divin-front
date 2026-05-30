import { env } from '$env/dynamic/private';
import { readSession, refreshIfNeeded } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const HOP_BY_HOP = new Set([
	'connection',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade'
]);

async function proxy(event: Parameters<RequestHandler>[0]): Promise<Response> {
	const apiBase = env.API_BASE_URL;
	if (!apiBase) return new Response('API_BASE_URL not configured', { status: 500 });

	const upstreamPath = `/api/${event.params.path}`;
	const requiresAdmin = upstreamPath.startsWith('/api/v1/admin/');
	const requiresAuth = requiresAdmin || upstreamPath.startsWith('/api/v1/user/');

	let session = await readSession(event.cookies);
	if (session) session = await refreshIfNeeded(event.cookies, session);

	if (requiresAuth && !session) {
		return new Response(
			JSON.stringify({ type: 'about:blank', title: 'Unauthorized', status: 401 }),
			{ status: 401, headers: { 'content-type': 'application/problem+json' } }
		);
	}

	if (requiresAdmin && session && !session.roles.includes('ROLE_ADMIN')) {
		return new Response(JSON.stringify({ type: 'about:blank', title: 'Forbidden', status: 403 }), {
			status: 403,
			headers: { 'content-type': 'application/problem+json' }
		});
	}

	const upstreamUrl = new URL(upstreamPath, apiBase);
	upstreamUrl.search = event.url.search;

	const headers = new Headers();
	for (const [name, value] of event.request.headers) {
		const lower = name.toLowerCase();
		if (HOP_BY_HOP.has(lower)) continue;
		if (lower === 'cookie' || lower === 'host') continue;
		headers.set(name, value);
	}
	if (session) headers.set('Authorization', `Bearer ${session.access_token}`);

	const method = event.request.method.toUpperCase();
	const body = method === 'GET' || method === 'HEAD' ? undefined : event.request.body;

	const upstream = await fetch(upstreamUrl.toString(), {
		method,
		headers,
		body,
		// @ts-expect-error — Node fetch needs this for streamed bodies
		duplex: body ? 'half' : undefined
	});

	const responseHeaders = new Headers();
	for (const [name, value] of upstream.headers) {
		if (HOP_BY_HOP.has(name.toLowerCase())) continue;
		responseHeaders.set(name, value);
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
