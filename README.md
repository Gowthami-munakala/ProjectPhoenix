# Project Phoenix — The Book of Secrets (Version 2.0)

A psychological horror adventure game built with HTML5 Canvas 2D, procedural Web Audio, and adaptive enemy learning.

## Playable Nightmares

### Level I — The Midnight Hotel: Room 009
- At 12:07 AM your car dies in a storm. The night receptionist has been expecting you.
- Find your room, uncover the dark history of the guests who never checked out, read the guest register, avoid the Occupant, and deduce the exit keypad code to escape before 1:00 AM.
- Complete Level I to unlock Level II.

### Level II — St. Jude Sanatorium: Ward B
- The abandoned psychiatric hospital where emergency sirens died years ago.
- Corridors with flickering institutional fluorescent lights, patient ward gurneys, medical charts, and cold storage lockers.
- Audio atmosphere: heart monitors, distant footsteps on cold tile, rolling gurneys, flatlines, electrical hums, and creaking doors.
- Puzzles: locate Circuit Breakers A & B, restore backup power in the Electrical Substation, solve Dr. Vance's morgue combination lock (`0429`), swipe the Master Keycard to override quarantine, and escape the Orderly through the Ambulance Bay.
- Complete Level II to unlock Level III.

### Level III — The Blackwood Pines: Whispering Trail
- Deep pine forest shrouded in dense rolling mist, abandoned trails, and limited visibility.
- Audio atmosphere: howling mountain winds, creaking branches, cracking twigs underfoot, distant animal calls, and the guttural roar of the Wendigo.
- Puzzles: search the abandoned Ranger Station for the Cemetery Key and Trail Map, unlock the overgrown cemetery, solve the runic symbol dials at the Altar of Whispers (Moon → Tree → Crow → Skull) to obtain the Forest Warden's Talisman, re-ignite the 3 ancient stone Lantern Beacons along the Whispering Trail, and break the boundary barrier across the Blackwood Gorge.

## Features & Upgrades

- **Direct Play**: Character selection screen has been removed. The nightmare begins immediately with default protagonist Kai (The Runner), complete with stamina bonuses and the Second Wind ability [R].
- **Progression & Saving**: Unlocks and game progress save automatically to browser `localStorage`. Progression persists across page reloads without requiring any backend database or login.
- **In-Game Phantom Market**: Unlock permanent powers with Phoenix Coins (Shield [1], Sprint [2], Soul Lantern [3], Cloak [4], Decoy [5]).
- **Contextual Smart Hints**: Press [H] or click Hint in the HUD for progressive clues when stuck.
- **Controls**: Full support for Desktop (WASD/Arrows, Shift to run, E to interact, F for light, Q to throw distractions, 1-5 for powers, R for ability, Space to hold breath) and Mobile (touch D-pad and action buttons).
- **Zero Backend / Serverless Dependencies**: Modified into a 100% self-contained frontend application. No Netlify Functions, no database CLI, no API keys, and no build tools required.

## How to Play Locally

Simply open `public/index.html` in any modern web browser, or serve using any static file server:
```bash
npx serve public
```

## How to Deploy to Cloudflare Pages (Free & No Command Line Needed)

1. Unzip the project ZIP or use the `public` folder.
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages** → **Create application** → **Pages** → **Upload assets**.
3. Enter your project name (e.g. `project-phoenix`).
4. Drag and drop the `public` folder (containing `index.html`, `css`, `js`, `img`) directly into the upload dropzone.
5. Click **Deploy site**.
6. Cloudflare provides an instant, free `*.pages.dev` public link with SSL, global CDN, and zero server maintenance!
