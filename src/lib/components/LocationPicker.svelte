<script lang="ts">
	import { searchGeocode } from '$lib/api/geocode';
	import * as m from '$lib/paraglide/messages';
	import type { SortLocation } from '$lib/sortLocation';

	let {
		open,
		onpick,
		onclose
	}: {
		open: boolean;
		onpick: (loc: SortLocation) => void;
		onclose: () => void;
	} = $props();

	type Tab = 'around' | 'custom';
	let tab = $state<Tab>('around');
	let geoError = $state<string | null>(null);
	let geoLoading = $state(false);

	let query = $state('');
	let suggestions = $state<{ label: string; lat: number; lng: number }[]>([]);
	let searching = $state(false);
	let searched = $state(false);
	let el = $state<HTMLDivElement | null>(null);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let controller: AbortController | null = null;

	$effect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (el && !el.contains(e.target as Node)) onclose();
		};
		// Defer so the click that opened us doesn't immediately close
		const id = setTimeout(() => document.addEventListener('click', handler), 0);
		return () => {
			clearTimeout(id);
			document.removeEventListener('click', handler);
		};
	});

	function useAroundMe() {
		geoError = null;
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			geoError = m.sort_loc_unavailable();
			return;
		}
		geoLoading = true;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				geoLoading = false;
				if (!open) return;
				onpick({
					label: m.sort_loc_around_me(),
					lat: pos.coords.latitude,
					lng: pos.coords.longitude
				});
			},
			(err) => {
				geoLoading = false;
				if (!open) return;
				geoError =
					err.code === err.PERMISSION_DENIED ? m.sort_loc_denied() : m.sort_loc_unavailable();
			},
			{ enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 }
		);
	}

	function scheduleSearch(q: string) {
		if (debounceTimer) clearTimeout(debounceTimer);
		if (controller) controller.abort();
		if (q.trim().length < 2) {
			suggestions = [];
			searching = false;
			searched = false;
			return;
		}
		debounceTimer = setTimeout(() => runSearch(q.trim()), 350);
	}

	async function runSearch(q: string) {
		controller = new AbortController();
		searching = true;
		searched = false;
		try {
			const matches = await searchGeocode(fetch, q, 5, controller.signal);
			suggestions = matches
				.map((d) => ({ label: d.label, lat: d.latitude, lng: d.longitude }))
				.filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
		} catch (err) {
			if ((err as { name?: string } | null)?.name === 'AbortError') return;
			suggestions = [];
		} finally {
			searching = false;
			searched = true;
		}
	}

	function onQueryInput(e: Event) {
		query = (e.target as HTMLInputElement).value;
		scheduleSearch(query);
	}
</script>

{#if open}
	<div
		bind:this={el}
		class="absolute top-full right-0 z-50 mt-1 w-80 overflow-hidden rounded-md border border-stone-200 bg-white shadow-lg"
		role="dialog"
		aria-label={m.sort_distance()}
	>
		<div class="flex border-b border-stone-200">
			<button
				type="button"
				onclick={() => (tab = 'around')}
				class={[
					'flex-1 px-3 py-2 text-sm font-medium',
					tab === 'around' ? 'bg-stone-50 text-stone-900' : 'text-stone-500'
				]}
			>
				{m.sort_loc_around_me()}
			</button>
			<button
				type="button"
				onclick={() => (tab = 'custom')}
				class={[
					'flex-1 px-3 py-2 text-sm font-medium',
					tab === 'custom' ? 'bg-stone-50 text-stone-900' : 'text-stone-500'
				]}
			>
				{m.sort_loc_custom_place()}
			</button>
		</div>

		{#if tab === 'around'}
			<div class="p-3">
				<button
					type="button"
					onclick={useAroundMe}
					disabled={geoLoading}
					class="w-full rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
				>
					{geoLoading ? m.restaurant_loading() : m.sort_loc_around_me()}
				</button>
				{#if geoError}
					<p class="mt-2 text-xs text-red-600" role="alert">{geoError}</p>
				{/if}
			</div>
		{:else}
			<div class="p-3">
				<input
					type="text"
					value={query}
					oninput={onQueryInput}
					placeholder={m.sort_loc_search_placeholder()}
					class="w-full rounded-md border-stone-300 text-sm focus:border-stone-500 focus:ring-stone-500"
				/>
				{#if searching}
					<p class="mt-2 text-xs text-stone-500">{m.sort_loc_searching()}</p>
				{:else if searched && suggestions.length === 0}
					<p class="mt-2 text-xs text-stone-500">{m.sort_loc_no_results()}</p>
				{:else if suggestions.length > 0}
					<ul class="mt-2 max-h-64 overflow-y-auto">
						{#each suggestions as s (s.lat + ',' + s.lng + ',' + s.label)}
							<li>
								<button
									type="button"
									onclick={() => onpick(s)}
									class="w-full rounded-md px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50"
								>
									{s.label}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
{/if}
