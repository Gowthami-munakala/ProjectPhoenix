// screens.js — Phoenix screens: character selection (roster), the Phantom
// Market (power-ups) and the Book of Secrets. Rendering only; main.js decides
// which screen is visible.
import { Audio } from './audio.js';
import { Phoenix, CHARACTERS, POWERS, SECRETS, GUEST_RECORDS, REWARDS } from './phoenix.js';
import { UI, setArt, esc } from './ui.js';

const $ = s => document.querySelector(s);
const coinsTxt = n => `🜂 ${n.toLocaleString()}`;

function levelStrip() {
  const i = Phoenix.levelInfo();
  return `<div class="lvl"><b>Level ${i.level}</b><span class="xpbar"><i style="width:${Math.round(i.pct * 100)}%"></i></span><span>${i.level >= 30 ? 'max level' : `${i.into} / ${i.need} XP`}</span></div>`;
}

// ---------------------------------------------------------------------------
// CHARACTER SELECTION
// ---------------------------------------------------------------------------
let rosterOpts = {};
export function renderRoster(opts = rosterOpts) {
  rosterOpts = opts;
  const grid = $('#roster-grid'); grid.innerHTML = '';
  const sel = Phoenix.character().id, lvl = Phoenix.level;
  CHARACTERS.forEach(c => {
    const owned = Phoenix.owns(c.id), locked = !owned && lvl < c.level, afford = Phoenix.coins >= c.price;
    const el = document.createElement('article');
    el.className = `char-card ${c.id === sel ? 'selected' : ''} ${locked ? 'locked' : ''}`;
    const badge = owned ? (c.price ? '<span class="badge own">Owned</span>' : '<span class="badge free">Free</span>') : locked ? `<span class="badge lock">Level ${c.level}</span>` : `<span class="badge price">${coinsTxt(c.price)}</span>`;
    const a = c.ability;
    el.innerHTML = `<div class="portrait" style="--tint:${c.color}"><img alt="Portrait of ${esc(c.name)}" loading="lazy" />${badge}</div>
      <div class="char-body"><h3>${esc(c.name)}</h3><p class="ctitle">${esc(c.title)} · ${c.price ? `Level ${c.level} · ${c.price} coins` : 'Free'}</p>
      <p class="bio">${esc(c.bio)}</p>
      <p class="trait"><b>Passive</b> ${esc(c.passive)}</p>
      <p class="trait"><b>[R] ${esc(a.name)}</b> ${esc(a.desc)} ${a.cd ? `<em>${a.dur}s · ${a.cd}s recharge</em>` : `<em>${a.uses} use per night</em>`}</p>
      <div class="char-actions"></div></div>`;
    const img = el.querySelector('img');
    setArt(img, `char-${c.id}`, 420);
    img.addEventListener('error', () => { if (img.dataset.fallback) img.remove(); img.dataset.fallback = 1; });
    const act = el.querySelector('.char-actions');
    const btn = (label, cls, fn, disabled) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.disabled = !!disabled; b.onclick = e => { e.stopPropagation(); fn(); }; act.appendChild(b); };
    if (owned) btn(c.id === sel ? 'Selected ✓' : 'Select', c.id === sel ? 'primary' : '', () => { Phoenix.select(c.id); Audio.play('pageTurn', { vol: 0.6 }); renderRoster(); UI.syncWallet(); }, c.id === sel);
    else if (locked) btn(`Reach level ${c.level}`, '', () => {}, true);
    else btn(afford ? `Hire for ${c.price}` : `Need ${c.price - Phoenix.coins} more`, afford ? 'primary' : '', () => confirmBuy(c), !afford);
    grid.appendChild(el);
  });
  const bar = $('#checkin-bar');
  if (opts.onBegin) {
    const owned = POWERS.filter(p => Phoenix.ownsPower(p.id));
    bar.innerHTML = `<div class="loadout"><b>Tonight:</b> ${esc(Phoenix.character().name)} · Powers: ${owned.length ? owned.map(p => `[${p.key}] ${esc(p.name)}`).join(', ') : 'none yet — visit the Phantom Market'}</div>`;
    const go = document.createElement('button'); go.className = 'btn primary'; go.textContent = `Check in as ${Phoenix.character().name} →`;
    go.onclick = () => opts.onBegin(); bar.appendChild(go);
    bar.style.display = '';
  } else { bar.innerHTML = ''; bar.style.display = 'none'; }
}

function confirmBuy(c) {
  UI.modal({ title: `Hire ${c.name}?`, html: `<p>${esc(c.title)} — ${esc(c.passive)}</p><p>Price <b>${coinsTxt(c.price)}</b>. Your balance after: <b>${coinsTxt(Phoenix.coins - c.price)}</b>.</p>`,
    actions: [{ label: 'Cancel' }, { label: `Hire for ${c.price}`, primary: true, onClick: async () => {
      const r = await Phoenix.buyCharacter(c.id);
      if (r.ok) { Phoenix.select(c.id); Audio.play('success'); } else Audio.play('fail');
      setTimeout(() => { UI.modal({ title: r.ok ? 'Welcome' : 'Purchase failed', html: `<p>${esc(r.reason)}</p>` }); renderRoster(); UI.syncWallet(); }, 0);
    } }] });
}

// ---------------------------------------------------------------------------
// PHANTOM MARKET
// ---------------------------------------------------------------------------
export function renderMarket(msg = '') {
  $('#market-level').innerHTML = levelStrip() + `<p class="xp-hint">Shield, Sprint and Lantern are ready at level 1. Cloak unlocks at level 2; Decoy at level 3. Unlock once, use every night.</p>`;
  const grid = $('#market-grid'); grid.innerHTML = '';
  POWERS.forEach(p => {
    const owned = Phoenix.ownsPower(p.id), locked = Phoenix.level < p.level, afford = Phoenix.coins >= p.price;
    const el = document.createElement('article');
    el.className = `power-card ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}`;
    el.innerHTML = `<div class="pc-head"><span class="pc-icon">${p.icon}</span><div><h3>${esc(p.name)}</h3><p class="pc-key">Key [${p.key}]</p></div></div>
      <p class="pc-effect">${esc(p.effect)}</p>
      <dl class="pc-stats"><div><dt>Cost</dt><dd>${coinsTxt(p.price)}</dd></div><div><dt>Unlock</dt><dd>Level ${p.level}</dd></div><div><dt>Duration</dt><dd>${p.dur}s</dd></div><div><dt>Recharge</dt><dd>${p.cd}s</dd></div></dl>`;
    const b = document.createElement('button');
    b.className = 'btn ' + (!owned && !locked && afford ? 'primary' : '');
    b.textContent = owned ? 'Unlocked ✓' : locked ? `Requires level ${p.level}` : afford ? `Unlock for ${p.price}` : `Need ${p.price - Phoenix.coins} more`;
    b.disabled = owned || locked || !afford;
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'Confirming purchase…';
      const r = await Phoenix.buyPower(p.id);
      Audio.play(r.ok ? 'success' : 'fail');
      UI.syncWallet(); renderMarket(r.reason);
    };
    el.appendChild(b);
    grid.appendChild(el);
  });
  $('#market-msg').textContent = msg;
}

// ---------------------------------------------------------------------------
// BOOK OF SECRETS
// ---------------------------------------------------------------------------
export function openSecrets(onClose) {
  const tabs = ['Clues', 'Secrets', 'Guest Records', 'Coin Ledger'];
  const m = UI.modal({ title: 'The Book of Secrets', cls: 'wide secrets', html: `<div class="tabs">${tabs.map((t, i) => `<button class="tab ${i ? '' : 'on'}" data-t="${i}">${t}</button>`).join('')}</div><div class="tab-body"></div>`, onClose });
  const body = m.el.querySelector('.tab-body');
  const render = i => {
    m.el.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', +b.dataset.t === i));
    if (i === 0) {
      const clues = Object.entries(Phoenix.clues).sort((a, b) => a[1].at - b[1].at);
      body.innerHTML = clues.length ? clues.map(([, c]) => `<details class="clue"><summary>${esc(c.title)}</summary><div class="doc">${esc(c.text)}</div></details>`).join('')
        : '<p class="empty">No clues yet. Notes, photographs and the register are copied here when you read them.</p>';
    } else if (i === 1) {
      const all = Object.entries(SECRETS).flatMap(([lv, list]) => list.map(s => ({ ...s, lv })));
      const found = all.filter(s => Phoenix.hasSecret(s.id)).length;
      body.innerHTML = `<p>${found} of ${all.length} secrets discovered. Each secret room pays ${REWARDS.secret} Phoenix Coins the first time.</p><ul class="secret-list">${all.map(s => Phoenix.hasSecret(s.id) ? `<li class="found">✦ ${esc(s.title)}</li>` : `<li>??? — hidden in ${esc(s.lv)}</li>`).join('')}</ul>`;
    } else if (i === 2) {
      const names = Object.keys(GUEST_RECORDS);
      body.innerHTML = `<p>Mr. Vale's guest records — ${Object.keys(Phoenix.records).length} of ${names.length} recovered.</p>` + names.map(n => Phoenix.records[n] ? `<div class="record"><b>${esc(n)}</b><span>${esc(GUEST_RECORDS[n])}</span></div>` : '<div class="record missing"><b>— torn page —</b><span>Ask Mr. Vale, or find where the staff keep their files.</span></div>').join('');
    } else {
      const l = [...Phoenix.ledger].reverse();
      body.innerHTML = `<p>Balance <b>${coinsTxt(Phoenix.coins)}</b></p><table class="ledger">${l.map(e => `<tr><td class="${e.n < 0 ? 'neg' : 'pos'}">${e.n > 0 ? '+' : ''}${e.n}</td><td>${esc(e.why)}</td><td>${new Date(e.at).toLocaleDateString()}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</table>`;
    }
  };
  m.el.querySelectorAll('.tab').forEach(b => b.onclick = () => { Audio.play('pageTurn', { vol: 0.5 }); render(+b.dataset.t); });
  render(0);
  return m;
}
