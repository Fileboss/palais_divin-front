import { error, redirect } from '@sveltejs/kit';
import { listRestaurants } from '$lib/api/restaurants';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	if (!locals.session) {
		redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
	}
	try {
		const { data, page } = await listRestaurants(fetch, { size: 20 });
		return { restaurants: data, meta: page };
	} catch {
		error(503, 'Backend unavailable');
	}
};
