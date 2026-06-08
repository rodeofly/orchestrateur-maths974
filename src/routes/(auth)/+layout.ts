import { requireAnon } from '$auth/guards';

// Espace de connexion : un utilisateur déjà authentifié est renvoyé vers son espace.
export const load = async () => {
	await requireAnon();
	return {};
};
