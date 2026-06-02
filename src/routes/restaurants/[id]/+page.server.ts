import { error } from '@sveltejs/kit';
import { getRestaurantPublic } from '$lib/api/restaurants';
import { getMyReview, listReviewsPublic } from '$lib/api/reviews';
import { ApiError } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, locals, params }) => {
	try {
		const sub = locals.session?.sub;
		const [restaurant, reviewsPage, myReview] = await Promise.all([
			getRestaurantPublic(fetch, params.id),
			listReviewsPublic(fetch, params.id, { size: 20 }),
			sub ? getMyReview(fetch, params.id).catch(() => null) : Promise.resolve(null)
		]);
		return {
			restaurant,
			reviews: reviewsPage.data,
			reviewsMeta: reviewsPage.page,
			myReview
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 404) {
			error(404, 'Restaurant introuvable');
		}
		error(503, 'Backend unavailable');
	}
};
