import { describe, it, expect } from 'vitest';
import { getRituel, normalizeSteps, withRituelCompetences, RITUELS } from './rituels';

describe('rituels — modèle', () => {
	it('getRituel renvoie la def, repli sur libre si inconnu', () => {
		expect(getRituel('rapido').competences).toEqual(['ca', 're']);
		expect(getRituel('zefor').competences).toEqual(['ra', 'ch']);
		// @ts-expect-error type inconnu volontaire
		expect(getRituel('nimporte').type).toBe('libre');
	});

	it('tous les rituels du schéma sont présents', () => {
		const types = RITUELS.map((r) => r.type);
		for (const t of ['rapido', 'zefor', 'probleme', 'evaluation', 'bilan', 'divertissement']) {
			expect(types).toContain(t);
		}
	});

	it('normalizeSteps tolère l’ancien format string[] (→ libre)', () => {
		expect(normalizeSteps(['lambdazef'])).toEqual([{ rituel: 'libre', activities: ['lambdazef'] }]);
		expect(normalizeSteps([{ rituel: 'rapido', activities: ['a', 'b'] }])).toEqual([
			{ rituel: 'rapido', titre: undefined, activities: ['a', 'b'] }
		]);
		expect(normalizeSteps(null)).toEqual([]);
	});

	it('withRituelCompetences fusionne activité + rituel (dédup), ok suit passed', () => {
		// activité émet 'ca' ; rituel rapido ajoute 're' (et 'ca' déjà présent → pas de doublon)
		const merged = withRituelCompetences([{ id: 'ca', ok: true }], 'rapido', true);
		expect(merged.map((c) => c.id).sort()).toEqual(['ca', 're']);
		expect(merged.every((c) => c.ok)).toBe(true);

		// activité n'émet rien → le rituel garantit ses compétences socle
		const fromRituel = withRituelCompetences([], 'zefor', false);
		expect(fromRituel.map((c) => c.id).sort()).toEqual(['ch', 'ra']);
		expect(fromRituel.every((c) => c.ok === false)).toBe(true);
	});
});
