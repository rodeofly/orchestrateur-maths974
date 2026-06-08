<script lang="ts">
	import type { Snippet } from 'svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { NAV_BY_ROLE, resolveHref } from '$lib/nav/routes';
	import { ROLE_LABELS, homeFor, simulatableRoles, type Role } from '$auth/roles';
	import { session, signOut, effectiveRole, simulateRole } from '$auth/session.svelte';
	import RoleBadge from '$components/ui/RoleBadge.svelte';
	import Avatar from '$components/ui/Avatar.svelte';

	let { children }: { children: Snippet } = $props();

	// Chrome piloté par le rôle EFFECTIF ; le sélecteur « Voir comme » par le rôle RÉEL.
	const role = $derived(effectiveRole());
	const items = $derived(NAV_BY_ROLE[role] ?? []);
	const sims = $derived(simulatableRoles(session.role));
	const seed = $derived(session.studentKey ?? session.userId ?? '');

	function isActive(href: string): boolean {
		return page.url.pathname === resolveHref(base, href);
	}
	async function logout() {
		await signOut();
		await goto(`${base}/`, { replaceState: true });
	}
	async function onSimulate(e: Event) {
		const el = e.currentTarget as HTMLSelectElement;
		const target = el.value as Role;
		el.value = '';
		if (!target) return;
		simulateRole(target);
		await goto(`${base}${homeFor(target)}`);
	}
</script>

<div class="shell" data-role={role}>
	<a href="#contenu" class="skip-link">Aller au contenu</a>

	<header class="topbar">
		<a class="brand" href={resolveHref(base, '/')} aria-label="Maths974 — accueil">
			<img src={resolveHref(base, '/logo.svg')} alt="Maths974" />
		</a>
		<RoleBadge {role} />
		<span class="spacer"></span>
		{#if sims.length}
			<select class="simsel" onchange={onSimulate} aria-label="Voir comme un autre rôle" title="Voir comme…">
				<option value="">👁 Voir comme…</option>
				{#each sims as r (r)}<option value={r}>{ROLE_LABELS[r]}</option>{/each}
			</select>
		{/if}
		<Avatar name={session.displayName ?? ROLE_LABELS[role]} {seed} />
		<button class="signout" onclick={logout}>Déconnexion</button>
	</header>

	<div class="layout">
		<nav class="nav" aria-label="Navigation principale">
			{#each items as it (it.href)}
				<a
					class="nav-item"
					class:active={isActive(it.href)}
					href={resolveHref(base, it.href)}
					aria-current={isActive(it.href) ? 'page' : undefined}>{it.label}</a
				>
			{/each}
		</nav>
		<main id="contenu" class="content">{@render children()}</main>
	</div>
</div>

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: var(--z-nav);
	}
	.brand {
		display: inline-flex;
		align-items: center;
	}
	.brand img {
		height: 2rem;
		width: auto;
		display: block;
	}
	.spacer {
		flex: 1;
	}
	.simsel {
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: var(--radius);
		padding: 0.4rem 0.6rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.signout {
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: var(--radius);
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.layout {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr;
	}
	.nav {
		display: flex;
		gap: var(--space-1);
		padding: var(--space-2);
		background: var(--surface);
		border-top: 1px solid var(--border);
		position: sticky;
		bottom: 0;
		overflow-x: auto;
		order: 2;
	}
	.nav-item {
		flex: 1;
		text-align: center;
		white-space: nowrap;
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius);
		color: var(--text-muted);
		font-weight: 600;
		font-size: 0.9rem;
	}
	.nav-item.active {
		color: var(--role-accent);
		background: var(--role-accent-soft);
	}
	.content {
		order: 1;
		padding: var(--space-5) var(--space-4);
		max-width: 1100px;
		width: 100%;
		margin: 0 auto;
	}

	@media (min-width: 768px) {
		.layout {
			grid-template-columns: 15rem 1fr;
		}
		.nav {
			flex-direction: column;
			border-top: none;
			border-right: 1px solid var(--border);
			position: sticky;
			top: 3.5rem;
			align-self: start;
			height: calc(100dvh - 3.5rem);
			order: 0;
		}
		.nav-item {
			flex: none;
			text-align: left;
		}
	}
</style>
