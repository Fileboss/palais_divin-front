import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (!locals.session) {
		redirect(302, `/auth/login?return_to=${encodeURIComponent(url.pathname + url.search)}`);
	}
	if (!locals.session.roles.includes('ROLE_ADMIN')) {
		error(403, 'Forbidden');
	}
	return {};
};
