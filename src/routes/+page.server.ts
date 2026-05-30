import { error, redirect } from '@sveltejs/kit';
import { listRestaurants } from '$lib/api/restaurants';
import { ApiError } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	if (!locals.session) {
		redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
	}
	try {
		const { data, page } = await listRestaurants(fetch, { size: 20 });
		return { restaurants: data, meta: page };
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
		}
		error(503, 'Backend unavailable');
	}
};
