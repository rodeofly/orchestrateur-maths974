// @ts-nocheck — fichier VENDORÉ (ne pas éditer ici). Source: maths974-embed / maths974-competences. Resync: npm run sync:m974.
// SDK côté ORCHESTRATEUR (host) — monte une app dans une iframe, lui envoie sa
// config, et reçoit ses AttemptResult. Usage :
//
//   import { mount } from '@maths974/embed/host';
//   const act = mount(containerEl, {
//     url: 'https://.../lambda-zef/',
//     params: { activity: 'lesson:a', timeLimit: 120, studentKey: 'eleve-42', kind: 'graded' },
//     allowOrigin: 'https://ftobe-maths974.github.io',   // prod : origine exacte de l'app
//   });
//   act.on('ready',   (info) => ...);
//   act.on('attempt', (a)    => relayToBackend(a));   // le signal-clé
//   act.on('progress',(p)    => updateHud(p.value));
//   act.command('pause');           // contrôle depuis le host (chrono, pause prof…)
//   act.destroy();
//
// App tierce NON native (Tier 2 « bridged ») : passe un `adapter(data, origin)` qui
// traduit SON protocole maison en AttemptResult — émis via le même event 'attempt' :
//   mount(el, { url, allowOrigin: 'https://coopmaths.fr', adapter: mathaleaBridge });
//
// Pas de Math.random ici (compat resume) : id de session = compteur de séquence.

import { MSG, VERSION, isM974Message, originAllowed, URL_SAFE_KEYS } from './protocol.js';

let _seq = 0;

export function mount(container, opts = {}) {
  if (!opts.url) throw new Error('mount: `url` requis');
  const allow = opts.allowOrigin || '*';
  const params = opts.params || {};
  const session = opts.session || PROTOSESSION();
  const listeners = Object.create(null);
  let childOrigin = null;

  const iframe = document.createElement('iframe');
  // App native : on injecte m974/session + params URL-safe. App « bridged » (adapter) :
  // elle ne parle PAS notre protocole — on garde son URL telle quelle (sinon nos params
  // polluent la sienne et peuvent faire trébucher son serveur). Cf. Tier 2.
  iframe.src = opts.adapter ? opts.url : withParams(opts.url, params, session);
  iframe.style.border = '0';
  iframe.style.width = opts.width || '100%';
  iframe.style.height = opts.height || '100%';
  iframe.style.display = 'block';
  if (opts.title) iframe.title = opts.title;
  if (opts.allowFullscreen) iframe.allow = 'fullscreen';
  if (opts.sandbox) iframe.setAttribute('sandbox', opts.sandbox);
  // Par défaut « no-referrer » : aucune fuite d'URL/contexte de l'orchestrateur vers
  // l'app tierce (RGPD/mineurs). Mais certains serveurs (anti-hotlink) refusent une
  // requête sans Referer → on autorise un override (ex. bridged : 'strict-origin-when-
  // cross-origin' = on ne livre QUE l'origine, jamais le chemin ni les params).
  iframe.referrerPolicy = opts.referrerPolicy || 'no-referrer';
  container.appendChild(iframe);

  function emit(ev, data) {
    const fns = listeners[ev];
    if (!fns) return;
    for (const fn of fns) {
      try {
        fn(data);
      } catch (e) {
        console.error('[m974/host]', ev, e);
      }
    }
  }

  function onMessage(e) {
    if (e.source !== iframe.contentWindow) return;
    if (isM974Message(e.data)) {
      if (!originAllowed(e.origin, allow)) return;
      childOrigin = e.origin;
      const { type, payload } = e.data;
      if (type === MSG.READY) {
        sendLaunch();
        emit('ready', payload);
      } else if (type === MSG.ATTEMPT) {
        emit('attempt', payload);
      } else if (type === MSG.PROGRESS) {
        emit('progress', payload);
      } else if (type === MSG.EXIT) {
        emit('exit', payload);
      }
      return;
    }
    // Adaptateur « bridged » (Tier 2) : une app tierce NON native émet son PROPRE
    // protocole (ex. MathALEA poste {action:'mathalea:score', resultsByExercice}).
    // `opts.adapter(data, origin)` le traduit en AttemptResult (ou un tableau), sans
    // jamais rien renvoyer à l'app. Gardé par la même allow-list d'origine.
    if (opts.adapter && originAllowed(e.origin, allow)) {
      let out;
      try {
        out = opts.adapter(e.data, e.origin);
      } catch (err) {
        console.error('[m974/host] adapter', err);
        return;
      }
      if (out) for (const a of Array.isArray(out) ? out : [out]) emit('attempt', a);
    }
  }
  window.addEventListener('message', onMessage);

  function targetOrigin() {
    return allow === '*' ? '*' : childOrigin || (Array.isArray(allow) ? allow[0] : allow);
  }

  function sendLaunch() {
    iframe.contentWindow.postMessage(
      { type: MSG.LAUNCH, version: VERSION, session, payload: params },
      targetOrigin(),
    );
  }

  const api = {
    iframe,
    session,
    on(ev, fn) {
      (listeners[ev] || (listeners[ev] = [])).push(fn);
      return api;
    },
    /** envoie une commande à l'app : command('pause'|'resume'|'reset'|'timeup'|'mute', extra?). */
    command(action, extra) {
      iframe.contentWindow.postMessage(
        { type: MSG.COMMAND, version: VERSION, session, payload: Object.assign({ action }, extra) },
        targetOrigin(),
      );
      return api;
    },
    destroy() {
      window.removeEventListener('message', onMessage);
      iframe.remove();
    },
  };
  return api;
}

function PROTOSESSION() {
  _seq += 1;
  return 's' + _seq;
}

function withParams(url, params, session) {
  const u = new URL(url, window.location.href);
  u.searchParams.set('m974', '1');
  u.searchParams.set('session', session);
  // SEULEMENT les clés non sensibles dans l'URL. studentKey & co. partent par
  // le postMessage LAUNCH (cf. sendLaunch, payload = params complet). Cf. URL_SAFE_KEYS.
  for (const [k, v] of Object.entries(params)) {
    if (v != null && URL_SAFE_KEYS.indexOf(k) !== -1) u.searchParams.set(k, String(v));
  }
  return u.toString();
}
