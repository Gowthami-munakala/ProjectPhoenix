# Project architecture

Project Phoenix is an existing plain-JavaScript canvas horror game, not a framework template. Preserve its Midnight Hotel map, storyline, assets, procedural sound, enemy behavior, characters, and secrets. Do not rebuild the game or silently add missing narrative chapters.

## Directories

- `public/index.html`: screens, game canvas, compact HUD, hint container, and touch controls; social metadata lives in the HTML head.
- `public/css/style.css`: preserved visual system. `public/css/phoenix.css`: focused upgrade styles and mobile controls.
- `public/js/main.js`: game lifecycle, menus, runtime power shop, results, and save import/export.
- `public/js/engine.js`: shared canvas engine, input, collision, and level lifecycle.
- `public/js/levels/hotel.js`: the only available story level, including contextual puzzle state and escape checkpoints.
- `public/js/levels/index.js`: authoritative list of available playable levels. The legacy save schema has other chapter names; this does not mean those levels exist.
- `public/js/catalog.js`: shared character and power catalogs, reward amounts, and XP constants. The server imports it directly; keep it free of browser dependencies.
- `public/js/phoenix.js` and `public/js/powers.js`: profile-facing operations and actual runtime ability effects.
- `public/js/hints.js`: on-demand contextual clues. Never expose the randomized code directly in smart hints.
- `public/js/storage.js`: legacy import, profile bootstrap, serialized remote saving, and currency synchronization. Local storage is read only for legacy migration.
- `server/economy.js`: server-authoritative purchase, discovery, completion, and memory-reset rules. Pure functions permit isolated logic checks without a database.
- `db/schema.ts` and `db/index.ts`: Drizzle schema and native Netlify Database adapter.
- `netlify/functions/player.mts`: guest cookie, origin checks, request handling, and optimistic-concurrency database writes.
- `netlify/database/migrations/`: generated SQL migrations. Include a migration for every schema change.

## Conventions and invariants

Use browser ES modules and retain the source's straightforward canvas architecture. New identifiers should be descriptive. Keep new UI consistent with the original amber, parchment, and near-black theme. Prefer small panels and dedicated menus; never introduce permanent currency, hint, or shop overlays. Keep keyboard controls functional alongside touch controls.

New guests receive 1,000 coins once. Prices come from the shared catalog. Check balance and ownership on the server. Economic mutations must use revision-guarded updates against the latest database row; generic saves must not override currency, ownership, or reward claims. The entire first-completion payout must be finalized atomically, even for unearned performance bonuses. Failure never awards a victory bonus or removes previously owned currency.

Save structured player data only in Netlify Database, using `@netlify/database` and `drizzle-orm@beta`. Keep `drizzle-kit@beta` and the migration output location prescribed by the platform skill. Guest profiles are identified by an HTTP-only cookie; do not introduce tokens into browser storage or logs. This game currently trusts the browser to report its gameplay outcome; it is not an anti-cheat or competitive economy.

Checkpoints must preserve the randomized code and register together. Restore only structurally valid checkpoints, put players on a safe open tile, and never award completion coins for a checkpoint retry. Runtime power cooldowns and active effects are ephemeral; purchased ownership is permanent.

Each normal attempt has a UUID used in pickup reward keys. Preserve that run ID across checkpoint retries to avoid duplicate pickup rewards while keeping the original per-attempt coin mechanic. Completion rewards remain keyed by story level, not run ID.

Browser-origin boundaries prevent automatic migration of saves from a different hostname. Keep the import/export path and never overwrite an existing server profile or regrant starter coins when migrating.

## Development

The site publishes `public/` without a frontend build step. `npm run dev` uses Netlify CLI on port 8889. Follow active task restrictions before starting any local server or validation command. Netlify's pipeline applies database migrations during deployment. No committed test framework exists; focused in-process checks have covered core logic, but real browser and production database verification remain necessary. Never claim Level 2 is implemented or tested until its original source is provided.
