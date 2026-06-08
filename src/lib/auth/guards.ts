// Gardes de routes — utilisées dans les load() des +layout.ts.
// RAPPEL : garde = UX/redirection seulement. La vraie barrière est la RLS Postgres.
// Elles lisent l'état VIVANT `session` (jamais un instantané figé).
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { ensureSessionLoaded, session, effectiveRole } from './session.svelte';
import { homeFor, type Role } from './roles';

export async function requireAuth() {
	await ensureSessionLoaded();
	if (session.status === 'error') return; // laisse +error.svelte s'afficher
	if (session.status !== 'authed') throw redirect(307, `${base}/connexion`);
}

export async function requireRole(role: Role) {
	await requireAuth();
	// On compare au rôle EFFECTIF : en simulation, l'admin n'accède plus qu'au rôle simulé
	// (et y est borné). La RLS reste le vrai garde-fou sur les données.
	if (session.status === 'authed' && effectiveRole() !== role) {
		throw redirect(307, `${base}${homeFor(effectiveRole())}`);
	}
}

export async function requireAnon() {
	await ensureSessionLoaded();
	if (session.status === 'authed') throw redirect(307, `${base}${homeFor(session.role)}`);
}
