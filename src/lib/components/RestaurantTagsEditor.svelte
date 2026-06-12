<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import * as m from '$lib/paraglide/messages';
	import { attachRestaurantTag, detachRestaurantTag, listTagCatalog } from '$lib/api/tags';
	import { tagLabel } from '$lib/i18n/tagLabel';
	import type { CategoryGroup, TagCategory, TagSummary } from '$lib/api/types';

	let {
		restaurantId,
		tags = $bindable([]),
		canEdit = false
	}: {
		restaurantId: string;
		tags?: TagSummary[];
		canEdit?: boolean;
	} = $props();

	let editing = $state(false);
	let groups = $state<CategoryGroup[]>([]);
	let loadingCatalog = $state(false);
	let catalogError = $state<string | null>(null);
	let selected = $state<string[]>([]);
	let saving = $state(false);
	let saveError = $state<string | null>(null);

	const flatCatalog = $derived(groups.flatMap((g) => g.tags));
	const initialIds = $derived(
		flatCatalog.filter((t) => tags.some((rt) => rt.slug === t.slug)).map((t) => t.id)
	);
	const totalTags = $derived(flatCatalog.length);
	const hasChanges = $derived(
		selected.length !== initialIds.length || selected.some((id) => !initialIds.includes(id))
	);

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

	async function loadCatalogOnce(): Promise<boolean> {
		if (groups.length > 0) return true;
		loadingCatalog = true;
		catalogError = null;
		try {
			const res = await listTagCatalog(fetch);
			groups = res.groups;
			return true;
		} catch {
			catalogError = m.error_load_more_failed();
			return false;
		} finally {
			loadingCatalog = false;
		}
	}

	async function startEdit() {
		const ok = await loadCatalogOnce();
		if (!ok) return;
		selected = flatCatalog.filter((t) => tags.some((rt) => rt.slug === t.slug)).map((t) => t.id);
		saveError = null;
		editing = true;
	}

	function cancel() {
		editing = false;
		saveError = null;
	}

	function toggle(id: string) {
		if (saving) return;
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	async function save() {
		if (saving) return;
		saving = true;
		saveError = null;
		const toAdd = selected.filter((id) => !initialIds.includes(id));
		const toRemove = initialIds.filter((id) => !selected.includes(id));

		const addResults = await Promise.allSettled(
			toAdd.map((id) => attachRestaurantTag(fetch, restaurantId, id))
		);
		const removeResults = await Promise.allSettled(
			toRemove.map((id) => detachRestaurantTag(fetch, restaurantId, id))
		);

		const succeededAdds = toAdd.filter((_, i) => addResults[i].status === 'fulfilled');
		const succeededRemoves = toRemove.filter((_, i) => removeResults[i].status === 'fulfilled');
		const anyFailed =
			addResults.some((r) => r.status === 'rejected') ||
			removeResults.some((r) => r.status === 'rejected');

		const nextIds = new SvelteSet(initialIds);
		for (const id of succeededAdds) nextIds.add(id);
		for (const id of succeededRemoves) nextIds.delete(id);

		tags = flatCatalog
			.filter((t) => nextIds.has(t.id))
			.map((t) => ({ slug: t.slug, label: t.label, category: t.category }));

		if (anyFailed) {
			saveError = m.restaurant_tags_save_failed();
			selected = flatCatalog.filter((t) => nextIds.has(t.id)).map((t) => t.id);
			saving = false;
			return;
		}

		editing = false;
		saving = false;
	}
</script>

{#if editing}
	<div class="mt-3 flex flex-col gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
		{#if loadingCatalog}
			<p class="text-xs text-stone-500">{m.tag_picker_loading()}</p>
		{:else if catalogError}
			<p class="text-xs text-red-600" role="alert">{catalogError}</p>
		{:else if totalTags === 0}
			<p class="text-xs text-stone-500">{m.tag_picker_empty()}</p>
		{:else}
			{#each groups as group (group.category)}
				{#if group.tags.length > 0}
					<fieldset class="flex flex-col gap-1.5">
						<legend class="text-[11px] font-medium tracking-wide text-stone-500 uppercase">
							{categoryLabel(group.category)}
						</legend>
						<ul class="flex flex-wrap gap-1.5">
							{#each group.tags as tag (tag.id)}
								{@const isSelected = selected.includes(tag.id)}
								<li>
									<button
										type="button"
										onclick={() => toggle(tag.id)}
										disabled={saving}
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
										{tagLabel(tag)}
									</button>
								</li>
							{/each}
						</ul>
					</fieldset>
				{/if}
			{/each}
		{/if}

		{#if saveError}
			<p class="text-xs text-red-600" role="alert">{saveError}</p>
		{/if}

		<div class="flex justify-end gap-2">
			<button
				type="button"
				onclick={cancel}
				disabled={saving}
				class="rounded-md border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-50"
			>
				{m.form_cancel()}
			</button>
			<button
				type="button"
				onclick={save}
				disabled={saving || !hasChanges}
				class="rounded-md bg-stone-900 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{saving ? m.form_submitting() : m.form_submit()}
			</button>
		</div>
	</div>
{:else}
	<div class="mt-3 flex flex-wrap items-center gap-1.5">
		{#each tags as tag (tag.slug)}
			<span class="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
				{tagLabel(tag)}
			</span>
		{/each}
		{#if canEdit}
			<button
				type="button"
				onclick={startEdit}
				disabled={loadingCatalog}
				class="rounded-full border border-dashed border-stone-300 px-2.5 py-0.5 text-xs font-medium text-stone-500 hover:border-stone-500 hover:text-stone-700 disabled:opacity-50"
			>
				{loadingCatalog
					? m.tag_picker_loading()
					: tags.length === 0
						? m.restaurant_tags_add()
						: m.restaurant_tags_edit()}
			</button>
		{/if}
		{#if catalogError}
			<span class="text-xs text-red-600" role="alert">{catalogError}</span>
		{/if}
	</div>
{/if}
