import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadAndRegisterPhoto } from './photos';
import { ApiError } from './api/types';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal('sessionStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	});
});

describe('uploadAndRegisterPhoto', () => {
	it('mints, PUTs to storage, registers, and returns the photo', async () => {
		const photo = {
			id: 'p1',
			restaurantId: 'r1',
			authorId: 'u1',
			contentType: 'image/png',
			objectKey: 'objects/k',
			createdAt: '2030-01-01T00:00:00Z'
		};

		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					uploadUrl: 'https://s3/u?sig=x',
					objectKey: 'objects/k',
					expiresAt: '2030-01-01T00:05:00Z'
				})
			)
			.mockResolvedValueOnce(jsonResponse(photo));

		const storagePut = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', storagePut);

		const file = new File(['hi'], 'a.png', { type: 'image/png' });
		const out = await uploadAndRegisterPhoto(fetcher, 'r1', file, 'scope-1');

		expect(out).toEqual(photo);

		expect(fetcher.mock.calls[0][0]).toBe('/api/v1/user/restaurants/r1/photos/upload-url');
		expect(storagePut).toHaveBeenCalledWith(
			'https://s3/u?sig=x',
			expect.objectContaining({ method: 'PUT', body: file })
		);
		const [registerUrl, registerInit] = fetcher.mock.calls[1];
		expect(registerUrl).toBe('/api/v1/user/restaurants/r1/photos');
		expect(registerInit.headers['Idempotency-Key']).toBeTruthy();
		expect(JSON.parse(registerInit.body)).toEqual({
			contentType: 'image/png',
			objectKey: 'objects/k'
		});
	});

	it('throws if mint fails and never calls storage or register', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
		const storagePut = vi.fn();
		vi.stubGlobal('fetch', storagePut);

		const file = new File(['hi'], 'a.png', { type: 'image/png' });
		await expect(uploadAndRegisterPhoto(fetcher, 'r1', file, 's')).rejects.toBeInstanceOf(ApiError);
		expect(storagePut).not.toHaveBeenCalled();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('throws if storage PUT fails and never calls register', async () => {
		const fetcher = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				uploadUrl: 'https://s3/u',
				objectKey: 'k',
				expiresAt: '2030-01-01T00:00:00Z'
			})
		);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));

		const file = new File(['hi'], 'a.png', { type: 'image/png' });
		await expect(uploadAndRegisterPhoto(fetcher, 'r1', file, 's')).rejects.toBeInstanceOf(ApiError);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('reuses the same idempotency key across retries within the same scope', async () => {
		const photo = {
			id: 'p1',
			restaurantId: 'r1',
			authorId: 'u1',
			contentType: 'image/png',
			objectKey: 'k',
			createdAt: '2030-01-01T00:00:00Z'
		};
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ uploadUrl: 'https://s3/u', objectKey: 'k', expiresAt: 'x' })
			)
			.mockResolvedValueOnce(new Response('fail', { status: 500 }))
			.mockResolvedValueOnce(
				jsonResponse({ uploadUrl: 'https://s3/u2', objectKey: 'k', expiresAt: 'x' })
			)
			.mockResolvedValueOnce(jsonResponse(photo));
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200 })));

		const file = new File(['hi'], 'a.png', { type: 'image/png' });
		await expect(uploadAndRegisterPhoto(fetcher, 'r1', file, 'retry-scope')).rejects.toBeInstanceOf(
			ApiError
		);
		await uploadAndRegisterPhoto(fetcher, 'r1', file, 'retry-scope');

		const firstKey = fetcher.mock.calls[1][1].headers['Idempotency-Key'];
		const secondKey = fetcher.mock.calls[3][1].headers['Idempotency-Key'];
		expect(firstKey).toBe(secondKey);
	});
});
