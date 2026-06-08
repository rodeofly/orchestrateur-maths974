// Modèle des RITUELS — le cœur d'une séance Maths974. Une séance = une suite de rituels
// typés ; chaque rituel travaille des compétences socle (ch/mo/re/ra/ca/co) et est rempli
// d'activités du catalogue. Mapping compétences repris du schéma méthode de Flo.

export type RituelType =
	| 'rapido'
	| 'zefor'
	| 'probleme'
	| 'evaluation'
	| 'bilan'
	| 'divertissement'
	| 'libre';

export interface RituelDef {
	type: RituelType;
	label: string;
	emoji: string;
	competences: string[]; // codes macro ch/mo/re/ra/ca/co
	dureeMin: number; // durée indicative (minutes), pour le pilotage en séance
	description: string;
}

export const RITUELS: RituelDef[] = [
	{ type: 'rapido', label: 'Rapido', emoji: '⚡', competences: ['ca', 're'], dureeMin: 5, description: 'Automatismes : calculer, représenter.' },
	{ type: 'zefor', label: 'Zéfor', emoji: '🥚', competences: ['ra', 'ch'], dureeMin: 10, description: 'Raisonner, chercher (indices adaptatifs).' },
	{ type: 'probleme', label: 'Résolution de problèmes', emoji: '🧩', competences: ['ra', 'mo'], dureeMin: 15, description: 'Raisonner, modéliser.' },
	{ type: 'evaluation', label: 'Évaluation', emoji: '📝', competences: ['ca'], dureeMin: 10, description: 'Bilan noté.' },
	{ type: 'bilan', label: 'Bilan de séance', emoji: '🔎', competences: ['ch', 'co'], dureeMin: 5, description: 'Chercher, communiquer.' },
	{ type: 'divertissement', label: 'Divertissement', emoji: '🎉', competences: [], dureeMin: 5, description: 'Récompense, plaisir.' },
	{ type: 'libre', label: 'Libre', emoji: '🎯', competences: [], dureeMin: 10, description: 'Activité hors rituel typé.' }
];

export function getRituel(type: RituelType): RituelDef {
	return RITUELS.find((r) => r.type === type) ?? RITUELS[RITUELS.length - 1];
}

// Un pas de séance = un rituel rempli d'activités (ids du catalogue).
export interface SeanceStep {
	rituel: RituelType;
	titre?: string;
	activities: string[];
}

// Tolère l'ancien format (`string[]` d'activités) → rituel 'libre'.
export function normalizeSteps(raw: unknown): SeanceStep[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((s): SeanceStep => {
		if (typeof s === 'string') return { rituel: 'libre', activities: [s] };
		if (s && typeof s === 'object') {
			const o = s as Record<string, unknown>;
			const rituel = (o.rituel as RituelType) ?? 'libre';
			const activities = Array.isArray(o.activities) ? (o.activities as string[]) : [];
			return { rituel, titre: o.titre as string | undefined, activities };
		}
		return { rituel: 'libre', activities: [] };
	});
}

// Fusionne les compétences émises par l'activité avec celles du RITUEL (dédup par id).
// Garantit qu'un rituel contribue toujours ses compétences socle, même si l'activité n'émet rien.
export function withRituelCompetences(
	competencies: unknown,
	rituelType: RituelType,
	passed: boolean
): Array<{ id: string; ok: boolean; weight?: number }> {
	const out: Array<{ id: string; ok: boolean; weight?: number }> = [];
	const seen = new Set<string>();
	const list = Array.isArray(competencies) ? competencies : [];
	for (const c of list) {
		const id = typeof c === 'string' ? c : (c as { id?: string })?.id;
		if (!id || seen.has(id)) continue;
		seen.add(id);
		if (typeof c === 'string') out.push({ id, ok: passed });
		else out.push({ id, ok: !!(c as { ok?: boolean }).ok, weight: (c as { weight?: number }).weight });
	}
	for (const id of getRituel(rituelType).competences) {
		if (seen.has(id)) continue;
		seen.add(id);
		out.push({ id, ok: passed });
	}
	return out;
}
