# SIMBA FPS — debug notes

Living notes from debugging sessions. Newest entries at the top.

---

## 2026-07-13 · 3D pistol not visible

### Symptom
After landing `feat(pistol): 3D model + walking sway + aim-down-sights`,
the user reported the 3D pistol never appeared on screen. The PNG pistol
was also not showing, so the visual was "empty bottom of screen where the
weapon used to be."

### Root cause
The **CSS default vs. inline style** trap.

`fps.css` declares:

```css
#weapon3d { … display: none; … }
```

so the 3D canvas is hidden by default (correct — we don't want to show it
before Three.js has initialised).

The visibility swap in `updateWeaponLayerVisibility()` was written as:

```js
w3dc.style.display = use3d ? "" : "none";
```

Setting `element.style.display = ""` **removes the inline style**. When the
inline style is gone the CSS rule (`display: none`) takes over again — so
the canvas never becomes visible, no matter how many times `render3dPistol`
draws into it. The pistol was being rendered every frame into an invisible
canvas.

The same anti-pattern applied to `#weapon`, but there the CSS default is
just the browser default of `display: block` for `<canvas>`, so clearing
the inline style did produce the intended "show" behaviour. That masked the
bug for the PNG path.

### Fix
Explicit values on both sides of the ternary:

```js
w2d.style.display  = use3d ? "none"  : "block";
w3dc.style.display = use3d ? "block" : "none";
```

Both file changes are in commit `fix(pistol): …` on top of the feat commit.

### Also shipped in the same fix
* **CDN fallback chain** — jsdelivr → unpkg → cloudflare (r128). Uses
  `document.write` during head parsing, which stays synchronous, so
  `fps.js` still sees `THREE` before its top-level code runs.
* **Debug logs** at the strategic points a future me will want:
  * page load: `[fps] Three.js loaded, revision = …`
  * `fps.js` load: `[fps] fps.js loaded { THREE, curWep, weapon_id, … }`
  * 3D init OK: `[fps][3d] init OK { canvas, three, webgl }`
  * first 3D frame: `[fps][3d] first frame drawn { buffer, css_rect, display, z_index }`
  * weapon switch: `[fps] switched to slot N id: … vm: …`
  * failure paths logged with `console.warn` / `console.error`

### How to verify a fix works
1. Open `~/simba/index.html` in Chrome/Safari
2. Open DevTools console **before** clicking Start Game
3. Expect to see, in order:
   - `[fps] Three.js loaded, revision = 160`
   - `[fps] fps.js loaded { THREE: "r160", curWep: 0, weapon_id: "pistol", weapon_vm: "pistol", … }`
4. Click Start Game and immediately expect:
   - `[fps][3d] init OK { canvas: "560x440", three: 160, webgl: "WebGL 2.0 …" }`
   - `[fps][3d] first frame drawn { buffer: "560x440", css_rect: "560x440 @ (…)", display: "block", z_index: "3" }`
5. The pistol should be visible in the lower-right of the viewport.
   Press right mouse to ADS (crosshair swaps to a dot, weapon centres,
   FOV zooms). Left-click to fire (muzzle flash + kick).
6. Press 2/3/4 to switch weapons. Expect:
   - `[fps] switched to slot 2 id: smg vm: smg`
   - The PNG viewmodel appears, the 3D canvas hides.

### If any of the above logs are missing

| Missing log | Likely cause | Try |
| --- | --- | --- |
| `Three.js loaded` | All 3 CDNs blocked | Check network tab; consider adding local `three.min.js` |
| `fps.js loaded` | `fps.js` 404 or JS error before line 1633 | Console error trace |
| `[fps][3d] init OK` | WebGL disabled or blacklisted | `chrome://gpu`, ANGLE backend |
| `first frame drawn` | Frame loop stopped or `weapon.vm` isn't `"pistol"` | Log `curWep` in the frame loop |
| First frame drawn but no visible pistol | `display: none` still winning (regression), z-index conflict, or canvas rect is 0×0 | Inspect the `#weapon3d` element in DevTools |

### Non-root-cause things I checked and ruled out
* Initial slot (curWep = 0 = pistol, weapon.vm = "pistol") — correct.
* Three.js loading order (`<script src=three>` is before `<script src=fps.js>`, both synchronous, no `defer`/`async`) — correct.
* Frame loop calling `render3dPistol(dt)` when pistol equipped — correct.
* `renderer.render(scene, camera)` being called — correct.
* Canvas dimensions (`560 × 440`) — correct.
* Pistol position inside camera frustum at `(0.3, -0.4, -0.6)` with FOV=75° — visible extents at that Z-plane are ±0.585 × ±0.46, so the top of the pistol sits inside the frame. (Grip is intentionally clipped off-screen — hip-carry pose.)
