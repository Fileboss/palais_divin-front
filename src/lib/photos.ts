import { mintPhotoUploadUrl, registerPhoto, uploadToObjectStorage } from '$lib/api/photos';
import type { PhotoResponse } from '$lib/api/types';
import { clearKey, getOrCreateKey } from '$lib/idempotency';

type Fetcher = typeof fetch;

export async function uploadAndRegisterPhoto(
	fetcher: Fetcher,
	restaurantId: string,
	file: File,
	scopeKey: string
): Promise<PhotoResponse> {
	const minted = await mintPhotoUploadUrl(fetcher, restaurantId);
	await uploadToObjectStorage(minted.uploadUrl, file);
	const key = getOrCreateKey(scopeKey);
	const photo = await registerPhoto(
		fetcher,
		restaurantId,
		{ contentType: file.type, objectKey: minted.objectKey },
		key
	);
	clearKey(scopeKey);
	return photo;
}
