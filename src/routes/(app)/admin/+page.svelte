<script lang="ts">
	import EmptyState from '$components/ui/EmptyState.svelte';
</script>

<h1>Administration</h1>
<p class="sub">Pilotage des établissements, classes et comptes.</p>
<EmptyState
	icon="🏫"
	title="Tableau de bord administrateur"
	description="La gestion des établissements et des utilisateurs arrivera après la fondation v0 (auth + rôles)."
/>

<style>
	.sub {
		color: var(--text-muted);
		margin-bottom: var(--space-4);
	}
</style>
