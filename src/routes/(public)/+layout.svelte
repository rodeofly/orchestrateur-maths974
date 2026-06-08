<script lang="ts">
	import type { Snippet } from 'svelte';
	import { base } from '$app/paths';
	let { children }: { children: Snippet } = $props();
</script>

<header class="pub">
	<a class="brand" href={`${base}/`} aria-label="Maths974 — accueil"><img src={`${base}/logo.svg`} alt="Maths974" /></a>
	<nav>
		<a href={`${base}/a-propos`}>À propos</a>
		<a class="cta" href={`${base}/connexion`}>Connexion</a>
	</nav>
</header>

<main class="pub-main">{@render children()}</main>

<footer class="pub-foot">
	<span>© Maths974 — association</span>
	<span class="credit">Exercices propulsés par <a href="https://forge.apps.education.fr/coopmaths/mathalea" target="_blank" rel="noopener">MathALEA — CoopMaths</a> (AGPL)</span>
	<a href={`${base}/confidentialite`}>Confidentialité & RGPD</a>
</footer>

<style>
	.pub {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-5);
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.brand {
		display: inline-flex;
		align-items: center;
	}
	.brand img {
		height: 2.1rem;
		width: auto;
		display: block;
	}
	.credit {
		font-size: 0.78rem;
		opacity: 0.8;
	}
	.credit a {
		color: inherit;
		text-decoration: underline;
	}
	.pub nav {
		display: flex;
		gap: var(--space-4);
		align-items: center;
	}
	.cta {
		background: var(--brand);
		color: #fff;
		padding: 0.5rem 1rem;
		border-radius: var(--radius);
	}
	.pub-main {
		max-width: 1100px;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4);
	}
	.pub-foot {
		display: flex;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-5);
		border-top: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 0.9rem;
	}
</style>
