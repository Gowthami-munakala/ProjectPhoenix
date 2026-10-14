// phoenix.js — the Phoenix account: Phoenix Coins, player level (XP),
// characters, power-ups, once-only rewards, clues, secrets and guest records.
// Catalogs live here; all state lives in Store.phoenix (see storage.js).
import { Store, save } from './storage.js';

import { STARTER_COINS, REWARDS, XP, MAX_LEVEL, CHARACTERS, POWERS, SECRETS, GUEST_RECORDS } from './catalog.js';
export { STARTER_COINS, REWARDS, XP, MAX_LEVEL, CHARACTERS, POWERS, SECRETS, GUEST_RECORDS } from './catalog.js';

// ---------------------------------------------------------------------------
// LEVEL CURVE
// ---------------------------------------------------------------------------
const stepXp = L => 100 + 25 * (L - 1);           // XP needed to go from L to L+1
export function levelInfo(xp) {
  let L = 1, need = stepXp(1), rest = xp;
  while (L < MAX_LEVEL && rest >= need) { rest -= need; L++; need = stepXp(L); }
  return { level: L, into: rest, need, pct: L >= MAX_LEVEL ? 1 : rest / need };
}

const P = () => Store.phoenix;
const listeners = new Set();
const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } });

export const Phoenix = {
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  get coins() { return P().coins; },
  get xp() { return P().xp; },
  get level() { return levelInfo(P().xp).level; },
  levelInfo() { return levelInfo(P().xp); },
  get ledger() { return P().ledger; },

  // Deducts only when the full amount is available. Returns true on success.
  async spend(n, why) {
    if (!Number.isSafeInteger(n) || n < 0 || P().coins < n) return false;
    if (!n) return true;
    if (n !== 25) return false;
    try { const result = await Store.command('spend-hint', { operationId: crypto.randomUUID() }); emit(); return result.ok; }
    catch { return false; }
  },
  isClaimed(key) { return !!P().claimed[key]; },
  // Once-only reward: pays `n` coins the first time `key` is claimed, then never again.
  async claim(key, n, why) {
    if (P().claimed[key]) return 0;
    const result = await Store.command('claim', { key }); emit();
    return result.coins || 0;
  },

  // Returns { gained, levels: [newly reached levels] }.
  addXp(n) {
    const mul = this.character().mods.xp || 1;
    const gained = Math.round(n * mul);
    const before = this.level;
    P().xp += gained; save(); emit();
    const after = this.level, levels = [];
    for (let l = before + 1; l <= after; l++) levels.push(l);
    return { gained, levels };
  },

  // ---- characters ----
  character(id = P().characters.selected) { return CHARACTERS.find(c => c.id === id) || CHARACTERS[0]; },
  owns(id) { return P().characters.owned.includes(id); },
  select(id) {
    if (!this.owns(id)) return false;
    P().characters.selected = id; save(true); emit();
    return true;
  },
  // { ok, reason }. Coins are deducted only when every check passes and the
  // purchase is recorded; any failure rolls back to the previous state.
  async buyCharacter(id) {
    const c = CHARACTERS.find(x => x.id === id);
    if (!c) return { ok: false, reason: 'Unknown character.' };
    if (this.owns(id)) return { ok: false, reason: `${c.name} is already yours.` };
    if (this.level < c.level) return { ok: false, reason: `Requires player level ${c.level}.` };
    if (P().coins < c.price) return { ok: false, reason: `You need ${c.price - P().coins} more Phoenix Coins.` };
    try { const result = await Store.command('purchase', { kind: 'character', id }); emit(); return result; }
    catch { return { ok: false, reason: 'Purchase could not be confirmed. Reconnect and retry; your balance is checked before any charge.' }; }
  },

  // ---- powers ----
  power(id) { return POWERS.find(p => p.id === id); },
  ownsPower(id) { return P().powers.owned.includes(id); },
  async buyPower(id) {
    const p = this.power(id);
    if (!p) return { ok: false, reason: 'Unknown power.' };
    if (this.ownsPower(id)) return { ok: false, reason: `${p.name} is already unlocked.` };
    if (this.level < p.level) return { ok: false, reason: `Unlocks at player level ${p.level}.` };
    if (P().coins < p.price) return { ok: false, reason: `You need ${p.price - P().coins} more Phoenix Coins.` };
    try { const result = await Store.command('purchase', { kind: 'power', id }); emit(); return result; }
    catch { return { ok: false, reason: 'Purchase could not be confirmed. Reconnect and retry; your balance is checked before any charge.' }; }
  },

  // ---- Book of Secrets ----
  addClue(id, title, text, level = 'hotel') {
    if (P().clues[id]) return false;
    P().clues[id] = { title, text, level, at: Date.now() }; save(); emit();
    return true;
  },
  addSecret(id, title, level = 'hotel') {
    if (P().secrets[id]) return false;
    P().secrets[id] = { title, level, at: Date.now() }; save(true); emit();
    return true;
  },
  hasSecret(id) { return !!P().secrets[id]; },
  addRecord(name) {
    if (!GUEST_RECORDS[name] || P().records[name]) return false;
    P().records[name] = Date.now(); save(); emit();
    return true;
  },
  get clues() { return P().clues; },
  get secrets() { return P().secrets; },
  get records() { return P().records; },
  progress(levelId) { return (P().progress[levelId] ||= { runs: 0, valeTalks: 0, wins: 0 }); },
};

// ---------------------------------------------------------------------------
// RUN REWARDS — one per level attempt. Every reward is keyed so it can only be
// paid once per run; level milestones are additionally first-time-only.
// ---------------------------------------------------------------------------
export class RunRewards {
  constructor(level) {
    this.level = level; this.paid = new Set();
    level.runId ||= crypto.randomUUID();
    this.coins = 0; this.xp = 0; this.lines = []; this.levelUps = [];
  }
  _xp(n) { const r = Phoenix.addXp(n); this.xp += r.gained; if (r.levels.length) { this.levelUps.push(...r.levels); r.levels.forEach(l => this.level.onLevelUp?.(l)); } return r.gained; }
  _once(key) { if (this.paid.has(key)) return false; this.paid.add(key); return true; }

  // A Phoenix Coin pickup: 5 coins, once per coin per run.
  async coin(id) {
    if (!this._once('coin:' + id)) return 0;
    let n;
    try { n = await Phoenix.claim(`coin:${this.level.id}:${this.level.runId}:${id}`, REWARDS.coin, 'Phoenix Coin found'); }
    catch (error) { this.paid.delete('coin:' + id); throw error; }
    this.coins += n; this._xp(XP.coin);
    return n;
  }
  objective(id) { if (this._once('obj:' + id)) this._xp(XP.objective); }
  record() { this._xp(XP.record); }
  // Secret room: 20 coins the first time it is ever discovered.
  async secret(id, title) {
    if (!this._once('secret:' + id)) return 0;
    const isNew = Phoenix.addSecret(id, title, this.level.id);
    let n;
    try { n = await Phoenix.claim(`secret:${this.level.id}:${id}`, REWARDS.secret, `Secret found: ${title}`); }
    catch (error) { this.paid.delete('secret:' + id); throw error; }
    this.coins += n; this._xp(XP.secret);
    if (n) this.lines.push([`Secret discovered — ${title}`, n]);
    return { coins: n, isNew };
  }
  // Called once when the level is completed.
  async finish({ allObjectives, spotted, damage }) {
    if (this.paid.has('finish')) return;
    const id = this.level.id;
    if (!this.paid.has('finish-payment')) {
      const result = await Store.command('finish', { levelId: id, allObjectives, spotted, damage });
      this.coins += result.coins;
      this.lines.push(...result.lines);
      this.paid.add('finish-payment');
      this._xp(XP.level);
      if (allObjectives) this._xp(XP.objectives);
      if (spotted === 0) this._xp(XP.unseen);
      if (damage === 0) this._xp(XP.nodamage);
    }
    if (this._once('win-record')) Phoenix.progress(id).wins++;
    await Store.flush();
    this.paid.add('finish');
  }
}
