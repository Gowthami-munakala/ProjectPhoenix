// powers.js — PowerKit: the in-level runtime for the selected character's
// passive + ability and the player's unlocked power-ups. BaseLevel and
// Stalker query it (speed, stamina, visibility, catches), so effects are real.
import { Audio } from './audio.js';
import { Phoenix, POWERS } from './phoenix.js';
import { TILE, dist, rnd } from './engine.js';

export class PowerKit {
  constructor(level) {
    this.level = level;
    this.char = Phoenix.character();
    this.mods = this.char.mods;
    this.state = {};                 // power id -> { active, cd }
    POWERS.forEach(p => { this.state[p.id] = { active: 0, cd: 0 }; });
    this.ab = { active: 0, cd: 0, uses: this.char.ability.uses ?? Infinity };
    this.decoys = [];
    this.used = 0;
  }

  // Applied once when the level starts (after the level has set its defaults).
  applyCharacter() {
    const L = this.level, m = this.mods;
    if (m.extraThrow && L.throwable) L.throwable.count += m.extraThrow;
    if (this.char.color) L.playerColor = this.char.color;
    L.refreshInventory();
  }

  available(p) { return Phoenix.ownsPower(p.id) && Phoenix.level >= p.level; }
  on(id) { return this.state[id]?.active > 0; }
  get abilityOn() { return this.ab.active > 0; }

  // ---- queries used by the engine ----
  get speedMul() { return (this.mods.speed || 1) * (this.on('sprint') ? 1.35 : 1); }
  get staminaDrainMul() { return this.on('sprint') ? 0 : (this.mods.staminaDrain || 1); }
  get staminaRegenMul() { return this.mods.staminaRegen || 1; }
  get silentSteps() { return this.on('sprint') || (this.char.id === 'kai' && this.abilityOn); }
  get runNoiseMul() { return this.mods.runNoise || 1; }
  get breathMul() { return this.mods.breath || 1; }
  get sightMul() { return this.mods.sight || 1; }
  get awarenessMul() { return this.char.id === 'ansel' && this.abilityOn ? 0 : (this.mods.awareness || 1); }
  get invisible() { return this.on('cloak') || (this.char.id === 'sable' && this.abilityOn); }
  get lantern() { return this.on('lantern'); }
  get shield() { return this.on('shield'); }
  // enemies drawn through walls
  revealsEnemy(e) {
    if (this.on('lantern') || (this.char.id === 'mira' && this.abilityOn)) return true;
    return !!this.mods.sense && dist(e, this.level.player) < this.mods.sense;
  }

  // ---- input + timers ----
  update(dt) {
    const L = this.level, I = L.input;
    for (const p of POWERS) {
      const s = this.state[p.id];
      if (s.active > 0) { s.active = Math.max(0, s.active - dt); if (!s.active) this.expire(p); }
      else if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      if (I.hit('p' + p.key)) this.activate(p);
    }
    if (this.ab.active > 0) this.ab.active = Math.max(0, this.ab.active - dt);
    else if (this.ab.cd > 0) this.ab.cd = Math.max(0, this.ab.cd - dt);
    if (I.hit('ability')) this.useAbility();
    if (this.char.id === 'ansel' && this.abilityOn) L.enemies.forEach(e => { if (e.state !== 'chase') e.awareness = Math.max(0, e.awareness - dt * 1.5); });

    // reveal hidden interactables (Esme passive, Spirit Sight, Soul Lantern)
    const rr = Math.max(this.mods.autoReveal || 0, this.lantern ? 170 : 0, this.char.id === 'esme' && this.abilityOn ? 420 : 0);
    if (rr) L.interactables.forEach(it => { if (!it.revealed && dist(it, L.player) < rr) { it.revealed = true; Audio.play('magic', { vol: 0.4 }); L.onReveal?.(it); } });

    // decoys call out until they fade
    this.decoys = this.decoys.filter(d => {
      d.t -= dt; d.callT -= dt;
      if (d.callT <= 0) { d.callT = 1.1; Audio.playAt('whisper', d.x, d.y, { vol: 1.2, range: 700, dur: 0.8 }); L.enemies.forEach(e => { if (e.active && e.state !== 'chase') e.setState('investigate', d); }); }
      return d.t > 0;
    });
  }

  activate(p) {
    const L = this.level, s = this.state[p.id];
    if (!Phoenix.ownsPower(p.id)) { L.alert(Phoenix.level < p.level ? `${p.name} unlocks at level ${p.level}` : `${p.name} is not unlocked — visit the Phantom Market`); Audio.play('click'); return; }
    if (s.active > 0) { L.alert(`${p.name} is already active`); return; }
    if (s.cd > 0) { L.alert(`${p.name} recharging — ${Math.ceil(s.cd)}s`); Audio.play('click'); return; }
    s.active = p.dur; this.used++;
    Audio.play('magic');
    if (p.id === 'decoy') {
      const pl = L.player, d = Math.max(40, L.map.ray(pl.x, pl.y, pl.angle, 230) - 16);
      this.decoys.push({ x: pl.x + Math.cos(pl.angle) * d, y: pl.y + Math.sin(pl.angle) * d, t: p.dur, callT: 0, max: p.dur });
    }
    if (p.id === 'cloak') L.enemies.forEach(e => { if (e.state !== 'chase') e.awareness = 0; });
    L.alert(`${p.name} — ${p.dur}s`);
  }
  expire(p) { this.state[p.id].cd = p.cd; this.level.alert(`${p.name} faded`, 1.5); }

  useAbility() {
    const L = this.level, a = this.char.ability, ab = this.ab;
    if (ab.active > 0) return;
    if (ab.cd > 0) { L.alert(`${a.name} recharging — ${Math.ceil(ab.cd)}s`); Audio.play('click'); return; }
    if (ab.uses <= 0) { L.alert(`${a.name} already used tonight`); Audio.play('click'); return; }
    if (this.char.id === 'rowan') {
      if (!L.pickLock?.()) { L.alert('No locked door within reach'); Audio.play('click'); return; }
      ab.uses--; Audio.play('click'); L.alert(`${a.name} — click.`);
      return;
    }
    ab.active = a.dur; ab.cd = a.cd + a.dur;
    if (this.char.id === 'kai') L.player.stamina = 1;
    Audio.play('magic', { vol: 0.7 });
    L.alert(`${a.name} — ${a.dur}s`);
  }

  // Phoenix Shield: absorbs a catch. Returns true when the hit was absorbed.
  absorbHit(enemy) {
    if (!this.shield) return false;
    const L = this.level, p = L.player;
    this.state.shield.active = 0; this.state.shield.cd = POWERS[0].cd;
    L.runStats.damage++;
    Audio.play('sting'); Audio.play('magic'); L.shake = 6; L.hurtFlash = 0.6;
    for (let i = 0; i < 26; i++) L.particles.push({ x: p.x, y: p.y, vx: rnd(-160, 160), vy: rnd(-160, 160), life: 0.8, color: '#ffb040' });
    // throw the enemy back to a far point and make it lose you
    const away = L.map.randomOpenNear(enemy.x + (enemy.x - p.x) * 3, enemy.y + (enemy.y - p.y) * 3, 3);
    if (!L.map.solidAt(away.x, away.y) && dist(away, p) > 4 * TILE) { enemy.x = away.x; enemy.y = away.y; }
    enemy.awareness = 0; enemy.lostT = 99;
    enemy.setState('search', L.map.randomOpenNear(p.x, p.y, 8));
    L.alert('THE PHOENIX SHIELD BURNS IT AWAY — RUN', 3);
    return true;
  }

  // ---- drawing (world space) ----
  draw(ctx, t) {
    const p = this.level.player;
    if (this.shield && !p.hidden) { ctx.strokeStyle = `rgba(255,170,60,${0.5 + Math.sin(t * 6) * 0.25})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 7); ctx.stroke(); }
    if (this.invisible && !p.hidden) { ctx.strokeStyle = 'rgba(160,140,255,.35)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    this.decoys.forEach(d => {
      const a = Math.min(1, d.t) * (0.5 + Math.sin(t * 9) * 0.15);
      ctx.fillStyle = `rgba(170,200,255,${a})`; ctx.beginPath(); ctx.ellipse(d.x, d.y, 9, 11, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(170,200,255,${a * 0.6})`; ctx.beginPath(); ctx.arc(d.x, d.y, 14 + (t * 30) % 20, 0, 7); ctx.stroke();
    });
  }
  // after lighting: outlines of revealed enemies
  drawReveal(ctx, zoom, cam, t) {
    const L = this.level;
    const shown = L.enemies.filter(e => e.active && this.revealsEnemy(e));
    if (!shown.length && !this.decoys.length) return;
    ctx.save(); ctx.scale(zoom, zoom); ctx.translate(-cam.x, -cam.y);
    shown.forEach(e => { ctx.strokeStyle = `rgba(255,70,50,${0.55 + Math.sin(t * 5) * 0.2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y, 13, 16, 0, 0, 7); ctx.stroke(); });
    this.decoys.forEach(d => { ctx.fillStyle = 'rgba(170,200,255,.5)'; ctx.beginPath(); ctx.arc(d.x, d.y, 5, 0, 7); ctx.fill(); });
    ctx.restore();
  }

  // ---- HUD ----
  hudHtml() {
    const a = this.char.ability, ab = this.ab;
    const abState = ab.active > 0 ? `<em>${ab.active.toFixed(1)}s</em>` : ab.cd > 0 ? `<i>${Math.ceil(ab.cd)}s</i>` : ab.uses <= 0 ? '<i>used</i>' : '<b>ready</b>';
    const abPct = ab.active > 0 ? ab.active / (a.dur || 1) : ab.cd > 0 ? 1 - ab.cd / (a.cd + a.dur) : 1;
    const slot = (key, name, icon, cls, state, pct) => `<div class="pslot ${cls}" title="${name}"><span class="k">${key}</span><span class="ic">${icon}</span><span class="nm">${name}</span><span class="st">${state}</span><span class="pg" style="width:${Math.round(pct * 100)}%"></span></div>`;
    let html = slot('R', a.name, '◈', 'ability ' + (ab.active > 0 ? 'active' : ab.cd > 0 || ab.uses <= 0 ? 'cool' : 'ready'), abState, abPct);
    for (const p of POWERS) {
      const s = this.state[p.id];
      if (!Phoenix.ownsPower(p.id)) { html += slot(p.key, p.name, p.icon, 'locked', Phoenix.level < p.level ? `Lv ${p.level}` : 'market', 0); continue; }
      const cls = s.active > 0 ? 'active' : s.cd > 0 ? 'cool' : 'ready';
      const st = s.active > 0 ? `<em>${s.active.toFixed(1)}s</em>` : s.cd > 0 ? `<i>${Math.ceil(s.cd)}s</i>` : '<b>ready</b>';
      const pct = s.active > 0 ? s.active / p.dur : s.cd > 0 ? 1 - s.cd / p.cd : 1;
      html += slot(p.key, p.name, p.icon, cls, st, pct);
    }
    return html;
  }
}
