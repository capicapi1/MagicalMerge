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
