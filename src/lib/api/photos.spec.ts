import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getPhotoDownloadUrl,
	mintPhotoUploadUrl,
	registerPhoto,
	uploadToObjectStorage
} from './photos';
import { ApiError } from './types';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('mintPhotoUploadUrl', () => {
	it('POSTs to the upload-url endpoint and returns the payload', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			jsonResponse({
				uploadUrl: 'https://s3/u',
				objectKey: 'k',
				expiresAt: '2030-01-01T00:00:00Z'
			})
		);
		const out = await mintPhotoUploadUrl(fetcher, 'rest-1');
		expect(fetcher).toHaveBeenCalledWith(
			'/api/v1/user/restaurants/rest-1/photos/upload-url',
			expect.objectContaining({ method: 'POST' })
		);
		expect(out.uploadUrl).toBe('https://s3/u');
		expect(out.objectKey).toBe('k');
	});

	it('throws ApiError on non-ok', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }));
		await expect(mintPhotoUploadUrl(fetcher, 'rest-1')).rejects.toBeInstanceOf(ApiError);
	});
});

describe('registerPhoto', () => {
	it('POSTs body with Idempotency-Key when provided', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			jsonResponse({
				id: 'p1',
				restaurantId: 'rest-1',
				authorId: 'u1',
				contentType: 'image/jpeg',
				objectKey: 'k',
				createdAt: '2030-01-01T00:00:00Z'
			})
		);
		await registerPhoto(
			fetcher,
			'rest-1',
			{ contentType: 'image/jpeg', objectKey: 'k' },
			'idem-123'
		);
		const [, init] = fetcher.mock.calls[0];
		expect(init.method).toBe('POST');
		expect(init.headers['Idempotency-Key']).toBe('idem-123');
		expect(init.headers['Content-Type']).toBe('application/json');
		expect(JSON.parse(init.body)).toEqual({ contentType: 'image/jpeg', objectKey: 'k' });
	});

	it('omits Idempotency-Key when not provided', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			jsonResponse({
				id: 'p1',
				restaurantId: 'rest-1',
				authorId: 'u1',
				contentType: 'image/jpeg',
				objectKey: 'k',
				createdAt: '2030-01-01T00:00:00Z'
			})
		);
		await registerPhoto(fetcher, 'rest-1', { contentType: 'image/jpeg', objectKey: 'k' });
		const [, init] = fetcher.mock.calls[0];
		expect(init.headers['Idempotency-Key']).toBeUndefined();
	});
});

describe('getPhotoDownloadUrl', () => {
	it('GETs the download-url endpoint', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			jsonResponse({
				downloadUrl: 'https://s3/d',
				objectKey: 'k',
				expiresAt: '2030-01-01T00:00:00Z'
			})
		);
		const out = await getPhotoDownloadUrl(fetcher, 'rest-1', 'p1');
		expect(fetcher).toHaveBeenCalledWith(
			'/api/v1/user/restaurants/rest-1/photos/p1/download-url',
			expect.objectContaining({ headers: { Accept: 'application/json' } })
		);
		expect(out.downloadUrl).toBe('https://s3/d');
	});
});

describe('uploadToObjectStorage', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('PUTs the file directly to the presigned URL with its content-type', async () => {
		const spy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
		globalThis.fetch = spy as unknown as typeof fetch;
		const file = new File(['hello'], 'a.jpg', { type: 'image/jpeg' });
		await uploadToObjectStorage('https://s3/u?sig=abc', file);
		expect(spy).toHaveBeenCalledWith(
			'https://s3/u?sig=abc',
			expect.objectContaining({
				method: 'PUT',
				headers: { 'Content-Type': 'image/jpeg' },
				body: file
			})
		);
	});

	it('throws ApiError on non-ok upload', async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValue(new Response(null, { status: 403 })) as unknown as typeof fetch;
		const file = new File(['hello'], 'a.jpg', { type: 'image/jpeg' });
		await expect(uploadToObjectStorage('https://s3/u', file)).rejects.toBeInstanceOf(ApiError);
	});
});
