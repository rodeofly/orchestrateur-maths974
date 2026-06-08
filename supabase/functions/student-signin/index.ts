// student-signin — connexion élève SANS email : {classCode, login, pin}.
// Vérifie le PIN (haché), puis émet un token de session (magic link) que le client
// confirme via verifyOtp. @ts-nocheck — runtime Deno.
import { preflight, json, serviceClient } from '../_shared/util.ts';
import { verifyPin } from '../_shared/hash.ts';

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') return preflight();
	if (req.method !== 'POST') return json(405, { error: 'POST attendu' });
	try {
		const { classCode, login, pin } = await req.json();
		if (!classCode || !login || !pin) return json(400, { error: 'champs requis' });

		const svc = serviceClient();
		const { data: cred } = await svc
			.from('student_credentials')
			.select('student_id, pin_hash')
			.eq('class_code', String(classCode).trim())
			.eq('login', String(login).trim())
			.maybeSingle();

		// Réponse identique si identifiant inconnu OU PIN faux (anti-énumération).
		if (!cred || !(await verifyPin(String(pin), cred.pin_hash))) {
			return json(401, { error: 'identifiants invalides' });
		}

		const { data: u } = await svc.auth.admin.getUserById(cred.student_id);
		if (!u?.user?.email) return json(500, { error: 'compte élève incomplet' });

		// Génère un magic link et renvoie SON hashed_token ; le client fait verifyOtp.
		const { data: link, error } = await svc.auth.admin.generateLink({
			type: 'magiclink',
			email: u.user.email
		});
		if (error || !link?.properties?.hashed_token) {
			return json(500, { error: 'génération de session impossible' });
		}
		// On ne renvoie JAMAIS l'email synthétique au client, seulement le token.
		return json(200, { token_hash: link.properties.hashed_token });
	} catch (e) {
		return json(500, { error: String(e) });
	}
});
