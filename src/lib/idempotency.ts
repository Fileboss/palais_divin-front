const PREFIX = 'idempotency_key:';

export function getOrCreateKey(scopeKey: string): string {
	const storageKey = PREFIX + scopeKey;
	const existing = sessionStorage.getItem(storageKey);
	if (existing) return existing;
	const key = crypto.randomUUID();
	sessionStorage.setItem(storageKey, key);
	return key;
}

export function clearKey(scopeKey: string): void {
	sessionStorage.removeItem(PREFIX + scopeKey);
}
