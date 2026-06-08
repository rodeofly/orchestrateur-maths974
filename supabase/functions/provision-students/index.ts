// provision-students — un PROF crée un lot de comptes élèves SANS email réel.
// Vérifie l'appelant (JWT) ET qu'il enseigne la classe ciblée, en base (pas le claim).
// Retourne les PIN UNE seule fois (pour impression). @ts-nocheck — runtime Deno.
import { preflight, json, serviceClient, getCaller } from '../_shared/util.ts';
import { hashPin, genPin } from '../_shared/hash.ts';

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') return preflight();
	if (req.method !== 'POST') return json(405, { error: 'POST attendu' });
	try {
		const caller = await getCaller(req);
		if (!caller) return json(401, { error: 'non authentifié' });

		const { classId, students } = await req.json();
		if (!classId || !Array.isArray(students) || students.length === 0) {
			return json(400, { error: 'classId et students[] requis' });
		}

		const svc = serviceClient();

		// La classe existe ? On récupère son établissement (tenant) et son code.
		const { data: cls } = await svc
			.from('classes')
			.select('id, etablissement_id, join_code')
			.eq('id', classId)
			.single();
		if (!cls) return json(404, { error: 'classe introuvable' });

		// L'appelant enseigne-t-il CETTE classe ? (autorité = table)
		const { data: teaches } = await svc
			.from('class_teachers')
			.select('teacher_id')
			.eq('class_id', classId)
			.eq('teacher_id', caller.id)
			.maybeSingle();
		if (!teaches) return json(403, { error: "vous n'enseignez pas cette classe" });

		const created: Array<{ login: string; pin?: string; error?: string }> = [];
		for (const s of students) {
			const login = String(s?.login ?? '').trim();
			if (!login) continue;
			const pin = genPin();
			const studentKey = crypto.randomUUID();
			const email = `${studentKey}@eleve.maths974.invalid`; // email synthétique (jamais réel)
			const displayName = s?.displayName ? String(s.displayName) : null;

			const { data: u, error: ue } = await svc.auth.admin.createUser({
				email,
				email_confirm: true,
				user_metadata: { display_name: displayName }
			});
			if (ue || !u?.user) {
				created.push({ login, error: ue?.message ?? 'création impossible' });
				continue;
			}
			const uid = u.user.id;
			// Le profil est créé par le trigger ; on le complète (rôle/tenant/pseudonyme).
			await svc
				.from('profiles')
				.update({
					role: 'eleve',
					etablissement_id: cls.etablissement_id,
					is_minor: true,
					student_key: studentKey,
					display_name: displayName
				})
				.eq('id', uid);
			await svc.from('class_students').insert({
				class_id: classId,
				student_id: uid,
				student_alias: login
			});
			await svc.from('student_credentials').insert({
				student_id: uid,
				class_code: cls.join_code ?? classId,
				login,
				pin_hash: await hashPin(pin)
			});
			created.push({ login, pin }); // PIN renvoyé UNE fois (impression hors-ligne)
		}

		return json(200, { classCode: cls.join_code ?? classId, created });
	} catch (e) {
		return json(500, { error: String(e) });
	}
});
