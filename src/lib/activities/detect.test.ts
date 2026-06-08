import { describe, it, expect } from 'vitest';
import { detectActivity, isExternalLinkId } from './detect';

describe('detect — auto-détection de lien externe', () => {
	it('un lien MathALEA (même coopmaths.fr) → réécrit vers NOTRE instance, embarqué + capté', () => {
		const m = detectActivity('https://coopmaths.fr/alea/?uuid=bdb18&id=4A10&v=eleve')!;
		expect(m.label).toBe('MathsAlea974 · 4A10'); // le code d'exo enrichit le libellé
		expect(m.source).toBe('coopmaths');
		expect(m.embed.connector).toBe('bridged'); // capté par notre pont
		expect(m.embed.mode).toBeUndefined(); // iframe (pas newtab)
		expect(m.embed.originProd).toBe('https://rodeofly.github.io'); // servi par NOTRE instance
		expect(m.embed.path).toContain('recorder=moodle'); // recorder ajouté
		expect(m.id).toBe('https://coopmaths.fr/alea/?uuid=bdb18&id=4A10&v=eleve'); // l'URL collée reste l'id
		// un lien déjà sur notre instance marche aussi
		expect(detectActivity('https://rodeofly.github.io/alea/?uuid=x&v=eleve')!.embed.connector).toBe('bridged');
	});

	it('reconnaît les autres fournisseurs (externes, newtab)', () => {
		expect(detectActivity('https://www.khanacademy.org/math/cc-third-grade')!.label).toBe('Khan Academy');
		expect(detectActivity('https://learningapps.org/watch?app=abc123')!.label).toBe('LearningApps');
		expect(detectActivity('https://youtu.be/abc')!.support).toBe('video');
		expect(detectActivity('https://www.khanacademy.org/x')!.embed.mode).toBe('newtab');
	});

	it('hôte inconnu → lien générique 🔗', () => {
		const m = detectActivity('https://exemple-prof.fr/exo/42')!;
		expect(m.emoji).toBe('🔗');
		expect(m.label).toBe('Lien — exemple-prof.fr');
		expect(m.source).toBe('url');
		expect(m.embed.mode).toBe('newtab');
	});

	it('rejette ce qui n’est pas une URL http(s)', () => {
		expect(detectActivity('pas une url')).toBeNull();
		expect(detectActivity('javascript:alert(1)')).toBeNull();
		expect(detectActivity('ftp://x.y/z')).toBeNull();
		expect(detectActivity('')).toBeNull();
	});

	it('isExternalLinkId', () => {
		expect(isExternalLinkId('https://x.fr')).toBe(true);
		expect(isExternalLinkId('mathalea')).toBe(false);
		expect(isExternalLinkId('zefor974/01-retour-unite')).toBe(false);
	});
});
