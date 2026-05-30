<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import Header from '$lib/components/Header.svelte';
	import { createInvitation } from '$lib/api/invitations';
	import type { InvitationResponse } from '$lib/api/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let invitations = $state<InvitationResponse[]>([]);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	let copiedId = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	const dateFormatter = $derived(
		new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeStyle: 'short' })
	);

	async function handleCreate() {
		if (submitting) return;
		submitting = true;
		submitError = null;
		try {
			const created = await createInvitation(fetch);
			invitations = [created, ...invitations];
		} catch {
			submitError = m.error_invitation_create_failed();
		} finally {
			submitting = false;
		}
	}

	async function copyLink(invitation: InvitationResponse) {
		try {
			await navigator.clipboard.writeText(invitation.signupUrl);
			copiedId = invitation.id;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch {
			// clipboard unavailable; user can still select & copy from the input
		}
	}
</script>

<svelte:head>
	<title>{m.admin_invitations_title()} · {m.brand_name()}</title>
</svelte:head>

<Header user={data.user} />

<main class="mx-auto max-w-5xl px-4 py-8">
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-stone-900">{m.admin_invitations_title()}</h1>
			<p class="mt-1 text-sm text-stone-600">{m.admin_invitations_subtitle()}</p>
		</div>
		<button
			type="button"
			onclick={handleCreate}
			disabled={submitting}
			class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{submitting ? m.admin_invitation_creating() : `+ ${m.admin_invitation_create()}`}
		</button>
	</div>

	{#if submitError}
		<p
			class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
			role="alert"
		>
			{submitError}
		</p>
	{/if}

	{#if invitations.length === 0}
		<p
			class="rounded-md border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500"
		>
			{m.admin_invitation_empty()}
		</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each invitations as invitation (invitation.id)}
				<li class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
					<label class="flex flex-col gap-1">
						<span class="text-xs font-medium text-stone-500">{m.admin_invitation_link_label()}</span
						>
						<div class="flex gap-2">
							<input
								type="text"
								readonly
								value={invitation.signupUrl}
								onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
								class="flex-1 rounded-md border-stone-300 bg-stone-50 font-mono text-sm text-stone-800 focus:border-stone-500 focus:ring-stone-500"
							/>
							<button
								type="button"
								onclick={() => copyLink(invitation)}
								class="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
							>
								{copiedId === invitation.id
									? m.admin_invitation_copied()
									: m.admin_invitation_copy()}
							</button>
						</div>
					</label>
					<p class="mt-2 text-xs text-stone-500">
						{m.admin_invitation_expires_at({
							date: dateFormatter.format(new Date(invitation.expiresAt))
						})}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</main>
