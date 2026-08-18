# Deep review — code quality, security, feature coherence

Date: 2026-08-18
Scope: whole `src/` tree (not a diff review) — BFF/auth layer, API client layer,
Svelte components, routes/pages, shared utilities. Cross-referenced against
`CLAUDE.md` and `HANDOFF.md`.

Methodology: three parallel passes (security audit, code-quality pass, feature-
coherence audit), then manual end-to-end verification of the standout security
finding (cookie serialization → header transport → browser URL resolution,
tested with real `cookie`/`http`/`URL` calls, not just read-through).

This supersedes the "what's still open" parts of `doc/code_review.md`
(2026-06-11) — see the note under Critical #1 for how it relates to that
review's finding #1.

---

## Critical

### 1. Open redirect via tab-stripping bypass — `src/lib/server/safeRedirect.ts:7`

**Status: fixed.** `safeReturnTo` now resolves `raw` against a sentinel
origin via `new URL()` and only accepts it if the resolved origin matches
exactly, instead of pattern-matching prefixes — see the fix at the end of
this section. Regression-tested in `src/lib/server/safeRedirect.spec.ts`.

`safeReturnTo()` only rejects `return_to` values starting with literal `//` or
`/\`. It doesn't account for the WHATWG URL spec's tab/newline-stripping step,
which every browser applies when parsing a URL — including a `Location:`
redirect target.

Verified end-to-end:

```
cookie.serialize('pd_return_to', '/\t/evil.com', ...) → round-trips intact through Set-Cookie encode/decode
res.writeHead(302, { Location: '/\t/evil.com' })       → Node sends the tab byte as-is (valid per RFC 7230)
new URL('/\t/evil.com', 'https://palaisdivin.lepgu.fr') → resolves to https://evil.com/
```

**Attack:** attacker sends `https://palaisdivin.lepgu.fr/auth/login?return_to=%2F%09%2Fevil.com`.
Victim completes a genuine Keycloak login (real credentials, nothing spoofed up
to that point). `src/routes/auth/callback/+server.ts:50`'s `redirect(302, returnTo)`
then sends them straight to `evil.com` immediately after authenticating — sets
up a follow-on phishing page ("session expired, log in again") while the
victim's guard is down from having just completed a legitimate-looking login.

**Relation to the prior review:** `doc/code_review.md` finding #1 (2026-06-11)
flagged the original, cruder open redirect (`return_to=//evil.com`) and
proposed exactly the fix that's now in place (`raw.startsWith('//')` /
`raw.startsWith('/\\')` checks). That fix closed the literal-prefix bypass but
didn't anticipate the tab-stripping variant — so the vulnerability class is
still open, just behind a narrower gate.

**Fix:** don't pattern-match the raw string. Parse it:

```ts
export function safeReturnTo(raw: string | null | undefined): string {
	if (typeof raw !== 'string') return '/';
	try {
		const resolved = new URL(raw, PUBLIC_ORIGIN);
		return resolved.origin === PUBLIC_ORIGIN ? resolved.pathname + resolved.search : '/';
	} catch {
		return '/';
	}
}
```

This lets the same WHATWG URL parser the browser uses do the normalization,
instead of trying to out-guess it with string prefix checks.

---

## High

### 2. `recommendations.ts` never attaches `ProblemDetails` — `src/lib/api/recommendations.ts:8`

Its local `parseOrThrow` throws `new ApiError(res.status, ...)` with no third
argument, unlike `restaurants.ts`, `tags.ts`, `users.ts`, `signup.ts`, which all
call `parseProblem(res)` and attach `.problem`. Every `ApiError` from
`listRecommendations` therefore has `problem === undefined`.

Concretely: `src/routes/recommendations/+page.server.ts:66-67` logs
`err.problem?.type` / `err.problem?.title` for diagnostics — always `undefined`
here, silently killing the diagnostic branch the equivalent home-page handler
relies on.

**Fix:** make `recommendations.ts`'s error path call `parseProblem` and attach
it, same as the other API modules.

### 3. Restaurant detail page swallows all errors as empty state — `src/routes/restaurants/[id]/+page.server.ts:19`

`getMyReview` and the public photo list both catch *all* errors (not just
404/"nothing yet") and coerce to `null` / `EMPTY_PHOTOS`.

**Failure scenario:** a user who already left a review hits this page during a
transient backend 500. `myReview` becomes `null`, the page seeds `ReviewForm`
into "create" mode instead of "edit," and submitting attempts to create a
duplicate review the backend rejects with a 409 the user doesn't understand.
Photos vanish silently the same way, with no error state ever surfaced.

**Fix:** only treat a real 404 as "nothing exists yet"; re-throw or surface
other status codes as a genuine error state.

### 4. Inconsistent error-detail surfacing across forms (feature coherence)

`src/routes/register/+page.svelte:19-49` maps `ApiError.problem.errors[]` into
field-level inline errors — the only form in the app that does. Everywhere
else falls into one of two buckets:

- **API layer never attaches `.problem`:** `src/lib/api/reviews.ts:11-16`,
  `src/lib/api/connections.ts:5-10`, `src/lib/api/recommendations.ts:6-11`
  (see #2 above) all throw with 2 args only.
- **API layer attaches it, but the UI discards it:**
  `src/lib/components/CreateRestaurantModal.svelte:116-121`
  (`catch { submitError = m.error_create_failed(); }`) and
  `src/routes/admin/+page.svelte:144, 188` don't even bind `err`, despite
  `restaurants.ts`/`tags.ts` carrying the exact I11 length-cap violation
  messages (`name` max 200, `address` max 500) the backend added specifically
  so clients could surface them.

**Concrete impact:** a user who types a 250-char restaurant name gets a
generic "creation failed" instead of the specific reason, even though the
backend now sends that reason.

**Fix:** either bring `reviews.ts`/`connections.ts`/`recommendations.ts` up to
the `restaurants.ts` pattern (call `parseProblem`, attach `.problem`) and wire
`CreateRestaurantModal`/admin forms to read it the way `register` does, or
extract a shared `mapProblemToFieldErrors()` helper so every form gets this
for free instead of re-implementing it once (as `register` currently does).

### 5. Roles-fallback dead code masks a privilege-drop path — `src/lib/server/auth.ts:101`

```ts
roles: extractRoles(accessClaims) ?? previous?.roles ?? []
```

`extractRoles` (lines 116-119) always returns an array, never `null`/`undefined`
— so the `?? previous?.roles` fallback can never trigger, even though the code
visually implies it's there to preserve roles across a refresh.

**Failure scenario:** an admin's access token is refreshed and the new token's
`realm_access.roles` claim is momentarily empty/malformed. The intended
fallback to the previous session's roles never fires; the admin's roles reset
to `[]`, and admin-only UI/BFF checks (`isAdmin` in the catch-all proxy) start
failing until the next full re-login.

**Fix:** either make `extractRoles` return `null` when the claim is genuinely
absent (so `??` does something), or drop the dead fallback and handle the
empty-roles case explicitly.

### 6. `refreshIfNeeded` treats a network blip like a revoked token — `src/lib/server/auth.ts:78`

The catch-all around `refreshTokenGrant` calls `clearSession` and returns
`null` for *any* thrown error, including a transient network failure or
Keycloak outage — not just an actually-invalid refresh token.

**Failure scenario:** Keycloak has a brief blip while a user's access token is
within the 60s refresh skew window; the refresh call throws a network error,
and the user is silently logged out even though their refresh token was still
valid.

**Fix:** distinguish network/5xx errors (retry-worthy, don't clear session)
from `invalid_grant`-class errors (clear session, force re-login).

---

## Medium

### 7. Recommendations screen never got the batched "my review" treatment

`src/routes/recommendations/+page.svelte:184-218` renders a bespoke `<li>`
template — no thumbnail, no tags, no "my review" chip or inline compose —
unlike `src/routes/+page.svelte:227-239`, which passes `myReviews` into
`RestaurantList` → `RestaurantCard`. `listMyReviewsBatch` is already imported
and used on the home feed; recommendations never calls it, and there's no
`doc/missing.md` entry or TODO explaining the gap.

Given `HANDOFF.md` explicitly frames the batched lookup as the pattern going
forward ("home feed, search results, etc."), this reads as an oversight: a
signed-in user can rate a restaurant from the home feed but has no way to see
or edit that same rating from the recommendations screen showing the identical
restaurant.

### 8. Duplicate review-submission recovery logic diverges on 409

`RestaurantCard.svelte:110-127` and `ReviewForm.svelte:49-57` both implement
"create review, handle 409 already-reviewed," but diverge: `RestaurantCard`
re-fetches the existing review via `getMyReview` and recovers into an editable
state; `ReviewForm` (restaurant detail page) just sets `alreadyReviewed = true`
with a static message and no path to load/edit the existing review short of a
manual reload.

### 9. `FollowButton` shows wrong initial state on the review list

`src/routes/users/[userId]/+page.svelte:127-130` correctly seeds
`initialFollowed` from `PublicUserResponse.isFollowedByMe`. But
`ReviewList.svelte:54` renders `<FollowButton targetId={review.authorId} />`
with no `initialFollowed` — always starting from `'idle'` — because
`ReviewResponse` carries no followed-by-me flag. A user who already follows a
reviewer sees "Follow" (not "Following") next to that reviewer's name on a
restaurant's review list. Not a dead end (the 422-on-double-follow path
recovers silently), but a visibly wrong first-render state.

### 10. Mixed-language / hardcoded error strings in `+page.server.ts` load functions

- `src/routes/users/[userId]/+page.server.ts:26` → `m.error_user_not_found()` (localized, correct)
- `src/routes/restaurants/[id]/+page.server.ts:27` → hardcoded **French** `'Restaurant introuvable'` regardless of viewer locale
- `src/routes/admin/+page.server.ts:10` → hardcoded English `'Forbidden'`
- `src/routes/+page.server.ts:80,89` and `src/routes/recommendations/+page.server.ts:71` → hardcoded English `'Backend unavailable'` / `'Authentication failed for this page.'`, duplicated verbatim across two files

Same class of error (`SvelteKit error()` boundary), four different
localization treatments across five call sites.

### 11. `LocationPicker` geolocation callback fires after the panel is closed — `src/lib/components/LocationPicker.svelte:51`

`useAroundMe`'s success/error callbacks call `onpick()` / set `geoError`
unconditionally, with no check that the picker is still open.

**Failure scenario:** user clicks "Around me," the permission prompt is slow,
the user dismisses the popover in the meantime. Seconds later
`getCurrentPosition`'s success callback still fires and silently switches the
parent's sort to distance-based, even though the user closed the panel without
confirming.

### 12. Idempotency-key reuse across retries with a different body — `src/lib/photos.ts:13`

`uploadAndRegisterPhoto` mints a fresh upload URL/`objectKey` on every call,
but reuses the same `Idempotency-Key` (scoped only by `scopeKey`) across
retries — so a retry sends a genuinely different request body under a key
meant to identify one unchanging request. If the first attempt uploads to
`objectKey1` then fails at `registerPhoto` (network blip), the retry mints
`objectKey2` but calls `registerPhoto` with the *same* idempotency key as the
first attempt. If the backend enforces idempotency-key/body consistency, the
legitimate retry gets rejected. (`src/lib/photos.spec.ts:91-121` documents this
exact same-key-different-body behavior as expected — worth revisiting whether
that's actually the desired contract.)

### 13. Duplicated query-parsing/guard logic between two `+page.server.ts` files

`parseSort` / `parseCoord` / `loginUrlFor` are defined nearly identically in
both `src/routes/+page.server.ts:16-33` and
`src/routes/recommendations/+page.server.ts:15-30`, with no shared helper.

**Risk:** a future fix to `loginUrlFor` (e.g. an origin allow-list check — see
Critical #1) gets applied to one file and forgotten in the other, silently
leaving one of the two sort-aware list pages on the old behavior.

---

## Low

### 14. Unnecessary blob-URL churn in `CreateRestaurantModal` photo previews — `src/lib/components/CreateRestaurantModal.svelte:45`

`previews` (a `$derived`) calls `URL.createObjectURL` for the entire `files`
array on every add/remove, and the `#each` block keys on `preview.url`
(line 241) — so every existing thumbnail's key changes and gets
destroyed/recreated each time a new file is picked, causing visible flicker
and briefly-live duplicate blob URLs.

### 15. Missing `typeof window` guard — `src/lib/idempotency.ts:5`

`getOrCreateKey` accesses `sessionStorage` directly, unlike the sibling
`src/lib/sortLocation.ts:6`, which explicitly guards before touching
`localStorage`. Currently only invoked client-side (latent today), but any
future call from a load function or an ambiguously-timed `$effect` during
hydration throws `ReferenceError: sessionStorage is not defined` with no
try/catch.

### 16. `PhotoGallery` has no empty state — `src/lib/components/PhotoGallery.svelte:62-101`

`RestaurantList`, `ReviewList`, and the recommendations list all render an
explicit "nothing here yet" placeholder. `PhotoGallery` wraps everything in
`{#if photos.length > 0}` and renders nothing when a restaurant has zero
photos — breaks the pattern every other list in the app follows.

### 17. `RecommendationResponse.location` plumbed through but never rendered

Per I10.3, `RecommendationResponse.location: CoordinatesDto` now matches
`RestaurantResponse.location`'s shape (fixed in commit `389b9b1`), but
`src/routes/recommendations/+page.svelte` never reads `rec.location` — no
map/distance UI consumes it, unlike the identical shape on
`RestaurantResponse.location`, which *is* rendered in `RestaurantCard.svelte:184-187`
and `restaurants/[id]/+page.svelte:147-152`. Dead field; low severity, but it's
the one HANDOFF item flagged as needing UI verification and looks unverified.

---

## What's confirmed clean

Full audit (not just this diff) of: session cookie crypto (`jose` AES-256-GCM,
fails closed on decrypt/parse errors), the BFF proxy's header allowlisting in
both directions and `/api/v1/{public,user,admin}/*` gating (the June review's
Critical #2-#4 — unauthenticated-passthrough, `Set-Cookie` leakage,
un-allowlisted request headers — are all fixed and re-verified closed), PKCE +
`state` CSRF protection on the OIDC flow, prod CSP (`connect-src 'self'`, no
`unsafe-inline`/`unsafe-eval` on script/connect), the presigned-URL photo
upload flow, admin route authorization (checked server-side in `+page.server.ts`
load, not just client-side), and a repo-wide grep for XSS sinks (`{@html}`,
`innerHTML`, `eval`, etc. — zero matches) and hardcoded secrets (none found).

Path-traversal/prefix-bypass on the BFF proxy (`/api/v1/user/../admin/...`)
was tested empirically against the dev server, not just read — SvelteKit
normalizes dot-segments (including percent-encoded ones) before the route
handler sees the path, so this bypass doesn't work.

---

## Top prioritized fix list

1. Fix `safeReturnTo` to parse-and-compare-origin instead of prefix-matching (Critical #1).
2. Fix the "nothing exists yet" error-swallowing on the restaurant detail page (#3).
3. Fix the dead roles-fallback in `auth.ts` (#5) and the network-blip-as-logout behavior (#6).
4. Pick one pattern for surfacing backend field errors and apply it everywhere (#4) — biggest coherence win, unlocks the I11 validation messages the backend already sends.
5. Decide whether the recommendations screen should get the batched review treatment (#7) or is intentionally scoped out — if the latter, record that in `HANDOFF.md`/`doc/missing.md` so it doesn't look like a bug to the next contributor.
