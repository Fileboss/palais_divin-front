// Accepts only same-origin absolute paths. Rejects protocol-relative
// (`//evil`) and backslash-tricks (`/\evil`) that browsers resolve as
// cross-origin redirects.
export function safeReturnTo(raw: string | null | undefined): string {
	if (typeof raw !== 'string') return '/';
	if (!raw.startsWith('/')) return '/';
	if (raw.startsWith('//') || raw.startsWith('/\\')) return '/';
	return raw;
}
