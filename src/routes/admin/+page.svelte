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
	<title>{m.admin_title()} · {m.brand_name()}</title>
</svelte:head>

<Header user={data.user} />

<main class="mx-auto max-w-5xl px-4 py-8">
	<h1 class="text-2xl font-bold text-stone-900">{m.admin_title()}</h1>

	<section class="mt-8">
		<h2 class="text-lg font-semibold text-stone-900">{m.admin_section_users()}</h2>

		<div class="mt-4 grid gap-6 md:grid-cols-2">
			<div class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
				<div class="flex items-center justify-between gap-4">
					<h3 class="text-sm font-semibold text-stone-900">{m.admin_users_invitations()}</h3>
					<button
						type="button"
						onclick={handleCreate}
						disabled={submitting}
						class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{submitting ? m.admin_invitation_creating() : `+ ${m.admin_invitation_create()}`}
					</button>
				</div>

				{#if submitError}
					<p
						class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
						role="alert"
					>
						{submitError}
					</p>
				{/if}

				{#if invitations.length === 0}
					<p class="mt-3 text-xs text-stone-500">{m.admin_invitation_empty()}</p>
				{:else}
					<ul class="mt-3 flex flex-col gap-2">
						{#each invitations as invitation (invitation.id)}
							<li class="rounded-md border border-stone-200 bg-stone-50 p-3">
								<label class="flex flex-col gap-1">
									<span class="text-[10px] font-medium tracking-wide text-stone-500 uppercase">
										{m.admin_invitation_link_label()}
									</span>
									<div class="flex gap-2">
										<input
											type="text"
											readonly
											value={invitation.signupUrl}
											onclick={(e) => (e.currentTarget as HTMLInputElement).select()}
											class="flex-1 rounded-md border-stone-300 bg-white font-mono text-xs text-stone-800 focus:border-stone-500 focus:ring-stone-500"
										/>
										<button
											type="button"
											onclick={() => copyLink(invitation)}
											class="shrink-0 rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 shadow-sm hover:bg-stone-50"
										>
											{copiedId === invitation.id
												? m.admin_invitation_copied()
												: m.admin_invitation_copy()}
										</button>
									</div>
								</label>
								<p class="mt-1.5 text-[11px] text-stone-500">
									{m.admin_invitation_expires_at({
										date: dateFormatter.format(new Date(invitation.expiresAt))
									})}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
				<h3 class="text-sm font-semibold text-stone-900">{m.admin_users_block()}</h3>
				<div class="mt-4 flex flex-col items-start gap-1">
					<button
						type="button"
						disabled
						class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
					>
						{m.admin_users_block()}
					</button>
					<span class="text-[11px] text-stone-500">{m.admin_users_block_caption()}</span>
				</div>
			</div>
		</div>
	</section>
</main>
