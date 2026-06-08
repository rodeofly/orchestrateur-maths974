import { requireRole } from '$auth/guards';

export const load = async () => {
	await requireRole('prof');
	return {};
};
