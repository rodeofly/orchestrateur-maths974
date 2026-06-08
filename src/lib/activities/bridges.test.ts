import { describe, it, expect } from 'vitest';
import { bridgeFor } from './bridges';

describe('bridges — adaptateurs « bridged » (Tier 2)', () => {
	it('expose le bridge MathALEA sous la source coopmaths, rien pour les autres', () => {
		expect(bridgeFor('coopmaths')).toBeTypeOf('function');
		expect(bridgeFor('lambdazef')).toBeUndefined(); // app native (m974), pas de bridge
		expect(bridgeFor(undefined)).toBeUndefined();
	});

	const mathalea = bridgeFor('coopmaths')!;

	it('ignore les messages qui ne sont pas un mathalea:score', () => {
		expect(mathalea({ type: 'm974:attempt' }, 'https://coopmaths.fr')).toBeNull();
		expect(mathalea({ action: 'mathalea:score' }, 'https://coopmaths.fr')).toBeNull(); // pas de tableau
		expect(mathalea(null, 'x')).toBeNull();
	});

	it('traduit resultsByExercice → une tentative par exercice terminé, score = points/questions', () => {
		const out = mathalea(
			{
				action: 'mathalea:score',
				resultsByExercice: [
					{ uuid: 'aaaa', numberOfPoints: 3, numberOfQuestions: 4, state: 'done', alea: 'Z1', duration: 9000 },
					{ uuid: 'bbbb', numberOfPoints: 0, numberOfQuestions: 2, state: 'done' },
					{ uuid: 'cccc', numberOfPoints: 1, numberOfQuestions: 1 }, // scoré (sans state) → capté
					{ uuid: 'dddd', title: 'non scoré' } // pas de numberOfQuestions → ignoré
				]
			},
			'https://coopmaths.fr'
		);
		expect(out).toHaveLength(3); // les 3 exos scorés (dddd ignoré faute de numberOfQuestions)
		const a = out![0];
		expect(a.app).toBe('mathalea');
		expect(a.activityId).toBe('mathalea:aaaa');
		expect(a.outcome.score).toBeCloseTo(0.75);
		expect(a.outcome.passed).toBe(true);
		expect(a.measures.durationMs).toBe(9000);
		expect(a.source).toBe('app');
		// 0/2 → échec
		expect(out![1].outcome.passed).toBe(false);
		expect(out![1].outcome.score).toBe(0);
		// cccc : 1/1 capté même sans state:'done'
		expect(out![2].outcome.score).toBe(1);
	});

	it('borne le score dans [0,1] et gère 0 question', () => {
		const out = mathalea(
			{ action: 'mathalea:score', resultsByExercice: [{ uuid: 'x', numberOfPoints: 5, numberOfQuestions: 0, state: 'done' }] },
			'https://coopmaths.fr'
		)!;
		expect(out[0].outcome.score).toBe(1); // points>0 sans dénominateur → réussi
	});
});
