// main.js — boots the game: screen flow (gate → intro → book → level),
// main loop, pause menu, results screens and the finale.
import { Audio } from './audio.js';
import { Dialogue, wait } from './dialogue.js';
import { Store, Memory } from './storage.js';
import { Input, TILE } from './engine.js';
import { UI, setArt, art } from './ui.js';
import { LEVELS } from './levels/index.js';
import { Phoenix, RunRewards, POWERS } from './phoenix.js';
import { PowerKit } from './powers.js';
import { renderMarket, openSecrets } from './screens.js';
import { SmartHints } from './hints.js';

const $ = s => document.querySelector(s);
const screens = ['gate', 'intro', 'book', 'market'];
let current = 'gate', stack = [];
function show(id) { current = id; if (id !== 'market') stack = []; screens.forEach(s => $('#' + s).classList.toggle('active', s === id)); }
// Phoenix screens remember where they were opened from for the Back button.
function openScreen(id, opts) {
  if (current === id && !opts) return;
  const from = current;
  if (id === 'market') renderMarket();
  UI.syncWallet();
  const prev = stack;
  show(id);
  stack = [...prev, from].filter(Boolean);
}
function goBack() {
  const to = stack.pop() || 'book';
  const keep = stack;
  if (to === 'market') { renderMarket(); show('market'); stack = keep; }
  else if (to === 'book') game.toBook();
  else if (to === 'intro') { show('intro'); revealTitle(); }
  else show(to);
}
Phoenix.onChange(() => UI.syncWallet());
window.addEventListener('phoenix-wallet', () => UI.syncWallet());

class Game {
  constructor() {
    this.canvas = $('#game');
    this.ctx = this.canvas.getContext('2d');
    this.input = new Input();
    this.ui = UI;
    this.level = null;
    this.levelDef = null;
    this.paused = false;
    this.last = performance.now();
    this.makeGrain();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    Dialogue.attach($('#subtitles'));
    requestAnimationFrame(t => this.loop(t));
  }

  makeGrain() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'), img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); this.grain = c;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.canvas.width = Math.floor(innerWidth * dpr);
    this.H = this.canvas.height = Math.floor(innerHeight * dpr);
    this.zoom = Math.min(this.W / (24 * TILE), this.H / (15 * TILE));
  }

  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    const L = this.level;
    if (L) {
      const running = !this.paused && !UI.modalOpen;
      if (running) { L.update(dt); Memory.tick(dt); this.hints?.update(dt); }
      L.render(this.ctx, this.W, this.H, this.zoom);
      if (!running) this.input.flush();
      if (this.input.hit('pause') && !UI.modalOpen && !L.ended) this.pause();
    } else {
      this.input.flush();
    }
    requestAnimationFrame(t2 => this.loop(t2));
  }

  // ---------------- levels ----------------
  async enter(def, checkpoint = false) {
    this.resumeCheckpoint = checkpoint;
    Audio.init();
    this.exitLevel(true);
    this.levelDef = def;
    show(null);
    UI.cine.show({ text: `${def.num}\n${def.title}`, cls: '' });
    Audio.play('pageTurn'); Audio.setMusic(null, 1);
    Audio.stopAllLoops(0.8);
    await wait(1900);
    UI.cine.hide();
    this.startLevel(def);
  }

  startLevel(def) {
    this.exitLevel(true);
    this.levelDef = def;
    UI.hud.reset();
    $('#hud').classList.add('active');
    UI.hud.title(def.title);
    this.input.clearAll();
    const L = new def.Level(this);
    L.kit = new PowerKit(L);
    L.rewards = new RunRewards(L);
    L.onLevelUp = lv => { UI.hud.toast(`<b>LEVEL ${lv}</b> reached`, 'lvl'); Audio.play('magic'); if ([5, 10, 15].includes(lv)) L.learned(`Level ${lv}: a new power can be unlocked in the Phantom Market.`); };
    Phoenix.progress(def.id).runs++;
    this.level = L;
    this.hints = new SmartHints(L);
    UI.hud.showThrow(!!L.throwable, L.throwable ? `throw ${L.throwable.name.toLowerCase()}` : '');
    L.refreshInventory();
    L.start();
    this.resumeCheckpoint = false;
  }

  exitLevel(silent) {
    this.hints?.hide(); this.hints = null;
    if (this.level) { this.level.destroy(); this.level = null; }
    document.body.classList.remove('glitch-screen');
    $('#hud').classList.remove('active');
    Dialogue.clear();
    if (!silent) { UI.cine.hide(); this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.W, this.H); }
  }

  restart(checkpoint = false) { this.resumeCheckpoint = checkpoint; if (this.levelDef) this.startLevel(this.levelDef); }

  openPowers() {
    const level = this.level;
    if (!level || level.ended) return;
    let timer, busy = false;
    const panel = UI.modal({ title: 'Phantom Market · Your powers', cls: 'wide', html: '<div id="run-shop"></div><p class="shop-message" role="status"></p>', onClose: () => { clearInterval(timer); this.input.clearAll(); } });
    const render = () => {
      if (busy) return;
      const root = panel.el.querySelector('#run-shop');
      root.innerHTML = `<p class="shop-balance">Phoenix Coins <b>${Phoenix.coins.toLocaleString()}</b><span>Unlock once. Use every night. The nightmare pauses here.</span></p>`;
      for (const power of POWERS) {
        const owned = Phoenix.ownsPower(power.id), cooldown = level.kit.state[power.id].cd;
        const card = document.createElement('article'); card.className = 'run-power';
        card.innerHTML = `<h3>${power.name}</h3><p>${power.effect}</p><small>${power.price} coins · ${power.dur}s · ${power.cd}s recharge</small>`;
        const button = document.createElement('button'); button.className = 'btn tiny';
        button.textContent = owned ? cooldown > 0 ? `Recharge ${Math.ceil(cooldown)}s` : level.kit.on(power.id) ? 'Already active' : 'Activate' : `Unlock · ${power.price}`;
        button.disabled = owned ? cooldown > 0 || level.kit.on(power.id) : Phoenix.level < power.level || Phoenix.coins < power.price;
        if (!owned && Phoenix.level < power.level) button.textContent = `Player level ${power.level} required`;
        if (!owned && Phoenix.coins < power.price && Phoenix.level >= power.level) button.textContent = `Need ${power.price - Phoenix.coins} more coins`;
        button.onclick = async () => {
          if (owned) { level.kit.activate(power); panel.close(); return; }
          busy = true; button.disabled = true; button.textContent = 'Saving purchase…';
          const result = await Phoenix.buyPower(power.id);
          busy = false;
          panel.el.querySelector('.shop-message').textContent = result.reason;
          render();
        };
        card.appendChild(button); root.appendChild(card);
      }
      const ability = document.createElement('button'); ability.className = 'btn'; ability.textContent = `Use ${level.kit.char.ability.name}`;
      ability.onclick = () => { level.kit.useAbility(); panel.close(); }; root.appendChild(ability);
    };
    render(); timer = setInterval(render, 1000);
  }

  toBook() {
    this.exitLevel();
    this.ctx.fillStyle = '#000'; this.ctx.fillRect(0, 0, this.W, this.H);
    Audio.stopAllLoops(0.8);
    Audio.setMusic('menu');
    Audio.startLoop('wind', 0.5);
    buildBook();
    show('book');
  }

  pause() {
    if (!this.level || UI.modalOpen) return;
    this.paused = true;
    if ('speechSynthesis' in window) speechSynthesis.pause();
    const L = this.level, ch = Phoenix.character();
    const objs = L.objectives.map(o => `<li class="${o.done ? 'done' : ''}">${o.text}</li>`).join('') || '<li>—</li>';
    UI.modal({
      title: 'Paused', cls: 'wide', html: `<p style="text-align:center;color:var(--ink-dim);margin-top:0">${this.levelDef.title}</p>
        <div class="pause-grid"><div><h4>Objectives</h4><ul class="pause-obj">${objs}</ul></div>
        <div><h4>${ch.name} · ${ch.title}</h4><p class="pause-p">${ch.passive}</p><p class="pause-p"><b>[R] ${ch.ability.name}:</b> ${ch.ability.desc}</p>
        <p class="pause-p">🜂 <b>${Phoenix.coins.toLocaleString()}</b> Phoenix Coins · +${L.rewards?.coins || 0} tonight · Level ${Phoenix.level}</p></div></div>`,
      actions: [
        { label: 'Resume', primary: true },
        { label: 'Restart Level', onClick: () => setTimeout(() => this.restart(), 0) },
        { label: 'Power-up Shop', close: false, onClick: () => this.openPowers() },
        { label: 'Book of Secrets', close: false, onClick: () => openSecrets() },
        { label: 'Settings', close: false, onClick: () => UI.settings() },
        { label: 'Controls', close: false, onClick: () => UI.controls() },
        { label: 'Return to Book', onClick: () => setTimeout(() => this.toBook(), 0) },
      ],
      onClose: () => { this.paused = false; this.input.clearAll(); if ('speechSynthesis' in window) speechSynthesis.resume(); },
    });
  }

  showGameOver(level, title = 'YOU WERE FOUND', flavor = '') {
    if (level !== this.level) return;
    UI.modal({
      cls: 'wide', html: `<div class="result dead"><p class="num" style="letter-spacing:.3em;color:#a55">${this.levelDef.title}</p><h1>${title}</h1><p class="flavor">${flavor}</p>
        <p class="summary">The book has recorded how you were caught. Next time, it will remember.</p>
        <div class="reward-box"><b>Victory bonus: 0 Phoenix Coins</b><p>Your existing coins and purchased powers are safe. Balance: ${Phoenix.coins.toLocaleString()} coins.</p></div></div>`,
      actions: [...(Phoenix.progress(level.id).checkpoint ? [{ label: 'Retry from Checkpoint', primary: true, onClick: () => setTimeout(() => this.restart(true), 0) }] : []), { label: 'Restart Level', onClick: () => setTimeout(() => this.restart(), 0) }, { label: 'Return to Book', onClick: () => setTimeout(() => this.toBook(), 0) }],
      keys: e => e.code === 'Escape' || e.code === 'KeyE',
    });
  }

  showComplete(level, summary = '') {
    if (level !== this.level) return;
    const def = this.levelDef;
    const mins = s => `${(s / 60) | 0}:${String(Math.round(s % 60)).padStart(2, '0')}`;
    Audio.setMusic('ending', 1);
    if (def.index === LEVELS.length - 1) return this.finale(level);
    const rw = level.rewards;
    const rows = rw ? rw.lines.map(([label, n, note]) => `<tr><td>${label}</td><td>${n ? `+${n}` : `<span class="muted">${note || '—'}</span>`}</td></tr>`).join('') : '';
    const nextDef = LEVELS[def.index + 1];
    const actions = [];
    if (nextDef) {
      actions.push({ label: 'Next Nightmare →', primary: true, onClick: () => setTimeout(() => this.enter(nextDef), 0) });
    }
    actions.push({ label: 'Replay Level', onClick: () => setTimeout(() => this.restart(), 0) });
    actions.push({ label: 'Return to Book', primary: !nextDef, onClick: () => setTimeout(() => this.toBook(), 0) });

    UI.modal({
      cls: 'wide', html: `<div class="result"><p style="letter-spacing:.3em;color:var(--gold);font-family:var(--display)">PAGE ${def.num}</p><h1>LEVEL ${def.index + 1} COMPLETE</h1><p class="flavor">${def.title}</p>
        <p class="summary">Time ${mins(level.time)} · ${summary}</p>
        ${rw ? `<table class="reward-table"><tr><th>Phoenix rewards</th><th>Coins</th></tr>${rows}<tr class="tot"><td>Total tonight (incl. coins found)</td><td>+${rw.coins}</td></tr></table>
        <p class="summary">XP +${rw.xp}${rw.levelUps.length ? ` · reached level ${rw.levelUps[rw.levelUps.length - 1]}` : ''} · Balance 🜂 ${Phoenix.coins.toLocaleString()}</p>` : ''}
        <p style="color:var(--ink-dim)">The page seals itself with a burning mark. Next nightmare unlocked in the Book of Secrets.</p></div>`,
      actions,
      keys: e => e.code === 'Escape' || e.code === 'KeyE',
    });
  }

  // Level 3 ending: all three pages glow, the blank page speaks.
  async finale(level) {
    this.exitLevel(true);
    show('book'); buildBook(true);
    Audio.setMusic('ending', 1); Audio.startLoop('wind', 0.4);
    Audio.play('pageTurn');
    await wait(3200);
    show(null);
    UI.cine.show({ text: '', img: art('book', 1000) });
    Audio.play('pageTurn'); await wait(1600);
    UI.cine.text('…', 'type');
    await wait(1200);
    UI.cine.text('THE GREATEST NIGHTMARE\nWAS NEVER INSIDE THE BOOK.');
    await Dialogue.say('book', 'The greatest nightmare was never inside the book.');
    await wait(1600);
    UI.cine.text('IT WAS THE ONE\nWHO OPENED IT.', 'glitch');
    Audio.play('glitch', { dur: 0.6 });
    await Dialogue.say('book', 'It was the one who opened it.');
    await wait(1200);
    UI.cine.art(im => im.classList.add('closing'));
    Audio.play('bookSlam');
    await wait(1800);
    UI.cine.hide();
    const all = LEVELS.every(l => Store.completed[l.id]);
    const n = LEVELS.filter(l => Store.completed[l.id]).length;
    UI.modal({
      cls: 'wide', html: `<div class="result"><h1>${all ? 'ALL THREE NIGHTMARES COMPLETED' : 'THE FINAL NIGHTMARE COMPLETED'}</h1>
        <p class="flavor" style="font-size:24px">THE END... FOR NOW.</p>
        <p class="summary">${all ? 'Every page of the Book of Secrets glows with radiant light. You have survived every nightmare.' : `${n} of ${LEVELS.length} pages glow. Other nightmares are still waiting for you inside the book.`}</p></div>`,
      actions: [
        { label: 'Play Again', onClick: () => setTimeout(() => this.enter(LEVELS[0]), 0) },
        { label: 'View Statistics', close: false, onClick: () => UI.stats() },
        { label: 'Return to Book', primary: true, onClick: () => setTimeout(() => this.toBook(), 0) },
      ],
      keys: e => e.code === 'Escape' || e.code === 'KeyE',
    });
  }
}

const game = new Game();
window.__game = game; // handy for debugging in the console

// ---------------------------------------------------------------------------
// BOOK (level select) — progressive unlocking based on completed levels
// ---------------------------------------------------------------------------
function buildBook(allGlow = false) {
  const wrap = $('#pages'); wrap.innerHTML = '';
  LEVELS.forEach(def => {
    const unlocked = !def.unlocked || def.unlocked(Store.completed);
    const done = Store.completed[def.id];
    const el = document.createElement('article');
    el.className = 'page' + (allGlow ? ' glow' : '') + (!unlocked ? ' locked' : '');
    el.style.setProperty('--glow', def.glow);

    let sealHtml = '';
    let actionHtml = '';
    if (!unlocked) {
      sealHtml = `<span class="seal locked">🔒 Locked</span>`;
      actionHtml = `<button class="btn" disabled>Locked 🔒</button>`;
    } else {
      sealHtml = `<span class="seal ${done ? '' : 'none'}">${done ? '✦ Survived' : 'Unwritten'}</span>`;
      actionHtml = `<button class="btn primary">Enter Nightmare</button>`;
    }

    el.innerHTML = `<div class="num">PAGE ${def.num} · LEVEL ${def.index + 1}</div><h3>${def.title}</h3>
      <div class="art"><img alt="${def.title} illustration" /></div>
      <p>${def.description}</p>
      <div class="meta"><b>OBJECTIVE</b> ${unlocked ? def.objective : (def.unlockHint || 'Survive previous nightmare to unlock.')}</div>
      <div class="meta"><b>ATMOSPHERE</b> ${def.atmosphere}</div>
      <div class="row">${sealHtml}${actionHtml}</div>`;
    setArt(el.querySelector('img'), def.art, 640);

    if (unlocked) {
      const go = () => { Audio.init(); Audio.play('pageTurn'); game.enter(def); };
      el.querySelector('.btn.primary').onclick = e => { e.stopPropagation(); go(); };
      if (Phoenix.progress(def.id).checkpoint) {
        const resume = document.createElement('button'); resume.className = 'btn'; resume.textContent = 'Resume Checkpoint';
        resume.onclick = event => { event.stopPropagation(); Audio.init(); game.enter(def, true); };
        el.querySelector('.row').appendChild(resume);
      }
      el.onclick = go;
    } else {
      el.onclick = () => { Audio.play('click'); UI.hud.alert(def.unlockHint || 'Survive the previous nightmare to unlock this chapter.', 2.5); };
    }
    wrap.appendChild(el);
  });
  $('#book-foot').textContent = `${LEVELS.filter(level => Store.completed[level.id]).length} of ${LEVELS.length} available nightmares survived. Your upgrades stay with you.`;
}

// ---------------------------------------------------------------------------
// CINEMATIC INTRO (≈12 seconds, skippable)
// ---------------------------------------------------------------------------
let introTimers = [], heartTimer = null, introDone = false;
function clearIntro() { introTimers.forEach(clearTimeout); introTimers = []; clearInterval(heartTimer); heartTimer = null; }
const at = (ms, fn) => introTimers.push(setTimeout(fn, ms));

function playIntro() {
  clearIntro(); introDone = false;
  const intro = $('#intro'), text = $('#intro-text'), book = $('#intro-book'), title = $('#title-block');
  intro.classList.remove('menu'); book.classList.remove('show', 'opening'); title.classList.remove('show'); text.classList.remove('show');
  show('intro');
  Audio.setMusic('intro', 3);
  Audio.startLoop('wind', 0.55);
  heartTimer = setInterval(() => Audio.play('heartbeat', { vol: 0.8, gap: 0.5 }), 1150);
  Audio.play('heartbeat');
  at(900, () => Audio.play('whisper', { pan: -0.7, dur: 2 }));
  at(1600, () => { text.textContent = 'Every nightmare begins with a story...'; text.classList.add('show'); Dialogue.say('narrator', 'Every nightmare begins with a story...'); });
  at(4800, () => { text.classList.remove('show'); Audio.play('bookSlam'); flash(); });
  at(5400, () => Audio.play('pageTurn'));
  at(6300, () => Audio.play('pageTurn', { vol: 0.7 }));
  at(6900, () => { text.innerHTML = 'But some stories... are waiting for <b style="color:#ff7a2f">YOU</b>.'; text.classList.add('show'); Dialogue.say('narrator', 'But some stories... are waiting for YOU.'); });
  at(7600, () => Audio.play('whisper', { pan: 0.7, dur: 1.6 }));
  at(10600, () => { text.classList.remove('show'); book.classList.add('show'); Audio.play('magic'); clearInterval(heartTimer); });
  at(12200, () => revealTitle());
}
function revealTitle() {
  clearIntro(); introDone = true;
  Store.data.introSeen = true; Store.save();
  $('#intro').classList.add('menu');
  $('#intro-text').classList.remove('show');
  $('#intro-book').classList.add('show');
  $('#title-block').classList.add('show');
  Audio.setMusic('menu', 3);
}
function flash() { const f = document.createElement('div'); f.style.cssText = 'position:absolute;inset:0;background:#ffcf9a;opacity:.35;z-index:9;pointer-events:none;transition:opacity .6s'; $('#intro').appendChild(f); requestAnimationFrame(() => f.style.opacity = 0); setTimeout(() => f.remove(), 700); }

async function openBook() {
  clearIntro();
  const book = $('#intro-book');
  if (!introDone) revealTitle();
  $('#title-block').classList.remove('show');
  Audio.play('bookSlam', { gap: 0 });
  book.classList.add('opening');
  setTimeout(() => Audio.play('pageTurn'), 400);
  setTimeout(() => Audio.play('pageTurn', { vol: 0.7 }), 900);
  await wait(1500);
  book.classList.remove('opening');
  game.toBook();
}
function skipIntro() { clearIntro(); Dialogue.clear(); revealTitle(); game.toBook(); }

// ---------------------------------------------------------------------------
// WIRING
// ---------------------------------------------------------------------------
setArt($('#intro-book img'), 'book', 1200);

let beginPending = false;
async function begin() {
  if (!$('#gate').classList.contains('active')) return;
  if (beginPending) return;
  beginPending = true; $('#gate-btn').disabled = true;
  Audio.init();
  let newGuest;
  try { newGuest = await Store.initialize(); }
  catch { $('#save-status').textContent = 'Your profile is unavailable. Reconnect, then try again. No balance was reset.'; beginPending = false; $('#gate-btn').disabled = false; return; }
  UI.syncMute();
  playIntro();
  if (newGuest) setTimeout(() => welcome(), 400);
  UI.syncWallet();
}
// New players: the 1,000 welcome coins (granted once per profile).
function welcome() {
  const el = document.createElement('div');
  el.className = 'welcome-gift';
  el.innerHTML = `<b>🜂 +1,000 Phoenix Coins</b><span>A welcome gift for new guests. Spend them on characters and powers.</span>`;
  $('#app').appendChild(el);
  setTimeout(() => el.remove(), 6500);
}
$('#gate-btn').addEventListener('click', begin);
window.addEventListener('keydown', e => { if ($('#gate').classList.contains('active') && !e.repeat) begin(); });

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  Audio.init();
  const a = b.dataset.action;
  if (a !== 'mute') Audio.play('click');
  switch (a) {
    case 'open-book': openBook(); break;
    case 'skip-intro': skipIntro(); break;
    case 'settings': UI.settings(); break;
    case 'stats': UI.stats(() => buildBook()); break;
    case 'controls': UI.controls(); break;
    case 'replay-intro': playIntro(); break;
    case 'to-title': show('intro'); revealTitle(); break;
    case 'pause': game.pause(); break;
    case 'hint': game.hints?.show(); break;
    case 'powers': game.openPowers(); break;
    case 'import-save': importSave(); break;
    case 'export-save': exportSave(); break;
    case 'market': openScreen('market'); break;
    case 'secrets': openSecrets(); break;
    case 'back': goBack(); break;
    case 'mute': toggleMute(); break;
  }
});
window.addEventListener('keydown', event => { if (event.code === 'KeyH' && !event.repeat && !UI.modalOpen && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) game.hints?.show(); });
window.addEventListener('phoenix-save-status', event => {
  $('#save-status').textContent = event.detail;
  const notice = $('#save-notice'); notice.textContent = event.detail; notice.hidden = !event.detail.startsWith('Save unavailable');
});
function exportSave() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(Store.data)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'project-phoenix-save.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importSave() {
  if (beginPending || Store.ready) { $('#save-status').textContent = 'Import before entering the game. Your current profile is unchanged.'; return; }
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    try {
      const file = input.files[0]; if (!file) return;
      if (file.size > 200000) throw new Error('This save file is too large.');
      Store.importLegacy(JSON.parse(await file.text()));
      $('#save-status').textContent = 'Previous save loaded. Enter the game to preserve it in your Phoenix profile.';
    } catch (error) { $('#save-status').textContent = error.message; }
  };
  input.click();
}
function toggleMute() { Store.settings.muted = !Store.settings.muted; Store.save(); Audio.applySettings(); UI.syncMute(); if (Store.settings.muted && 'speechSynthesis' in window) speechSynthesis.cancel(); }
window.addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat && !$('#gate').classList.contains('active') && !/INPUT/.test(document.activeElement?.tagName || '')) toggleMute(); });
// browsers may suspend audio when the tab is hidden
document.addEventListener('visibilitychange', () => { if (document.hidden && game.level && !UI.modalOpen && !game.level.ended) game.pause(); });
