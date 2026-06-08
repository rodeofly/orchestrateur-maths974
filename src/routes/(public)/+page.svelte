<script lang="ts">
	import { base } from '$app/paths';
	import { ROLES, ROLE_LABELS, type Role } from '$auth/roles';

	const PITCH: Record<Role, string> = {
		prof: 'Compose une séance en 2 minutes : choisis un parcours prêt à l’emploi ou crée le tien, rythmé et chronométré.',
		eleve: 'Reprends ta séance, joue les activités, suis tes compétences qui progressent.',
		parent: 'Suis le parcours de tes enfants, en transparence.',
		admin: 'Pilote les établissements, les classes et les comptes.',
		visiteur: 'Découvre les activités en libre accès, sans compte.'
	};
	const ORDER: Role[] = ['prof', 'eleve', 'parent', 'admin'];
</script>

<section class="hero">
	<h1>L’orchestrateur <span>Maths974</span></h1>
	<p class="lead">
		Le tableau de bord du professeur metteur en scène : un seul endroit pour composer, lancer et
		suivre des parcours d’activités pédagogiques — apprendre <em>et</em> être évalué, tous supports
		confondus.
	</p>
	<div class="actions">
		<a class="primary" href={`${base}/connexion`}>Se connecter</a>
		<a class="ghost" href={`${base}/a-propos`}>En savoir plus</a>
	</div>
</section>

<section class="roles" aria-label="Espaces par profil">
	{#each ORDER as r (r)}
		<article class="role-card" data-role={r}>
			<h2>{ROLE_LABELS[r]}</h2>
			<p>{PITCH[r]}</p>
		</article>
	{/each}
</section>

<style>
	.hero {
		text-align: center;
		padding: var(--space-8) var(--space-2);
	}
	.hero h1 {
		font-size: clamp(2rem, 5vw, 3.2rem);
	}
	.hero h1 span {
		color: var(--brand);
	}
	.lead {
		max-width: 44rem;
		margin: var(--space-4) auto 0;
		font-size: 1.15rem;
		color: var(--text-muted);
	}
	.actions {
		display: flex;
		gap: var(--space-3);
		justify-content: center;
		margin-top: var(--space-5);
		flex-wrap: wrap;
	}
	.actions a {
		padding: 0.7rem 1.4rem;
		border-radius: var(--radius);
		font-weight: 700;
	}
	.primary {
		background: var(--brand);
		color: #fff;
	}
	.ghost {
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
	}
	.roles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: var(--space-4);
		margin-top: var(--space-6);
	}
	.role-card {
		background: var(--surface);
		border: 1px solid var(--border);
		border-top: 4px solid var(--role-accent);
		border-radius: var(--radius-lg);
		padding: var(--space-5);
		box-shadow: var(--shadow-sm);
	}
	.role-card h2 {
		color: var(--role-accent);
		font-size: 1.1rem;
		margin-bottom: var(--space-2);
	}
	.role-card p {
		color: var(--text-muted);
		font-size: 0.95rem;
	}
</style>
