<script lang="ts">
	import '$styles/app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ensureSessionLoaded, session, stopSimulating } from '$auth/session.svelte';
	import { ROLE_LABELS, homeFor } from '$auth/roles';

	let { children } = $props();

	// Démarre tôt le chargement de session (idempotent). Les gardes l'awaitent.
	ensureSessionLoaded();

	async function restore() {
		const home = homeFor(session.role);
		stopSimulating();
		await goto(`${base}${home}`);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if session.simulatedRole}
	<div class="sim-banner" role="status">
		<span>👁 Tu vois l'application comme <strong>{ROLE_LABELS[session.simulatedRole]}</strong> (simulation)</span>
		<button onclick={restore}>↩ Rétablir mes droits</button>
	</div>
{/if}

{@render children()}

<style>
	.sim-banner {
		position: sticky;
		top: 0;
		z-index: var(--z-modal);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		padding: 0.5rem var(--space-4);
		background: #1e293b;
		color: #fff;
		font-size: 0.9rem;
	}
	.sim-banner button {
		border: 1px solid rgba(255, 255, 255, 0.4);
		background: transparent;
		color: #fff;
		border-radius: var(--radius);
		padding: 0.25rem 0.7rem;
		font-weight: 600;
		cursor: pointer;
	}
	.sim-banner button:hover {
		background: rgba(255, 255, 255, 0.12);
	}
</style>
