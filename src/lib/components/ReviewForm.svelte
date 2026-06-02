<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { createReview, updateReview } from '$lib/api/reviews';
	import { getOrCreateKey, clearKey } from '$lib/idempotency';
	import type { ReviewResponse } from '$lib/api/types';
	import { ApiError } from '$lib/api/types';

	let {
		restaurantId,
		existing = null,
		oncreated
	}: {
		restaurantId: string;
		existing?: ReviewResponse | null;
		oncreated: (review: ReviewResponse) => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let rating = $state(existing?.rating ?? 0);
	// svelte-ignore state_referenced_locally
	let comment = $state(existing?.comment ?? '');
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let alreadyReviewed = $state(false);

	const scopeKey = $derived(`review:${restaurantId}`);
	const isEditing = $derived(!!existing);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (rating < 1 || rating > 5 || submitting) return;
		submitting = true;
		error = null;
		try {
			const body = { rating, comment: comment.trim() || undefined };
			let review: ReviewResponse;
			if (existing) {
				review = await updateReview(fetch, restaurantId, body);
			} else {
				const key = getOrCreateKey(scopeKey);
				review = await createReview(fetch, restaurantId, body, key);
				clearKey(scopeKey);
			}
			if (!existing) {
				rating = 0;
				comment = '';
			}
			oncreated(review);
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				alreadyReviewed = true;
			} else {
				error = m.error_review_failed();
			}
		} finally {
			submitting = false;
		}
	}
</script>

{#if alreadyReviewed}
	<p class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
		{m.review_already_reviewed()}
	</p>
{:else}
	<form
		onsubmit={handleSubmit}
		class="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
	>
		<h3 class="text-sm font-semibold text-stone-900">
			{isEditing ? m.review_edit() : m.review_form_title()}
		</h3>

		<fieldset>
			<legend class="mb-1.5 text-xs font-medium text-stone-600">{m.review_form_rating()}</legend>
			<div class="flex gap-1">
				{#each [1, 2, 3, 4, 5] as star (star)}
					<button
						type="button"
						onclick={() => (rating = star)}
						aria-label={String(star)}
						class="text-2xl leading-none transition-transform hover:scale-110 focus:outline-none"
						class:text-amber-400={star <= rating}
						class:text-stone-300={star > rating}
					>
						★
					</button>
				{/each}
			</div>
		</fieldset>

		<label class="flex flex-col gap-1">
			<span class="text-xs font-medium text-stone-600">{m.review_form_comment()}</span>
			<textarea
				bind:value={comment}
				placeholder={m.review_form_comment_placeholder()}
				maxlength="1000"
				rows="3"
				class="resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:ring-1 focus:ring-stone-500 focus:outline-none"
			></textarea>
		</label>

		{#if error}
			<p class="text-sm text-red-600" role="alert">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={rating < 1 || submitting}
			class="self-start rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{submitting ? m.review_form_submitting() : m.review_form_submit()}
		</button>
	</form>
{/if}
