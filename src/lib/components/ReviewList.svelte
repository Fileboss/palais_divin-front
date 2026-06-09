<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';
	import type { PageMeta, ReviewResponse } from '$lib/api/types';
	import ConnectButton from './ConnectButton.svelte';

	let {
		reviews,
		meta,
		loading = false,
		error = null,
		showConnect = false,
		currentUserId = null,
		onloadmore
	}: {
		reviews: ReviewResponse[];
		meta: PageMeta;
		loading?: boolean;
		error?: string | null;
		showConnect?: boolean;
		currentUserId?: string | null;
		onloadmore: () => void;
	} = $props();

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(getLocale(), {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function shortId(id: string): string {
		return id.slice(0, 8);
	}
</script>

{#if reviews.length === 0 && !meta.hasNext}
	<p class="py-4 text-sm text-stone-500">{m.review_list_empty()}</p>
{:else}
	<ul class="flex flex-col divide-y divide-stone-100">
		{#each reviews as review (review.id)}
			<li class="flex flex-col gap-2 py-4">
				<div class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<span class="text-sm font-medium text-stone-700">
							{review.authorDisplayName ?? m.review_author({ id: shortId(review.authorId) })}
						</span>
						{#if showConnect && currentUserId && review.authorId !== currentUserId}
							<ConnectButton targetId={review.authorId} />
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<span class="text-sm text-amber-400" aria-label="{review.rating} out of 5">
							{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
						</span>
						<time datetime={review.createdAt} class="text-xs text-stone-400">
							{formatDate(review.createdAt)}
						</time>
					</div>
				</div>
				{#if review.comment}
					<p class="text-sm text-stone-700">{review.comment}</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

{#if error}
	<p class="mt-2 text-sm text-red-600" role="alert">{error}</p>
{/if}

{#if meta.hasNext}
	<div class="mt-4 flex justify-center">
		<button
			type="button"
			onclick={onloadmore}
			disabled={loading}
			class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{loading ? m.restaurant_loading() : m.restaurant_load_more()}
		</button>
	</div>
{/if}
