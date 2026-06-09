import {
	ApiError,
	parseProblem,
	type CreateTagImplicationRequest,
	type CreateTagRequest,
	type RestaurantTagResponse,
	type TagCatalogResponse,
	type TagCategory,
	type TagImplicationResponse,
	type TagImplicationsResponse,
	type TagResponse
} from './types';

type Fetcher = typeof fetch;

async function parseOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const problem = await parseProblem(res);
		throw new ApiError(res.status, `${res.status} ${res.statusText}`, problem ?? undefined);
	}
	return (await res.json()) as T;
}

const PUBLIC_PATH = '/api/v1/public/tags';
const ADMIN_PATH = '/api/v1/admin/tags';
const USER_RESTAURANT_PATH = '/api/v1/user/restaurants';
const PUBLIC_IMPLICATIONS_PATH = '/api/v1/public/tag-implications';
const ADMIN_IMPLICATIONS_PATH = '/api/v1/admin/tag-implications';

export async function listTagCatalog(
	fetcher: Fetcher,
	options: { category?: TagCategory } = {}
): Promise<TagCatalogResponse> {
	const url = options.category
		? `${PUBLIC_PATH}?category=${encodeURIComponent(options.category)}`
		: PUBLIC_PATH;
	const res = await fetcher(url, { headers: { Accept: 'application/json' } });
	return parseOrThrow<TagCatalogResponse>(res);
}

export async function createTag(fetcher: Fetcher, body: CreateTagRequest): Promise<TagResponse> {
	const res = await fetcher(ADMIN_PATH, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body)
	});
	return parseOrThrow<TagResponse>(res);
}

export async function deleteTag(fetcher: Fetcher, tagId: string): Promise<void> {
	const res = await fetcher(`${ADMIN_PATH}/${encodeURIComponent(tagId)}`, { method: 'DELETE' });
	if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
}

export async function attachRestaurantTag(
	fetcher: Fetcher,
	restaurantId: string,
	tagId: string
): Promise<RestaurantTagResponse> {
	const res = await fetcher(
		`${USER_RESTAURANT_PATH}/${encodeURIComponent(restaurantId)}/tags/${encodeURIComponent(tagId)}`,
		{ method: 'POST', headers: { Accept: 'application/json' } }
	);
	return parseOrThrow<RestaurantTagResponse>(res);
}

export async function detachRestaurantTag(
	fetcher: Fetcher,
	restaurantId: string,
	tagId: string
): Promise<void> {
	const res = await fetcher(
		`${USER_RESTAURANT_PATH}/${encodeURIComponent(restaurantId)}/tags/${encodeURIComponent(tagId)}`,
		{ method: 'DELETE' }
	);
	if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
}

export async function listTagImplications(fetcher: Fetcher): Promise<TagImplicationsResponse> {
	const res = await fetcher(PUBLIC_IMPLICATIONS_PATH, { headers: { Accept: 'application/json' } });
	return parseOrThrow<TagImplicationsResponse>(res);
}

export async function createTagImplication(
	fetcher: Fetcher,
	body: CreateTagImplicationRequest
): Promise<TagImplicationResponse> {
	const res = await fetcher(ADMIN_IMPLICATIONS_PATH, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify(body)
	});
	return parseOrThrow<TagImplicationResponse>(res);
}

export async function deleteTagImplication(
	fetcher: Fetcher,
	tagId: string,
	impliesTagId: string
): Promise<void> {
	const res = await fetcher(
		`${ADMIN_IMPLICATIONS_PATH}/${encodeURIComponent(tagId)}/${encodeURIComponent(impliesTagId)}`,
		{ method: 'DELETE' }
	);
	if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
}
