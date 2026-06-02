import { redirect, error } from '@sveltejs/kit';
import { listRecommendations } from '$lib/api/recommendations';
import { ApiError } from '$lib/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	if (!locals.session) {
		redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname)}`);
	}
	try {
		const { data, page } = await listRecommendations(fetch, { size: 20 });
		return { recommendations: data, meta: page };
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname)}`);
		}
		error(503, 'Backend unavailable');
	}
};
