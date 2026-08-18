// Resolves `raw` against a private sentinel origin and only accepts it if it
// stays on that origin. Delegates to the same WHATWG URL parser a browser
// uses (tab/newline stripping, backslash-as-slash, userinfo tricks, etc.)
// instead of re-implementing prefix checks that URL normalization can bypass.
const SENTINEL_ORIGIN = 'http://safe-redirect.internal';

export function safeReturnTo(raw: string | null | undefined): string {
	if (typeof raw !== 'string') return '/';
	try {
		const resolved = new URL(raw, SENTINEL_ORIGIN);
		if (resolved.origin !== SENTINEL_ORIGIN) return '/';
		return resolved.pathname + resolved.search + resolved.hash;
	} catch {
		return '/';
	}
}
