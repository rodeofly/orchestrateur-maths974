<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		icon = '✨',
		title,
		description = '',
		action
	}: { icon?: string; title: string; description?: string; action?: Snippet } = $props();
</script>

<div class="empty">
	<div class="icon" aria-hidden="true">{icon}</div>
	<h2>{title}</h2>
	{#if description}<p>{description}</p>{/if}
	{#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: var(--space-3);
		padding: var(--space-8) var(--space-4);
		color: var(--text-muted);
	}
	.icon {
		font-size: 2.5rem;
	}
	h2 {
		color: var(--text);
		font-size: 1.2rem;
	}
	p {
		max-width: 32rem;
	}
</style>
