import { describe, it, expect } from 'vitest';
import { buildTree } from './tree';
import { filter, matchesSearch, countBy } from './library';
import type { ActivityMeta } from './types';

// Fixture contrôlée (le vrai catalogue compte des centaines d'entrées → on teste la LOGIQUE).
const a = (o: Partial<ActivityMeta> & Pick<ActivityMeta, 'id'>): ActivityMeta => ({
	source: 'gs', label: o.id, kind: 'graded', support: 'fiche',
	embed: { path: `/x?ref=${o.id}` }, taxo: { domaineKey: '00-transversal' }, ...o
});
const FIX: ActivityMeta[] = [
	a({ id: 'lambdazef', source: 'lambdazef', support: 'jeu', taxo: { domaineKey: '06-pensee-informatique' }, competences: ['ra'], keywords: ['lambda', 'logique'] }),
	a({ id: 'gs:retour', label: 'Retour à l’unité', support: 'fiche', taxo: { gs: ['GS 24.4'], domaineKey: '05-proportionnalite', sousTheme: '24. Proportionnalité' }, competences: ['ra', 'ch'], keywords: ['proportionnalité', 'unité'] }),
	a({ id: 'gs:glisse', support: 'manipulable', taxo: { gs: ['GS 3.11'], domaineKey: '01-nombres-et-calculs' }, competences: ['ca'] }),
	a({ id: 'gs:tableur', label: 'Tableur', support: 'tableur', taxo: { gs: ['GS 19.3'], domaineKey: '06-pensee-informatique' }, competences: ['ca', 're'], keywords: ['tableur'] }),
	a({ id: 'gs:volume', support: 'manipulable', taxo: { gs: ['GS 12.4'], domaineKey: '02-grandeurs-et-mesures' }, competences: ['ca'] })
];
const byId = (id: string) => FIX.find((x) => x.id === id) as ActivityMeta;

describe('bibliothèque — arbre (spine GS)', () => {
	const tree = buildTree(FIX);
	const dom = (k: string) => tree.find((d) => d.key === k);
	it('range chaque activité sous son domaine canonique', () => {
		expect(dom('05-proportionnalite')?.count).toBe(1);
		expect(dom('06-pensee-informatique')?.count).toBe(2); // λ-Zèf + tableur
	});
	it('la feuille = l’étiquette GS', () => {
		expect(dom('05-proportionnalite')?.sousThemes[0].leaves[0].gs).toBe('GS 24.4');
	});
	it('une activité sans GS tombe sous « sans étiquette »', () => {
		const leaves = dom('06-pensee-informatique')?.sousThemes.flatMap((s) => s.leaves) ?? [];
		expect(leaves.some((l) => l.gs === null && l.activities.some((x) => x.id === 'lambdazef'))).toBe(true);
	});
});

describe('bibliothèque — recherche', () => {
	it('le code GS est un canal de recherche (« 24.4 »)', () => {
		expect(matchesSearch(byId('gs:retour'), '24.4')).toBe(true);
		expect(matchesSearch(byId('lambdazef'), '24.4')).toBe(false);
	});
	it('recherche insensible aux accents', () => {
		expect(matchesSearch(byId('gs:retour'), 'unite')).toBe(true);
		expect(matchesSearch(byId('gs:tableur'), 'tableur')).toBe(true);
	});
});

describe('bibliothèque — facettes', () => {
	it('filtre par domaine (ET inter-facette)', () => {
		expect(filter(FIX, { domaines: new Set(['05-proportionnalite']) }).map((x) => x.id)).toEqual(['gs:retour']);
	});
	it('filtre par compétence (OU intra-facette)', () => {
		expect(filter(FIX, { comps: new Set(['ca']) }).map((x) => x.id).sort()).toEqual(['gs:glisse', 'gs:tableur', 'gs:volume']);
	});
	it('facette inactive ne filtre pas ; combinaison ET', () => {
		expect(filter(FIX, {}).length).toBe(FIX.length);
		expect(filter(FIX, { comps: new Set(['ca']), supports: new Set(['tableur']) }).map((x) => x.id)).toEqual(['gs:tableur']);
	});
	it('compteurs disjonctifs par support', () => {
		const counts = countBy(FIX, {}, 'supports', (x) => [x.support]);
		expect(counts.get('manipulable')).toBe(2);
		expect(counts.get('jeu')).toBe(1);
	});
});
