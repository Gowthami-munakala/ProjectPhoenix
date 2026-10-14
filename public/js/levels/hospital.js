// LEVEL 2 — ST. JUDE SANATORIUM: WARD B
// Atmospheric hospital horror. Flickering lights, rolling gurneys, medical puzzles.
import { BaseLevel, Stalker, Grid, TileMap, TILE, tc, dist, rnd, choose, shuffle, hash, clamp } from '../engine.js';
import { Audio } from '../audio.js';
import { Memory, Store } from '../storage.js';
import { Phoenix } from '../phoenix.js';

const SOLID = '#WBTSCGDXKHP';
const OPAQUE = '#WSCDXKH';

const PHOENIX_COINS = [
  [3, 4], [12, 4], [22, 3], [34, 4], [46, 4],
  [6, 12], [18, 12], [28, 11], [40, 12], [48, 12],
  [4, 20], [15, 20], [25, 21], [38, 20], [48, 22],
  [8, 28], [24, 28], [36, 28]
];

function buildHospitalMap() {
  const g = new Grid(52, 34);
  // Main corridors: West-East corridors and connecting North-South halls
  g.rect(1, 8, 50, 9, '.');          // Central North Corridor
  g.rect(1, 16, 50, 17, '.');        // Central South Corridor
  g.rect(1, 10, 2, 15, '.');         // West connector
  g.rect(25, 10, 26, 15, '.');       // Central Hall connector
  g.rect(49, 10, 50, 15, '.');       // East connector

  // North Wing: Patient Wards 201, 202, 203
  g.rect(1, 1, 15, 6, ','); g.put(7, 7, 'D');   // Ward 201
  g.rect(18, 1, 32, 6, ','); g.put(25, 7, 'D');  // Ward 202
  g.rect(35, 1, 49, 6, ','); g.put(42, 7, 'D');  // Ward 203

  // Mid Wing: Nurses' Station, Doctors' Office, Pharmacy
  g.rect(3, 11, 12, 14, '_'); g.put(13, 12, '.'); // Nurses' Station
  g.rect(15, 11, 23, 14, ','); g.put(19, 15, 'D'); // Doctor's Consultation
  g.rect(28, 11, 38, 14, ','); g.put(33, 15, 'K'); // Pharmacy (Locked)
  g.rect(41, 11, 48, 14, '_'); g.put(45, 15, 'D'); // Records & Lab

  // South Wing: Electrical Substation, Security / Quarantine, Morgue, Ambulance Bay
  g.rect(1, 19, 14, 26, '_'); g.put(8, 18, 'D');   // Electrical Substation / Generator
  g.rect(17, 19, 33, 26, '_'); g.put(25, 18, '.');  // Security & Quarantine Console
  g.rect(36, 19, 50, 26, ','); g.put(43, 18, 'D');  // Morgue & Cold Storage
  g.rect(18, 28, 32, 32, '_'); g.put(25, 27, '.');  // Ambulance Bay (Exit lobby)
  g.put(25, 33, 'X'); g.put(26, 33, 'X');           // Ambulance Bay Exit blast doors

  // Furniture & Fixtures
  const bed = (x, y) => g.puts([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], 'B');
  // Beds in Patient Wards
  bed(3, 2); bed(8, 2); bed(12, 2);
  bed(20, 2); bed(24, 2); bed(29, 2);
  bed(37, 2); bed(41, 2); bed(46, 2);

  // Supply cabinets / lockers (W)
  g.puts([[14, 2], [19, 6], [36, 6], [4, 11], [11, 11], [42, 11], [2, 20], [13, 20]], 'W');
  // Desks & Medical trays (T)
  g.puts([[5, 4], [22, 4], [39, 4], [7, 13], [18, 13], [30, 13], [35, 13], [44, 13], [22, 23], [28, 23]], 'T');
  // Medicine shelves & records (S)
  g.puts([[29, 12], [30, 12], [31, 12], [35, 12], [36, 12], [37, 12], [42, 13], [47, 13]], 'S');
  // Generator unit in Electrical Substation (G)
  g.puts([[4, 22], [5, 22], [4, 23], [5, 23]], 'G');
  // Security Console terminal (P)
  g.puts([[24, 21], [25, 21], [26, 21]], 'P');
  // Morgue Cold Storage drawers (C)
  g.puts([[47, 20], [48, 20], [49, 20], [47, 24], [48, 24], [49, 24]], 'C');

  // SECRET 1: Padded Cell behind movable shelf in Ward 201
  g.rect(1, 28, 7, 32, ','); g.put(4, 27, 'H');
  g.put(3, 30, 'T');

  // SECRET 2: Confidential Autopsy Vault behind Morgue wall
  g.rect(44, 28, 50, 32, ','); g.put(47, 27, 'H');
  g.put(48, 30, 'S');

  return g.rows();
}

const HIDES = [
  { id: 'ward-bed-201', tile: [3, 4], label: 'Crawl under patient gurney in Ward 201' },
  { id: 'ward-bed-203', tile: [41, 4], label: 'Crawl under patient gurney in Ward 203' },
  { id: 'nurses-closet', tile: [4, 12], label: 'Hide in the nurses’ supply cabinet' },
  { id: 'pharmacy-locker', tile: [36, 13], label: 'Squeeze into the medicine locker' },
  { id: 'generator-corner', tile: [2, 24], label: 'Hide behind the substation transformers' },
  { id: 'morgue-vault', tile: [48, 22], label: 'Hide inside the cold morgue vault' },
];

export class HospitalLevel extends BaseLevel {
  constructor(game) {
    super(game);
    this.id = 'hospital';
    this.map = new TileMap(buildHospitalMap(), { solid: SOLID, opaque: OPAQUE });
    this.bg = '#030504';
    this.darkness = 0.94;
    this.darkColor = '2,6,5';
    this.musicName = 'hospital';
    this.ambientSounds = ['monitor', 'trolley', 'spark', 'footstepsFar', 'creak', 'flatline', 'whisper'];
    this.surface = 'tile';
    this.throwable = { name: 'Glass Vials', count: 2 };
    this.playerColor = '#4a665a';
    this.player.x = tc(25, 30).x;
    this.player.y = tc(25, 30).y;
    this.player.angle = -Math.PI / 2;
    this.breath = 1;
    this.holding = false;
    this.stage = 'dark'; // 'dark' -> 'morgue' -> 'quarantine' -> 'escape'
    this.powerOn = false;
    this.morgueCode = '0429';
    this.setupWorld();
  }

  setupWorld() {
    this.setObjectives([
      { id: 'power', text: 'Restore backup power at the Electrical Substation' },
      { id: 'breakers', text: 'Find Circuit Breakers A & B (Nurses’ Station & Pharmacy)' },
      { id: 'keycard', text: 'Retrieve Dr. Vance’s Master Keycard from the Morgue' },
      { id: 'console', text: 'Override Quarantine Lockdown at the Security Console' },
      { id: 'evacuate', text: 'Evacuate through the Ambulance Bay Doors' },
    ]);

    const P = (tx, ty) => tc(tx, ty);

    // Initial emergency red/dim lights
    this.mainLights = [
      this.addLight({ ...P(8, 8), r: 120, flicker: 0.12, intensity: 0.5, color: 'rgba(255,80,50,0.08)' }),
      this.addLight({ ...P(25, 8), r: 140, flicker: 0.05, intensity: 0.5, color: 'rgba(255,90,50,0.08)' }),
      this.addLight({ ...P(42, 8), r: 120, flicker: 0.1, intensity: 0.5, color: 'rgba(255,80,50,0.08)' }),
      this.addLight({ ...P(8, 16), r: 120, flicker: 0.08, intensity: 0.5, color: 'rgba(255,80,50,0.08)' }),
      this.addLight({ ...P(25, 16), r: 150, flicker: 0.03, intensity: 0.6, color: 'rgba(255,90,50,0.08)' }),
      this.addLight({ ...P(42, 16), r: 120, flicker: 0.15, intensity: 0.5, color: 'rgba(255,80,50,0.08)' }),
      this.addLight({ ...P(25, 23), r: 140, flicker: 0.05, intensity: 0.6, color: 'rgba(100,200,255,0.08)' }), // console
    ];

    // Phoenix Coins (18 pickups)
    this.phoenixCoins = PHOENIX_COINS.map(([tx, ty], i) => ({
      id: `pc${i}`,
      ...P(tx, ty),
      taken: false,
      light: this.addLight({ ...P(tx, ty), r: 34, intensity: 0.45, color: 'rgba(60,240,160,0.12)' })
    }));

    // Hiding spots
    HIDES.forEach(h => {
      const p = P(h.tile[0], h.tile[1]);
      h.x = p.x; h.y = p.y;
      this.addInteract({
        id: h.id, ...p, r: 36, sparkle: false,
        label: () => this.player.hidden?.id === h.id ? 'Leave hiding spot' : h.label,
        action: it => this.toggleHide(h, it),
      });
    });

    // Nurses' Station: Breaker A (Red) and Pharmacy Key
    this.addInteract({
      id: 'nurses-desk', ...P(7, 13), r: 40, once: true, label: 'Search Nurses’ Station desk',
      action: () => {
        this.give('Red Breaker (Unit A)');
        this.give('Pharmacy Key');
        this.alert('Found Red Breaker (Unit A) and the Pharmacy Key on the nurses’ chart desk.');
        this.addClue('nurses-note', 'Nurses’ Station Log', '“Emergency generators require Breaker A (Red) and Breaker B (Blue). Breaker B was locked inside the Pharmacy after the riot.”');
        if (this.has('Blue Breaker (Unit B)')) this.done('breakers');
      }
    });

    // Pharmacy Door (locked)
    this.addInteract({
      id: 'pharmacy-door', ...P(33, 15), r: 42, sparkle: false,
      cond: () => this.map.get(33, 15) === 'K',
      label: () => this.has('Pharmacy Key') ? 'Unlock Pharmacy with key' : 'Pharmacy Door (locked)',
      action: it => {
        if (!this.has('Pharmacy Key')) { Audio.play('click'); this.alert('Locked. A label reads: PHARMACY — AUTHORIZED STAFF ONLY.'); return; }
        this.map.set(33, 15, '.'); this.redrawTile(33, 15);
        it.enabled = false;
        Audio.play('door');
        this.alert('Unlocked the Pharmacy door.');
      }
    });

    // Pharmacy Shelf: Breaker B (Blue)
    this.addInteract({
      id: 'pharmacy-shelf', ...P(31, 12), r: 40, once: true, label: 'Search medicine shelves',
      action: () => {
        this.give('Blue Breaker (Unit B)');
        this.alert('Found Blue Breaker (Unit B) in the pharmaceutical storage crate.');
        if (this.has('Red Breaker (Unit A)')) this.done('breakers');
      }
    });

    // Generator / Electrical Substation Panel
    this.addInteract({
      id: 'generator-panel', ...P(5, 22), r: 44,
      cond: () => !this.powerOn,
      label: () => (this.has('Red Breaker (Unit A)') && this.has('Blue Breaker (Unit B)')) ? 'Insert breakers & engage backup power' : 'Examine Generator Fuse Panel',
      action: () => {
        if (!this.has('Red Breaker (Unit A)') || !this.has('Blue Breaker (Unit B)')) {
          this.alert('Two heavy slots are empty: Circuit Breaker A (Red) and Circuit Breaker B (Blue) are missing.');
          return;
        }
        this.restorePower();
      }
    });

    // Doctor's Desk & Medical Log
    this.addInteract({
      id: 'dr-desk', ...P(18, 13), r: 40, once: true, label: 'Read Dr. Vance’s Autopsy Notes',
      action: async () => {
        const text = 'PATIENT AUTOPSY LOG — ST. JUDE SANATORIUM\n\nSubject: 404 (Unidentified Orderly)\nPrimary cause of death: Unknown cellular mutation\nTime of Death: 04:29 AM\n\nNote: The master keycard is locked in Cold Storage Locker 4. The digital combination is calibrated to the subject’s recorded time of death (4 digits).';
        await this.ui.doc('Dr. Vance’s Autopsy Log', text);
        this.addClue('morgue-code', 'Autopsy Log — Subject 404', 'Dr. Vance calibrated the Morgue Cold Storage locker keypad to Subject 404’s time of death: 04:29 (Code: 0429).');
        this.alert('Dr. Vance’s log mentions Subject 404’s time of death: 04:29.');
      }
    });

    // Morgue Locker Keypad
    this.addInteract({
      id: 'morgue-keypad', ...P(48, 20), r: 42,
      cond: () => !this.has('Master Keycard'),
      label: 'Examine Cold Storage Keypad',
      action: async () => {
        if (!this.powerOn) { this.alert('The keypad is unpowered. Restore electrical power first.'); return; }
        const ok = await this.ui.keypad({
          title: 'Cold Storage Locker 4',
          hint: 'Enter 4-digit code (Subject 404 Time of Death):',
          length: 4,
          check: c => c === this.morgueCode,
        });
        if (!ok) return;
        this.give('Master Keycard');
        this.done('keycard');
        this.alert('Cold storage drawer slides open with a hiss. Retrieved Dr. Vance’s Master Keycard!');
        this.stage = 'quarantine';
        this.spawnOrderly();
      }
    });

    // Security & Quarantine Console
    this.addInteract({
      id: 'quarantine-console', ...P(25, 21), r: 44,
      cond: () => this.stage === 'quarantine' || this.stage === 'morgue',
      label: () => this.has('Master Keycard') ? 'Swipe Master Keycard & Override Quarantine' : 'Quarantine Console (Locked)',
      action: async () => {
        if (!this.has('Master Keycard')) {
          Audio.play('click');
          this.alert('Quarantine lockdown active. Swipe Dr. Vance’s Master Keycard to release.');
          return;
        }
        this.overrideQuarantine();
      }
    });

    // Ambulance Bay Doors (Exit)
    this.addInteract({
      id: 'exit-blast-doors', ...P(25, 33), r: 50,
      label: () => this.stage === 'escape' ? 'Evacuate Sanatorium through Ambulance Bay' : 'Ambulance Bay Doors (Sealed)',
      action: () => {
        if (this.stage !== 'escape') {
          Audio.play('click');
          this.alert('Heavy steel blast doors. Sealed by Sanatorium Quarantine Protocol.');
          return;
        }
        this.escapeSanatorium();
      }
    });

    // SECRETS
    // Secret 1: Padded Cell (Ward 201)
    this.addInteract({
      id: 'secret-shelf-201', ...P(4, 26), r: 36, once: true,
      cond: () => this.map.get(4, 27) === 'H',
      label: 'Inspect cracked wall tile behind bed',
      action: () => {
        this.map.set(4, 27, '.'); this.redrawTile(4, 27);
        Audio.play('stoneDoor');
        this.alert('The wall slides back, revealing a forgotten padded isolation cell.');
      }
    });

    // Secret 2: Confidential Autopsy Vault
    this.addInteract({
      id: 'secret-morgue-vault', ...P(47, 26), r: 36, once: true,
      cond: () => this.map.get(47, 27) === 'H',
      label: 'Inspect loose ventilation panel',
      action: () => {
        this.map.set(47, 27, '.'); this.redrawTile(47, 27);
        Audio.play('stoneDoor');
        this.alert('A hidden autopsy archive behind the morgue wall opens.');
      }
    });
  }

  restorePower() {
    this.take('Red Breaker (Unit A)');
    this.take('Blue Breaker (Unit B)');
    this.powerOn = true;
    this.done('power');
    Audio.play('generator');
    Audio.play('switch');
    Audio.startLoop('hum', 0.4);

    // Switch corridor lights from dim emergency red to bright fluorescent cyan
    this.mainLights.forEach(l => {
      l.color = 'rgba(120,240,255,0.09)';
      l.intensity = 0.85;
      l.r = 170;
    });

    this.alert('Emergency generators roar to life! Fluorescent lights flicker on down the corridors.');
    this.addClue('power-restored', 'Substation Online', 'Emergency power is restored. Electronic terminals and keypads are now functional.');
    this.stage = 'morgue';
  }

  spawnOrderly() {
    if (this.creature) return;
    Audio.play('screech');
    Audio.play('sting');
    this.alert('A heavy metallic drag echoes down the north corridor... Something heard the lock open.', 4);

    const orderly = new Stalker(this, {
      x: tc(7, 8).x, y: tc(7, 8).y, r: 12,
      speeds: { patrol: 55, investigate: 85, search: 72, chase: 142 },
      patrol: [tc(7, 8), tc(25, 8), tc(42, 8), tc(42, 16), tc(25, 16), tc(8, 16)],
      stepSurface: 'tile',
      sight: 240,
      catchDist: 22,
    });

    orderly.onHear = () => {
      if (Math.random() < 0.4) Audio.play('trolley', { vol: 0.6 });
    };

    orderly.draw = (ctx, t) => {
      ctx.save(); ctx.translate(orderly.x, orderly.y);
      ctx.shadowColor = '#000'; ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(0, 6, 15, 8, 0, 0, 7); ctx.fill();
      ctx.rotate(orderly.angle);

      // Hunched surgeon body
      ctx.fillStyle = '#1e382d'; // dark hospital scrubs
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 14, 0, 0, 7); ctx.fill();
      // Bloody apron
      ctx.fillStyle = '#6a2218';
      ctx.fillRect(-6, -4, 12, 14);

      // Head / surgical mask
      ctx.fillStyle = '#dcd6ca';
      ctx.beginPath(); ctx.arc(6, 0, 6, 0, 7); ctx.fill();
      // Glowing yellow/red eyes
      ctx.fillStyle = orderly.state === 'chase' ? '#ff2a1a' : '#ffc030';
      ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(10, -2, 2, 0, 7); ctx.arc(10, 2, 2, 0, 7); ctx.fill();

      // Scalpel / metallic bar in hand
      ctx.strokeStyle = '#c0c8cc'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(4, 8); ctx.lineTo(18, 12); ctx.stroke();
      ctx.restore();

      orderly.drawAwareness(ctx);
    };

    this.creature = orderly;
    this.enemies.push(orderly);
  }

  overrideQuarantine() {
    this.done('console');
    this.stage = 'escape';
    Audio.play('warning');
    Audio.play('door');
    this.alert('QUARANTINE OVERRIDDEN! Ambulance Bay Blast Doors Unlocked. Escape now!', 5);
    this.timeLeft = 360; // 6:00 minute escape timer

    // Ambulance blast doors open on map
    this.map.set(25, 33, '.'); this.map.set(26, 33, '.');
    this.redrawTile(25, 33); this.redrawTile(26, 33);

    this.saveCheckpoint();
  }

  saveCheckpoint() {
    if (this.stage !== 'escape' || this.ended) return;
    const checkpoint = {
      version: 1, runId: this.runId, stage: this.stage,
      inventory: [...this.inventory], objectives: this.objectives.map(o => ({ ...o })),
      powerOn: this.powerOn,
      throwables: this.throwable.count,
    };
    Phoenix.progress(this.id).checkpoint = checkpoint;
    Store.save(true);
  }

  toggleHide(h, it) {
    const p = this.player;
    if (p.hidden) {
      p.hidden = null; Audio.play('creak'); this.holding = false;
      return;
    }
    const c = this.creature;
    p.hidden = { id: h.id, it, x: p.x, y: p.y };
    p.x = h.x; p.y = h.y;
    Audio.play('creak');
    Memory.hide('hospital', h.id);
    this.flashlight.on = false;
    if (c && c.active && c.state === 'chase' && dist(c, p) < 250 && this.map.los(c.x, c.y, p.x, p.y)) {
      c.setState('search'); c.target = { x: p.x, y: p.y };
      this.alert('IT SAW YOU HIDE. Run!', 2.5);
    }
    this.alert('Hidden. Hold [Space] to hold breath. [E] to leave.', 3);
  }

  onHiddenUpdate(dt) {
    const hold = this.input.is('action') && this.breath > 0;
    if (hold && !this.holding) Audio.play('breath');
    if (!hold && this.holding && this.breath <= 0.02) {
      Audio.play('gasp'); this.noise(this.player.x, this.player.y, 130, 'gasp');
    }
    this.holding = hold;
    if (hold) this.breath = Math.max(0, this.breath - dt / (4.6 * (this.kit?.breathMul || 1)));
    else this.breath = Math.min(1, this.breath + dt / 3);
  }

  updateHud() {
    super.updateHud();
    if (this.player.hidden) {
      this.ui.hud.status(`<span style="color:#9fd">HIDDEN · ${this.holding ? 'HOLDING BREATH' : 'breathing'}</span><span>Breath<span class="bar"><i style="width:${this.breath * 100}%;background:#8fc8ff"></i></span></span>`);
    }
  }

  onTimeout() {
    this.gameOver('QUARANTINE SEALED', 'The blast doors locked permanently. Ward B claims another soul.');
  }

  escapeSanatorium() {
    this.frozen = true;
    if (this.creature) this.creature.active = false;
    Audio.setMusic(null, 1);
    Audio.stopAllLoops(0.5);

    this.run(async () => {
      Audio.play('door');
      await this.w(0.8);
      this.ui.cine.show({ text: '' });
      Audio.play('pageTurn');
      await this.w(1.2);
      this.ui.cine.text('You burst through the ambulance bay blast doors...');
      await this.say('narrator', 'You burst through the ambulance bay blast doors...');
      await this.w(1.6);
      this.ui.cine.text('The cold night air fills your lungs. The sirens fade into the dark.');
      await this.say('narrator', 'The cold night air fills your lungs. The sirens fade into the dark.');
      await this.w(2.0);
      Audio.play('bookSlam');
      this.ui.cine.text('PAGE II SEALS IN FLAME.', 'glitch');
      await this.w(2.5);
      this.ui.cine.hide();
      this.done('evacuate');
      this.complete('Survived St. Jude Sanatorium · All quarantine protocols overridden.');
    });
  }

  getHintContext() {
    if (!this.powerOn && (!this.has('Red Breaker (Unit A)') || !this.has('Blue Breaker (Unit B)'))) {
      return ['breakers', [
        'The sanatorium is dark. Search the Nurses’ Station desk and the Pharmacy for circuit breakers.',
        'Breaker A is in the Nurses’ Station. Breaker B is locked in the Pharmacy; use the Pharmacy Key found on the nurses’ desk.'
      ]];
    }
    if (!this.powerOn) {
      return ['generator', [
        'You have both circuit breakers. Take them to the Electrical Substation in the southwest corridor.',
        'Interact with the Generator Fuse Panel in the southwest room to restore power.'
      ]];
    }
    if (!this.has('Master Keycard')) {
      return ['morgue', [
        'Power is online. Head to the Morgue at the southeast end to find Dr. Vance’s Master Keycard.',
        'The Morgue keypad requires Subject 404’s time of death from Dr. Vance’s consultation desk: 0429.'
      ]];
    }
    if (this.stage !== 'escape') {
      return ['console', [
        'Take Dr. Vance’s Master Keycard to the Central Security Console.',
        'Swipe the keycard at the console in the central hall to override quarantine and unlock the Ambulance Bay doors.'
      ]];
    }
    return ['evacuate', [
      'The quarantine blast doors are unlocked! Run south to the Ambulance Bay and escape before time expires.',
      'Head straight down the south hall to the exit doors [X] to evacuate!'
    ]];
  }

  onUpdate(dt) {
    if (!this.frozen) {
      // Collect Phoenix coins
      for (const c of this.phoenixCoins) {
        if (!c.taken && dist(c, this.player) < 26 && !this.player.hidden) {
          c.taken = true; c.light.on = false;
          this.rewards?.coin(c.id).then(amt => {
            if (amt) this.ui.hud.toast(`+${amt} Phoenix Coins saved`, 'gold');
          });
          Audio.play('pickup');
          for (let i = 0; i < 8; i++) this.particles.push({ x: c.x, y: c.y, vx: rnd(-40, 40), vy: rnd(-50, 10), life: 0.5, color: '#3ce8a0' });
        }
      }

      // Secret rooms discovery
      const ptx = this.player.x / TILE, pty = this.player.y / TILE;
      if (!this.foundPadded && pty >= 28 && ptx <= 8) {
        this.foundPadded = true;
        this.rewards?.secret('padded-cell', 'The Forgotten Padded Cell');
      }
      if (!this.foundVault && pty >= 28 && ptx >= 44) {
        this.foundVault = true;
        this.rewards?.secret('morgue-archive', 'The Confidential Autopsy Vault');
      }
    }
  }

  drawTile(g, ch, x, y) {
    const X = x * TILE, Y = y * TILE, h = hash(x, y);
    // Hospital floor painting
    if (ch === '.' || ch === 'd') {
      // Polished institutional tile
      g.fillStyle = (x + y) % 2 ? '#1a2420' : '#141c18';
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = 'rgba(100,200,160,0.04)';
      g.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
    } else if (ch === ',') {
      // Patient ward linoleum
      g.fillStyle = '#1e2824';
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = `rgba(180,220,200,${h * 0.05})`;
      g.fillRect(X, Y, TILE, TILE);
    } else if (ch === '_') {
      // Clean operating/terminal tile
      g.fillStyle = '#162226';
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = 'rgba(160,240,255,0.04)';
      g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
    }

    if (ch === '#') {
      // Hospital wall: dark decayed upper wall with green lower tile trim
      g.fillStyle = '#101714';
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = '#1b3228'; // green hospital wainscot tile
      g.fillRect(X, Y + TILE - 8, TILE, 8);
      g.fillStyle = '#2d5444';
      g.fillRect(X, Y + TILE - 9, TILE, 1);
      return;
    }

    // Furniture
    switch (ch) {
      case 'B':
        // Hospital gurney / bed with stained sheets
        g.fillStyle = '#404c48'; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        g.fillStyle = '#9cb4a8'; g.fillRect(X + 4, Y + 4, TILE - 8, TILE - 8);
        g.fillStyle = '#6a2a24'; g.fillRect(X + 8, Y + 10, 8, 8); // stain
        break;
      case 'W':
        // Steel medical supply locker
        g.fillStyle = '#22302a'; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        g.fillStyle = '#3a5046'; g.fillRect(X + 4, Y + 4, TILE - 8, TILE - 8);
        g.fillStyle = '#90b8a8'; g.fillRect(X + 14, Y + 12, 4, 2);
        break;
      case 'T':
        // Metal medical tray table
        g.fillStyle = '#2b3a34'; g.fillRect(X + 5, Y + 5, TILE - 10, TILE - 10);
        g.fillStyle = '#607870'; g.fillRect(X + 7, Y + 7, TILE - 14, TILE - 14);
        break;
      case 'S':
        // Medicine shelves
        g.fillStyle = '#1b2622'; g.fillRect(X + 1, Y + 1, TILE - 2, TILE - 2);
        g.fillStyle = '#3a8070';
        for (let i = 0; i < 3; i++) g.fillRect(X + 3, Y + 5 + i * 9, TILE - 6, 4);
        break;
      case 'G':
        // Generator transformer unit
        g.fillStyle = '#1a221f'; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        g.fillStyle = this.powerOn ? '#2ce090' : '#d04030';
        g.fillRect(X + 8, Y + 8, 6, 6);
        break;
      case 'P':
        // Security terminal
        g.fillStyle = '#1c262a'; g.fillRect(X + 3, Y + 3, TILE - 6, TILE - 6);
        g.fillStyle = this.stage === 'escape' ? '#2ae080' : '#40a0ff';
        g.fillRect(X + 7, Y + 7, TILE - 14, 8);
        break;
      case 'C':
        // Morgue cold storage drawers
        g.fillStyle = '#263330'; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        g.fillStyle = '#445852'; g.fillRect(X + 4, Y + 5, TILE - 8, 8);
        g.fillStyle = '#80a096'; g.fillRect(X + 12, Y + 8, 8, 2);
        break;
      case 'X':
        // Ambulance exit blast doors
        g.fillStyle = '#222826'; g.fillRect(X + 1, Y + 2, TILE - 2, TILE - 4);
        g.fillStyle = this.stage === 'escape' ? '#30e080' : '#e04030';
        g.fillRect(X + 6, Y + 6, TILE - 12, 4);
        break;
      case 'K':
        // Locked door
        g.fillStyle = '#283832'; g.fillRect(X + 2, Y + 10, TILE - 4, 12);
        g.fillStyle = '#ffb030'; g.fillRect(X + 20, Y + 14, 4, 4);
        break;
      case 'D':
        // Closed door
        g.fillStyle = '#283832'; g.fillRect(X + 2, Y + 10, TILE - 4, 12);
        break;
    }
  }

  drawWorld(ctx) {
    if (this.player.hidden) {
      ctx.strokeStyle = this.holding ? 'rgba(100,220,255,.7)' : 'rgba(255,255,255,.35)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawOverlay(ctx, W, H) {
    // Flickering institutional lights overlay
    if (this.powerOn && Math.random() < 0.03) {
      ctx.fillStyle = 'rgba(140,240,255,0.04)';
      ctx.fillRect(0, 0, W, H);
    }
  }
}
