// LEVEL 3 — THE BLACKWOOD PINES: WHISPERING TRAIL
// Atmospheric forest horror. Dense fog, creaking branches, ancient altar puzzles, and an agile predator.
import { BaseLevel, Stalker, Grid, TileMap, TILE, tc, dist, rnd, choose, shuffle, hash, clamp } from '../engine.js';
import { Audio } from '../audio.js';
import { Memory, Store } from '../storage.js';
import { Phoenix } from '../phoenix.js';

const SOLID = '#TBSRGLAXH';
const OPAQUE = '#TSRX';

const PHOENIX_COINS = [
  [4, 4], [14, 4], [25, 4], [38, 3], [50, 4],
  [8, 12], [20, 11], [32, 12], [44, 11],
  [6, 20], [16, 20], [28, 20], [40, 20], [50, 20],
  [10, 28], [24, 28], [36, 28], [48, 28]
];

function buildForestMap() {
  const g = new Grid(56, 36);

  // Winding forest paths
  g.rect(2, 6, 52, 7, ',');          // North trail
  g.rect(2, 15, 52, 16, ',');        // Central Whispering Trail
  g.rect(2, 24, 52, 25, ',');        // South river trail

  // North-South connecting paths
  g.rect(4, 7, 5, 24, ',');          // West path
  g.rect(26, 7, 27, 24, ',');        // Central crossroads
  g.rect(48, 7, 49, 24, ',');        // East path

  // Ranger Station (North-East clearing)
  g.rect(38, 2, 47, 5, '_'); g.put(42, 6, '.');
  // Ranger furniture
  g.puts([[39, 3], [40, 3]], 'R'); g.puts([[45, 3], [46, 3]], 'S');

  // Graveyard & Altar of Whispers (North-West clearing)
  g.rect(3, 2, 18, 5, '.'); g.put(10, 6, 'G'); // Cemetery iron gate
  // Gravestones (S) and Altar (A)
  g.puts([[5, 3], [7, 3], [13, 3], [15, 3]], 'S');
  g.puts([[10, 3], [11, 3]], 'A');

  // Ancient Stone Beacons along Whispering Trail (L)
  g.put(6, 15, 'L');   // Beacon 1 (West Glade)
  g.put(26, 15, 'L');  // Beacon 2 (Central Crossroads)
  g.put(48, 15, 'L');  // Beacon 3 (East Overlook)

  // Hollow Trees / Hunter's Blinds for hiding (B)
  g.puts([[12, 11], [22, 11], [35, 11], [15, 20], [38, 20], [28, 29]], 'B');

  // Branch crackle hazard zones (twigs on trail)
  g.puts([[18, 6], [32, 6], [12, 16], [36, 16], [20, 24], [42, 24]], ',');

  // Gorge Bridge & Boundary Iron Gate (Exit in the South)
  g.rect(24, 26, 29, 34, '_');
  g.put(26, 35, 'X'); g.put(27, 35, 'X'); // Boundary Gate

  // SECRET 1: Witch's Ritual Circle (hidden grove in far West)
  g.rect(1, 28, 6, 34, '.'); g.put(4, 27, 'H');
  g.puts([[3, 30], [4, 30], [3, 32], [4, 32]], 'A');

  // SECRET 2: Abandoned Iron Mine (rocky cave in far East)
  g.rect(50, 28, 54, 34, '.'); g.put(51, 27, 'H');
  g.puts([[52, 30], [53, 30]], 'S');

  return g.rows();
}

const HIDES = [
  { id: 'hollow-tree-west', tile: [12, 11], label: 'Slip into the hollow ancient oak' },
  { id: 'hunters-blind-mid', tile: [22, 11], label: 'Duck inside the overgrown hunter’s blind' },
  { id: 'pine-thicket-east', tile: [35, 11], label: 'Conceal yourself in the dense pine thicket' },
  { id: 'crypt-sarcophagus', tile: [5, 4], label: 'Hide behind the mossy stone sarcophagus' },
  { id: 'ranger-bunk', tile: [45, 4], label: 'Hide under the wooden ranger bunk' },
  { id: 'gorge-boulder', tile: [28, 29], label: 'Crouch behind the cliffside boulder' },
];

export class ForestLevel extends BaseLevel {
  constructor(game) {
    super(game);
    this.id = 'forest';
    this.map = new TileMap(buildForestMap(), { solid: SOLID, opaque: OPAQUE });
    this.bg = '#020402';
    this.darkness = 0.95;
    this.darkColor = '1,3,2';
    this.musicName = 'forest';
    this.ambientSounds = ['owl', 'crow', 'branch', 'rustle', 'whisper', 'howl', 'growl'];
    this.surface = 'leaves';
    this.throwable = { name: 'Pine Cones & Stones', count: 3 };
    this.playerColor = '#4a5e46';
    this.player.x = tc(26, 8).x;
    this.player.y = tc(26, 8).y;
    this.player.angle = Math.PI / 2;
    this.breath = 1;
    this.holding = false;
    this.stage = 'ranger'; // 'ranger' -> 'altar' -> 'beacons' -> 'escape'
    this.beaconsLit = 0;
    this.beaconLights = [];
    this.fog = Array.from({ length: 60 }, () => ({
      x: rnd(0, 1), y: rnd(0, 1), r: rnd(70, 130), vx: rnd(0.005, 0.015), a: rnd(0.04, 0.09)
    }));
    this.setupWorld();
  }

  setupWorld() {
    this.setObjectives([
      { id: 'ranger', text: 'Search the Ranger Station for the Cemetery Key and Trail Map' },
      { id: 'altar', text: 'Solve the Altar of Whispers to claim the Forest Talisman' },
      { id: 'beacons', text: 'Re-ignite the 3 Lantern Beacons along the Whispering Trail (0/3)' },
      { id: 'escape', text: 'Escape through the Blackwood Gorge Gate' },
    ]);

    const P = (tx, ty) => tc(tx, ty);

    // Initial ambient lights
    this.addLight({ ...P(42, 4), r: 110, intensity: 0.65, color: 'rgba(255,180,90,0.08)' }); // ranger cabin lamp
    this.addLight({ ...P(10, 4), r: 130, intensity: 0.6, flicker: 0.04, color: 'rgba(180,220,255,0.06)' }); // cemetery moon glow

    // Phoenix Coins (18 pickups)
    this.phoenixCoins = PHOENIX_COINS.map(([tx, ty], i) => ({
      id: `pc${i}`,
      ...P(tx, ty),
      taken: false,
      light: this.addLight({ ...P(tx, ty), r: 34, intensity: 0.45, color: 'rgba(255,200,80,0.12)' })
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

    // Ranger Station Desk: Cemetery Key & Journal
    this.addInteract({
      id: 'ranger-desk', ...P(40, 3), r: 42, once: true, label: 'Search Ranger’s log desk',
      action: async () => {
        this.give('Cemetery Key');
        this.give('Trail Map');
        this.done('ranger');
        const text = 'CHIEF RANGER’S JOURNAL — BLACKWOOD PINES\n\n“The creature came down from the peaks when the fog settled. It hunts by the sound of snapping wood.\n\nThe Altar of Whispers in the cemetery holds the Warden’s Talisman. The symbol dials require the sacred order:\n  First, the pale Moon rises [☾ Moon]\n  Above the ancient Tree [𐃏 Tree]\n  Watched by the Carrion Crow [𓅃 Crow]\n  Resting upon the Bone Skull [☠ Skull]\n\nOnce retrieved, light the three stone beacons along the trail. The creature cannot stand the sacred flame.”';
        await this.ui.doc('Ranger’s Journal & Whispering Trail Map', text);
        this.addClue('altar-poem', 'Altar of Whispers Dial Order', 'Order of dials: Moon (☾) → Tree (𐃏) → Crow (𓅃) → Skull (☠).');
        this.alert('Found the Cemetery Key and Ranger’s Journal.');
        this.stage = 'altar';
      }
    });

    // Graveyard Gate (G)
    this.addInteract({
      id: 'cemetery-gate', ...P(10, 6), r: 42, sparkle: false,
      cond: () => this.map.get(10, 6) === 'G',
      label: () => this.has('Cemetery Key') ? 'Unlock Cemetery Gate with Key' : 'Cemetery Gate (Locked)',
      action: it => {
        if (!this.has('Cemetery Key')) { Audio.play('click'); this.alert('Locked with heavy iron chains. Marked with the Forest Warden crest.'); return; }
        this.map.set(10, 6, '.'); this.redrawTile(10, 6);
        it.enabled = false;
        Audio.play('creak');
        this.alert('Unlocked the Cemetery Gate.');
      }
    });

    // Altar of Whispers (A)
    const dialSymbols = [
      { id: 'moon', glyph: '☾', name: 'Pale Moon' },
      { id: 'tree', glyph: '𐃏', name: 'Rooted Tree' },
      { id: 'crow', glyph: '𓅃', name: 'Carrion Crow' },
      { id: 'skull', glyph: '☠', name: 'Bone Skull' },
      { id: 'snake', glyph: '🐍', name: 'Coiled Viper' },
      { id: 'fire', glyph: '🔥', name: 'Wildfire' },
    ];
    this.addInteract({
      id: 'altar-dials', ...P(10, 3), r: 44,
      cond: () => !this.has('Forest Warden’s Talisman'),
      label: 'Inspect Altar of Whispers',
      action: async () => {
        const ok = await this.ui.dials({
          title: 'The Altar of Whispers',
          hint: 'Align the 4 runic dials according to the Ranger’s poem:',
          slots: 4,
          symbols: dialSymbols,
          check: ids => ids[0] === 'moon' && ids[1] === 'tree' && ids[2] === 'crow' && ids[3] === 'skull',
        });
        if (!ok) return;
        this.give('Forest Warden’s Talisman');
        this.done('altar');
        Audio.play('stoneDoor');
        Audio.play('shrine');
        this.alert('The altar stone parts with a golden glow! Retrieved the Forest Warden’s Talisman.');
        this.stage = 'beacons';
        this.spawnWendigo();
      }
    });

    // Three Stone Beacons (L)
    const setupBeacon = (id, tx, ty, name) => {
      this.addInteract({
        id: `beacon-${id}`, ...P(tx, ty), r: 44,
        cond: () => !this[`beacon_${id}_lit`],
        label: () => this.has('Forest Warden’s Talisman') ? `Ignite ${name} with Talisman` : `Examine ${name}`,
        action: it => {
          if (!this.has('Forest Warden’s Talisman')) {
            this.alert(`The unlit stone beacon rests cold. Requires the Forest Warden’s Talisman to ignite.`);
            return;
          }
          this[`beacon_${id}_lit`] = true;
          this.beaconsLit++;
          it.enabled = false;
          Audio.play('magic');
          Audio.play('shrine');
          const bl = this.addLight({ ...P(tx, ty), r: 200, intensity: 0.9, color: 'rgba(255,210,120,0.12)' });
          this.beaconLights.push(bl);
          this.alert(`${name} blazes with sacred fire! The creature screeches and retreats.`);

          // Beast retreats from beacon
          if (this.creature) {
            Audio.play('growl', { vol: 0.8 });
            this.creature.awareness = 0;
            this.creature.setState('patrol');
          }

          const o = this.objectives.find(x => x.id === 'beacons');
          if (o) {
            o.text = `Re-ignite the 3 Lantern Beacons along the Whispering Trail (${this.beaconsLit}/3)`;
            this.ui.hud.objectives(this.objectives);
          }

          if (this.beaconsLit >= 3) {
            this.done('beacons');
            this.stage = 'escape';
            this.alert('All 3 Beacons are blazing! The path to the Gorge Gate is revealed. Escape now!', 5);
            this.timeLeft = 360; // 6 minute timer
            this.saveCheckpoint();
          }
        }
      });
    };

    setupBeacon(1, 6, 15, 'West Beacon');
    setupBeacon(2, 26, 15, 'Central Crossroads Beacon');
    setupBeacon(3, 48, 15, 'East Overlook Beacon');

    // Gorge Boundary Gate (Exit)
    this.addInteract({
      id: 'gorge-gate', ...P(26, 35), r: 52,
      label: () => this.stage === 'escape' ? 'Unlock Blackwood Gorge Gate and Escape' : 'Boundary Iron Gate (Locked)',
      action: () => {
        if (this.stage !== 'escape') {
          Audio.play('click');
          this.alert('Ancient iron gate bound by shadow roots. Light the 3 Beacons to clear the barrier.');
          return;
        }
        this.escapeForest();
      }
    });

    // SECRET 1: Witch's Ritual Circle
    this.addInteract({
      id: 'secret-witch-grove', ...P(4, 26), r: 36, once: true,
      cond: () => this.map.get(4, 27) === 'H',
      label: 'Part the weeping willow vines',
      action: () => {
        this.map.set(4, 27, '.'); this.redrawTile(4, 27);
        Audio.play('rustle');
        this.alert('Vines part, uncovering an ancient witch’s ritual circle under the canopy.');
      }
    });

    // SECRET 2: Collapsed Iron Mine
    this.addInteract({
      id: 'secret-mine-cave', ...P(51, 26), r: 36, once: true,
      cond: () => this.map.get(51, 27) === 'H',
      label: 'Clear crumbled boulders',
      action: () => {
        this.map.set(51, 27, '.'); this.redrawTile(51, 27);
        Audio.play('rumbleHit');
        this.alert('The rocks give way to a hidden, abandoned iron mine shaft.');
      }
    });
  }

  spawnWendigo() {
    if (this.creature) return;
    Audio.play('howl');
    Audio.play('growl');
    this.alert('A chilling howl reverberates through the pines... The Wendigo begins its hunt!', 4);

    const wendigo = new Stalker(this, {
      x: tc(48, 8).x, y: tc(48, 8).y, r: 12,
      speeds: { patrol: 60, investigate: 90, search: 75, chase: 148 },
      patrol: [tc(48, 8), tc(26, 8), tc(5, 8), tc(5, 16), tc(26, 16), tc(48, 16)],
      stepSurface: 'leaves',
      sight: 250,
      catchDist: 22,
    });

    wendigo.onHear = (x, y, kind) => {
      Audio.play('rustle', { vol: 0.6 });
    };

    wendigo.draw = (ctx, t) => {
      ctx.save(); ctx.translate(wendigo.x, wendigo.y);
      ctx.shadowColor = '#000'; ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.ellipse(0, 6, 16, 9, 0, 0, 7); ctx.fill();
      ctx.rotate(wendigo.angle);

      // Gaunt beast body
      ctx.fillStyle = '#141812';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 16, 0, 0, 7); ctx.fill();

      // Antlers / skeletal horns
      ctx.strokeStyle = '#8a9486'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -8); ctx.lineTo(12, -18); ctx.lineTo(18, -16);
      ctx.moveTo(4, 8); ctx.lineTo(12, 18); ctx.lineTo(18, 16);
      ctx.stroke();

      // Head
      ctx.fillStyle = '#222820';
      ctx.beginPath(); ctx.arc(7, 0, 7, 0, 7); ctx.fill();

      // Piercing glowing eyes
      ctx.fillStyle = wendigo.state === 'chase' ? '#ff2010' : '#ff9920';
      ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(10, -3, 2, 0, 7); ctx.arc(10, 3, 2, 0, 7); ctx.fill();

      // Sharp beast claws
      ctx.strokeStyle = '#c5d0c0'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(14, -13);
      ctx.moveTo(0, 10); ctx.lineTo(14, 13);
      ctx.stroke();

      ctx.restore();
      wendigo.drawAwareness(ctx);
    };

    this.creature = wendigo;
    this.enemies.push(wendigo);
  }

  saveCheckpoint() {
    if (this.stage !== 'escape' || this.ended) return;
    const checkpoint = {
      version: 1, runId: this.runId, stage: this.stage,
      inventory: [...this.inventory], objectives: this.objectives.map(o => ({ ...o })),
      beaconsLit: this.beaconsLit,
      throwables: this.throwable.count,
    };
    Phoenix.progress(this.id).checkpoint = checkpoint;
    Store.save(true);
  }

  toggleHide(h, it) {
    const p = this.player;
    if (p.hidden) {
      p.hidden = null; Audio.play('rustle'); this.holding = false;
      return;
    }
    const c = this.creature;
    p.hidden = { id: h.id, it, x: p.x, y: p.y };
    p.x = h.x; p.y = h.y;
    Audio.play('rustle');
    Memory.hide('forest', h.id);
    this.flashlight.on = false;
    if (c && c.active && c.state === 'chase' && dist(c, p) < 260 && this.map.los(c.x, c.y, p.x, p.y)) {
      c.setState('search'); c.target = { x: p.x, y: p.y };
      this.alert('THE SHADOW NOTICED YOU. Hold breath or flee!', 2.5);
    }
    this.alert('Hidden in the shadows. Hold [Space] to hold breath. [E] to emerge.', 3);
  }

  onHiddenUpdate(dt) {
    const hold = this.input.is('action') && this.breath > 0;
    if (hold && !this.holding) Audio.play('breath');
    if (!hold && this.holding && this.breath <= 0.02) {
      Audio.play('gasp'); this.noise(this.player.x, this.player.y, 140, 'gasp');
    }
    this.holding = hold;
    if (hold) this.breath = Math.max(0, this.breath - dt / (4.6 * (this.kit?.breathMul || 1)));
    else this.breath = Math.min(1, this.breath + dt / 3);
  }

  updateHud() {
    super.updateHud();
    if (this.player.hidden) {
      this.ui.hud.status(`<span style="color:#9fd">CONCEALED · ${this.holding ? 'HOLDING BREATH' : 'breathing'}</span><span>Breath<span class="bar"><i style="width:${this.breath * 100}%;background:#8fc8ff"></i></span></span>`);
    }
  }

  onTimeout() {
    this.gameOver('CONSUMED BY THE WOODS', 'The dawn never broke. The Whispering Trail has claimed you forever.');
  }

  escapeForest() {
    this.frozen = true;
    if (this.creature) this.creature.active = false;
    Audio.setMusic(null, 1);
    Audio.stopAllLoops(0.5);

    this.run(async () => {
      Audio.play('door');
      await this.w(0.8);
      this.ui.cine.show({ text: '' });
      Audio.play('shrine');
      await this.w(1.2);
      this.ui.cine.text('You cross the Blackwood Gorge bridge as dawn breaks over the peaks...');
      await this.say('narrator', 'You cross the Blackwood Gorge bridge as dawn breaks over the peaks...');
      await this.w(1.8);
      this.ui.cine.text('The shadows dissolve. The whispering trees fall silent.');
      await this.say('narrator', 'The shadows dissolve. The whispering trees fall silent.');
      await this.w(2.0);
      Audio.play('bookSlam');
      this.ui.cine.text('PAGE III SEALS IN RADIANT GOLD.', 'glitch');
      await this.w(2.5);
      this.ui.cine.hide();
      this.done('escape');
      this.complete('Survived the Blackwood Pines · The Whispering Trail has been cleansed.');
    });
  }

  getHintContext() {
    if (!this.has('Cemetery Key')) {
      return ['ranger', [
        'Explore the northeast corner of the woods to locate the abandoned Ranger Station.',
        'Read the Ranger’s log desk inside the cabin to take the Cemetery Key and Trail Map.'
      ]];
    }
    if (!this.has('Forest Warden’s Talisman')) {
      return ['altar', [
        'Unlock the cemetery gate in the northwest corner with your Cemetery Key.',
        'Align the 4 Altar dials: Pale Moon (☾), Rooted Tree (𐃏), Carrion Crow (𓅃), Bone Skull (☠).'
      ]];
    }
    if (this.beaconsLit < 3) {
      return ['beacons', [
        `Re-ignite all 3 stone beacons along the trail (${this.beaconsLit}/3 lit). The beacons are at the west glade, central crossroads, and east overlook.`,
        'Interact with each cold stone lantern along the trail while holding the Warden’s Talisman to light them.'
      ]];
    }
    return ['escape', [
      'All 3 beacons are lit! Head south across the gorge bridge to the Boundary Iron Gate [X].',
      'Interact with the Boundary Gate to break the shadow barrier and escape the forest!'
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
          for (let i = 0; i < 8; i++) this.particles.push({ x: c.x, y: c.y, vx: rnd(-40, 40), vy: rnd(-50, 10), life: 0.5, color: '#f0c040' });
        }
      }

      // Secret rooms discovery
      const ptx = this.player.x / TILE, pty = this.player.y / TILE;
      if (!this.foundWitch && pty >= 28 && ptx <= 6) {
        this.foundWitch = true;
        this.rewards?.secret('witch-circle', 'The Witch’s Ritual Circle');
      }
      if (!this.foundMine && pty >= 28 && ptx >= 50) {
        this.foundMine = true;
        this.rewards?.secret('old-mine', 'The Collapsed Iron Mine');
      }
    }
  }

  drawTile(g, ch, x, y) {
    const X = x * TILE, Y = y * TILE, h = hash(x, y);

    // Forest ground painting
    if (ch === ',') {
      // Fallen pine needles and dry leaves
      g.fillStyle = (x + y) % 2 ? '#1e1c14' : '#181610';
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = `rgba(160,110,50,${h * 0.08})`;
      g.fillRect(X, Y, TILE, TILE);
    } else if (ch === '.') {
      // Dark mossy forest clearing
      g.fillStyle = '#141c12';
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = `rgba(80,140,70,${h * 0.06})`;
      g.fillRect(X, Y, TILE, TILE);
    } else if (ch === '_') {
      // Weathered wood planks (cabin / gorge bridge)
      g.fillStyle = '#261c14';
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = 'rgba(0,0,0,.3)';
      for (let i = 0; i < 4; i++) g.fillRect(X, Y + i * 8 + 7, TILE, 1);
    }

    if (ch === '#') {
      // Dense ancient pine / cliff rock wall
      g.fillStyle = '#0a1008';
      g.fillRect(X, Y, TILE, TILE);
      g.fillStyle = '#182416';
      g.beginPath();
      g.arc(X + 16, Y + 16, 12 + (h * 4), 0, Math.PI * 2);
      g.fill();
      return;
    }

    // Props & Fixtures
    switch (ch) {
      case 'R':
        // Ranger desk / table
        g.fillStyle = '#3a2416'; g.fillRect(X + 4, Y + 4, TILE - 8, TILE - 8);
        g.fillStyle = '#5c3a22'; g.fillRect(X + 6, Y + 6, TILE - 12, TILE - 12);
        break;
      case 'S':
        // Stone tomb / gravestone
        g.fillStyle = '#363d36'; g.fillRect(X + 6, Y + 4, TILE - 12, TILE - 6);
        g.fillStyle = '#586458'; g.fillRect(X + 8, Y + 6, TILE - 16, TILE - 10);
        break;
      case 'G':
        // Cemetery iron gate
        g.fillStyle = '#242a22'; g.fillRect(X + 2, Y + 10, TILE - 4, 12);
        g.strokeStyle = '#808a80'; g.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(X + 6 + i * 6, Y + 4); g.lineTo(X + 6 + i * 6, Y + 24); g.stroke(); }
        break;
      case 'A':
        // Ancient Ritual Altar
        g.fillStyle = '#2d332d'; g.beginPath(); g.arc(X + 16, Y + 16, 11, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#5c6e5a'; g.beginPath(); g.arc(X + 16, Y + 16, 7, 0, Math.PI * 2); g.fill();
        break;
      case 'L':
        // Stone Lantern Beacon
        g.fillStyle = '#303830'; g.fillRect(X + 6, Y + 6, TILE - 12, TILE - 12);
        g.fillStyle = this[`beacon_${x < 15 ? 1 : x < 35 ? 2 : 3}_lit`] ? '#ffb840' : '#4a5448';
        g.beginPath(); g.arc(X + 16, Y + 16, 6, 0, Math.PI * 2); g.fill();
        break;
      case 'B':
        // Hollow tree / Hunter's blind
        g.fillStyle = '#1e140c'; g.beginPath(); g.arc(X + 16, Y + 16, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#080503'; g.beginPath(); g.arc(X + 16, Y + 16, 7, 0, Math.PI * 2); g.fill();
        break;
      case 'X':
        // Boundary Iron Gate
        g.fillStyle = '#261c16'; g.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        g.strokeStyle = this.stage === 'escape' ? '#e0b040' : '#707070';
        g.lineWidth = 2;
        g.strokeRect(X + 4, Y + 4, TILE - 8, TILE - 8);
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
    // Drifting rolling mist/fog particles
    ctx.fillStyle = 'rgba(200, 225, 215, 0.04)';
    this.fog.forEach(f => {
      f.x += f.vx * 0.1;
      if (f.x > 1.2) f.x = -0.2;
      const px = f.x * W, py = f.y * H;
      ctx.beginPath();
      ctx.arc(px, py, f.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
