import { describe, it, expect } from 'vitest';
import { resolveHref, NAV_BY_ROLE } from './routes';
import { ROLES } from '$auth/roles';

describe('resolveHref (base path GitHub Pages)', () => {
	it('en dev (base vide) renvoie le chemin tel quel', () => {
		expect(resolveHref('', '/prof')).toBe('/prof');
		expect(resolveHref('', '/')).toBe('/');
	});

	it('en prod préfixe le base path', () => {
		const base = '/orchestrateur-maths974';
		expect(resolveHref(base, '/prof')).toBe('/orchestrateur-maths974/prof');
		expect(resolveHref(base, '/')).toBe('/orchestrateur-maths974');
		expect(resolveHref(base, '/eleve/competences')).toBe('/orchestrateur-maths974/eleve/competences');
	});

	it('laisse les liens externes intacts', () => {
		expect(resolveHref('/base', 'https://moodle.maths974.fr')).toBe('https://moodle.maths974.fr');
	});
});

describe('NAV_BY_ROLE', () => {
	it('définit une navigation pour chaque rôle', () => {
		for (const r of ROLES) {
			expect(Array.isArray(NAV_BY_ROLE[r]), r).toBe(true);
			expect(NAV_BY_ROLE[r].length).toBeGreaterThan(0);
		}
	});
});
