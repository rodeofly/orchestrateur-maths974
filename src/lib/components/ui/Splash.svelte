<script lang="ts">
	let { label = 'Chargement…' }: { label?: string } = $props();
</script>

<div class="splash" role="status" aria-live="polite">
	<div class="spinner" aria-hidden="true"></div>
	<p>{label}</p>
</div>

<style>
	.splash {
		min-height: 60dvh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: var(--space-4);
		color: var(--text-muted);
	}
	.spinner {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		border: 3px solid var(--gray-200);
		border-top-color: var(--brand);
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
