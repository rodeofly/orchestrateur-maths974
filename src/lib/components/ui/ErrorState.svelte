<script lang="ts">
	let {
		title = 'Oups, un souci est survenu',
		message = '',
		onretry
	}: { title?: string; message?: string; onretry?: () => void } = $props();
</script>

<div class="error" role="alert">
	<div class="icon" aria-hidden="true">⚠️</div>
	<h2>{title}</h2>
	{#if message}<p class="msg">{message}</p>{/if}
	{#if onretry}
		<button class="retry" onclick={onretry}>Réessayer</button>
	{/if}
</div>

<style>
	.error {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: var(--space-3);
		padding: var(--space-8) var(--space-4);
	}
	.icon {
		font-size: 2.5rem;
	}
	.msg {
		color: var(--text-muted);
		max-width: 34rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}
	.retry {
		padding: 0.6rem 1.1rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--surface);
		font-weight: 600;
		cursor: pointer;
	}
</style>
