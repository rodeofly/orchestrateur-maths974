import { requireAuth } from '$auth/guards';

// Tout l'espace connecté exige une session (garde UX ; la sécurité réelle = RLS).
export const load = async () => {
	await requireAuth();
	return {};
};
