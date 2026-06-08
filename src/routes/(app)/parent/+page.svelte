<script lang="ts">
	import EmptyState from '$components/ui/EmptyState.svelte';
	import Button from '$components/ui/Button.svelte';
	import { base } from '$app/paths';
</script>

<h1>Mes enfants</h1>
<p class="sub">Suivez le parcours de vos enfants, en transparence.</p>
<EmptyState
	icon="👨‍👩‍👧"
	title="Aucun enfant rattaché"
	description="Le rattachement parent-enfant et le consentement arrivent en v0."
>
	{#snippet action()}
		<Button variant="ghost" href={`${base}/parent/consentement`}>Gérer le consentement</Button>
	{/snippet}
</EmptyState>

<style>
	.sub {
		color: var(--text-muted);
		margin-bottom: var(--space-4);
	}
</style>
