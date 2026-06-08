import { describe, it, expect } from 'vitest';
import { detectActivity, isExternalLinkId } from './detect';

describe('detect — auto-détection de lien externe', () => {
	it('reconnaît les fournisseurs connus (label + emoji + externe)', () => {
		const m = detectActivity('https://coopmaths.fr/alea/?uuid=bdb18&v=eleve')!;
		expect(m.label).toBe('MathALEA');
		expect(m.emoji).toBe('🎲');
		expect(m.source).toBe('coopmaths');
		expect(m.embed.mode).toBe('newtab');
		expect(m.embed.connector).toBe('none');

		expect(detectActivity('https://www.khanacademy.org/math/cc-third-grade')!.label).toBe('Khan Academy');
		expect(detectActivity('https://learningapps.org/watch?app=abc123')!.label).toBe('LearningApps');
		expect(detectActivity('https://youtu.be/abc')!.support).toBe('video');
	});

	it("l'URL est l'id et reconstruit l'URL complète", () => {
		const m = detectActivity('https://coopmaths.fr/alea/?uuid=bdb18&v=eleve')!;
		expect(m.id).toBe('https://coopmaths.fr/alea/?uuid=bdb18&v=eleve');
		expect(m.embed.originProd! + m.embed.path).toBe('https://coopmaths.fr/alea/?uuid=bdb18&v=eleve');
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
