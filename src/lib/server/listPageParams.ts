// Shared query-parsing helpers for the restaurant-list-shaped pages
// (home feed, recommendations) — both parse a sort value against a valid
// set with a default, a coordinate pair, and build a `return_to`-carrying
// login URL the same way.

export function parseSortFactory<T extends string>(validSorts: readonly T[], fallback: T) {
	return (raw: string | null): T =>
		raw && (validSorts as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseCoord(raw: string | null): number | undefined {
	if (raw == null) return undefined;
	const n = Number.parseFloat(raw);
	return Number.isFinite(n) ? n : undefined;
}

export function loginUrlFor(url: URL): string {
	const returnTo = new URL(url);
	returnTo.searchParams.set('auth_retry', '1');
	return `/auth/login?return_to=${encodeURIComponent(returnTo.pathname + returnTo.search)}`;
}
