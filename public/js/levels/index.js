// index.js — the book's pages: Level 1 (Hotel), Level 2 (Hospital), Level 3 (Forest)
import { HotelLevel } from './hotel.js';
import { HospitalLevel } from './hospital.js';
import { ForestLevel } from './forest.js';

export const LEVELS = [
  {
    id: 'hotel',
    index: 0,
    num: 'I',
    title: 'The Midnight Hotel — Room 009',
    art: 'hotel',
    glow: 'rgba(255,150,60,.6)',
    Level: HotelLevel,
    description: 'At 12:07 AM your car dies in a storm. The receptionist has been expecting you.',
    objective: 'Find the code, avoid the Occupant, escape before 1:00 AM.',
    atmosphere: 'Rain, flickering lamps, knocking at the door.',
    unlocked: () => true,
  },
  {
    id: 'hospital',
    index: 1,
    num: 'II',
    title: 'St. Jude Sanatorium — Ward B',
    art: 'hospital',
    glow: 'rgba(60,220,160,.6)',
    Level: HospitalLevel,
    description: 'The emergency sirens died years ago. Something still walks the tiled corridors of Ward B.',
    objective: 'Restore the backup power, find Dr. Vance’s keycard, override quarantine, and escape.',
    atmosphere: 'Heart monitors, flickering fluorescent tubes, rolling gurneys, footsteps on cold tile.',
    unlocked: (completed) => !!completed.hotel,
    unlockHint: 'Survive Level I (The Midnight Hotel) to unlock.',
  },
  {
    id: 'forest',
    index: 2,
    num: 'III',
    title: 'The Blackwood Pines — Whispering Trail',
    art: 'forest',
    glow: 'rgba(140,200,90,.6)',
    Level: ForestLevel,
    description: 'A dark, mist-choked forest where the trees whisper your name. Limited visibility hides ancient horrors.',
    objective: 'Search the ranger cabin, solve the Altar of Whispers, re-ignite the 3 beacons, and escape across the gorge.',
    atmosphere: 'Creaking branches, howling wind, cracking twigs underfoot, eyes watching from the fog.',
    unlocked: (completed) => !!completed.hospital,
    unlockHint: 'Survive Level II (St. Jude Sanatorium) to unlock.',
  },
];
