// erase-student — droit à l'effacement RGPD. Réservé à l'ADMIN de l'établissement de l'élève.
// La suppression du compte auth cascade sur profiles/class_students/attempts/credentials
// (FK on delete cascade). @ts-nocheck — runtime Deno.
import { preflight, json, serviceClient, getCaller } from '../_shared/util.ts';

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') return preflight();
	if (req.method !== 'POST') return json(405, { error: 'POST attendu' });
	try {
		const caller = await getCaller(req);
		if (!caller) return json(401, { error: 'non authentifié' });

		const { studentId } = await req.json();
		if (!studentId) return json(400, { error: 'studentId requis' });

		const svc = serviceClient();
		const { data: student } = await svc
			.from('profiles')
			.select('etablissement_id')
			.eq('id', studentId)
			.single();
		const { data: admin } = await svc
			.from('profiles')
			.select('role, etablissement_id')
			.eq('id', caller.id)
			.single();

		if (
			!student ||
			!admin ||
			admin.role !== 'admin' ||
			!admin.etablissement_id ||
			admin.etablissement_id !== student.etablissement_id
		) {
			return json(403, { error: "réservé à l'administrateur de l'établissement" });
		}

		const { error } = await svc.auth.admin.deleteUser(studentId);
		if (error) return json(500, { error: error.message });
		return json(200, { ok: true });
	} catch (e) {
		return json(500, { error: String(e) });
	}
});
