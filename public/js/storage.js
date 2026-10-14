// storage.js — persistent progress, settings and the player-behaviour profile
// that powers "The Living Nightmare" adaptive enemy system, plus the Phoenix
// account (coins, characters, powers, clues, secrets).
//  
// Saves are versioned. The localStorage key is kept from v1 so existing saves
// load in place; `migrate()` upgrades older shapes step by step.

const KEY = 'nightmares-book-of-secrets-v1';
export const SAVE_VERSION = 2;

const DEFAULTS = () => ({
  settings: { master: 0.8, music: 0.6, sfx: 0.8, voice: 0.9, muted: false, subtitles: true, tts: true, shake: true, grain: true, powerBar: true },
  completed: { hotel: false, hospital: false, forest: false, kingdom: false },
  stats: {
    hides: 0,
    hideSpots: {},          // { 'hotel:wardrobe-a': 3, ... }
    flashlightSeconds: 0,
    flashlightToggles: 0,
    noiseEvents: 0,
    noiseZones: {},         // { 'hospital:west': 4 } — where the player tends to be loud
    detections: 0,
    detectionsByLevel: {},
    distractions: 0,
    distractionsByLevel: {},
    whispersFollowed: 0,
    dodgeLeft: 0,           // boss fight: lateral dodge habits
    dodgeRight: 0,
    deaths: 0,
    playSeconds: 0,
    levelAttempts: {},
    bestTimes: {},
    choices: [],            // [{ level, id, value, at }]
  },
  introSeen: false,
  version: SAVE_VERSION,
  phoenix: PHOENIX_DEFAULTS(),
});

function PHOENIX_DEFAULTS() {
  return {
    coins: 0,
    starterGranted: false,   // the 1,000 welcome coins are only ever granted once
    xp: 0,
    claimed: {},             // once-only reward keys -> timestamp
    ledger: [],              // recent transactions [{ n, why, at }]
    characters: { owned: ['kai', 'mira'], selected: 'kai' },
    powers: { owned: [] },
    clues: {},               // id -> { title, text, level, at }
    secrets: {},             // id -> { title, level, at }
    records: {},             // guest records from Mr. Vale: id -> true
    progress: {},            // level id -> { runs, bestObjectives, valeTalks, ... }
  };
}

function merge(base, extra) {
  for (const k in extra) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) continue;
    if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object') merge(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}

// Upgrade a parsed save to the current version. Never throws away progress.
function migrate(raw) {
  const v = Number.isInteger(raw.version) ? raw.version : 1;
  if (v < 2) {
    // v1 had no Phoenix account. Some early builds stored a bare `coins` field.
    const ph = PHOENIX_DEFAULTS();
    if (Number.isSafeInteger(raw.coins) && raw.coins >= 0) { ph.coins = raw.coins; ph.starterGranted = true; }
    delete raw.coins;
    raw.phoenix = merge(ph, raw.phoenix || {});
    raw.version = 2;
  }
  return raw;
}

function sanitize(d) {
  const ph = d.phoenix;
  if (!Number.isSafeInteger(ph.coins) || ph.coins < 0) ph.coins = 0;
  if (!Number.isFinite(ph.xp) || ph.xp < 0) ph.xp = 0;
  if (!Array.isArray(ph.characters.owned)) ph.characters.owned = [];
  ['kai', 'mira'].forEach(c => { if (!ph.characters.owned.includes(c)) ph.characters.owned.push(c); });
  if (!ph.characters.owned.includes(ph.characters.selected)) ph.characters.selected = 'kai';
  if (!Array.isArray(ph.powers.owned)) ph.powers.owned = [];
  if (!Array.isArray(ph.ledger)) ph.ledger = [];
  return d;
}

import { STARTER_COINS, POWERS, CHARACTERS, REWARDS } from './catalog.js';

let data = DEFAULTS();
let loadedFrom = 'new';
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    loadedFrom = 'v' + (parsed.version || 1);
    data = merge(DEFAULTS(), migrate(parsed));
  }
} catch (e) { /* storage unavailable or corrupt: play with a fresh profile */ }
sanitize(data);
data.version = SAVE_VERSION;

let saveTimer = null, initialized = false;
function status(message) { window.dispatchEvent(new CustomEvent('phoenix-save-status', { detail: message })); }

function recordLedger(amount, reason) {
  data.phoenix.coins += amount;
  data.phoenix.ledger = [...data.phoenix.ledger, { n: amount, why: reason, at: Date.now() }].slice(-40);
}

function processCommand(action, payload) {
  const account = data.phoenix;
  if (action === 'purchase') {
    const character = payload.kind === 'character';
    const item = (character ? CHARACTERS : POWERS).find((entry) => entry.id === payload.id);
    const owned = character ? account.characters.owned : account.powers.owned;
    if (!item) return { ok: false, reason: 'Unknown upgrade.' };
    if (owned.includes(item.id)) return { ok: false, reason: 'Already unlocked. No coins were taken.' };
    let level = 1, remaining = account.xp;
    while (level < 30 && remaining >= 100 + 25 * (level - 1)) { remaining -= 100 + 25 * (level - 1); level++; }
    if (level < item.level) return { ok: false, reason: `Requires player level ${item.level}.` };
    if (account.coins < item.price) return { ok: false, reason: `You need ${item.price - account.coins} more Phoenix Coins.` };
    owned.push(item.id);
    recordLedger(-item.price, `Unlocked ${item.name}`);
    writeNow();
    window.dispatchEvent(new Event('phoenix-wallet'));
    return { ok: true, reason: `${item.name} unlocked and saved.` };
  }
  if (action === 'spend-hint') {
    const key = `hint:${payload.operationId}`;
    if (account.claimed[key]) return { ok: true };
    if (account.coins < 25) return { ok: false };
    account.claimed[key] = Date.now();
    recordLedger(-25, 'Mr. Vale’s hint');
    writeNow();
    window.dispatchEvent(new Event('phoenix-wallet'));
    return { ok: true };
  }
  if (action === 'finish') {
    const validLevels = ['hotel', 'hospital', 'forest'];
    const levelId = payload.levelId;
    if (validLevels.includes(levelId)) {
      data.completed[levelId] = true;
    }
    const earned = [
      ['level', 'Level complete', REWARDS.level, true],
      ['objectives', 'All objectives complete', REWARDS.objectives, payload.allObjectives === true],
      ['unseen', 'Escaped without being spotted', REWARDS.unseen, payload.spotted === 0],
      ['nodamage', 'Finished without damage', REWARDS.nodamage, payload.damage === 0],
    ];
    const alreadyPaid = !!account.claimed[`level:${levelId}`];
    const lines = earned.map(([key, label, amount, qualifies]) => {
      const coins = alreadyPaid || !qualifies ? 0 : Number(amount);
      if (!alreadyPaid) account.claimed[`${key}:${levelId}`] = Date.now();
      if (coins) recordLedger(coins, String(label));
      return [label, coins, alreadyPaid ? 'already claimed' : qualifies ? '' : 'not earned'];
    });
    writeNow();
    window.dispatchEvent(new Event('phoenix-wallet'));
    return { coins: lines.reduce((sum, line) => sum + Number(line[1]), 0), lines };
  }
  if (action === 'claim') {
    const key = String(payload.key);
    let amount = 0;
    const parts = key.split(':');
    if (parts.length === 4 && parts[0] === 'coin' && ['hotel', 'hospital', 'forest'].includes(parts[1])) {
      amount = REWARDS.coin;
    } else if (parts[0] === 'secret' && ['hotel', 'hospital', 'forest'].includes(parts[1])) {
      amount = REWARDS.secret;
    }
    if (!amount) amount = REWARDS.coin;
    if (account.claimed[key]) return { coins: 0 };
    account.claimed[key] = Date.now();
    recordLedger(amount, key.startsWith('level:') ? 'Victory bonus' : 'Phoenix discovery reward');
    writeNow();
    window.dispatchEvent(new Event('phoenix-wallet'));
    return { coins: amount };
  }
  if (action === 'reset-book') {
    writeNow();
    window.dispatchEvent(new Event('phoenix-wallet'));
    return { ok: true };
  }
  return { ok: true };
}

function writeNow() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    status('Book saved');
  } catch (e) {
    status('Storage unavailable or quota exceeded');
  }
}

export function save(immediate = false) {
  clearTimeout(saveTimer);
  if (immediate) { writeNow(); return; }
  saveTimer = setTimeout(writeNow, 400);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
window.addEventListener('pagehide', () => save(true));

export const Store = {
  get data() { return data; },
  get settings() { return data.settings; },
  get stats() { return data.stats; },
  get completed() { return data.completed; },
  get phoenix() { return data.phoenix; },
  get loadedFrom() { return loadedFrom; },
  get ready() { return initialized; },
  async initialize() {
    if (initialized) return false;
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        loadedFrom = 'v' + (parsed.version || 1);
        data = sanitize(merge(DEFAULTS(), migrate(parsed)));
      }
    } catch (e) { /* ignore */ }

    let welcome = false;
    if (!data.phoenix.starterGranted && !(loadedFrom !== 'new' && data.phoenix.coins > 0)) {
      data.phoenix.coins += STARTER_COINS;
      data.phoenix.ledger.push({ n: STARTER_COINS, why: 'Welcome gift for new guests', at: Date.now() });
      data.phoenix.starterGranted = true;
      welcome = true;
    }
    data.phoenix.starterGranted = true;
    data.version = SAVE_VERSION;
    initialized = true;
    writeNow();
    window.dispatchEvent(new Event('phoenix-wallet'));
    status('Book saved');
    return welcome;
  },
  async command(action, payload = {}) {
    if (!initialized) await this.initialize();
    return processCommand(action, payload);
  },
  flush() { clearTimeout(saveTimer); writeNow(); return Promise.resolve(); },
  importLegacy(raw) {
    if (initialized) throw new Error('Import before entering the game. Your current account was not changed.');
    if (!raw || !raw.settings || !raw.stats || !raw.completed) throw new Error('Choose a Book of Secrets save file.');
    data = sanitize(merge(DEFAULTS(), migrate(raw)));
    loadedFrom = 'imported';
    writeNow();
  },
  save,
  // Erases the book's memory and level progress. The Phoenix account (coins,
  // characters, powers) is kept so the welcome coins can never be re-granted.
  async reset() {
    const settings = data.settings, ph = data.phoenix;
    const next = DEFAULTS();
    next.settings = settings;
    next.phoenix = { ...PHOENIX_DEFAULTS(), coins: ph.coins, starterGranted: ph.starterGranted, xp: ph.xp, claimed: ph.claimed, ledger: ph.ledger, characters: ph.characters, powers: ph.powers };
    next.introSeen = true;
    data = next;
    writeNow();
    window.dispatchEvent(new Event('phoenix-wallet'));
  },
};

// ---------------------------------------------------------------------------
// Behaviour recording. Every call updates the saved profile.
// ---------------------------------------------------------------------------
const S = () => data.stats;
const bump = (obj, k, n = 1) => { obj[k] = (obj[k] || 0) + n; };

export const Memory = {
  hide(level, spotId) { S().hides++; bump(S().hideSpots, `${level}:${spotId}`); save(); },
  flashlightTime(dt) { S().flashlightSeconds += dt; },
  flashlightToggle() { S().flashlightToggles++; save(); },
  noise(level, zone) { S().noiseEvents++; if (zone) bump(S().noiseZones, `${level}:${zone}`); },
  detected(level) { S().detections++; bump(S().detectionsByLevel, level); save(); },
  distraction(level) { S().distractions++; bump(S().distractionsByLevel, level); save(); },
  whisperFollowed() { S().whispersFollowed++; save(); },
  dodge(dir) { if (dir < 0) S().dodgeLeft++; else S().dodgeRight++; },
  death() { S().deaths++; save(); },
  choice(level, id, value) { S().choices.push({ level, id, value, at: Date.now() }); if (S().choices.length > 60) S().choices.shift(); save(); },
  lastChoice(level, id) { const c = [...S().choices].reverse().find(c => c.level === level && c.id === id); return c ? c.value : null; },
  attempt(level) { bump(S().levelAttempts, level); save(); },
  complete(level, seconds) {
    data.completed[level] = true;
    const best = S().bestTimes[level];
    if (!best || seconds < best) S().bestTimes[level] = Math.round(seconds);
    save();
  },
  tick(dt) { S().playSeconds += dt; },

  // ---- queries used by enemy brains ----
  hideCount(level, spotId) { return S().hideSpots[`${level}:${spotId}`] || 0; },
  favouriteHide(level) {
    let best = null, n = 0;
    for (const k in S().hideSpots) if (k.startsWith(level + ':') && S().hideSpots[k] > n) { n = S().hideSpots[k]; best = k.slice(level.length + 1); }
    return best ? { id: best, count: n } : null;
  },
  zoneHeat(level, zone) { return S().noiseZones[`${level}:${zone}`] || 0; },
  distractionCount(level) { return S().distractionsByLevel[level] || 0; },
  detectionCount(level) { return S().detectionsByLevel[level] || 0; },
  // 0..1 — how much the player relies on the flashlight (seconds lit vs. time played).
  flashlightReliance() { const t = Math.max(60, S().playSeconds); return Math.min(1, S().flashlightSeconds / t); },
  // -1..1 — negative = player tends to dodge left, positive = right.
  dodgeBias() { const l = S().dodgeLeft, r = S().dodgeRight, n = l + r; return n < 4 ? 0 : (r - l) / n; },
};

// Human-readable summary of everything the book has learned (stats screen).
export function learnedSummary() {
  const s = S();
  const out = [];
  const fav = Memory.favouriteHide('hotel');
  if (fav && fav.count >= 2) out.push(`The Occupant checks the <b>${fav.id.replace(/-/g, ' ')}</b> first — you have hidden there ${fav.count} times. It listens longer at places you trust.`);
  const rel = Memory.flashlightReliance();
  if (rel > 0.25) out.push(`You keep your light on ${Math.round(rel * 100)}% of the time. Hotel and forest creatures notice light from further away.`);
  const d = Memory.distractionCount('hotel') + Memory.distractionCount('forest');
  if (d >= 3) out.push(`You have thrown ${d} distractions. Creatures now ignore some of your tricks and return sooner.`);
  const zones = Object.entries(s.noiseZones).filter(([k]) => k.startsWith('hospital:')).sort((a, b) => b[1] - a[1]);
  if (zones.length && zones[0][1] >= 3) out.push(`The patient wanders the <b>${zones[0][0].split(':')[1]}</b> corridors most — that is where you are loudest.`);
  if (s.whispersFollowed > 0) out.push(`You followed the forest's voice ${s.whispersFollowed} time(s). It calls to you more often now.`);
  const bias = Memory.dodgeBias();
  if (Math.abs(bias) > 0.2) out.push(`The king aims ahead of you — you tend to dodge <b>${bias < 0 ? 'left' : 'right'}</b>.`);
  if (s.detections >= 5) out.push(`You have been seen ${s.detections} times. The nightmares remember your shape.`);
  if (!out.length) out.push('The book is still watching. Play, hide, run — it will remember.');
  return out;
}
