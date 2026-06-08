// set-user-role — un ADMIN change le rôle d'un adulte de SON établissement.
// Toute l'autorisation et les invariants (même tenant, pas mineur, pas self, dernier admin)
// sont vérifiés ATOMIQUEMENT en base par public.admin_set_role (l'appelant est passé après
// vérification de son JWT). @ts-nocheck — runtime Deno.
import { preflight, json, serviceClient, getCaller } from '../_shared/util.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS: Record<string, number> = {
	ok: 200,
	role_invalide: 400,
	self: 403,
	pas_admin: 403,
	autre_tenant: 403,
	mineur: 403,
	introuvable: 404,
	dernier_admin: 409
};

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') return preflight();
	if (req.method !== 'POST') return json(405, { error: 'POST attendu' });
	try {
		const caller = await getCaller(req);
		if (!caller) return json(403, { error: 'non authentifié' });

		const body = await req.json();
		const userId = String(body?.userId ?? '');
		const role = body?.role;
		if (!UUID_RE.test(userId)) return json(400, { error: 'userId invalide' });
		if (role !== 'prof' && role !== 'parent' && role !== 'admin') return json(400, { error: 'rôle invalide' });

		const svc = serviceClient();
		const { data, error } = await svc.rpc('admin_set_role', {
			p_caller: caller.id,
			p_target: userId,
			p_role: role
		});
		if (error) return json(500, { error: error.message });

		const status = String(data);
		if (status === 'ok') return json(200, { ok: true });
		return json(STATUS[status] ?? 400, { error: status });
	} catch (e) {
		return json(500, { error: String(e) });
	}
});
