<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import ErrorState from '$components/ui/ErrorState.svelte';
</script>

<div class="wrap">
	<ErrorState
		title="Page introuvable ou accès impossible"
		message={page.error?.message ?? `Erreur ${page.status}`}
		onretry={() => location.reload()}
	/>
	<p class="home"><a href={`${base}/`}>← Retour à l'accueil</a></p>
</div>

<style>
	.wrap {
		min-height: 100dvh;
		display: grid;
		place-content: center;
	}
	.home {
		text-align: center;
	}
</style>
