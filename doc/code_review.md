# Code review — full codebase pass

Date: 2026-06-11
Scope: every committed file in `src/`, plus root config (`svelte.config.js`,
`vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`,
`package.json`), `messages/*.json`, `project.inlang/`, `doc/openapi.yaml`,
`doc/missing.md`, `HANDOFF.md`.

Grouped by severity. Each finding has a file:line anchor.

---

## Critical

### 1. Open redirect via protocol-relative `return_to`

`src/routes/auth/login/+server.ts:17` and `src/routes/auth/callback/+server.ts:49`
validate `return_to` with `startsWith('/')`. A value like `//evil.com/foo`
passes that check, but `redirect(302, '//evil.com/foo')` is interpreted by the
browser as a protocol-relative redirect to `evil.com`. Classic open redirect:
an attacker crafts `…/auth/login?return_to=//evil.com` and steals the
post-login navigation.

Fix: require `/` *and* not `//` (and not `/\`).

```ts
const safe = rawReturnTo && /^\/(?![\\/])/.test(rawReturnTo) ? rawReturnTo : '/';
```

Same fix in both files.

### 2. BFF proxy forwards everything under `/api/*` — no allowlist

`src/routes/api/[...path]/+server.ts:21-22` only treats `/api/v1/user/*` and
`/api/v1/admin/*` as auth-required. Anything else (`/api/internal/...`,
`/api/v1/anything-not-public`, `/api/actuator/health`, accidental new backend
paths…) is proxied **without authentication** and the response is streamed back
to the public internet. The SvelteKit container becomes an open mirror for
every path the backend exposes.

Fix: invert the rule. Only proxy known prefixes (`/api/v1/public/`,
`/api/v1/user/`, `/api/v1/admin/`); 404 everything else.

### 3. BFF proxy forwards upstream `Set-Cookie` and other response headers untouched

`src/routes/api/[...path]/+server.ts:68-72` copies all upstream response
headers except hop-by-hop. `Set-Cookie` is not hop-by-hop, so any cookie the
backend sets ends up on the browser scoped to `palaisdivin.lepgu.fr`. Today
the backend doesn't set cookies, but as soon as it does (CSRF token, Spring
session, etc.) those cookies leak into a domain that hosts a session cookie
under a totally different trust model. Also: `Server`, `X-Powered-By`, and any
backend-internal headers leak.

Fix: explicitly allow-list response headers (`content-type`, `content-length`,
`cache-control`, `etag`, `last-modified`, `location`, `vary`,
`content-disposition`). Strip everything else.

### 4. Forwarded request headers are also un-allowlisted

Same file, lines 44-50: every browser-supplied request header except `cookie`
and `host` is forwarded to the backend with an injected Bearer. Browsers
can't normally set `X-Forwarded-For`, but custom headers like `X-User-Id`,
`X-Tenant`, `X-Forwarded-User` *can* be sent from JS — and if the backend
ever trusts any such header, the SvelteKit proxy is the spoofing vector. The
intent of a BFF is to be the trust boundary; right now it's a transparent
forwarder of arbitrary headers with a privileged token attached.

Fix: explicitly forward only `content-type`, `content-length`, `accept`,
`accept-language`, `idempotency-key`, `if-none-match`, `if-modified-since`.
Drop the rest.

---

## High

### 5. No upstream timeout — a hung backend ties up every Node worker

`src/routes/api/[...path]/+server.ts:56` calls `fetch(upstreamUrl, ...)` with
no `signal`. If the backend hangs, the SvelteKit Node process will hold the
request forever. Add `signal: AbortSignal.timeout(15_000)` (or similar) on
both this proxy and the SSR loader calls.

### 6. N+1 `getMyReview` calls on the home page SSR

`src/routes/+page.server.ts:51-60` and `src/routes/+page.svelte:130-138` issue
one `GET /api/v1/user/restaurants/{id}/reviews` per restaurant on the page
(20 calls per page load, 20 more per "load more"). For an authenticated user
this is 20 sequential round-trips through the BFF on every navigation to `/`.
The backend should expose a batched "my reviews for this set of restaurants"
endpoint; record the gap in `doc/missing.md` (per the project rule). Until
then this dominates TTFB.

### 7. `RestaurantList` does not pass `affinity` down to `RestaurantCard`

`src/lib/components/RestaurantList.svelte:43-52` forwards `userId`, `myReview`,
etc., but never the per-restaurant affinity.
`src/lib/components/RestaurantCard.svelte:7-44` accepts an `affinity` prop and
renders the recommender count from it (`{#if affinity && affinity.recommenderCount > 0}`
line 188), but it will always be `null` when the card is used from the list.
Either drop the dead branch in `RestaurantCard`, or actually wire affinity
through `RestaurantList`.

### 8. `/restaurants/[id]` affinity fetch races on navigation

`src/routes/restaurants/[id]/+page.svelte:55-60` calls
`getRestaurantAffinity(fetch, data.restaurant.id)` from `$effect` with no
AbortController and no guard against `data.restaurant.id` changing. Rapidly
clicking between two restaurants can show restaurant A's affinity on
restaurant B's page. Use `AbortController` (or capture `id` and discard the
result if it doesn't match `data.restaurant.id` at resolution time).

### 9. Cookie chunk size is too close to the per-cookie limit

`src/lib/server/auth.ts:15` sets `COOKIE_CHUNK_SIZE = 3500`. The hard browser
limit is ~4096 bytes per cookie *including* name, attributes, and `Set-Cookie`
overhead — name (`pd_session.0`) + path/secure/httponly/samesite/maxage
attributes easily eat 80-100 bytes. With a 3500-byte value you're at ~3600
bytes — within spec but very close, and proxies/CDNs sometimes clamp earlier.
Drop to ~3000 to be safe.

Also: keeping `access_token`, `refresh_token`, and `id_token` (3 JWTs) in the
cookie means *every request* re-uploads all three. A more conventional
approach is a small opaque session id cookie + server-side store
(Redis/SQLite). At minimum this is worth flagging as the scaling cost — the
current scheme works but every restaurant-list HTTP round trip carries
~6-10KB upstream.

### 10. `<svelte:window on:keydown>` is legacy Svelte syntax in a runes-only project

`src/lib/components/PhotoGallery.svelte:60` uses `on:keydown` — Svelte 5 in
runes mode prefers `onkeydown={handleKey}`. CLAUDE.md is explicit that runes
are forced. Only `on:` directive in the codebase; convert it.

### 11. Browser hits OpenStreetMap Nominatim directly

`src/lib/components/LocationPicker.svelte:84-90` calls
`https://nominatim.openstreetmap.org/search` directly from the browser. Two
problems:

- Nominatim's [usage policy](https://operations.osmfoundation.org/policies/nominatim/)
  requires an identifying `User-Agent` or `Referer` and limits to 1 req/s.
  Browsers can't set User-Agent, and the request comes from the user's IP, so
  once the app gets traffic OSM may block it.
- It leaks the user's search queries (and IP) to a third party on every
  keystroke debounce. Privacy note worth raising.

Fix: proxy through your own `/api/public/geocode` endpoint with a cache, or
use a paid provider.

### 12. Tests cover only `photos` — none for auth, BFF, filter parsing, idempotency, redirect safety

Only `src/lib/photos.spec.ts` and `src/lib/api/photos.spec.ts` exist. The
most security-sensitive code (session encryption, refresh, proxy header
rules, `return_to` validation, the `parseFilterState` URL parser, OIDC
callback) has zero tests. At minimum add tests for:

- `parseFilterState` (handles missing values, name length cap, malformed booleans)
- `decryptSession` rejects tampered ciphertext
- `refreshIfNeeded` clears the cookie when refresh returns invalid_grant
- `return_to` validator rejects `//evil.com`, `/\evil.com`, `http://evil.com`

---

## Medium

### 13. Redirect on auth-required failure on the recommendations page can loop

`src/routes/recommendations/+page.server.ts:48-50` redirects to
`/auth/login?return_to=...` when the proxy returns 401. The proxy already
cleared the cookie at that point
(`src/routes/api/[...path]/+server.ts:64-66`), so the user lands on login,
signs in, and gets sent back to `/recommendations` — fine. But if the refresh
succeeded and the backend *still* returns 401 (e.g., the access token's
audience is mismatched), this becomes a tight redirect loop. Worth detecting
(e.g., a `?retry=1` short-circuit to display an error) or rate-limiting at the
page.

### 14. Catch-all proxy `requiresAdmin` branch doesn't refresh roles from the access token

`src/routes/api/[...path]/+server.ts:34-39` reads `session.roles` from the
*decoded* cookie. Fine for steady-state, but when a user is granted ADMIN,
their cookie still says "USER" until token refresh (up to 30 days if they stay
logged in but never get within 60s of access-token expiry). For a small site
this is acceptable, but call it out — the backend should still be the source
of truth and return 403 if the token's actual roles disagree (it already
does, presumably).

### 15. `Header.svelte` document click handler always runs, even when menu is closed

`src/lib/components/Header.svelte:29-35`: `$effect` registers a global click
handler regardless of `open`. Cheap but wasteful — register only when
`open === true`. Same pattern in `SortMenu.svelte:35-41` and
`LocationPicker.svelte:29-40` (LocationPicker at least gates on `open`).

### 16. `RestaurantFilters.svelte` collapsible header uses `role="button"` on a `<div>` and clones logic from `<details>`

`src/lib/components/RestaurantFilters.svelte:210-250` is a
`<div role="button" tabindex="0" onkeydown=…>` opening/closing a custom
section. Right next to it (`263-281`) you use the *native* `<details>` for
the same job. Either use `<button>` (semantic, keyboard, screen-reader
correct out of the box) or use `<details>` everywhere. The current
half-and-half is a small a11y regression.

### 17. `PhotoGallery` lightbox image has no alt

`src/lib/components/PhotoGallery.svelte:124-128`:
`<img src={photos[activeIndex].url} alt="">`. Decorative `alt=""` is
acceptable for a gallery — but combined with the fact the close button label
is the only accessible name on the dialog, screen-reader users have nothing
to navigate inside. Consider `alt={m.gallery_photo_aria({...})}` or at least
an `aria-describedby`.

### 18. `RestaurantTagsEditor.save` uses `Promise.all` + a shared mutable `anyFailed`

`src/lib/components/RestaurantTagsEditor.svelte:89-101`: ok in practice but
the pattern is fragile (race on `anyFailed`, no per-tag error reporting).
Also: a partial failure leaves the local `tags` un-mutated even though some
attaches/detaches succeeded on the server, producing a desync between UI and
backend. Either refetch the restaurant's tags on failure, or apply the
optimistic update per-tag.

### 19. `CreateRestaurantModal` tag attach loop swallows errors silently

`src/lib/components/CreateRestaurantModal.svelte:122-128` notes "Tag attach is
best-effort". But the user has no way to know one tag failed — they think
their selections are saved. Surface partial-tag-attach failures the same way
photo-upload failures are surfaced (lines 153-158).

### 20. `CreateRestaurantModal` `oncreated` callback signature mismatches `+page.svelte`

The component is typed `(restaurant, photos) => void`
(`src/lib/components/CreateRestaurantModal.svelte:17-18`) but
`src/routes/+page.svelte:233` passes `oncreated={handleCreated}` where
`handleCreated` (line 150) accepts only `(restaurant)`. TypeScript probably
allows this (functions are bivariant on args) but the photos parameter is
dropped silently, so newly uploaded photos don't appear on the list without a
refetch. Probably a real product bug — verify.

### 21. `getMyReview` recovery in `RestaurantCard.submitReview` overwrites the existing review

`src/lib/components/RestaurantCard.svelte:117-128`: on 409 the code blindly
calls `updateReview`, which overwrites whatever the user previously wrote. If
they previously wrote a 5★ review and after a re-render write a 1★, the
recovery silently overwrites the 5★ without showing the previous content.
Per the comment "There is no GET user endpoint" — but `getMyReview` does exist
(`src/lib/api/reviews.ts:54`). Use it to fetch the existing review first and
let the user decide.

### 22. No CSP, no `X-Content-Type-Options`, no `Permissions-Policy`

`src/app.html:1-16` has no security headers, and `hooks.server.ts` doesn't add
any. Add at least `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, and a CSP. The CSP needs
to allow `https://nominatim.openstreetmap.org` and the photo-storage origin
(once configured) — easier to design now than retrofitting under a CSP report
nightmare later.

### 23. Logout endpoint trusts `id_token_hint` from a possibly-decrypted-but-tampered cookie

`src/routes/auth/logout/+server.ts:9-19`: `clearSession` happens *before* the
redirect, so if `readSession` returns a payload the cookie was valid
(decrypts and verifies AES-GCM). Fine. Worth flagging only because `id_token`
is whatever was in the cookie — if you ever switch to unauthenticated cookie
storage this becomes a forged-logout vector. Currently safe.

### 24. `sessionFromTokens` defaults `expires_in` to 60s on missing field

`src/lib/server/auth.ts:89`: `const expiresIn = tokens.expires_in ?? 60;` —
if Keycloak ever returns a token without `expires_in`, we'll refresh every
minute. That's actually safer than over-trusting a missing value, but worth a
`console.warn` so we notice.

### 25. `oidc.None()` — public client, no client auth

`src/lib/server/oidc.ts:18-21`: correct for SPA-style PKCE. But the SvelteKit
server *is* a server; you could promote this to a confidential client with
`client_secret_basic` for defense in depth. Optional.

### 26. `idempotency.ts` non-crypto fallback

`src/lib/idempotency.ts:5-9`: the fallback path uses `Math.random()`. In every
realistic browser `crypto.randomUUID` exists; the fallback will never run.
Delete it (the project has no graceful-degradation policy I can see).

### 27. `RecommendationResponse` flat lat/lng vs `RestaurantResponse.location: CoordinatesDto`

`src/lib/api/types.ts:142-152` vs `75-89`: the wire shape is inconsistent
(flat `latitude/longitude` vs nested `location`). Backend choice, but worth
raising — it makes downstream rendering code awkward. Should land in
`doc/missing.md` as a request to normalize.

### 28. Backend-error `console.error` dumps may include user data

`src/routes/+page.server.ts:75-83` and
`src/routes/recommendations/+page.server.ts:52-62` log the problem object. If
the backend ever puts user-supplied input in `problem.detail` or
`problem.errors[].message`, you'll log it. Low risk but PII-relevant; consider
redacting or just logging status/code.

---

## Low / nits

- `src/lib/photos.spec.ts:14-18`: the `sessionStorage` stub is missing
  `length` and `key`, which is fine until a test uses them.
- `src/lib/api/photos.ts:79`: `Content-Type: file.type` — if `file.type` is
  empty (some uploads), the PUT may fail at the storage backend. Default to
  `application/octet-stream`.
- `src/lib/components/Header.svelte:10-13`: `roles?: string[]` in the local
  type, but `data.user` in `src/routes/+layout.server.ts:3` always returns
  `{ sub, username, roles }`. Drop the `?`.
- `src/lib/components/RestaurantCard.svelte:140`: `alt=""` for the thumbnail
  is correct (decorative beside a labeled link) — good.
- `src/lib/components/ReviewList.svelte:51`: falling back to
  `m.review_author({ id: shortId })` only when `authorDisplayName` is missing;
  OK, but note any "Anonymous" path is gone now that the backend always
  provides display name. Could simplify.
- `src/lib/sortLocation.ts`: `clearSortLocation` is exported but never called.
  Either wire it (when the user removes their pinned location) or drop it.
- `src/lib/i18n/tagLabel.ts`: `HANDOFF.md` proposes a fallback chain
  `labelI18n[locale] → labelI18n["en"] → label`. Today the helper does only
  the first two of three. Add `en` fallback before `label`.
- `messages/*.json`: with 7 locales and no key-coverage check at build time,
  drift is inevitable. Consider an inlang/CI lint that requires all locales to
  have the same key set.
- `src/routes/demo/+page.svelte` and `src/lib/vitest-examples/*`: scaffolding
  from `npx sv create`. Ship-blocker? No, but worth deleting before going to
  prod.
- `package.json:24-25`: `@sveltejs/adapter-auto` — CLAUDE.md flags this;
  switching to `adapter-node` is a known follow-up.
- `HANDOFF.md:113`: "Gitignored locally" — but the file is committed (`git log`
  shows it's tracked). Either gitignore it or update the comment.
- `eslint.config.js`: no `svelte/button-has-type` rule. The codebase is
  disciplined about `type="button"` (good), so adding the rule would just
  enforce what you already do.

---

## What's solid (worth keeping intact)

- The BFF concept (`+server.ts` proxy + encrypted session cookie) is the right
  shape — the issues above are tuning, not architectural.
- `jose` + AES-256-GCM + chunked cookies + ad-hoc refresh-on-read in
  `hooks.server.ts` is a clean implementation of session handling.
- `parseProblem` + `ApiError.problem` gives every API call a typed error path
  that maps to RFC 7807 — the `register/+page.svelte` field-error mapping
  (`src/routes/register/+page.svelte:19-49`) is a particularly nice use.
- Cursor-based pagination is consistently shaped
  (`PageMeta { hasNext, nextCursor, size }`) across every list endpoint.
- Runes-only Svelte 5: with one stray `on:` you're fully on the new model.
  `$bindable`, `$derived`, snippet-based reuse are used correctly.
- The `Idempotency-Key` scheme (`src/lib/idempotency.ts` + reuse across
  retries in `RestaurantCard.submitReview` / `ReviewForm` /
  `uploadAndRegisterPhoto`) is correctly implemented and tested.

---

## Top-5 prioritized fix list

1. Fix the `return_to` open-redirect (login + callback).
2. Allow-list paths/headers in the BFF proxy and strip upstream `Set-Cookie` /
   server headers.
3. Add `AbortSignal.timeout` to the BFF upstream fetch.
4. Replace `<svelte:window on:keydown>` with the runes-mode property syntax.
5. Surface the `getMyReview` N+1 in `doc/missing.md` and ask backend for a
   batched endpoint; until then, drop the per-card fetch on load and lazy-load
   when a card mounts a "your review" panel.

Items 1-4 are small and security-adjacent; reasonable to bundle in one PR.
