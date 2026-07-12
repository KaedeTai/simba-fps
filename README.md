# SIMBA FPS

A single-file, browser-native first-person shooter in the Wolfenstein 3D lineage. The world is rendered with a Canvas 2D DDA raycaster; the weapon viewmodel is a Three.js overlay stacked on top. No build step, no dependencies beyond a pinned copy of Three.js — clone it and open `index.html`.

**Play it:** https://&lt;username&gt;.github.io/simba-fps/ *(replace `<username>` with your GitHub handle after enabling Pages)*

![screenshot placeholder — drop a gameplay grab in `screenshots/gameplay.png`](screenshots/gameplay.png)

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look (pointer lock) |
| Left click | Fire |
| Right click | Aim down sights (ADS) |
| `1`–`9` / mouse wheel / `Q` `E` | Switch weapon |
| `R` | Reload |
| `Shift` | Sprint |
| `B` / `Tab` | Open shop |
| `Esc` | Pause menu |

Tablet / touch: enable "觸控控制" on the start screen for an on-screen joystick + fire / reload / switch / shop buttons.

## Weapons

Five distinct 3D viewmodels back the nine-weapon arsenal. Each has its own hip pose, ADS pose, and recoil weight.

| Slot | Weapon | Silhouette | Recoil × | ADS FOV |
| --- | --- | --- | --- | --- |
| 1 | Pistol | Compact L-shape, short barrel | 1.0 | 55° |
| 2 | SMG | Short barrel, angled magazine, folding stock | 0.6 | 55° |
| 3 | Shotgun | Fat barrel, wooden pump + stock, brass bead sight | 1.8 | 55° |
| 4 | Rifle | Long barrel, small scope + rings, wood stock | 1.1 | 55° |
| 5 | Sniper | Extra-long barrel, prominent scope, bipod, bolt handle | 1.5 | **30°** (real zoom) |

Later shop tiers (autosg, laser, minigun, plasma) re-use the SMG / shotgun / rifle meshes with heavier stats.

## Tech stack

- **World renderer** — HTML5 Canvas 2D, DDA-marched raycasting, per-column z-buffer for sprite occlusion
- **Viewmodel** — Three.js r0.160 pinned locally (`three.min.js`) with a jsdelivr → unpkg → cloudflare fallback chain
- **UI** — Vanilla DOM overlays styled with plain CSS
- **Persistence** — `localStorage` under `simbafps:profile:<name>` (meta-progression, banked between runs) and `simbafps:run:v1` (current run auto-resume on refresh)
- **No build step, no npm** — every file is served as-is

## Run locally

```bash
git clone https://github.com/<username>/simba-fps.git
cd simba-fps
python3 -m http.server 8000
# open http://localhost:8000/
```

Any static server works (`npx serve`, `caddy file-server`, Nginx, etc.). Opening `index.html` via `file://` also works, but pointer lock and some pointer-lock-adjacent behaviour is happier over `http://`.

## Repo layout

```
simba-fps/
├── index.html         entry point (loads three.min.js, fps.css, fps.js)
├── fps.css            all styles
├── fps.js             game logic (raycaster, enemies, weapons, HUD, save)
├── three.min.js       pinned Three.js r0.160 (~654 KB, tracked in git)
├── fps_assets/        pre-chroma-keyed PNG viewmodel sprites (fallback path)
│   ├── pistol.png
│   ├── smg.png
│   ├── shotgun.png
│   └── rifle.png
├── fps_gun_test.html  sprite-alignment sandbox (not linked from index.html)
├── DEBUG.md           debugging notes from past sessions
├── LICENSE            MIT
└── README.md          you are here
```

## Save data

Progress persists in your browser's `localStorage`:

- `simbafps:profile:<name>` — meta-progression (coin bank, max HP upgrades, best score / best wave / lifetime kills, AI-teammate preference). Persists across runs and across page refreshes.
- `simbafps:run:v1` — current run snapshot (player position + HP, wave, enemies, mag counts, owned weapons). Written every 3 seconds while playing and on `beforeunload` / `pagehide`. Reload the page mid-fight and you drop back into the pause menu at the same wave.

To wipe the auto-resume save without touching profile progression, press **Esc** in-game and click **重置遊戲（清除存檔）** under "危險區域".

## Roadmap / TODO

- Sound effects (fire, dry-fire click, reload rack, footsteps, hit feedback)
- Real 3D world scene (walls, floor, ceiling as Three.js geometry so lighting is consistent across weapon and world)
- Hit particles / bullet decals / blood spurts
- Bolt-cycle animation on sniper fire; shotgun pump animation on reload
- More weapons and enemy variants; enemy projectile attacks
- Multiplayer leaderboard for best-wave via a small serverless endpoint

## Contributing

Issues and PRs welcome. Style is vanilla JS in one file, no build step, no dependencies beyond the pinned Three.js. Please keep it that way — the single-file simplicity is the point. Match the existing indentation (2 spaces) and comment tone (concise, explains "why" not "what"). Debug logs go through `console.log("[fps][...] …", { … })` so they're easy to filter.

## License

MIT — see [LICENSE](LICENSE).

Three.js is bundled under its own MIT license (see [threejs.org](https://threejs.org)).
