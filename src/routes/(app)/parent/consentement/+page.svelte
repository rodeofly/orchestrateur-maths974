<script lang="ts">
	import Card from '$components/ui/Card.svelte';
</script>

<h1>Consentement</h1>
<p class="sub">Base légale et information des familles (RGPD, mineurs).</p>

<Card>
	<h2>Traitement des données de votre enfant</h2>
	<p>
		Le suivi strictement pédagogique relève de la mission de service public de l’établissement. Tout
		traitement étendu (suivi longitudinal, agrégation inter-applications) reste <strong>désactivé</strong>
		tant que votre consentement éclairé n’est pas enregistré.
	</p>
	<p class="todo">
		⚙️ v0 : ce gating sera appliqué techniquement au moment où une activité est lancée (le runner
		arrive après la fondation auth + rôles). Voir la
		<a href="../confidentialite">politique de confidentialité</a>.
	</p>
</Card>

<style>
	.sub {
		color: var(--text-muted);
		margin-bottom: var(--space-4);
	}
	h2 {
		font-size: 1.15rem;
		margin-bottom: var(--space-2);
	}
	p {
		line-height: 1.6;
		margin-bottom: var(--space-3);
	}
	.todo {
		font-size: 0.9rem;
		color: var(--text-muted);
	}
</style>
