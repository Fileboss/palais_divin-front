<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import type { ReviewResponse } from '$lib/api/types';
	import { ApiError } from '$lib/api/types';
	import { createReview, recoverExistingReview, updateReview } from '$lib/api/reviews';
	import { getOrCreateKey, clearKey } from '$lib/idempotency';

	let {
		restaurantId,
		myReview = null,
		onreviewchange
	}: {
		restaurantId: string;
		myReview?: ReviewResponse | null;
		onreviewchange?: (review: ReviewResponse) => void;
	} = $props();

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
		const scopeKey = `review:${restaurantId}`;
		const body = { rating: selectedRating, comment: comment.trim() || undefined };
		try {
			let saved: ReviewResponse;
			if (myReview) {
				saved = await updateReview(fetch, restaurantId, body);
			} else {
				const key = getOrCreateKey(scopeKey);
				saved = await createReview(fetch, restaurantId, body, key);
				clearKey(scopeKey);
			}
			onreviewchange?.(saved);
			reviewState = 'idle';
		} catch (err) {
			if (err instanceof ApiError && err.status === 409 && !myReview) {
				const existing = await recoverExistingReview(fetch, restaurantId);
				if (existing) {
					onreviewchange?.(existing);
					reviewError = m.review_already_reviewed();
					reviewState = 'composing';
					clearKey(scopeKey);
					return;
				}
			}
			reviewError = m.error_review_failed();
			reviewState = 'composing';
		}
	}
</script>

<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">{m.review_my_review()}</p>

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
