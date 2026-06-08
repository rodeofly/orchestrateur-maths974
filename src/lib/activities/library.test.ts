import { describe, it, expect } from 'vitest';
import { ACTIVITIES } from './catalog';
import { buildTree } from './tree';
import { filter, matchesSearch, countBy } from './library';
import type { ActivityMeta } from './types';

describe('bibliothèque — arbre (spine GS)', () => {
	const tree = buildTree(ACTIVITIES);
	const dom = (k: string) => tree.find((d) => d.key === k);

	it('range chaque activité sous son domaine canonique', () => {
		expect(dom('05-proportionnalite')?.count).toBe(1); // retour à l'unité
		expect(dom('01-nombres-et-calculs')?.count).toBe(1); // glisse-nombre
		expect(dom('02-grandeurs-et-mesures')?.count).toBe(1); // volume
		expect(dom('06-pensee-informatique')?.count).toBe(2); // λ-Zèf + tableur
	});

	it('la feuille = l’étiquette GS (titre + activités dessous)', () => {
		const st = dom('05-proportionnalite')?.sousThemes[0];
		expect(st?.leaves[0].gs).toBe('GS 24.4');
		expect(st?.leaves[0].activities[0].id).toBe('gs:zefor974/01-retour-unite');
	});

	it('λ-Zèf (sans GS) tombe sous une feuille « sans étiquette »', () => {
		const leaves = dom('06-pensee-informatique')?.sousThemes.flatMap((s) => s.leaves) ?? [];
		expect(leaves.some((l) => l.gs === null && l.activities.some((a) => a.id === 'lambdazef'))).toBe(true);
	});
});

describe('bibliothèque — recherche', () => {
	const byId = (id: string) => ACTIVITIES.find((a) => a.id === id) as ActivityMeta;
	it('le code GS est un canal de recherche (« 24.4 »)', () => {
		expect(matchesSearch(byId('gs:zefor974/01-retour-unite'), '24.4')).toBe(true);
		expect(matchesSearch(byId('lambdazef'), '24.4')).toBe(false);
	});
	it('recherche par mot-clé, insensible aux accents', () => {
		expect(matchesSearch(byId('gs:zefor974/03-tableur'), 'tableur')).toBe(true);
		expect(matchesSearch(byId('gs:zefor974/01-retour-unite'), 'unite')).toBe(true); // « unité » sans accent
	});
});

describe('bibliothèque — facettes', () => {
	it('filtre par domaine (ET inter-facette)', () => {
		const r = filter(ACTIVITIES, { domaines: new Set(['05-proportionnalite']) });
		expect(r.map((a) => a.id)).toEqual(['gs:zefor974/01-retour-unite']);
	});
	it('filtre par compétence (OU intra-facette)', () => {
		const r = filter(ACTIVITIES, { comps: new Set(['ca']) });
		expect(r.map((a) => a.id).sort()).toEqual(
			['gs:zefor974/02-glisse-nombre', 'gs:zefor974/03-tableur', 'gs:zefor974/03-volume-cubes'].sort()
		);
	});
	it('facette inactive ne filtre pas ; combinaison ET', () => {
		expect(filter(ACTIVITIES, {}).length).toBe(ACTIVITIES.length);
		const r = filter(ACTIVITIES, { comps: new Set(['ca']), supports: new Set(['tableur']) });
		expect(r.map((a) => a.id)).toEqual(['gs:zefor974/03-tableur']);
	});
	it('compteurs disjonctifs par support', () => {
		const counts = countBy(ACTIVITIES, {}, 'supports', (a) => [a.support]);
		expect(counts.get('manipulable')).toBe(2);
		expect(counts.get('jeu')).toBe(1);
	});
});
