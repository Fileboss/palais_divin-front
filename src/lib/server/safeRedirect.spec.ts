import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './safeRedirect';

describe('safeReturnTo', () => {
	it('passes through plain relative paths unchanged', () => {
		expect(safeReturnTo('/recommendations')).toBe('/recommendations');
		expect(safeReturnTo('/restaurants/abc?x=1')).toBe('/restaurants/abc?x=1');
	});

	it('defaults to / for missing or non-string input', () => {
		expect(safeReturnTo(null)).toBe('/');
		expect(safeReturnTo(undefined)).toBe('/');
		expect(safeReturnTo('')).toBe('/');
	});

	it('rejects protocol-relative and absolute cross-origin values', () => {
		expect(safeReturnTo('//evil.com')).toBe('/');
		expect(safeReturnTo('/\\evil.com')).toBe('/');
		expect(safeReturnTo('http://evil.com')).toBe('/');
		expect(safeReturnTo('https://evil.com')).toBe('/');
	});

	it('rejects the tab/newline-stripping bypass', () => {
		expect(safeReturnTo('/\t/evil.com')).toBe('/');
		expect(safeReturnTo('/\n/evil.com')).toBe('/');
	});

	it('resolves a leading-backslash value as a same-origin relative path', () => {
		// No leading `/`, so this is a relative (not network-path) reference —
		// it resolves onto our own origin as `/evil.com`, not a bypass.
		expect(safeReturnTo('\\evil.com')).toBe('/evil.com');
	});

	it('does not misread a userinfo segment as pointing off-origin', () => {
		expect(safeReturnTo('/@evil.com')).toBe('/@evil.com');
	});
});
