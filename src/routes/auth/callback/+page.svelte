<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { refreshSession, session } from '$auth/session.svelte';
	import { homeFor } from '$auth/roles';
	import Splash from '$components/ui/Splash.svelte';
	import ErrorState from '$components/ui/ErrorState.svelte';

	let error = $state('');

	onMount(async () => {
		try {
			// Le client Supabase (detectSessionInUrl) consomme le code/hash au démarrage.
			// On relit la session puis on route vers l'espace du rôle.
			await refreshSession();
			if (session.status === 'authed') {
				await goto(`${base}${homeFor(session.role)}`, { replaceState: true });
			} else if (session.status === 'error') {
				error = session.error ?? 'Erreur de connexion.';
			} else {
				error = 'Lien de connexion invalide ou expiré.';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});
</script>

{#if error}
	<div class="wrap">
		<ErrorState title="Connexion impossible" message={error} />
		<p class="back"><a href={`${base}/connexion`}>Retour à la connexion</a></p>
	</div>
{:else}
	<Splash label="Connexion en cours…" />
{/if}

<style>
	.wrap {
		min-height: 100dvh;
		display: grid;
		place-content: center;
	}
	.back {
		text-align: center;
	}
</style>
