// Autorisation admin — lue EN BASE (jamais le claim JWT). Factorisée (audit must-fix #6).
// @ts-nocheck — runtime Deno.
import { getCaller, serviceClient } from './util.ts';

/** Renvoie { id, tenant } si l'appelant est ADMIN d'un établissement, sinon null. */
export async function getAdminCaller(req: Request): Promise<{ id: string; tenant: string } | null> {
	const caller = await getCaller(req); // vérifie le JWT de l'appelant
	if (!caller) return null;
	const svc = serviceClient();
	const { data } = await svc
		.from('profiles')
		.select('role, etablissement_id')
		.eq('id', caller.id)
		.single();
	if (!data || data.role !== 'admin' || !data.etablissement_id) return null;
	return { id: caller.id, tenant: data.etablissement_id as string };
}
