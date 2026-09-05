# MagicalMerge

Offline-first mobile PWA prototype for a magical-girl merge strategy game.

## Current prototype

- Portrait/mobile-first UI
- 7 × 3 board (21 merge slots)
- Tap two units of the same level to merge
- Turn-based combat
- Waves and progressive stage difficulty
- 100 parameterized stages
- Boss every 10th stage
- Active skills + passive run upgrades
- Account XP and persistent account level
- Persistent Magical Base / Crystal Heart upgrades
- Local save with `localStorage`
- PWA manifest + service worker for offline play
- Placeholder emoji units ready to be replaced by sprites later

## Run locally

Serve this folder from a local HTTP server (service workers do not work from `file://`).

For GitHub Pages, upload the files to the repository root and enable Pages from the `main` branch.

## Roadmap

1. Replace placeholder units with original Magical Girl sprites.
2. Build a proper merge/evolution tree.
3. Add elemental interactions.
4. Expand skill pool and introduce all active skills by Stage 15.
5. Add world-specific enemies, bosses and mechanics.
6. Add sound, animation and polish.


## v0.5 changes
- Moving a Magical Girl automatically ends the turn.
- Equal-level merges remain free actions and do not end the turn.
- Each Magical Girl in an occupied lane launches its own projectile at the first enemy in that lane.
- Manual END TURN control is hidden because movement is now the turn action.
- Service-worker cache bumped to v5.


## v0.8 gameplay rules
- Upper enemy field: 7 columns × 8 rows; enemies remain only in this field.
- Lower Magical Girl field: 7 columns × 3 rows; Magical Girls remain only in this field.
- Enemy and player fields share the same 7 columns for vertical targeting.
- A moved Magical Girl ends the turn; a same-level merge does not.
- Touch/pointer dragging and tap-to-select movement are supported on mobile.
- After each player turn, surviving enemies advance one row toward the divider.
- Only enemies that reach the divider deal damage to the Crystal Heart, then they disappear.
