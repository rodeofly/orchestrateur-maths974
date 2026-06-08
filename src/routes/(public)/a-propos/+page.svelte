<script lang="ts">
	import { base } from '$app/paths';
</script>

<article class="prose">
	<h1>À propos</h1>
	<p>
		L’orchestrateur Maths974 relie les applications pédagogiques de l’association (Blokaly974,
		Aljeb974, GS.C4.2026, Pezali974, et la constellation de petites apps) autour d’un objectif
		unique : <strong>apprendre et être évalué</strong>, quel que soit le support.
	</p>
	<h2>Le principe</h2>
	<p>
		Chaque activité garde sa propre détection de réussite mais parle un langage commun (le
		référentiel de compétences + une « tentative » au format unifié). L’orchestrateur permet au
		professeur de composer une séquence d’activités — comme un metteur en scène — et d’en suivre les
		résultats.
	</p>
	<h2>Vie privée</h2>
	<p>
		Public collège : la protection des données des élèves mineurs est une priorité absolue.
		Minimisation des données, hébergement européen, aucune publicité. Voir la
		<a href={`${base}/confidentialite`}>politique de confidentialité</a>.
	</p>
</article>

<style>
	.prose {
		max-width: 42rem;
		margin: 0 auto;
		display: grid;
		gap: var(--space-4);
	}
	.prose h2 {
		margin-top: var(--space-4);
		font-size: 1.25rem;
	}
	.prose p {
		color: var(--text);
		line-height: 1.7;
	}
</style>
