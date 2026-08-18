import { error } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages';
import { listPublicRestaurantPhotos } from '$lib/api/photos';
import { getRestaurantPublic } from '$lib/api/restaurants';
import { getMyReview, listReviewsPublic } from '$lib/api/reviews';
import { ApiError, type PhotosPageResponse } from '$lib/api/types';
import type { PageServerLoad } from './$types';

const EMPTY_PHOTOS: PhotosPageResponse = {
	data: [],
	page: { hasNext: false, size: 0 }
};

function emptyOn404<T>(fallback: T) {
	return (err: unknown): T => {
		if (err instanceof ApiError && err.status === 404) return fallback;
		throw err;
	};
}

export const load: PageServerLoad = async ({ fetch, locals, params }) => {
	try {
		const sub = locals.session?.sub;
		const [restaurant, reviewsPage, myReview, photosPage] = await Promise.all([
			getRestaurantPublic(fetch, params.id),
			listReviewsPublic(fetch, params.id, { size: 20 }),
			sub ? getMyReview(fetch, params.id).catch(emptyOn404(null)) : Promise.resolve(null),
			listPublicRestaurantPhotos(fetch, params.id, { size: 20 }).catch(emptyOn404(EMPTY_PHOTOS))
		]);
		return {
			restaurant,
			reviews: reviewsPage.data,
			reviewsMeta: reviewsPage.page,
			myReview,
			photos: photosPage
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) {
			error(404, m.error_restaurant_not_found());
		}
		error(503, m.error_backend_unavailable());
	}
};
