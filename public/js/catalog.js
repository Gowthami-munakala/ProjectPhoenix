export const STARTER_COINS = 1000;
export const REWARDS = { coin: 5, level: 350, objectives: 100, secret: 20, unseen: 75, nodamage: 75 };
// XP is earned on every run (unlike first-time coin bonuses) so levels keep rising.
export const XP = { coin: 4, objective: 20, secret: 40, level: 150, objectives: 50, unseen: 60, nodamage: 40, record: 10 };
export const MAX_LEVEL = 30;

// ---------------------------------------------------------------------------
// CHARACTERS — `mods` are read by PowerKit (powers.js) and change gameplay.
// ---------------------------------------------------------------------------
export const CHARACTERS = [
  { id: 'kai', name: 'Kai', title: 'The Runner', level: 1, price: 0, color: '#4b5866',
    bio: 'A courier who never stops moving. His car died on the hotel road.',
    passive: 'Stamina drains 30% slower and recovers 30% faster.',
    ability: { name: 'Second Wind', desc: 'Instantly refills stamina; footsteps are silent for 5s.', dur: 5, cd: 45 },
    mods: { staminaDrain: 0.7, staminaRegen: 1.3 } },
  { id: 'mira', name: 'Mira', title: 'The Listener', level: 1, price: 0, color: '#5a4a66',
    bio: 'A sound engineer who can hear a floorboard settle three rooms away.',
    passive: 'Holds her breath 50% longer. Senses enemies through walls within 6 metres.',
    ability: { name: 'Hear the Walls', desc: 'Reveals every enemy through walls for 8s.', dur: 8, cd: 40 },
    mods: { breath: 1.5, sense: 190 } },
  { id: 'rowan', name: 'Rowan', title: 'The Locksmith', level: 3, price: 350, color: '#5a5040',
    bio: 'A gentleman thief with a ring of skeleton keys and soft-soled boots.',
    passive: 'Running is heard 40% less far. Starts with 2 extra throwables.',
    ability: { name: 'Pick the Lock', desc: 'Opens the locked door you stand beside, no key needed. Once per night.', dur: 0, cd: 0, uses: 1 },
    mods: { runNoise: 0.6, extraThrow: 2 } },
  { id: 'esme', name: 'Esme', title: 'The Medium', level: 6, price: 550, color: '#6a5a7a',
    bio: 'A spiritualist who reads the dead the way others read letters.',
    passive: 'Hidden writing and passages reveal themselves when she is near — no light needed.',
    ability: { name: 'Spirit Sight', desc: 'Reveals every hidden clue and passage within a wide radius for 10s.', dur: 10, cd: 60 },
    mods: { autoReveal: 80 } },
  { id: 'ansel', name: 'Dr. Ansel Crowe', title: 'The Scholar', level: 9, price: 800, color: '#4a5a4a',
    bio: 'A retired physician who has catalogued every haunting since 1961.',
    passive: 'Enemies notice him 25% slower. Earns 25% more XP.',
    ability: { name: 'Steady Nerves', desc: 'Enemy awareness of you drains away and cannot build for 6s.', dur: 6, cd: 50 },
    mods: { awareness: 0.75, xp: 1.25 } },
  { id: 'sable', name: 'Sable', title: 'The Shadow', level: 12, price: 1100, color: '#2e2a33',
    bio: 'No one remembers checking Sable in. The register disagrees.',
    passive: 'Moves 10% faster. Enemies see 15% less far.',
    ability: { name: 'Vanish', desc: 'Becomes completely invisible for 4s.', dur: 4, cd: 55 },
    mods: { speed: 1.1, sight: 0.85 } },
];

// ---------------------------------------------------------------------------
// POWER-UPS — bought once, then usable every night with a duration + cooldown.
// ---------------------------------------------------------------------------
export const POWERS = [
  { id: 'shield', key: '1', name: 'Phoenix Shield', icon: '🜂', level: 1, price: 250, dur: 12, cd: 90,
    effect: 'For 12s, the first attack that would catch you is burned away. The enemy is thrown back and loses track of you.' },
  { id: 'sprint', key: '2', name: 'Spirit Sprint', icon: '➶', level: 1, price: 200, dur: 8, cd: 60,
    effect: 'For 8s you run 35% faster, use no stamina and make no footstep noise.' },
  { id: 'lantern', key: '3', name: 'Soul Lantern', icon: '✧', level: 1, price: 300, dur: 15, cd: 75,
    effect: 'For 15s a ghost-light enemies cannot see lights a wide area, reveals hidden clues nearby and outlines enemies through walls.' },
  { id: 'cloak', key: '4', name: 'Shadow Cloak', icon: '☾', level: 2, price: 400, dur: 7, cd: 90,
    effect: 'For 7s enemies cannot see you unless they walk into you. Chases break off almost at once.' },
  { id: 'decoy', key: '5', name: 'Phantom Decoy', icon: '♆', level: 3, price: 500, dur: 6, cd: 70,
    effect: 'Sends a phantom of you ahead that calls out for 6s. Enemies always go to investigate it.' },
];

// Secrets per level (the Book of Secrets shows undiscovered ones as ???).
export const SECRETS = {
  hotel: [
    { id: 'room-007', title: 'Room 007 — the room that is not on any floor plan' },
    { id: 'staff-archive', title: 'The Staff Archive behind the red book' },
  ],
  hospital: [
    { id: 'padded-cell', title: 'The Forgotten Padded Cell behind the supply shelf' },
    { id: 'morgue-archive', title: 'The Confidential Autopsy Vault' },
  ],
  forest: [
    { id: 'witch-circle', title: 'The Witch’s Ritual Circle in the deep woods' },
    { id: 'old-mine', title: 'The Collapsed Iron Mine Entrance' },
  ],
};

// Guest records Mr. Vale keeps. Names match the hotel register.
export const GUEST_RECORDS = {
  'M. Hale': 'Travelling salesman. Asked for a wake-up call at 6 AM. The call was never answered.',
  'Agnes Voss': 'Widow. Requested a room "far from the stairs". Her shoes are still outside the door.',
  'T. Whitlock': 'Photographer. Took 36 pictures of the corridor. Every frame shows one more door than the last.',
  'Dr. Ferris': 'Physician. Left a note: "the receptionist has no pulse". Checked out? No.',
  'June Calloway': 'Singer. Guests reported humming from the walls for three weeks after she arrived.',
  'Edgar Pell': 'Clockmaker. Repaired the lobby clock. It has read 12:07 ever since.',
  'R. Mournby': 'Insurance assessor. Valued the hotel at "nothing — no one ever leaves to file a claim".',
  'Lillian Crane': 'Child, aged nine. Travelling alone. Room paid for in advance, in 1926.',
  'You': 'Room 009. Checked in 12:07 AM. Checked out — the ink has not dried yet.',
};


