// Référentiel des rôles — logique PURE (aucun import réseau / $app) → testable unitairement.
// RÈGLE DE SÉCURITÉ : ce module ne fait QUE de l'UX/routage. L'autorité d'autorisation
// est la RLS Postgres (cf. supabase/migrations/0002_rls.sql), jamais le code client.

export const ROLES = ['admin', 'prof', 'eleve', 'parent', 'visiteur'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Administrateur',
	prof: 'Enseignant',
	eleve: 'Élève',
	parent: 'Parent',
	visiteur: 'Visiteur'
};

// Page d'accueil canonique de chaque rôle après connexion.
export const HOME_BY_ROLE: Record<Role, string> = {
	admin: '/admin',
	prof: '/prof',
	eleve: '/eleve',
	parent: '/parent',
	visiteur: '/'
};

export function homeFor(role: Role): string {
	return HOME_BY_ROLE[role] ?? '/';
}

export function isRole(x: unknown): x is Role {
	return typeof x === 'string' && (ROLES as readonly string[]).includes(x);
}

// Défaut = le rôle le MOINS privilégié (audit : ne JAMAIS défaulter sur 'admin').
export function roleFromProfile(raw: unknown): Role {
	return isRole(raw) ? raw : 'visiteur';
}

// Espace privé détenu par chaque rôle (préfixe de route).
const OWNED_PREFIX: ReadonlyArray<readonly [string, Role]> = [
	['/admin', 'admin'],
	['/prof', 'prof'],
	['/eleve', 'eleve'],
	['/parent', 'parent']
];

// Rôle requis pour une route, ou null si publique.
export function requiredRoleFor(path: string): Role | null {
	for (const [prefix, role] of OWNED_PREFIX) {
		if (path === prefix || path.startsWith(prefix + '/')) return role;
	}
	return null;
}

// Un rôle peut-il accéder à un chemin ? (garde UX uniquement.)
export function canAccess(role: Role, path: string): boolean {
	const need = requiredRoleFor(path);
	if (need === null) return true; // route publique
	return role === need;
}

// --- Simulation de rôle (« Voir comme… », façon Moodle) ---
// Échelle descendante du + au - privilégié. `parent` est un rôle latéral, hors échelle.
// On ne peut SIMULER qu'un rôle STRICTEMENT en dessous du sien (jamais monter).
export const SIM_LADDER: Role[] = ['admin', 'prof', 'eleve', 'visiteur'];

export function simulatableRoles(real: Role): Role[] {
	const i = SIM_LADDER.indexOf(real);
	return i < 0 ? [] : SIM_LADDER.slice(i + 1);
}

export function canSimulate(real: Role, target: Role): boolean {
	return simulatableRoles(real).includes(target);
}
