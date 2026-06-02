<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages';
	import Header from '$lib/components/Header.svelte';
	import { listRecommendations } from '$lib/api/recommendations';
	import type { PageData } from './$types';
	import type { PageMeta, RecommendationResponse } from '$lib/api/types';

	let { data }: { data: PageData } = $props();

	// svelte-ignore state_referenced_locally
	let recommendations = $state<RecommendationResponse[]>(data.recommendations);
	// svelte-ignore state_referenced_locally
	let meta = $state<PageMeta>(data.meta);
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);

	async function handleLoadMore() {
		if (!meta.hasNext || !meta.nextCursor || loadingMore) return;
		loadingMore = true;
		loadMoreError = null;
		try {
			const next = await listRecommendations(fetch, {
				cursor: meta.nextCursor,
				size: meta.size
			});
			recommendations = [...recommendations, ...next.data];
			meta = next.page;
		} catch {
			loadMoreError = m.error_load_more_failed();
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>{m.recommendations_title()} · {m.brand_name()}</title>
</svelte:head>

<Header user={data.user} />

<main class="mx-auto max-w-5xl px-4 py-8">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-stone-900">{m.recommendations_title()}</h1>
		<p class="mt-1 text-sm text-stone-600">{m.recommendations_subtitle()}</p>
	</div>

	{#if recommendations.length === 0}
		<p
			class="rounded-md border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500"
		>
			{m.recommendations_empty()}
		</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each recommendations as rec (rec.id)}
				<li>
					<a
						href={resolve(`/restaurants/${rec.id}`)}
						class="flex flex-row overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
					>
						<div class="flex flex-1 flex-col gap-2 p-4">
							<h3 class="text-base font-semibold text-stone-900">{rec.name}</h3>
							{#if rec.address}
								<p class="text-sm text-stone-600">{rec.address}</p>
							{/if}
							<p class="text-sm font-medium text-emerald-600">
								{m.recommendations_recommenders({ count: rec.recommenderCount })}
							</p>
						</div>
						<div class="flex w-32 flex-shrink-0 flex-col items-end justify-center gap-1 p-4">
							<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">
								{m.recommendations_affinity()}
							</p>
							<p class="text-xl font-bold text-stone-800">{rec.affinity.toFixed(1)}</p>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if loadMoreError}
		<p class="mt-4 text-sm text-red-600" role="alert">{loadMoreError}</p>
	{/if}

	{#if meta.hasNext}
		<div class="mt-6 flex justify-center">
			<button
				type="button"
				onclick={handleLoadMore}
				disabled={loadingMore}
				class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{loadingMore ? m.restaurant_loading() : m.restaurant_load_more()}
			</button>
		</div>
	{/if}
</main>
