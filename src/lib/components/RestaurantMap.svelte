<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import * as m from '$lib/paraglide/messages';
	import type { CoordinatesDto } from '$lib/api/types';

	let { location, name }: { location: CoordinatesDto; name: string } = $props();

	let loading = $state(true);
	let error = $state<string | null>(null);

	function renderMap(container: HTMLDivElement) {
		const lat = location.latitude;
		const lng = location.longitude;

		let cancelled = false;
		let map: import('maplibre-gl').Map | undefined;
		loading = true;
		error = null;

		import('maplibre-gl')
			.then(({ Map, Marker, NavigationControl }) => {
				if (cancelled) return;
				const created = new Map({
					container,
					style: 'https://tiles.openfreemap.org/styles/positron',
					center: [lng, lat],
					zoom: 15
				});
				created.addControl(new NavigationControl(), 'top-right');
				new Marker().setLngLat([lng, lat]).addTo(created);
				created.on('load', () => (loading = false));
				created.on('error', () => (error = m.map_load_failed()));
				map = created;
			})
			.catch(() => (error = m.map_load_failed()));

		return () => {
			cancelled = true;
			map?.remove();
		};
	}
</script>

<div class="relative h-full w-full" role="img" aria-label={m.restaurant_map_aria({ name })}>
	<div class="h-full w-full" {@attach renderMap}></div>
	{#if loading || error}
		<div
			class="absolute inset-0 flex items-center justify-center bg-stone-100 text-xs text-stone-500"
		>
			{error ?? m.map_loading()}
		</div>
	{/if}
</div>
