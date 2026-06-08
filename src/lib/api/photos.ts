import {
	ApiError,
	type PhotoDownloadUrlResponse,
	type PhotoResponse,
	type PhotosPageResponse,
	type PhotoUploadUrlResponse,
	type RegisterPhotoRequest
} from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

export async function mintPhotoUploadUrl(
	fetcher: Fetcher,
	restaurantId: string
): Promise<PhotoUploadUrlResponse> {
	const res = await fetcher(
		`/api/v1/user/restaurants/${encodeURIComponent(restaurantId)}/photos/upload-url`,
		{ method: 'POST', headers: { Accept: 'application/json' } }
	);
	return parseOrThrow<PhotoUploadUrlResponse>(res);
}

export async function registerPhoto(
	fetcher: Fetcher,
	restaurantId: string,
	body: RegisterPhotoRequest,
	idempotencyKey?: string
): Promise<PhotoResponse> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Accept: 'application/json'
	};
	if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
	const res = await fetcher(`/api/v1/user/restaurants/${encodeURIComponent(restaurantId)}/photos`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});
	return parseOrThrow<PhotoResponse>(res);
}

export async function getPhotoDownloadUrl(
	fetcher: Fetcher,
	restaurantId: string,
	photoId: string
): Promise<PhotoDownloadUrlResponse> {
	const res = await fetcher(
		`/api/v1/user/restaurants/${encodeURIComponent(restaurantId)}/photos/${encodeURIComponent(photoId)}/download-url`,
		{ headers: { Accept: 'application/json' } }
	);
	return parseOrThrow<PhotoDownloadUrlResponse>(res);
}

export async function listPublicRestaurantPhotos(
	fetcher: Fetcher,
	restaurantId: string,
	options: { cursor?: string; size?: number } = {}
): Promise<PhotosPageResponse> {
	const qs = new URLSearchParams();
	if (options.cursor) qs.set('cursor', options.cursor);
	if (options.size != null) qs.set('size', String(options.size));
	const base = `/api/v1/public/restaurants/${encodeURIComponent(restaurantId)}/photos`;
	const url = qs.size > 0 ? `${base}?${qs}` : base;
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<PhotosPageResponse>(res);
}

export async function uploadToObjectStorage(uploadUrl: string, file: File): Promise<void> {
	const res = await fetch(uploadUrl, {
		method: 'PUT',
		headers: { 'Content-Type': file.type },
		body: file
	});
	if (!res.ok) {
		throw new ApiError(res.status, `${res.status} ${res.statusText}`);
	}
}
