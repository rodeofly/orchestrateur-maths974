import { describe, it, expect } from 'vitest';
import {
	ROLES,
	homeFor,
	isRole,
	roleFromProfile,
	requiredRoleFor,
	canAccess,
	simulatableRoles,
	canSimulate,
	type Role
} from './roles';

describe('roles', () => {
	it('homeFor renvoie la home canonique de chaque rôle', () => {
		expect(homeFor('admin')).toBe('/admin');
		expect(homeFor('prof')).toBe('/prof');
		expect(homeFor('eleve')).toBe('/eleve');
		expect(homeFor('parent')).toBe('/parent');
		expect(homeFor('visiteur')).toBe('/');
	});

	it('isRole valide le référentiel', () => {
		for (const r of ROLES) expect(isRole(r)).toBe(true);
		expect(isRole('root')).toBe(false);
		expect(isRole(null)).toBe(false);
		expect(isRole(42)).toBe(false);
	});

	it('roleFromProfile défaute sur le rôle le MOINS privilégié (jamais admin)', () => {
		expect(roleFromProfile('prof')).toBe('prof');
		expect(roleFromProfile(undefined)).toBe('visiteur');
		expect(roleFromProfile('superuser')).toBe('visiteur');
		expect(roleFromProfile('admin')).toBe('admin'); // explicite OK, mais jamais par défaut
	});

	it('requiredRoleFor mappe les espaces privés et laisse le public ouvert', () => {
		expect(requiredRoleFor('/admin')).toBe('admin');
		expect(requiredRoleFor('/admin/connecteur')).toBe('admin');
		expect(requiredRoleFor('/prof/annee/ABC')).toBe('prof');
		expect(requiredRoleFor('/')).toBeNull();
		expect(requiredRoleFor('/connexion')).toBeNull();
		expect(requiredRoleFor('/confidentialite')).toBeNull();
	});

	it('canAccess : matrice stricte par rôle (pas de débordement inter-espaces)', () => {
		const cases: [Role, string, boolean][] = [
			['prof', '/prof', true],
			['prof', '/admin', false],
			['prof', '/eleve', false],
			['eleve', '/eleve/competences', true],
			['eleve', '/parent', false],
			['parent', '/parent', true],
			['parent', '/prof', false],
			['admin', '/admin/etablissements', true],
			['admin', '/prof', false], // admin n'usurpe pas l'espace prof côté UX
			['visiteur', '/', true],
			['visiteur', '/prof', false]
		];
		for (const [role, path, ok] of cases) {
			expect(canAccess(role, path), `${role} -> ${path}`).toBe(ok);
		}
	});

	it('simulatableRoles : on ne descend l’échelle que vers les rôles INFÉRIEURS', () => {
		expect(simulatableRoles('admin')).toEqual(['prof', 'eleve', 'visiteur']);
		expect(simulatableRoles('prof')).toEqual(['eleve', 'visiteur']);
		expect(simulatableRoles('eleve')).toEqual(['visiteur']);
		expect(simulatableRoles('visiteur')).toEqual([]);
		expect(simulatableRoles('parent')).toEqual([]); // rôle latéral, hors échelle
	});

	it('canSimulate : jamais MONTER ni se simuler soi-même', () => {
		expect(canSimulate('admin', 'eleve')).toBe(true);
		expect(canSimulate('prof', 'visiteur')).toBe(true);
		expect(canSimulate('eleve', 'prof')).toBe(false); // pas de montée
		expect(canSimulate('prof', 'admin')).toBe(false); // pas de montée
		expect(canSimulate('admin', 'admin')).toBe(false); // pas soi-même
	});
});
