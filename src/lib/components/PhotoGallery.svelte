<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { listPublicRestaurantPhotos } from '$lib/api/photos';
	import type { PageMeta, PhotoSummary, PhotosPageResponse } from '$lib/api/types';

	let {
		restaurantId,
		initial
	}: {
		restaurantId: string;
		initial: PhotosPageResponse;
	} = $props();

	// svelte-ignore state_referenced_locally
	let photos = $state<PhotoSummary[]>(initial.data);
	// svelte-ignore state_referenced_locally
	let meta = $state<PageMeta>(initial.page);
	let loadingMore = $state(false);
	let loadMoreError = $state<string | null>(null);
	let activeIndex = $state<number | null>(null);

	async function handleLoadMore() {
		if (!meta.hasNext || !meta.nextCursor || loadingMore) return;
		loadingMore = true;
		loadMoreError = null;
		try {
			const next = await listPublicRestaurantPhotos(fetch, restaurantId, {
				cursor: meta.nextCursor,
				size: meta.size
			});
			photos = [...photos, ...next.data];
			meta = next.page;
		} catch {
			loadMoreError = m.error_load_more_failed();
		} finally {
			loadingMore = false;
		}
	}

	function openAt(i: number) {
		activeIndex = i;
	}

	function close() {
		activeIndex = null;
	}

	function handleKey(e: KeyboardEvent) {
		if (activeIndex == null) return;
		if (e.key === 'Escape') {
			close();
		} else if (e.key === 'ArrowRight' && activeIndex < photos.length - 1) {
			activeIndex += 1;
		} else if (e.key === 'ArrowLeft' && activeIndex > 0) {
			activeIndex -= 1;
		}
	}
</script>

<svelte:window onkeydown={handleKey} />

{#if photos.length > 0}
	<section class="mt-8">
		<ul class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
			{#each photos as photo, i (photo.id)}
				<li>
					<button
						type="button"
						onclick={() => openAt(i)}
						class="block aspect-square w-full overflow-hidden rounded-md bg-stone-100 focus:ring-2 focus:ring-stone-500 focus:outline-none"
						aria-label={m.gallery_photo_aria({ index: i + 1, total: photos.length })}
					>
						<img
							src={photo.url}
							alt=""
							loading="lazy"
							class="h-full w-full object-cover transition hover:scale-105"
						/>
					</button>
				</li>
			{/each}
		</ul>

		{#if loadMoreError}
			<p class="mt-4 text-sm text-red-600" role="alert">{loadMoreError}</p>
		{/if}

		{#if meta.hasNext}
			<div class="mt-4 flex justify-center">
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
	</section>
{/if}

{#if activeIndex != null}
	<div
		role="dialog"
		aria-modal="true"
		aria-label={m.gallery_lightbox_label()}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
	>
		<button
			type="button"
			onclick={close}
			aria-label={m.gallery_close()}
			class="absolute inset-0 h-full w-full cursor-zoom-out bg-transparent"
		></button>
		<button
			type="button"
			onclick={close}
			aria-label={m.gallery_close()}
			class="absolute top-4 right-4 z-10 rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
		>
			✕
		</button>
		<img
			src={photos[activeIndex].url}
			alt={m.gallery_photo_aria({ index: activeIndex + 1, total: photos.length })}
			class="pointer-events-none relative max-h-full max-w-full object-contain"
		/>
	</div>
{/if}
