<script lang="ts" module>
	export type SortKey =
		| 'CREATED_AT_DESC'
		| 'RATING_DESC'
		| 'DISTANCE_ASC'
		| 'AFFINITY_DESC'
		| 'NAME_ASC';

	export type SortOption = {
		key: SortKey;
		label: string;
		disabled?: boolean;
		disabledReason?: string;
	};
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	let {
		value,
		options,
		onchange
	}: {
		value: SortKey;
		options: SortOption[];
		onchange: (key: SortKey) => void;
	} = $props();

	let open = $state(false);
	let el = $state<HTMLDivElement | null>(null);

	const currentLabel = $derived(options.find((o) => o.key === value)?.label ?? '');

	$effect(() => {
		const handler = (e: MouseEvent) => {
			if (el && !el.contains(e.target as Node)) open = false;
		};
		document.addEventListener('click', handler);
		return () => document.removeEventListener('click', handler);
	});

	function pick(opt: SortOption) {
		if (opt.disabled) return;
		open = false;
		if (opt.key !== value) onchange(opt.key);
	}
</script>

<div bind:this={el} class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		<span class="text-stone-500">{m.sort_label()}:</span>
		<span class="text-stone-900">{currentLabel}</span>
		<svg
			class="h-3 w-3 text-stone-400"
			viewBox="0 0 12 12"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="M2 4l4 4 4-4" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-40 mt-1 min-w-[12rem] overflow-hidden rounded-md border border-stone-200 bg-white shadow-md"
			role="listbox"
		>
			{#each options as opt (opt.key)}
				<button
					type="button"
					role="option"
					aria-selected={opt.key === value}
					aria-disabled={opt.disabled}
					title={opt.disabled ? opt.disabledReason : undefined}
					onclick={() => pick(opt)}
					class="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
					class:cursor-not-allowed={opt.disabled}
					class:text-stone-400={opt.disabled}
					class:text-stone-900={!opt.disabled && opt.key === value}
					class:font-semibold={!opt.disabled && opt.key === value}
					class:text-stone-700={!opt.disabled && opt.key !== value}
					class:hover:bg-stone-50={!opt.disabled}
				>
					<span>{opt.label}</span>
					{#if opt.disabled}
						<span class="ml-3 text-xs text-stone-400">{m.sort_coming_soon()}</span>
					{:else if opt.key === value}
						<svg
							class="h-3.5 w-3.5 text-stone-900"
							viewBox="0 0 14 14"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							aria-hidden="true"
						>
							<path d="M3 7l3 3 5-6" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
