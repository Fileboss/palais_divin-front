<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import type {
		RestaurantAffinityResponse,
		RestaurantResponse,
		ReviewResponse
	} from '$lib/api/types';
	import { ApiError } from '$lib/api/types';
	import { createReview, updateReview } from '$lib/api/reviews';
	import { deleteRestaurant } from '$lib/api/restaurants';
	import { getOrCreateKey, clearKey } from '$lib/idempotency';

	let {
		restaurant,
		showMyReview = false,
		affinity = null,
		userId = null,
		myReview = null,
		isAdmin = false,
		onreviewchange,
		ondelete
	}: {
		restaurant: RestaurantResponse;
		showMyReview?: boolean;
		affinity?: RestaurantAffinityResponse | null;
		userId?: string | null;
		myReview?: ReviewResponse | null;
		isAdmin?: boolean;
		onreviewchange?: (review: ReviewResponse) => void;
		ondelete?: (id: string) => void;
	} = $props();

	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	async function handleDelete() {
		if (!confirm(m.restaurant_delete_confirm())) return;
		deleting = true;
		deleteError = null;
		try {
			await deleteRestaurant(fetch, restaurant.id);
			ondelete?.(restaurant.id);
		} catch {
			deleteError = m.error_delete_failed();
			deleting = false;
		}
	}

	const createdAt = $derived(
		new Date(restaurant.createdAt).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})
	);

	const avgRatingLabel = $derived(
		typeof restaurant.avgRating === 'number' && restaurant.avgRating > 0
			? restaurant.avgRating.toLocaleString(getLocale(), {
					minimumFractionDigits: 1,
					maximumFractionDigits: 1
				})
			: null
	);

	type ReviewState = 'idle' | 'composing' | 'submitting';
	let reviewState = $state<ReviewState>('idle');
	let selectedRating = $state(0);
	let comment = $state('');
	let reviewError = $state<string | null>(null);

	function startCompose() {
		selectedRating = myReview?.rating ?? 0;
		comment = myReview?.comment ?? '';
		reviewState = 'composing';
		reviewError = null;
	}

	function cancelCompose() {
		reviewState = 'idle';
		selectedRating = 0;
		comment = '';
		reviewError = null;
	}

	async function submitReview() {
		if (selectedRating < 1 || reviewState === 'submitting') return;
		reviewState = 'submitting';
		reviewError = null;
		const scopeKey = `review:${restaurant.id}`;
		const body = { rating: selectedRating, comment: comment.trim() || undefined };
		try {
			let saved: ReviewResponse;
			if (myReview) {
				saved = await updateReview(fetch, restaurant.id, body);
			} else {
				const key = getOrCreateKey(scopeKey);
				saved = await createReview(fetch, restaurant.id, body, key);
				clearKey(scopeKey);
			}
			onreviewchange?.(saved);
			reviewState = 'idle';
		} catch (err) {
			if (err instanceof ApiError && err.status === 409 && !myReview) {
				// A review already exists but we don't have it locally (e.g. after navigation).
				// There is no GET user endpoint, so recover by updating with the same data.
				try {
					const recovered = await updateReview(fetch, restaurant.id, body);
					onreviewchange?.(recovered);
					reviewState = 'idle';
					clearKey(scopeKey);
					return;
				} catch {
					// fall through to generic error
				}
			}
			reviewError = m.error_review_failed();
			reviewState = 'composing';
		}
	}
</script>

<article
	class="flex flex-row overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
>
	<div class="flex flex-1 flex-col gap-2 p-4">
		<h3 class="text-base font-semibold text-stone-900">{restaurant.name}</h3>
		{#if restaurant.address}
			<p class="text-sm text-stone-600">{restaurant.address}</p>
		{/if}
		<p class="text-sm">
			{#if avgRatingLabel}
				<span class="text-amber-400" aria-hidden="true">★</span>
				<span class="font-medium text-stone-700">{avgRatingLabel}</span>
			{:else}
				<span class="text-stone-400">{m.review_no_ratings_yet()}</span>
			{/if}
		</p>
		{#if affinity && affinity.recommenderCount > 0}
			<p class="text-sm font-medium text-emerald-600">
				{m.recommendations_recommenders({ count: affinity.recommenderCount })}
			</p>
		{/if}
		<p class="mt-auto text-xs text-stone-400">
			{#if restaurant.location}
				{restaurant.location.latitude.toFixed(4)}, {restaurant.location.longitude.toFixed(4)}
				<span class="mx-1" aria-hidden="true">·</span>
			{/if}
			<time datetime={restaurant.createdAt}>{createdAt}</time>
		</p>
		{#if isAdmin}
			<div class="flex flex-col gap-1">
				<button
					type="button"
					onclick={handleDelete}
					disabled={deleting}
					class="self-start rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
				>
					{deleting ? '…' : m.restaurant_delete()}
				</button>
				{#if deleteError}
					<p class="text-xs text-red-600">{deleteError}</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if showMyReview && userId}
		<div class="w-px self-stretch bg-stone-100"></div>

		<div class="flex w-44 flex-shrink-0 flex-col gap-2 p-4">
			<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">
				{m.review_my_review()}
			</p>

			{#if reviewState === 'composing' || reviewState === 'submitting'}
				<div class="flex flex-col gap-2">
					<div class="flex gap-0.5">
						{#each [1, 2, 3, 4, 5] as star (star)}
							<button
								type="button"
								onclick={() => (selectedRating = star)}
								aria-label={String(star)}
								class="text-lg leading-none transition-transform hover:scale-110 focus:outline-none"
								class:text-amber-400={star <= selectedRating}
								class:text-stone-300={star > selectedRating}>★</button
							>
						{/each}
					</div>
					<textarea
						bind:value={comment}
						placeholder={m.review_form_comment_placeholder()}
						maxlength="1000"
						rows="2"
						class="resize-none rounded border border-stone-300 px-2 py-1 text-xs text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:ring-1 focus:ring-stone-500 focus:outline-none"
					></textarea>
					{#if reviewError}
						<p class="text-xs text-red-600">{reviewError}</p>
					{/if}
					<div class="flex gap-2">
						<button
							type="button"
							onclick={submitReview}
							disabled={reviewState === 'submitting' || selectedRating < 1}
							class="flex-1 rounded bg-stone-900 px-2 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
						>
							{reviewState === 'submitting' ? m.review_form_submitting() : m.review_form_submit()}
						</button>
						<button
							type="button"
							onclick={cancelCompose}
							disabled={reviewState === 'submitting'}
							class="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-50"
						>
							{m.form_cancel()}
						</button>
					</div>
				</div>
			{:else if myReview}
				<div class="flex flex-col gap-1">
					<span class="text-base text-amber-400" aria-label="{myReview.rating} out of 5">
						{'★'.repeat(myReview.rating)}{'☆'.repeat(5 - myReview.rating)}
					</span>
					{#if myReview.comment}
						<p class="line-clamp-2 text-xs text-stone-600">{myReview.comment}</p>
					{/if}
					<button
						type="button"
						onclick={startCompose}
						class="mt-1 self-start rounded border border-stone-300 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
					>
						{m.review_edit()}
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={startCompose}
					class="self-start rounded bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-800"
				>
					{m.review_button()}
				</button>
			{/if}
		</div>
	{/if}
</article>
