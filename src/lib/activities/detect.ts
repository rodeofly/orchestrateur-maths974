// Auto-détection de LIEN EXTERNE. Le prof colle une URL (Khan, mathaléa, LearningApps…) :
// on reconnaît le fournisseur (label + emoji) et on fabrique une ActivityMeta « externe »
// (mode 'newtab', pas de capture auto → validation déclarative par emojis, Tier 4).
//
// Astuce : l'URL EST l'id de l'activité. getActivity() re-synthétise la meta depuis l'id
// quand il commence par http(s) → les séances stockent juste la chaîne (déjà des string[]),
// aucun changement de schéma. Cf. catalog.getActivity.
import type { ActivityMeta, ActivitySource, Support } from './types';

type Provider = {
	test: RegExp; // testé sur le hostname (minuscule)
	source: ActivitySource;
	label: string;
	emoji: string;
	support: Support;
};

// Reconnus = joli label/emoji. Tout le reste tombe sur un lien générique 🔗.
const PROVIDERS: Provider[] = [
	{ test: /(^|\.)coopmaths\.fr$/, source: 'coopmaths', label: 'MathALEA', emoji: '🎲', support: 'quiz' },
	{ test: /(^|\.)khanacademy\.org$/, source: 'url', label: 'Khan Academy', emoji: '🦉', support: 'lien' },
	{ test: /(^|\.)learningapps\.org$/, source: 'url', label: 'LearningApps', emoji: '🧩', support: 'quiz' },
	{ test: /(^|\.)geogebra\.org$/, source: 'geogebra', label: 'GeoGebra', emoji: '📐', support: 'geometrie-dyn' },
	{ test: /(^|\.)(youtube\.com|youtu\.be)$/, source: 'video', label: 'YouTube', emoji: '🎬', support: 'video' },
	{ test: /(^|\.)lumni\.fr$/, source: 'video', label: 'Lumni', emoji: '🎬', support: 'video' },
	{ test: /(^|\.)kahoot\.(it|com)$/, source: 'kahoot', label: 'Kahoot', emoji: '🎯', support: 'jeu' },
	{ test: /(^|\.)wordwall\.net$/, source: 'url', label: 'Wordwall', emoji: '🧩', support: 'jeu' },
	{ test: /(^|\.)(quiziniere\.com|test\.quiziniere\.com)$/, source: 'url', label: 'La Quizinière', emoji: '📝', support: 'quiz' },
	{ test: /(^|\.)genial\.ly$/, source: 'url', label: 'Genially', emoji: '✨', support: 'lien' },
	{ test: /(^|\.)(quizizz\.com)$/, source: 'url', label: 'Quizizz', emoji: '❓', support: 'quiz' },
	{ test: /(^|\.)(desmos\.com)$/, source: 'url', label: 'Desmos', emoji: '📈', support: 'geometrie-dyn' }
];

/** Une chaîne est-elle un id de lien externe (= une URL http(s)) ? */
export function isExternalLinkId(id: string): boolean {
	return /^https?:\/\//i.test(id.trim());
}

// Notre instance MathALEA auto-hébergée (build statique, sans Cloudflare → embarquable).
const MATHALEA_ORIGIN = 'https://rodeofly.github.io';
const isMathaleaLink = (host: string, path: string) =>
	(/(^|\.)coopmaths\.fr$/.test(host) || /(^|\.)rodeofly\.github\.io$/.test(host)) && path.startsWith('/alea');

/** Détecte le fournisseur d'une URL collée et renvoie une ActivityMeta.
 *  Cas spécial MathALEA : tout lien (même coopmaths.fr) est RÉÉCRIT vers notre instance
 *  → embarqué (iframe) + capté (recorder=moodle, pont 'coopmaths'). Sinon : lien externe
 *  (newtab). null si l'entrée n'est pas une URL http(s) valide. */
export function detectActivity(input: string): ActivityMeta | null {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

	const host = url.hostname.toLowerCase();

	// ── MathALEA : exercice configuré par le prof → servi via NOTRE instance, capté ──
	if (isMathaleaLink(host, url.pathname)) {
		let qs = url.search;
		if (!/[?&]recorder=/.test(qs)) qs += (qs ? '&' : '?') + 'recorder=moodle&iframe=1';
		const idParam = url.searchParams.get('id');
		return {
			id: url.href, // on garde l'URL collée comme id ; getActivity la réécrit pareil
			source: 'coopmaths',
			label: idParam ? `MathsAlea974 · ${idParam}` : 'MathsAlea974 — exercice',
			emoji: '🎲',
			description: 'Exercice MathALEA configuré, embarqué — réussites captées. Propulsé par CoopMaths.',
			kind: 'graded',
			support: 'quiz',
			embed: { originProd: MATHALEA_ORIGIN, path: url.pathname + qs + url.hash, connector: 'bridged' },
			taxo: { domaineKey: '00-transversal', domaineLabel: 'Transversal' },
			competences: [],
			rituels: [],
			keywords: ['mathalea', 'coopmaths', 'exercice']
		};
	}

	const p = PROVIDERS.find((x) => x.test.test(host));
	const prettyHost = host.replace(/^www\./, '');

	return {
		id: url.href, // l'URL est l'id (re-synthétisée par getActivity)
		source: p?.source ?? 'url',
		label: p ? p.label : `Lien — ${prettyHost}`,
		emoji: p?.emoji ?? '🔗',
		description: `Activité externe (${prettyHost}) — s'ouvre dans un nouvel onglet.`,
		kind: 'graded',
		support: p?.support ?? 'lien',
		// Externe : navigation top-level (contourne les murs anti-iframe type Cloudflare),
		// pas de capture auto. La réussite se déclare par emojis (Tier 4).
		embed: {
			originProd: url.origin,
			path: url.pathname + url.search + url.hash,
			mode: 'newtab',
			connector: 'none'
		},
		taxo: { domaineKey: '00-transversal', domaineLabel: 'Transversal' },
		competences: [],
		rituels: [],
		keywords: []
	};
}
