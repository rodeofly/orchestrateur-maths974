// Adaptateurs « bridged » (Tier 2 du spectre de captation — cf. mémoire
// captation-validation-spectre / docs/BIBLIOTHEQUE.md). Une app tierce NON native
// émet son PROPRE protocole postMessage ; on le TRADUIT en AttemptResult, sans jamais
// rien lui renvoyer (écoute seule). Branché au host vendoré via RunnerFrame (prop `adapter`).
//
// Ajouter une app = écrire une fonction `(data) => BridgedAttempt[] | null` et l'inscrire
// dans BRIDGES sous la clé `source` de son entrée de catalogue.

export type BridgedAttempt = {
	app: string;
	activityId: string;
	ts: string;
	outcome: { passed: boolean; score: number };
	measures: Record<string, unknown>;
	competencies: { id: string; ok: boolean; weight?: number }[];
	/** Provenance de la tentative : ici 'app' (captée). Cf. les 5 défis (provenance). */
	source: 'app';
	kind: string;
};

export type BridgeFn = (data: unknown, origin: string) => BridgedAttempt[] | null;

// ── MathALEA (coopmaths) ───────────────────────────────────────────────────────────
// Lancé avec `?recorder=moodle`, MathALEA poste au parent (au clic « Vérifier le score ») :
//   { action: 'mathalea:score', resultsByExercice: InterfaceResultExercice[], iframe }
// où chaque item terminé = { numberOfPoints, numberOfQuestions, uuid, alea, state:'done',
//   duration?, title? }. On émet UNE tentative par exercice (granularité utile pour les
//   compétences plus tard) avec score = points / questions.
function mathaleaBridge(data: unknown): BridgedAttempt[] | null {
	const d = data as { action?: string; resultsByExercice?: unknown };
	if (!d || d.action !== 'mathalea:score') return null;
	// Diagnostic : on voit dans la console que le score MathALEA est bien arrivé jusqu'au pont.
	console.info('[MathsAlea974] mathalea:score reçu →', d.resultsByExercice);
	if (!Array.isArray(d.resultsByExercice)) return null;
	const ts = new Date().toISOString();
	const out: BridgedAttempt[] = [];
	for (const raw of d.resultsByExercice) {
		const r = raw as {
			numberOfPoints?: number;
			numberOfQuestions?: number;
			uuid?: string;
			indice?: number;
			alea?: string;
			title?: string;
			duration?: number;
			state?: string;
		};
		// On accepte tout exercice SCORÉ (un nb de questions défini) — sans exiger state:'done'
		// (plus robuste selon les types d'exercices/flux MathALEA).
		if (!r || typeof r.numberOfQuestions !== 'number') continue;
		const total = Number(r.numberOfQuestions) || 0;
		const got = Number(r.numberOfPoints) || 0;
		const score = total > 0 ? Math.max(0, Math.min(1, got / total)) : got > 0 ? 1 : 0;
		out.push({
			app: 'mathalea',
			activityId: 'mathalea:' + (r.uuid ?? r.indice ?? 'exo'),
			ts,
			outcome: { passed: score >= 0.5, score },
			measures: {
				numberOfQuestions: total,
				numberOfPoints: got,
				...(typeof r.duration === 'number' ? { durationMs: r.duration } : {}),
				...(r.alea ? { alea: r.alea } : {}),
				...(r.title ? { title: r.title } : {})
			},
			competencies: [], // annotation fine par exercice mathaléa = chantier ultérieur
			source: 'app',
			kind: 'graded'
		});
	}
	return out.length ? out : null;
}

// Clé = `source` de l'entrée de catalogue (cf. ActivitySource). 'coopmaths' = MathALEA.
const BRIDGES: Record<string, BridgeFn> = {
	coopmaths: mathaleaBridge
};

/** Adaptateur « bridged » d'une source de catalogue, ou undefined si l'app est native
 *  (connector 'm974') ou non captable (connector 'none'). */
export function bridgeFor(source: string | undefined): BridgeFn | undefined {
	return source ? BRIDGES[source] : undefined;
}
