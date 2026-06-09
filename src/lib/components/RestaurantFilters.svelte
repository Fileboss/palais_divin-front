<script lang="ts" module>
	export interface FilterState {
		tagGroups: string[][];
		name: string;
		dineIn?: boolean;
		takeOut?: boolean;
		delivery?: boolean;
	}

	export function emptyFilterState(): FilterState {
		return { tagGroups: [], name: '' };
	}

	export const TAG_CAP_TOTAL = 10;
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { listTagCatalog } from '$lib/api/tags';
	import type { TagCategory, TagResponse } from '$lib/api/types';

	type CatalogState = { loading: boolean; tags: TagResponse[]; error: boolean };

	let {
		value = $bindable<FilterState>(emptyFilterState()),
		onapply
	}: {
		value?: FilterState;
		onapply: (next: FilterState) => void;
	} = $props();

	const EAGER: TagCategory[] = ['REGIME', 'TYPE'];
	const COLLAPSED: TagCategory[] = ['SPECIALTY', 'VENUE_TYPE', 'SERVICE_AND_PLACE'];

	let catalogs = $state<Partial<Record<TagCategory, CatalogState>>>({});
	let nameInput = $derived(value.name);
	let nameTimer: ReturnType<typeof setTimeout> | null = null;
	let capHit = $state(false);
	let expanded = $state(false);

	$effect(() => {
		for (const category of EAGER) {
			if (!catalogs[category]) loadCategory(category);
		}
		return () => {
			if (nameTimer != null) clearTimeout(nameTimer);
		};
	});

	function loadCategory(category: TagCategory): void {
		catalogs = { ...catalogs, [category]: { loading: true, tags: [], error: false } };
		listTagCatalog(fetch, { category })
			.then((res) => {
				const group = res.groups.find((g) => g.category === category);
				catalogs = {
					...catalogs,
					[category]: { loading: false, tags: group?.tags ?? [], error: false }
				};
			})
			.catch(() => {
				catalogs = { ...catalogs, [category]: { loading: false, tags: [], error: true } };
			});
	}

	function handleDetailsToggle(category: TagCategory, ev: Event): void {
		const opened = (ev.currentTarget as HTMLDetailsElement).open;
		if (opened && !catalogs[category]) loadCategory(category);
	}

	function totalSelected(state: FilterState): number {
		return state.tagGroups.reduce((sum, g) => sum + g.length, 0);
	}

	function findGroupIndex(state: FilterState, slug: string): number {
		return state.tagGroups.findIndex((g) => g.includes(slug));
	}

	function findCategoryGroupIndex(state: FilterState, categorySlugs: Set<string>): number {
		return state.tagGroups.findIndex((g) => g.some((s) => categorySlugs.has(s)));
	}

	function toggleSlug(category: TagCategory, slug: string): void {
		const inGroupIdx = findGroupIndex(value, slug);
		if (inGroupIdx >= 0) {
			const nextGroups = value.tagGroups
				.map((g, i) => (i === inGroupIdx ? g.filter((s) => s !== slug) : g))
				.filter((g) => g.length > 0);
			const next: FilterState = { ...value, tagGroups: nextGroups };
			value = next;
			onapply(next);
			return;
		}
		if (totalSelected(value) >= TAG_CAP_TOTAL) {
			capHit = true;
			setTimeout(() => (capHit = false), 1800);
			return;
		}
		const categorySlugs = new Set((catalogs[category]?.tags ?? []).map((t) => t.slug));
		const categoryGroupIdx = findCategoryGroupIndex(value, categorySlugs);
		let nextGroups: string[][];
		if (categoryGroupIdx >= 0) {
			nextGroups = value.tagGroups.map((g, i) => (i === categoryGroupIdx ? [...g, slug] : g));
		} else {
			nextGroups = [...value.tagGroups, [slug]];
		}
		const next: FilterState = { ...value, tagGroups: nextGroups };
		value = next;
		onapply(next);
	}

	function cycleBoolean(field: 'dineIn' | 'takeOut' | 'delivery'): void {
		const current = value[field];
		const nextVal = current === undefined ? true : current === true ? false : undefined;
		const next: FilterState = { ...value, [field]: nextVal };
		value = next;
		onapply(next);
	}

	function handleNameInput(): void {
		if (nameTimer != null) clearTimeout(nameTimer);
		nameTimer = setTimeout(() => {
			const trimmed = nameInput.trim();
			if (trimmed === value.name) return;
			const next: FilterState = { ...value, name: trimmed };
			value = next;
			onapply(next);
		}, 300);
	}

	function handleReset(): void {
		const next = emptyFilterState();
		value = next;
		nameInput = '';
		onapply(next);
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

	function booleanLabel(state: boolean | undefined): string {
		if (state === true) return m.filter_state_yes();
		if (state === false) return m.filter_state_no();
		return m.filter_state_any();
	}

	const selectedSlugs = $derived(new Set(value.tagGroups.flat()));

	const activeCount = $derived(
		totalSelected(value) +
			(value.name.length > 0 ? 1 : 0) +
			(value.dineIn !== undefined ? 1 : 0) +
			(value.takeOut !== undefined ? 1 : 0) +
			(value.delivery !== undefined ? 1 : 0)
	);

	function selectedCountForCategory(category: TagCategory): number {
		const tags = catalogs[category]?.tags ?? [];
		return tags.reduce((sum, t) => sum + (selectedSlugs.has(t.slug) ? 1 : 0), 0);
	}
</script>

{#snippet chipList(category: TagCategory)}
	{@const state = catalogs[category]}
	{#if state?.loading}
		<p class="text-xs text-stone-500">{m.tag_picker_loading()}</p>
	{:else if state?.error}
		<p class="text-xs text-red-600" role="alert">{m.filter_load_failed()}</p>
	{:else if state && state.tags.length === 0}
		<p class="text-xs text-stone-500">{m.tag_picker_empty()}</p>
	{:else if state}
		<ul class="flex flex-wrap gap-1.5">
			{#each state.tags as tag (tag.slug)}
				{@const isSelected = selectedSlugs.has(tag.slug)}
				<li>
					<button
						type="button"
						onclick={() => toggleSlug(category, tag.slug)}
						aria-pressed={isSelected}
						class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition"
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
	{/if}
{/snippet}

<section class="flex flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50/60 p-4">
	<div
		role="button"
		tabindex="0"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
		onkeydown={(ev) => {
			if (ev.key === 'Enter' || ev.key === ' ') {
				ev.preventDefault();
				expanded = !expanded;
			}
		}}
		class="-m-1 flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded p-1 select-none hover:text-stone-900"
	>
		<div class="flex items-center gap-2 text-sm font-medium text-stone-700">
			<span
				aria-hidden="true"
				class="inline-block text-[10px] text-stone-400 transition-transform"
				class:rotate-90={expanded}
			>
				▶
			</span>
			<span>{m.filter_title()}</span>
			{#if activeCount > 0}
				<span class="rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-700">
					{m.filter_count({ count: activeCount })}
				</span>
			{/if}
		</div>
		{#if activeCount > 0}
			<button
				type="button"
				onclick={(ev) => {
					ev.stopPropagation();
					handleReset();
				}}
				class="text-xs font-medium text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
			>
				{m.filter_reset()}
			</button>
		{/if}
	</div>

	{#if expanded}
		{#each EAGER as category (category)}
			<div class="flex flex-col gap-1.5">
				<p class="text-xs font-medium tracking-wide text-stone-500 uppercase">
					{categoryLabel(category)}
				</p>
				{@render chipList(category)}
			</div>
		{/each}

		<div class="flex flex-wrap gap-2">
			{#each COLLAPSED as category (category)}
				{@const count = selectedCountForCategory(category)}
				<details
					class="flex-1 rounded-md border border-stone-200 bg-white"
					ontoggle={(ev) => handleDetailsToggle(category, ev)}
				>
					<summary
						class="cursor-pointer list-none px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
					>
						{categoryLabel(category)}
						{#if count > 0}
							<span class="ml-1 text-stone-500">({count})</span>
						{/if}
					</summary>
					<div class="border-t border-stone-100 p-2">
						{@render chipList(category)}
					</div>
				</details>
			{/each}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#each [{ field: 'dineIn' as const, label: m.filter_dine_in() }, { field: 'takeOut' as const, label: m.filter_take_out() }, { field: 'delivery' as const, label: m.filter_delivery() }] as toggle (toggle.field)}
				{@const state = value[toggle.field]}
				<button
					type="button"
					onclick={() => cycleBoolean(toggle.field)}
					class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition"
					class:border-stone-900={state !== undefined}
					class:bg-stone-900={state === true}
					class:text-white={state === true}
					class:bg-white={state !== true}
					class:text-stone-900={state === false}
					class:border-stone-300={state === undefined}
					class:text-stone-700={state === undefined}
				>
					<span>{toggle.label}</span>
					<span class="text-[10px] opacity-70">{booleanLabel(state)}</span>
				</button>
			{/each}
		</div>

		<input
			type="search"
			bind:value={nameInput}
			oninput={handleNameInput}
			maxlength={100}
			placeholder={m.filter_name_placeholder()}
			class="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
		/>

		{#if capHit}
			<p class="text-xs text-amber-700" role="alert">{m.filter_cap_reached()}</p>
		{/if}
	{/if}
</section>
