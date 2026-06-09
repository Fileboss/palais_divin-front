<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { listTagCatalog } from '$lib/api/tags';
	import type { CategoryGroup, TagCategory } from '$lib/api/types';

	let {
		selected = $bindable<string[]>([]),
		disabled = false
	}: {
		selected?: string[];
		disabled?: boolean;
	} = $props();

	let groups = $state<CategoryGroup[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const totalTags = $derived(groups.reduce((sum, g) => sum + g.tags.length, 0));

	$effect(() => {
		if (groups.length > 0 || loading) return;
		loading = true;
		error = null;
		listTagCatalog(fetch)
			.then((res) => (groups = res.groups))
			.catch(() => (error = m.error_load_more_failed()))
			.finally(() => (loading = false));
	});

	function toggle(id: string) {
		if (disabled) return;
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	function categoryLabel(category: TagCategory): string {
		switch (category) {
			case 'REGIME':
				return m.tag_category_regime();
			case 'TYPE':
				return m.tag_category_type();
			case 'SPECIALTY':
				return m.tag_category_specialty();
			case 'VENUE_TYPE':
				return m.tag_category_venue_type();
			case 'SERVICE_AND_PLACE':
				return m.tag_category_service_and_place();
		}
	}
</script>

<div class="flex flex-col gap-3">
	{#if loading}
		<p class="text-xs text-stone-500">{m.tag_picker_loading()}</p>
	{:else if error}
		<p class="text-xs text-red-600" role="alert">{error}</p>
	{:else if totalTags === 0}
		<p class="text-xs text-stone-500">{m.tag_picker_empty()}</p>
	{:else}
		{#each groups as group (group.category)}
			{#if group.tags.length > 0}
				<fieldset class="flex flex-col gap-1.5">
					<legend class="text-xs font-medium tracking-wide text-stone-500 uppercase">
						{categoryLabel(group.category)}
					</legend>
					<ul class="flex flex-wrap gap-1.5">
						{#each group.tags as tag (tag.id)}
							{@const isSelected = selected.includes(tag.id)}
							<li>
								<button
									type="button"
									onclick={() => toggle(tag.id)}
									{disabled}
									aria-pressed={isSelected}
									class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
									class:border-stone-900={isSelected}
									class:bg-stone-900={isSelected}
									class:text-white={isSelected}
									class:border-stone-300={!isSelected}
									class:bg-white={!isSelected}
									class:text-stone-700={!isSelected}
									class:hover:bg-stone-50={!isSelected}
								>
									{tag.label}
								</button>
							</li>
						{/each}
					</ul>
				</fieldset>
			{/if}
		{/each}
	{/if}
</div>
