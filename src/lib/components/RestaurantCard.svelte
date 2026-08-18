<script lang="ts">
	import { resolve } from '$app/paths';
	import { getLocale } from '$lib/paraglide/runtime';
	import { tagLabel } from '$lib/i18n/tagLabel';
	import * as m from '$lib/paraglide/messages';
	import type { RestaurantResponse, ReviewResponse } from '$lib/api/types';
	import { deleteRestaurant } from '$lib/api/restaurants';
	import MyReviewPanel from './MyReviewPanel.svelte';

	let {
		restaurant,
		showMyReview = false,
		userId = null,
		myReview = null,
		isAdmin = false,
		onreviewchange,
		ondelete
	}: {
		restaurant: RestaurantResponse;
		showMyReview?: boolean;
		userId?: string | null;
		myReview?: ReviewResponse | null;
		isAdmin?: boolean;
		onreviewchange?: (review: ReviewResponse) => void;
		ondelete?: (id: string) => void;
	} = $props();

	const thumbnailUrl = $derived(restaurant.thumbnail?.url ?? null);
	const affinityLabel = $derived(
		typeof restaurant.affinity === 'number'
			? restaurant.affinity.toLocaleString(getLocale(), {
					minimumFractionDigits: 1,
					maximumFractionDigits: 1
				})
			: null
	);

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
</script>

<article
	class="flex flex-row overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
>
	{#if thumbnailUrl}
		<img src={thumbnailUrl} alt="" class="size-28 flex-shrink-0 object-cover" />
	{:else}
		<div
			role="img"
			aria-label={m.photo_placeholder_aria()}
			class="flex size-28 flex-shrink-0 items-center justify-center bg-stone-100 text-stone-300"
		>
			<svg viewBox="0 0 24 24" fill="currentColor" class="size-8" aria-hidden="true">
				<path
					d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm2 0v9.59l3.3-3.3a1 1 0 0 1 1.4 0l3.3 3.3 2.3-2.3a1 1 0 0 1 1.4 0L20 14.59V5H6Zm10 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"
				/>
			</svg>
		</div>
	{/if}
	<div class="flex flex-1 flex-col gap-2 p-4">
		<h3 class="text-base font-semibold">
			<a
				href={resolve('/restaurants/[id]', { id: restaurant.id })}
				class="text-stone-900 hover:underline focus:underline focus:outline-none"
			>
				{restaurant.name}
			</a>
		</h3>
		{#if restaurant.address}
			<p class="text-sm text-stone-600">{restaurant.address}</p>
		{/if}
		{#if restaurant.tags && restaurant.tags.length > 0}
			<ul class="flex flex-wrap gap-1">
				{#each restaurant.tags as tag (tag.slug)}
					<li class="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
						{tagLabel(tag)}
					</li>
				{/each}
			</ul>
		{/if}
		<p class="text-sm">
			{#if avgRatingLabel}
				<span class="text-amber-400" aria-hidden="true">★</span>
				<span class="font-medium text-stone-700">{avgRatingLabel}</span>
			{:else}
				<span class="text-stone-400">{m.review_no_ratings_yet()}</span>
			{/if}
		</p>
		{#if affinityLabel}
			<p class="text-sm font-medium text-emerald-600">
				{m.recommendations_affinity()}: {affinityLabel}
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
			<MyReviewPanel restaurantId={restaurant.id} {myReview} {onreviewchange} />
		</div>
	{/if}
</article>
