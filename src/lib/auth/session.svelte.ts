// État de session réactif (runes). Source de vérité unique = le store `session`,
// tenu à jour par onAuthStateChange (enregistré UNE seule fois). Les gardes lisent
// l'état VIVANT, jamais un instantané figé. Rôle/tenant viennent de la TABLE profiles.
import { browser } from '$app/environment';
import { getSupabase } from '$lib/supabase/client';
import { roleFromProfile, canSimulate, type Role } from './roles';

export type SessionStatus = 'loading' | 'authed' | 'anon' | 'error';

export interface SessionState {
	status: SessionStatus;
	userId: string | null;
	role: Role; // rôle RÉEL (depuis la table profiles)
	simulatedRole: Role | null; // rôle SIMULÉ (« Voir comme… ») — UI seulement
	tenantId: string | null;
	studentKey: string | null;
	displayName: string | null;
	error: string | null;
}

export const session = $state<SessionState>({
	status: 'loading',
	userId: null,
	role: 'visiteur',
	simulatedRole: null,
	tenantId: null,
	studentKey: null,
	displayName: null,
	error: null
});

/** Rôle effectif pour l'UI : le rôle simulé s'il existe, sinon le rôle réel. */
export function effectiveRole(): Role {
	return session.simulatedRole ?? session.role;
}

/** Simuler un rôle inférieur (UI uniquement ; la RLS reste le vrai garde-fou). */
export function simulateRole(target: Role) {
	if (canSimulate(session.role, target)) session.simulatedRole = target;
}

/** Rétablir ses droits réels. */
export function stopSimulating() {
	session.simulatedRole = null;
}

function setAnon() {
	session.status = 'anon';
	session.userId = null;
	session.role = 'visiteur';
	session.simulatedRole = null;
	session.tenantId = null;
	session.studentKey = null;
	session.displayName = null;
	session.error = null;
}

function fail(e: unknown) {
	session.status = 'error';
	session.error = e instanceof Error ? e.message : String(e);
}

interface ProfileRow {
	role?: unknown;
	etablissement_id?: string | null;
	student_key?: string | null;
	display_name?: string | null;
}

async function hydrateProfile(userId: string) {
	const sb = getSupabase();
	// RLS : un utilisateur ne lit que SON profil.
	const { data, error } = await sb
		.from('profiles')
		.select('role, etablissement_id, student_key, display_name')
		.eq('id', userId)
		.single();
	if (error) throw error;
	const row = (data ?? {}) as ProfileRow;
	session.status = 'authed';
	session.userId = userId;
	session.role = roleFromProfile(row.role);
	session.tenantId = row.etablissement_id ?? null;
	session.studentKey = row.student_key ?? null;
	session.displayName = row.display_name ?? null;
	session.error = null;
}

let listening = false;

async function loadOnce(): Promise<void> {
	if (!browser) {
		setAnon();
		return;
	}
	try {
		const sb = getSupabase();
		// Listener enregistré UNE seule fois : suit login/logout/refresh ensuite.
		if (!listening) {
			listening = true;
			sb.auth.onAuthStateChange((_event, s) => {
				if (!s) setAnon();
				else hydrateProfile(s.user.id).catch(fail);
			});
		}
		const {
			data: { session: s }
		} = await sb.auth.getSession();
		if (!s) setAnon();
		else await hydrateProfile(s.user.id);
	} catch (e) {
		fail(e);
	}
}

let loaded: Promise<void> | null = null;

/** Garantit que le 1er chargement de session a eu lieu (idempotent). */
export function ensureSessionLoaded(): Promise<void> {
	return (loaded ??= loadOnce());
}

/** Relit la session courante (ex. retour de magic link), sans réenregistrer le listener. */
export async function refreshSession(): Promise<void> {
	loaded = loadOnce();
	await loaded;
}

export async function signOut() {
	if (!browser) return;
	await getSupabase().auth.signOut(); // déclenche onAuthStateChange → setAnon
	setAnon();
}
