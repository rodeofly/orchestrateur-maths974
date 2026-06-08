// invite-user — un ADMIN invite un adulte (prof|parent) par e-mail dans SON établissement.
// Sécurisé d'après l'audit : tenant lu en base (jamais du body), UPDATE bornée anti-vol de
// compte, nettoyage des orphelins, redirectTo en dur, réponse neutre anti-énumération.
// @ts-nocheck — runtime Deno.
import { preflight, json, serviceClient } from '../_shared/util.ts';
import { getAdminCaller } from '../_shared/admin.ts';

// redirectTo CONSTRUIT CÔTÉ SERVEUR (aucune donnée client). Doit figurer dans les Redirect URLs Supabase.
const APP_REDIRECT = 'https://rodeofly.github.io/orchestrateur-maths974/auth/callback';
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') return preflight();
	if (req.method !== 'POST') return json(405, { error: 'POST attendu' });
	try {
		const admin = await getAdminCaller(req);
		if (!admin) return json(403, { error: 'réservé à un administrateur' });

		const body = await req.json();
		const email = String(body?.email ?? '').trim().toLowerCase();
		const role = body?.role;
		if (!email || email.length > 200 || !EMAIL_RE.test(email)) return json(400, { error: 'e-mail invalide' });
		if (role !== 'prof' && role !== 'parent') return json(400, { error: 'rôle invalide (prof ou parent)' });

		const svc = serviceClient();
		const { data: inv, error: ie } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo: APP_REDIRECT });
		// Anti-énumération : e-mail déjà utilisé / erreur → réponse NEUTRE, on ne touche à rien.
		if (ie || !inv?.user) return json(200, { ok: true });

		const newId = inv.user.id;
		// UPDATE BORNÉE : n'attache QUE si le profil est frais (tenant NULL, role eleve via trigger).
		// Un e-mail préexistant (autre tenant) a déjà un tenant → 0 ligne → aucune modification.
		const { data: upd, error: ue } = await svc
			.from('profiles')
			.update({ role, etablissement_id: admin.tenant, is_minor: false })
			.eq('id', newId)
			.is('etablissement_id', null)
			.eq('role', 'eleve')
			.select('id');
		if (ue) {
			// pas d'orphelin authentifiable
			await svc.auth.admin.deleteUser(newId).catch(() => {});
			return json(500, { error: 'rattachement impossible' });
		}
		if (upd && upd.length === 1) {
			await svc.from('admin_audit').insert({
				actor_id: admin.id,
				actor_etablissement_id: admin.tenant,
				action: 'invite',
				target_id: newId,
				new_role: role
			});
		}
		// Réponse identique (nouveau ou préexistant) → pas de divulgation d'appartenance.
		return json(200, { ok: true });
	} catch (e) {
		return json(500, { error: String(e) });
	}
});
