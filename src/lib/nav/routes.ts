// Navigation déclarative par rôle + helper de href (gère le base path GitHub Pages).
import type { Role } from '$auth/roles';

export interface NavItem {
	href: string; // chemin app (sans base), ex '/prof'
	label: string;
}

// resolveHref(base, '/prof') -> '/prof' en dev, '/orchestrateur-maths974/prof' en prod.
// Pur → testable. (Piège connu : oublier le base path casse tous les liens sur Pages.)
export function resolveHref(base: string, path: string): string {
	if (!path.startsWith('/')) return path; // lien externe ou relatif : inchangé
	if (path === '/') return base || '/';
	return base + path;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
	admin: [
		{ href: '/admin', label: 'Tableau de bord' },
		{ href: '/admin/etablissements', label: 'Établissements' },
		{ href: '/admin/utilisateurs', label: 'Utilisateurs' }
	],
	prof: [
		{ href: '/prof', label: 'Mes classes' },
		{ href: '/prof/annee', label: 'Progression' },
		{ href: '/prof/parcours', label: 'Séances' },
		{ href: '/prof/bibliotheque', label: 'Bibliothèque' },
		{ href: '/prof/cockpit', label: 'Cockpit' },
		{ href: '/prof/seance', label: 'Aperçu activité' }
	],
	eleve: [
		{ href: '/eleve', label: 'Mon espace' },
		{ href: '/eleve/jouer', label: 'Jouer' },
		{ href: '/eleve/competences', label: 'Mes compétences' }
	],
	parent: [
		{ href: '/parent', label: 'Mes enfants' },
		{ href: '/parent/consentement', label: 'Consentement' }
	],
	visiteur: [{ href: '/', label: 'Accueil' }]
};
