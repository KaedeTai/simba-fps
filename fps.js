"use strict";
/* =========================================================================
   SIMBA FPS — raycasting first-person shooter, single file, no dependencies
   ========================================================================= */

// ---------- 3D world mode pref — HOISTED to fix TDZ ----------
// Must be declared BEFORE any code (e.g. initProfileUI at line ~700) that
// reads USE_3D_WORLD. Previously lived deep in the world3d module block
// (~line 2178) which triggered:
//   Uncaught ReferenceError: Cannot access 'USE_3D_WORLD' before initialization
// on any page load that ran initProfileUI before the world3d block.
//
// Toggle sources (priority: URL > localStorage > default):
//   ?mode=2d / ?mode=3d       URL query param (session, e.g. bug repro)
//   localStorage 'simbafps:pref:world3d'   persistent user pref
//   default = true (3D)
//
// User inputs three ways:
//   Desktop: F2 keydown → toggle + reload
//   Any:     start-screen checkbox "3D 世界" → saves pref, applies on Start
//   Any:     pause-menu "切換 2.5D / 3D 模式" button → toggle + reload
const WORLD3D_PREF_KEY = "simbafps:pref:world3d";
function _readWorld3dPref() {
  try {
    const params = new URLSearchParams(location.search);
    const modeParam = params.get("mode");
    if (modeParam === "2d") return false;
    if (modeParam === "3d") return true;
    const stored = localStorage.getItem(WORLD3D_PREF_KEY);
    if (stored === "false") return false;
    if (stored === "true")  return true;
  } catch (e) {}
  return true;                                     // default: 3D
}
let USE_3D_WORLD = _readWorld3dPref();
console.log("[fps][world3d] mode:", USE_3D_WORLD ? "3D" : "2.5D",
  "(source: URL/localStorage/default)");

// -------------------- Dagger (player viewmodel) live-tuning --------------
// Values are in radians (rotation) or world units (position). Init from
// URL query (?daggerRX=0.5&daggerRY=0.5&daggerRZ=0&daggerTX=...);
// keyboard: [ / ] adjust RX, ; / ' adjust RY, , / . adjust RZ (0.1 step);
// - / = adjust TX (left/right), Bksp / \ adjust TY, N / M adjust TZ;
// P prints current values to console. The star's rotation is applied
// in _loadDaggerMesh() at load time; the position offset is added in
// render3dWeapon() each frame so the dagger viewmodel follows the
// tuning live.
//
// Replaces the older teammate-rifle tuning — the rifle is now
// committed at the baked defaults (worked well across sessions), and
// the dagger still needs user-facing live tuning because the Star.glb
// orientation wasn't right on first load.
function _readDaggerDbg() {
  let rx = 0, ry = 0, rz = 0;
  let tx = 0, ty = 0, tz = 0;
  try {
    const u = new URLSearchParams(location.search);
    if (u.has("daggerRX")) rx = parseFloat(u.get("daggerRX"));
    if (u.has("daggerRY")) ry = parseFloat(u.get("daggerRY"));
    if (u.has("daggerRZ")) rz = parseFloat(u.get("daggerRZ"));
    if (u.has("daggerTX")) tx = parseFloat(u.get("daggerTX"));
    if (u.has("daggerTY")) ty = parseFloat(u.get("daggerTY"));
    if (u.has("daggerTZ")) tz = parseFloat(u.get("daggerTZ"));
  } catch (e) {}
  return { rx, ry, rz, tx, ty, tz };
}
const _daggerDbg = _readDaggerDbg();
console.log("[fps][daggerDbg] init from URL:", _daggerDbg);
// Apply the dagger rotation tuning to the star model in the pivot frame.
// Called from _loadDaggerMesh so the model's local rotation reflects the
// current tuning values at load time.
function _daggerDbgApplyToModel(model) {
  if (!model) return;
  model.rotation.set(_daggerDbg.rx, _daggerDbg.ry, _daggerDbg.rz);
}
function _daggerDbgUpdateHud() {
  let hud = document.getElementById("daggerDbg");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "daggerDbg";
    hud.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:9;" +
      "font:11px 'SF Mono',Menlo,monospace;color:#ffd07d;" +
      "background:rgba(0,0,0,.55);padding:5px 8px;border-radius:4px;" +
      "pointer-events:none;letter-spacing:1px;line-height:1.5";
    document.body.appendChild(hud);
  }
  const f2 = v => v.toFixed(2);
  hud.innerHTML =
    `dagger R(rad): X=${f2(_daggerDbg.rx)}  Y=${f2(_daggerDbg.ry)}  Z=${f2(_daggerDbg.rz)}  <span style="opacity:.6">[/] ;/' ,/.</span><br>` +
    `dagger T:       X=${f2(_daggerDbg.tx)}  Y=${f2(_daggerDbg.ty)}  Z=${f2(_daggerDbg.tz)}  <span style="opacity:.6">-/= Bksp/\\ N/M  P=log</span>`;
}

function toggleWorld3dMode() {
  const next = !USE_3D_WORLD;
  try { localStorage.setItem(WORLD3D_PREF_KEY, String(next)); } catch (e) {}
  console.log("[fps][world3d] toggling to", next ? "3D" : "2.5D", "— reloading");
  location.reload();
}

// ---------- Level maps (1 = wall, 0 = floor) ----------
const MAPS = [
  {
    name: "迷宮", spawn: { x: 3.5, y: 3.5 }, wallRGB: [92, 108, 150],
    grid: [
      "1111111111111111111111",
      "1000000000110000000001",
      "1011110110110110111101",
      "1010000010000010000101",
      "1010111010111010110101",
      "1000100000101000010001",
      "1110101110101011101011",
      "1000101000000000100011",
      "1011101011111010111011",
      "1000001000000010000001",
      "1011111011011010110111",
      "1000000010010010000001",
      "1011110110010011110101",
      "1010010000000000010101",
      "1010011111011110010101",
      "1000000001000100000001",
      "1111011011011011011111",
      "1000000000000000000001",
      "1011110111111101111001",
      "1010000000000000001001",
      "1000000110000110000001",
      "1111111111111111111111",
    ],
  },
  {
    // "競技場" — open arena with isolated pillars, fully connected, better for co-op crossfire
    name: "競技場", spawn: { x: 11, y: 11 }, wallRGB: [150, 96, 70],
    grid: [
      "1111111111111111111111",
      "1000000000000000000001",
      "1000000000000000000001",
      "1001100001100000110001",
      "1001100001100000110001",
      "1000000000000000000001",
      "1000001000010001000001",
      "1000000000000000000001",
      "1000000000000000000001",
      "1001100001100110110001",
      "1001100001100110110001",
      "1000001000000001000001",
      "1000000000000000000001",
      "1000000001100110000001",
      "1000000001100110000001",
      "1000001000010001000001",
      "1001100001100000110001",
      "1001100001100000110001",
      "1000000000000000000001",
      "1000000000000000000001",
      "1000000000000000000001",
      "1111111111111111111111",
    ],
  },
  {
    // "神殿" — a broken-box temple with doorways on all four sides (fully connected)
    name: "神殿", spawn: { x: 11, y: 11 }, wallRGB: [92, 140, 110],
    grid: [
      "1111111111111111111111",
      "1000000000000000000001",
      "1000000000000000000001",
      "1001100000000000011001",
      "1001100000000000011001",
      "1000000000000000000001",
      "1000001111001111000001",
      "1000001000000001000001",
      "1000001000000001000001",
      "1000001000000001000001",
      "1000000000000000000001",
      "1000000000000000000001",
      "1000001000000001000001",
      "1000001000000001000001",
      "1000001000000001000001",
      "1000001111001111000001",
      "1000000000000000000001",
      "1001100000000000011001",
      "1001100000000000011001",
      "1000000000000000000001",
      "1000000000000000000001",
      "1111111111111111111111",
    ],
  },
  {
    // "大要塞" — a large 30x30 fortress with scattered blockhouses (fully connected)
    name: "大要塞", spawn: { x: 15, y: 15 }, wallRGB: [150, 130, 70],
    grid: [
      "111111111111111111111111111111",
      "100000000000000000000000000001",
      "100000000000000000000000000001",
      "100000000000000000000000000001",
      "100011100011100011100011100001",
      "100011100011100011100011100001",
      "100011100011100011100011100001",
      "100000000000001000000000000001",
      "100000000000000000000000000001",
      "100000000000000000000000000001",
      "100011100000000000000011100001",
      "100011100000000000000011100001",
      "100011100000000000000011100001",
      "100000000000000000000000000001",
      "100000010000000100000010000001",
      "100000000000001000000000000001",
      "100011100000000000000011100001",
      "100011100000000000000011100001",
      "100011100000000000000011100001",
      "100000000000000000000000000001",
      "100000000000000000000000000001",
      "100000000000000000000000000001",
      "100011100011101011100011100001",
      "100011100011100011100011100001",
      "100011100011100011100011100001",
      "100000000000000000000000000001",
      "100000000000000000000000000001",
      "100000000000000000000000000001",
      "100000000000000000000000000001",
      "111111111111111111111111111111",
    ],
  },
].map(m => ({ ...m, grid: m.grid.map(r => r.split("").map(Number)) }));

let curMap = 0;
let selectedMap = 0;   // chosen on the start screen
let MAP = MAPS[0].grid;
let MAP_H = MAP.length, MAP_W = MAP[0].length;
let wallRGB = MAPS[0].wallRGB;

function loadMap(index) {
  curMap = ((index % MAPS.length) + MAPS.length) % MAPS.length;
  const m = MAPS[curMap];
  MAP = m.grid; MAP_H = MAP.length; MAP_W = MAP[0].length;
  wallRGB = m.wallRGB;
}

function isWall(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= MAP_W || yi >= MAP_H) return true;
  return MAP[yi][xi] === 1;
}

// ---------- Canvas / rendering setup ----------
const screen = document.getElementById("game");
const ctx = screen.getContext("2d");
let W = 0, H = 0, HALF_H = 0;
const FOV = Math.PI / 3;            // 60°
let NUM_RAYS = 0, COL_W = 2;
// Far-clip fallback distance for the (in a bordered map, never-taken) case
// where a ray hits no wall. The DDA march is bounded by step count, not this.
const MAX_DEPTH = 40;

function resize() {
  W = screen.width = Math.floor(window.innerWidth);
  H = screen.height = Math.floor(window.innerHeight);
  HALF_H = H / 2;
  COL_W = W > 1400 ? 3 : 2;
  NUM_RAYS = Math.ceil(W / COL_W);
}
window.addEventListener("resize", resize);
resize();

// ---------- Player / weapon / world state ----------
const player = { x: 3.5, y: 3.5, dir: 0, pitch: 0, hp: 100, maxHp: 100, speed: 3.2, sprint: 5.2, bob: 0 };
// Jump physics (added later, kept out of the player object so the save
// schema doesn't gain new fields — jump is transient and resets on
// spawn / revive anyway). Space to jump when grounded (playerZ === 0
// && !jumping); gravity brings you back down; no double-jump.
let playerZ = 0;                // vertical offset in world units above eye height
let playerVelZ = 0;             // vertical velocity, units/sec
let jumping = false;
const JUMP_V = 3.5;             // initial jump velocity — peak height ~0.6 units
const GRAVITY = 9.8;            // "airtime" ~700 ms total cycle

// AI teammate — follows the player and shoots the nearest visible enemy
const ally = {
  x: 3.5, y: 4.5, dir: 0, hp: 100, maxHp: 100, speed: 2.9,
  dead: false, deadT: 0, fireCd: 0, muzzle: 0, hurt: 0,
  fireRate: 0.45, damage: 19, range: 11, dist: 999,
  friendly: true, sizeScale: 0.95,
};

// Weapon arsenal — pistol + dagger are free from the start; the rest
// appear in the shop as you clear waves (unlockWave) and are bought with
// coins (cost).
// vm = which viewmodel shape to draw. Every entry also gets per-weapon runtime
// state (mag, reload…) via the .map() below.
//
// === Melee weapons (melee: true) ===
// Flagged for tryShoot's melee branch — no bullet, no ammo, instant damage
// to enemies within `range` in front of the player. magSize is 1 for the
// HUD counter, but the melee branch never decrements it (and never auto-
// reloads either, so the HUD always shows ∞-ish behavior).
const weapons = [
  { id: "pistol",  name: "手槍",     ico: "🔫", magSize: 12, fireRate: 0.13, reloadTime: 1.0,
    damage: 34,  range: 16, spread: 0.030, pellets: 1, auto: false, vm: "pistol",  owned: true },
  // Dagger: free from the start, lives in slot 2. Uses the Star.glb model
  // from the Vanguard Mixamo set as a 3D viewmodel. ~1.4 unit reach
  // (knife-range — you basically have to be on top of the enemy).
  // No ammo: magSize: 1 is a display hack so the HUD shows a single bullet
  // icon; tryShoot's melee branch ignores weapon.mag entirely.
  // Icon: ⭐ (the actual model is a 4-pointed throwing star with a blue
  // gem center, not a literal blade — using a star icon to match what
  // the player sees, while keeping the "匕首" name the user asked for).
  { id: "dagger",  name: "匕首",     ico: "⭐", magSize: 1,  fireRate: 0.30, reloadTime: 0,
    damage: 75,  range: 1.4, spread: 0.0,   pellets: 1, auto: false, vm: "dagger",  owned: true, melee: true },
  { id: "smg",     name: "衝鋒槍",   ico: "💥", magSize: 30, fireRate: 0.06, reloadTime: 1.4,
    damage: 16,  range: 14, spread: 0.080, pellets: 1, auto: true,  vm: "smg",     cost: 150,  unlockWave: 2 },
  { id: "shotgun", name: "霰彈槍",   ico: "🔩", magSize: 6,  fireRate: 0.70, reloadTime: 1.7,
    damage: 14,  range: 10, spread: 0.280, pellets: 8, auto: false, vm: "shotgun", cost: 250,  unlockWave: 3 },
  { id: "rifle",   name: "突擊步槍", ico: "🎯", magSize: 25, fireRate: 0.11, reloadTime: 1.5,
    damage: 30,  range: 20, spread: 0.025, pellets: 1, auto: true,  vm: "rifle",   cost: 350,  unlockWave: 4 },
  { id: "sniper",  name: "狙擊槍",   ico: "🔭", magSize: 5,  fireRate: 0.80, reloadTime: 1.8,
    damage: 130, range: 28, spread: 0.002, pellets: 1, auto: false, vm: "sniper",  cost: 500,  unlockWave: 5 },
  { id: "autosg",  name: "自動霰彈", ico: "🧨", magSize: 10, fireRate: 0.28, reloadTime: 1.9,
    damage: 12,  range: 11, spread: 0.300, pellets: 7, auto: true,  vm: "autosg",  cost: 550,  unlockWave: 6 },
  { id: "laser",   name: "雷射槍",   ico: "⚡", magSize: 40, fireRate: 0.05, reloadTime: 1.6,
    damage: 22,  range: 22, spread: 0.006, pellets: 1, auto: true,  vm: "laser",   cost: 700,  unlockWave: 7 },
  { id: "minigun", name: "機槍",     ico: "🌀", magSize: 80, fireRate: 0.04, reloadTime: 2.6,
    damage: 15,  range: 16, spread: 0.100, pellets: 1, auto: true,  vm: "minigun", cost: 900,  unlockWave: 8 },
  // Plasma cannon is a "map cannon" (地圖炮) AOE weapon — half-a-room
  // radius (9 units), soft edge floor so even grazing hits sting.
  // Proximity fuse: the shot auto-detonates when it enters the fuseRange
  // of any live enemy along its flight path, so you don't need to line
  // it up on a specific target — throw it toward a crowd and it pops
  // when it's close enough. Balance: 6-round mag, slow 1.3s fire rate,
  // long 2.4s reload. Damage 220 at center, ~15% floor at edge.
  { id: "plasma",  name: "電漿炮",   ico: "☄️", magSize: 6,  fireRate: 1.30, reloadTime: 2.4,
    damage: 220, range: 22, spread: 0.020, pellets: 1, auto: true,  vm: "plasma",  cost: 1400, unlockWave: 10,
    splashRadius: 9.0, splashFloor: 0.15, fuseRange: 2.8 },
].map(w => ({ ...w, mag: w.magSize, cooldown: 0, reloading: false, reloadT: 0, recoil: 0 }));
let curWep = 0;
let weapon = weapons[curWep];

function switchWeapon(i) {
  if (!running || paused || gameOver || shopOpen) return;
  i = (i + weapons.length) % weapons.length;
  if (!weapons[i].owned || i === curWep) return;
  weapon.reloading = false; weapon.reloadT = 0;   // cancel any in-progress reload
  curWep = i;
  weapon = weapons[curWep];
  weapon.cooldown = Math.max(weapon.cooldown, 0.25); // small equip delay
  console.log("[fps] switched to slot", curWep + 1, "id:", weapon.id, "vm:", weapon.vm);
}
// Cycle to the next/prev OWNED weapon (for wheel / Q / E).
function cycleWeapon(dir) {
  let i = curWep;
  for (let n = 0; n < weapons.length; n++) {
    i = (i + dir + weapons.length) % weapons.length;
    if (weapons[i].owned) { switchWeapon(i); return; }
  }
}
const enemies = [];
let score = 0, wave = 1, kills = 0, coins = 0;
// === Kill streak tracker ===
// Each kill within STREAK_WINDOW_S of the previous counts toward a
// streak. Triggered a banner like "雙殺!" / "三殺!" / "四殺!" /
// "五殺!" / "神一般!" at thresholds.
let lastKillT = -10;
let killStreak = 0;
const STREAK_WINDOW_S = 2.0;
let running = false, paused = false, gameOver = false, shopOpen = false, awaitingNextWave = false;
const keys = {};
let mouseDown = false, hurtT = 0;
let useAlly = true;   // whether the AI teammate is enabled this run

// ---------- Local save profiles (localStorage; offline-friendly) ----------
const SAVE_PREFIX = "simbafps:profile:";
let profileName = "玩家";
function defaultProfile() {
  return { coins: 0, maxHp: 100, unlocked: [], bestScore: 0, bestWave: 1, totalKills: 0, useAlly: true };
}
let profile = defaultProfile();

function loadProfile(name) {
  profileName = (name || "玩家").slice(0, 16).trim() || "玩家";
  try {
    const raw = localStorage.getItem(SAVE_PREFIX + profileName);
    profile = raw ? Object.assign(defaultProfile(), JSON.parse(raw)) : defaultProfile();
    localStorage.setItem("simbafps:last", profileName);
  } catch (e) { profile = defaultProfile(); }
  useAlly = profile.useAlly !== false;
  return profile;
}
function saveProfile() {
  try { localStorage.setItem(SAVE_PREFIX + profileName, JSON.stringify(profile)); } catch (e) {}
}
// copy the current run's meta-progress into the profile and persist
function bankProgress() {
  // Coins, max-HP upgrades, best stats and teammate preference persist.
  // Weapons do NOT — every run starts with the pistol and re-earns the rest.
  profile.coins = coins;
  profile.maxHp = player.maxHp;
  profile.useAlly = useAlly;
  if (score > profile.bestScore) profile.bestScore = score;
  if (wave > profile.bestWave) profile.bestWave = wave;
  saveProfile();
}

// =========================================================================
// === persistence: auto-resume the current run on page refresh ===
// The profile layer above handles meta-progression (coins, best score,
// etc.) across runs. This layer serialises the *current run* — position,
// HP, wave, enemy roster — so a browser refresh drops the player back
// where they were instead of the start screen.
//
// Storage: single JSON blob at RUN_KEY. Version-gated so future schema
// changes can be migrated or ignored. Corrupt JSON is auto-discarded.
//
// Save triggers:
//   * every AUTOSAVE_INTERVAL_S seconds while playing (throttled)
//   * beforeunload + pagehide (belt-and-braces catch on refresh/close)
//   * wave clear, shop close, weapon purchase (major state transitions)
//
// Save is cleared on player death (endGame) so the next launch starts
// fresh, and by the explicit ESC-menu Reset button.
// =========================================================================
const RUN_KEY = "simbafps:run:v1";
const AUTOSAVE_INTERVAL_S = 3;
let autosaveT = 0;
let resumeSafetyT = 0;    // brief enemy-freeze grace period after auto-resume

function saveRun() {
  if (!running || gameOver) return;
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      profileName,
      map: curMap,
      player: {
        x: player.x, y: player.y, dir: player.dir, pitch: player.pitch,
        hp: player.hp, maxHp: player.maxHp,
      },
      ally: {
        x: ally.x, y: ally.y, hp: ally.hp, maxHp: ally.maxHp,
        dead: !!ally.dead, deadT: ally.deadT || 0,
      },
      // Persist per-weapon ownership + mag count. Match by id on restore so
      // the arsenal can be re-ordered in a later patch without breaking saves.
      weapons: weapons.map(w => ({ id: w.id, owned: !!w.owned, mag: w.mag })),
      curWep,
      enemies: enemies.map(e => ({
        x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, speed: e.speed,
        dmg: e.dmg, reward: e.reward, scoreVal: e.scoreVal,
        radius: e.radius, sizeScale: e.sizeScale, boss: !!e.boss,
        reach: e.reach, enraged: !!e.enraged,
        // kind/ranged: persisted so a reload doesn't fall back every enemy
        // to the default sprite. Without this, save → reload → next frame
        // would render all loaded enemies as the grunt silhouette and the
        // visual variety disappears until the next wave spawn.
        kind: e.kind || "grunt", ranged: !!e.ranged,
        dead: !!e.dead, deadT: e.deadT || 0,
      })),
      score, wave, kills, coins,
      bossAlive,
      useAlly,
      shopOpen, awaitingNextWave,
    };
    localStorage.setItem(RUN_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("[fps][save] saveRun failed:", err);
  }
}

function loadRun() {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.version !== 1) {
      console.warn("[fps][save] version mismatch, discarding:", d && d.version);
      localStorage.removeItem(RUN_KEY);
      return null;
    }
    return d;
  } catch (err) {
    console.warn("[fps][save] corrupt save, discarding:", err);
    try { localStorage.removeItem(RUN_KEY); } catch (e) {}
    return null;
  }
}

function clearRun() {
  try {
    localStorage.removeItem(RUN_KEY);
    // Verify the removal took — a silent try/catch used to hide the case
    // where localStorage was in a state that ignored writes.
    const stillThere = localStorage.getItem(RUN_KEY);
    if (stillThere !== null) {
      console.error("[fps][save] clearRun: removeItem returned but key STILL present:",
        String(stillThere).slice(0, 60));
    }
  } catch (e) {
    console.warn("[fps][save] clearRun threw:", e);
  }
}

// Rebuild the whole world from a save blob. Called at page load if a
// save exists. Any failure inside here should be caught by the caller —
// see the boot IIFE at the bottom of this file.
function restoreRun(d) {
  // ----- profile (meta) -----
  loadProfile(d.profileName);
  const acctInput = document.getElementById("acct");
  if (acctInput) acctInput.value = profileName;
  applyProfileToStartUI();
  // ----- map -----
  loadMap(d.map || 0);
  selectedMap = curMap;
  Array.from(document.getElementById("mapsel").children)
    .forEach((c, j) => c.classList.toggle("sel", j === curMap));
  // ----- player -----
  Object.assign(player, {
    x: d.player.x, y: d.player.y, dir: d.player.dir, pitch: d.player.pitch,
    hp: d.player.hp, maxHp: d.player.maxHp, bob: 0,
  });
  // ----- ally -----
  useAlly = d.useAlly !== false;
  Object.assign(ally, {
    x: d.ally.x, y: d.ally.y, hp: d.ally.hp, maxHp: d.ally.maxHp || 100,
    dead: !!d.ally.dead, deadT: d.ally.deadT || 0,
    fireCd: 0, muzzle: 0, hurt: 0,
  });
  // ----- weapons — match by id, unknown ids silently dropped -----
  for (const wSaved of (d.weapons || [])) {
    const w = weapons.find(x => x.id === wSaved.id);
    if (w) {
      w.owned = !!wSaved.owned;
      w.mag = Math.max(0, Math.min(w.magSize, wSaved.mag ?? w.magSize));
      w.reloading = false; w.reloadT = 0; w.cooldown = 0; w.recoil = 0;
    }
  }
  curWep = Math.max(0, Math.min(weapons.length - 1, d.curWep || 0));
  if (!weapons[curWep].owned) curWep = 0;   // safety fallback if saved slot got unowned somehow
  weapon = weapons[curWep];
  // ----- enemies -----
  enemies.length = 0;
  for (const e of (d.enemies || [])) {
    enemies.push({
      x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
      speed: e.speed, dmg: e.dmg, reward: e.reward, scoreVal: e.scoreVal,
      radius: e.radius, sizeScale: e.sizeScale, boss: !!e.boss,
      reach: e.reach, enraged: !!e.enraged,
      dead: !!e.dead, deadT: e.deadT || 0,
      hurt: 0, attackCd: 0, dist: 999,
    });
  }
  // ----- counters + flow -----
  score = d.score || 0;
  wave  = d.wave  || 1;
  kills = d.kills || 0;
  coins = d.coins || 0;
  bossAlive = !!d.bossAlive;
  hurtT = 0;
  running = true;
  gameOver = false;
  awaitingNextWave = !!d.awaitingNextWave;
  buildShop();
  $("start").classList.add("hidden");
  $("over").classList.add("hidden");
  // Reveal the (opaque) #world3d canvas — same as startGame(), needed on
  // page-load auto-resume too so the restored session sees the 3D world.
  document.body.classList.add("game-running");
  // If the save caught us mid-shop, restore that screen instead of pause,
  // so the wave-clear detector in update() doesn't re-fire and double-
  // increment the wave counter.
  if (d.shopOpen) {
    paused = false;
    openShop(!!d.awaitingNextWave);
    $("pause").classList.add("hidden");
  } else {
    paused = true;                                    // resume paused; user clicks to relock pointer
    shopOpen = false;
    $("shop").classList.add("hidden");
    $("pause").classList.remove("hidden");
    resumeSafetyT = 1.2;                              // ~1.2 s enemy-AI freeze after unpause
  }
  showBanner(`續玩:第 ${wave} 波 · 生命 ${Math.ceil(player.hp)} · 金幣 ${coins}`);
  console.log("[fps][save] resumed run", {
    wave, hp: player.hp, coins, enemies: enemies.length, shopOpen: !!d.shopOpen,
    savedAt: new Date(d.savedAt).toLocaleString(),
  });
}
// === /persistence ===

// ---------- Waves ----------
const BOSS_EVERY = 5;   // a boss appears on every 5th wave
let bossAlive = false;
// === Screen shake ===
// Magnitude in world units. Set on heavy events (boss spawn, plasma
// explosion, big hit). Decays exponentially each frame. Applied to the
// 3D camera position offset and to the 2.5D canvas CSS transform.
let screenShake = 0;
function _addScreenShake(amount) {
  // Cap the cumulative shake so a flurry of small hits doesn't make
  // the screen unreadable.
  screenShake = Math.min(screenShake + amount, 0.30);
}

// find a valid spawn point far enough from the player
function findSpawn(minDist2) {
  for (let tries = 0; tries < 3000; tries++) {
    const x = 1 + Math.random() * (MAP_W - 2);
    const y = 1 + Math.random() * (MAP_H - 2);
    if (isWall(x, y)) continue;
    const dx = x - player.x, dy = y - player.y;
    if (dx * dx + dy * dy < minDist2) continue;
    return { x, y };
  }
  return null;
}

// bigger maps get proportionally more enemies so they aren't empty
function mapScale() { return Math.max(1, Math.round((MAP_W * MAP_H) / (22 * 22))); }

// Pick a kind for the current wave slot. Mix shifts with wave number so
// later waves throw harder variants at the player. All variants are
// available from wave 1 — just rarer at low waves — so the user sees
// visual variety immediately instead of having to grind up to wave 3+
// before the first non-grunt shows up.
//
// Distribution at wave 1: ~60% grunt, ~22% charger (fast scout variant),
// ~12% shield, ~6% shooter. By wave 8+ this settles to roughly
// 30/25/25/20 grunt/charger/shield/shooter.
function pickEnemyKind() {
  const r = Math.random();
  // Wave-gated probabilities: every kind is unlocked from wave 1, but
  // their weight grows with wave number. The cumulative bands below
  // sum to 1.0 at every wave value.
  const t = Math.min(1, (wave - 1) / 7);   // 0 at wave 1, 1 at wave 8+
  const pShooter = 0.05 + 0.15 * t;          //  5% → 20%
  const pCharger = 0.20 + 0.15 * t;          // 20% → 35%
  const pShield  = 0.15 + 0.10 * t;          // 15% → 25%
  // pGrunt fills the rest, sliding from 60% → 20%
  if (r < pShooter)            return "shooter";
  if (r < pShooter + pCharger) return "charger";
  if (r < pShooter + pCharger + pShield) return "shield";
  return "grunt";
}

function spawnWave(n) {
  const count = n * mapScale();
  for (let i = 0; i < count; i++) {
    const p = findSpawn(25);
    if (!p) continue;
    const kind = pickEnemyKind();
    const cfg = ENEMY_SPRITES[kind];
    const baseHp  = 40 + wave * 8;
    const baseDmg = 8 + wave;
    const hp  = Math.round(baseHp  * cfg.baseHpMul);
    const dmg = Math.round(baseDmg * cfg.baseDmgMul);
    const spd = (0.9 + Math.random() * 0.5 + wave * 0.05) * cfg.baseSpdMul;
    enemies.push({
      x: p.x, y: p.y, hp, maxHp: hp,
      speed: spd, dmg, reward: kind === "boss" ? 650 : 25 + (kind === "shield" ? 35 : 0),
      scoreVal: kind === "shield" ? 220 : kind === "shooter" ? 160 : 100,
      radius: kind === "shield" ? 0.55 : 0.45,
      sizeScale: kind === "shield" ? 1.25 : 1.0,
      boss: false, kind, ranged: cfg.ranged,
      // Shooter-only state: keeps a distance from the player and fires
      // projectiles (visual: glowing tracer) instead of melee charges.
      // The projectile is reused from the boss / player path; for the
      // shooter we just call the same wallBetween + aimAt + damage logic
      // but with reduced fire rate + damage.
      fireT: 0,
      hurt: 0, dead: false, deadT: 0, attackCd: 0, dist: 999,
    });
  }
}

function spawnBoss() {
  const p = findSpawn(36) || { x: MAP_W - 3.5, y: MAP_H - 3.5 };
  const cfg = ENEMY_SPRITES.boss;
  const hp = (900 + wave * 180) * cfg.baseHpMul;
  const reward = 650 + wave * 110;
  enemies.push({
    x: p.x, y: p.y, hp, maxHp: hp,
    speed: (0.8 + wave * 0.03) * cfg.baseSpdMul,
    dmg: Math.round((30 + wave * 2) * cfg.baseDmgMul),
    reward, scoreVal: 2500,
    radius: 0.95, sizeScale: 2.4, boss: true, kind: "boss", ranged: cfg.ranged, reach: cfg.reach,
    enraged: false,
    hurt: 0, dead: false, deadT: 0, attackCd: 0, dist: 999,
  });
  bossAlive = true;
  showBanner(`⚠ 首領來襲！血量 ${hp}，血低時會狂暴！擊倒可獲 ${reward} 金幣`);
  // Screen-shake on spawn so the player feels the boss ARRIVE.
  _addScreenShake(0.18);
  // Red vignette flash so the player SEES the boss appear.
  _bossSpawnFlash();
}

// spawn the appropriate roster for the current wave
function startWave() {
  reviveAlly();   // teammate rejoins fresh at the start of each wave
  if (wave % BOSS_EVERY === 0) {
    spawnBoss();
    spawnWave(2 + Math.floor(wave / 3));   // a few minions escort the boss
  } else {
    spawnWave(3 + wave);
  }
}

// ---------- Input ----------
addEventListener("keydown", e => {
  keys[e.code] = true;
  if (e.code === "KeyR") reload();
  // F2: toggle 2.5D <-> 3D world mode. Persists via localStorage +
  // reloads. saveRun's beforeunload hook preserves the current run so
  // the mode change is seamless.
  if (e.code === "F2") { e.preventDefault(); toggleWorld3dMode(); return; }
  // === DEBUG HOTKEYS (show the visual variety) ===
  // F3: skip to next wave (forces startWave). Lets the user jump past
  // the wave-1 grunt grind to see shield / charger / shooter variants
  // without playing through 6 waves of low variety. Doesn't bypass
  // the spawn logic — pickEnemyKind still runs normally on the new
  // wave, so you'll actually see different monsters after the skip.
  if (e.code === "F3" && running && !gameOver) {
    e.preventDefault();
    for (const e2 of enemies) e2.dead = true;  // clear current wave
    wave += 1;
    awaitingNextWave = false;
    startWave();
    showBanner(`⏩ 跳到第 ${wave} 波`);
    return;
  }
  // F4: force-spawn one of each enemy kind in front of the player.
  // Use this when you want to compare all 5 silhouettes side by side
  // without grinding waves. Spawns at random positions within 4 units.
  if (e.code === "F4" && running && !gameOver) {
    e.preventDefault();
    const fwd = player.dir;
    const cx = player.x + Math.cos(fwd) * 5;
    const cy = player.y + Math.sin(fwd) * 5;
    const kinds = ["grunt", "shield", "charger", "shooter"];
    let added = 0;
    for (const k of kinds) {
      const cfg = ENEMY_SPRITES[k];
      const ang = (added / kinds.length) * Math.PI * 2;
      const px = cx + Math.cos(ang) * 2.5;
      const py = cy + Math.sin(ang) * 2.5;
      const hp = Math.round(40 * cfg.baseHpMul);
      enemies.push({
        x: px, y: py, hp, maxHp: hp,
        speed: 0.9 * cfg.baseSpdMul,
        dmg: 8 * cfg.baseDmgMul, reward: 25, scoreVal: 100,
        radius: k === "shield" ? 0.55 : 0.45,
        sizeScale: k === "shield" ? 1.25 : 1.0,
        boss: false, kind: k, ranged: cfg.ranged,
        fireT: 0, hurt: 0, dead: false, deadT: 0, attackCd: 0, dist: 999,
      });
      added++;
    }
    showBanner("🧪 已召喚 grunt / shield / charger / shooter (F4)");
    return;
  }
  // F key — keyboard equivalent of right-mouse ADS. Switched from Cmd/Meta
  // because Cmd+W (close tab) is OS-level on macOS and preventDefault
  // can't cancel it. F has no OS-level conflicts, is easy to hold with the
  // left thumb while WASD-fingering, and matches the "F for flashlight /
  // interact" convention many FPS games use.
  if (e.code === "KeyF" && running && !paused && !gameOver && !shopOpen) {
    aiming3d = true;
    return;
  }
  // Space to jump — grounded-only, no double-jump. preventDefault stops
  // the default browser scroll on Space.
  if (e.code === "Space" && running && !paused && !gameOver && !shopOpen) {
    if (!jumping && playerZ <= 0) {
      playerVelZ = JUMP_V;
      jumping = true;
    }
    e.preventDefault();
    return;
  }
  const dm = e.code.match(/^Digit([1-9])$/);
  if (dm) switchWeapon(+dm[1] - 1);
  if (e.code === "KeyQ") cycleWeapon(-1);
  if (e.code === "KeyE") cycleWeapon(1);
  if (e.code === "KeyB" || e.code === "Tab") {
    e.preventDefault();
    if (shopOpen) closeShop(); else if (running && !gameOver && !paused) openShop(false);
  }
  // -------- Dagger viewmodel live tuning --------
  // BracketLeft/Right → RX, Semicolon/Quote → RY, Comma/Period → RZ.
  // Minus/Equal → TX, Backspace/Backslash → TY, KeyN/KeyM → TZ.
  // KeyP dumps current values so the user can paste them into a URL or
  // commit them as baked defaults. Replaces the old rifleDbg system —
  // the Vanguard teammate's rifle position was already locked in, and
  // the Star.glb dagger viewmodel still needs user-facing tuning.
  const RSTEP = 0.1;                                     // step in radians (~5.7°)
  const TSTEP = 0.01;                                    // step in world units
  let touched = false;
  if      (e.code === "BracketLeft")  { _daggerDbg.rx -= RSTEP; touched = true; }
  else if (e.code === "BracketRight") { _daggerDbg.rx += RSTEP; touched = true; }
  else if (e.code === "Semicolon")    { _daggerDbg.ry -= RSTEP; touched = true; }
  else if (e.code === "Quote")        { _daggerDbg.ry += RSTEP; touched = true; }
  else if (e.code === "Comma")        { _daggerDbg.rz -= RSTEP; touched = true; }
  else if (e.code === "Period")       { _daggerDbg.rz += RSTEP; touched = true; }
  // Position tuning (world units).
  else if (e.code === "Minus")        { _daggerDbg.tx -= TSTEP; touched = true; }
  else if (e.code === "Equal")        { _daggerDbg.tx += TSTEP; touched = true; }
  else if (e.code === "Backspace")    { _daggerDbg.ty -= TSTEP; touched = true; }
  else if (e.code === "Backslash")    { _daggerDbg.ty += TSTEP; touched = true; }
  else if (e.code === "KeyN")         { _daggerDbg.tz -= TSTEP; touched = true; }
  else if (e.code === "KeyM")         { _daggerDbg.tz += TSTEP; touched = true; }
  else if (e.code === "KeyP")         {
    console.log("[fps][daggerDbg]",
      `R=(${_daggerDbg.rx.toFixed(3)}, ${_daggerDbg.ry.toFixed(3)}, ${_daggerDbg.rz.toFixed(3)})`,
      `T=(${_daggerDbg.tx.toFixed(3)}, ${_daggerDbg.ty.toFixed(3)}, ${_daggerDbg.tz.toFixed(3)})`,
      "→ URL:",
      `?daggerRX=${_daggerDbg.rx.toFixed(3)}&daggerRY=${_daggerDbg.ry.toFixed(3)}&daggerRZ=${_daggerDbg.rz.toFixed(3)}` +
      `&daggerTX=${_daggerDbg.tx.toFixed(3)}&daggerTY=${_daggerDbg.ty.toFixed(3)}&daggerTZ=${_daggerDbg.tz.toFixed(3)}`);
  }
  if (touched) {
    // Re-apply the rotation immediately so the user sees the change
    // even if the dagger isn't loaded yet. The position offset is
    // picked up in render3dWeapon on the next frame.
    //
    // IMPORTANT: only the *model* (the loaded Star.glb Group) should be
    // rotated by _daggerDbg. The slashTrail and glowTip are children of
    // the pivot and already follow the pivot's swing rotation — touching
    // their own rotation here would visually decouple them from the
    // dagger. (Previous bug: the loop was `if (sub.isMesh)` which
    // silently skipped the model because the GLB is a Group, not a Mesh,
    // so only the slashTrail + glowTip were being rotated — the user
    // saw the small yellow glow sphere orbiting instead of the dagger.)
    const holder = w3d && w3d.meshes && w3d.meshes.dagger;
    if (holder && holder.userData && holder.userData.dagger) {
      const ud = holder.userData.dagger;
      // ud.pivot.children[0] is the loaded model Group.
      const model = ud.pivot.children[0];
      if (model) {
        model.rotation.set(_daggerDbg.rx, _daggerDbg.ry, _daggerDbg.rz);
      }
    }
    _daggerDbgUpdateHud();
    e.preventDefault();
  }
});
addEventListener("keyup", e => {
  keys[e.code] = false;
  // F key release ends the ADS started by keydown.
  if (e.code === "KeyF") aiming3d = false;
});
screen.addEventListener("mousedown", e => { if (e.button === 0) { mouseDown = true; tryShoot(); } });
addEventListener("mouseup", e => { if (e.button === 0) mouseDown = false; });
// === 3D weapons prototype: right mouse = ADS (aim-down-sights) ===
// Works for any weapon with a 3D counterpart; the flag is read by
// render3dWeapon() to lerp between hip and aim poses + FOV.
addEventListener("mousedown", e => {
  if (e.button === 2 && running && !paused && !gameOver && !shopOpen) aiming3d = true;
});
addEventListener("mouseup", e => { if (e.button === 2) aiming3d = false; });
addEventListener("contextmenu", e => { if (running) e.preventDefault(); });
// === /3D weapons prototype ===
addEventListener("wheel", e => {
  if (!running || paused || gameOver || shopOpen) return;
  cycleWeapon(e.deltaY > 0 ? 1 : -1);
}, { passive: true });
// Scope mode helper — active when sniper is equipped and right mouse held.
// Reads globals declared elsewhere (aiming3d, weapon), so must NOT be
// called before those exist; used only after startup.
function _isScoped() {
  return typeof aiming3d !== "undefined" && aiming3d
      && typeof weapon !== "undefined" && weapon && weapon.id === "sniper";
}
// Laser rifle's holographic sight — lighter version of the sniper scope.
// Zooms moderately (35° hFOV vs sniper's 20°), keeps the viewmodel visible
// (holo is glued to the weapon, not hiding behind an eyecup), and only
// slows aim slightly.
function _isLaserScoped() {
  return typeof aiming3d !== "undefined" && aiming3d
      && typeof weapon !== "undefined" && weapon && weapon.id === "laser";
}
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement === screen && !paused) {
    // Sniper scope drops sensitivity dramatically so fine aim is possible.
    // Laser holo sight is a lighter version — 0.6× instead of 0.35×.
    const sensMult = _isScoped() ? 0.35 : (_isLaserScoped() ? 0.6 : 1);
    player.dir += e.movementX * 0.0022 * sensMult;
    // vertical look: shift the horizon (moving mouse up looks up)
    player.pitch -= e.movementY * 1.3 * sensMult;
    const lim = H * 0.6;
    player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
  }
});
document.addEventListener("pointerlockchange", () => {
  // in touch mode we never lock the pointer, so don't auto-pause on lock changes
  if (!touchMode && document.pointerLockElement !== screen && running && !gameOver && !shopOpen) {
    paused = true;
    document.getElementById("pause").classList.remove("hidden");
  }
});

// ---------- Touch controls (tablet / phone) ----------
let touchMode = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
const stick = { id: null, bx: 0, by: 0, dx: 0, dy: 0 };   // left virtual joystick
const lookT = { id: null, x: 0, y: 0 };                   // right drag-to-look
let touchSprint = false;
const STICK_R = 72;

function stickEl(id) { return document.getElementById(id); }
function inMenus() { return !running || paused || gameOver || shopOpen; }

function onTouchStart(e) {
  if (!touchMode || inMenus()) return;          // menus use normal taps
  let used = false;
  for (const t of e.changedTouches) {
    // let taps on the on-screen buttons and weapon bar behave normally
    if (t.target && t.target.closest && t.target.closest(".touchbtn, #wepbar")) continue;
    if (t.clientX < window.innerWidth * 0.45 && stick.id === null) {
      stick.id = t.identifier; stick.bx = t.clientX; stick.by = t.clientY; stick.dx = 0; stick.dy = 0;
      const b = stickEl("stickbase"), k = stickEl("stickknob");
      b.style.left = k.style.left = t.clientX + "px";
      b.style.top = k.style.top = t.clientY + "px";
      b.style.display = k.style.display = "block";
      used = true;
    } else if (lookT.id === null) {
      lookT.id = t.identifier; lookT.x = t.clientX; lookT.y = t.clientY;
      used = true;
    }
  }
  if (used) e.preventDefault();
}
function onTouchMove(e) {
  if (!touchMode) return;
  let handled = false;
  for (const t of e.changedTouches) {
    if (t.identifier === stick.id) {
      let dx = t.clientX - stick.bx, dy = t.clientY - stick.by;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }
      stick.dx = dx / STICK_R; stick.dy = dy / STICK_R;
      const k = stickEl("stickknob");
      k.style.left = (stick.bx + dx) + "px"; k.style.top = (stick.by + dy) + "px";
      handled = true;
    } else if (t.identifier === lookT.id) {
      player.dir += (t.clientX - lookT.x) * 0.005;
      player.pitch -= (t.clientY - lookT.y) * 1.4;
      const lim = H * 0.6;
      player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
      lookT.x = t.clientX; lookT.y = t.clientY;
      handled = true;
    }
  }
  if (handled) e.preventDefault();
}
function onTouchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === stick.id) {
      stick.id = null; stick.dx = 0; stick.dy = 0;
      stickEl("stickbase").style.display = stickEl("stickknob").style.display = "none";
    }
    if (t.identifier === lookT.id) lookT.id = null;
  }
}
document.addEventListener("touchstart", onTouchStart, { passive: false });
document.addEventListener("touchmove", onTouchMove, { passive: false });
document.addEventListener("touchend", onTouchEnd);
document.addEventListener("touchcancel", onTouchEnd);

// wire the on-screen buttons
function bindBtn(id, onDown, onUp) {
  const el = document.getElementById(id);
  el.addEventListener("touchstart", e => { e.preventDefault(); e.stopPropagation(); onDown && onDown(); }, { passive: false });
  if (onUp) el.addEventListener("touchend", e => { e.preventDefault(); onUp(); }, { passive: false });
  // also support mouse for testing touch mode on desktop
  el.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); onDown && onDown(); });
  if (onUp) el.addEventListener("mouseup", e => { e.preventDefault(); onUp(); });
}

// ---------- UI ----------
const $ = id => document.getElementById(id);
$("startBtn").onclick = startGame;
$("retryBtn").onclick = startGame;
$("resumeBtn").onclick = resumeGame;
$("pause").addEventListener("click", e => { if (e.target.id === "pause") resumeGame(); });
function lock() { if (!touchMode && screen.requestPointerLock) screen.requestPointerLock(); }

// bind touch buttons now that helpers exist
bindBtn("btnFire", () => { mouseDown = true; tryShoot(); }, () => { mouseDown = false; });
// Aim button — touch equivalent of right-mouse. Hold to ADS (sniper enters
// scope mode), release to lower.
bindBtn("btnAim",
  () => { if (running && !paused && !gameOver && !shopOpen) aiming3d = true; },
  () => { aiming3d = false; });
bindBtn("btnReload", () => reload());
bindBtn("btnSwitch", () => cycleWeapon(1));
bindBtn("btnSprint", () => {
  touchSprint = !touchSprint;
  document.getElementById("btnSprint").classList.toggle("toggled", touchSprint);
});
bindBtn("btnShop", () => { if (shopOpen) closeShop(); else if (running && !gameOver && !paused) openShop(false); });
bindBtn("btnPause", () => {
  if (running && !gameOver && !shopOpen && !paused) {
    paused = true; document.getElementById("pause").classList.remove("hidden");
  }
});

// map selector on the start screen
const mapsel = $("mapsel");
MAPS.forEach((m, i) => {
  const card = document.createElement("div");
  card.className = "mapcard" + (i === selectedMap ? " sel" : "");
  card.textContent = m.name;
  card.onclick = () => {
    selectedMap = i;
    Array.from(mapsel.children).forEach((c, j) => c.classList.toggle("sel", j === i));
  };
  mapsel.appendChild(card);
});

// account / profile + teammate toggle on the start screen
function renderProfStats() {
  $("profstats").textContent = (profile.bestScore || profile.coins)
    ? `最佳得分 ${profile.bestScore}　·　最遠 ${profile.bestWave} 波　·　金幣存款 ${profile.coins}`
    : "新帳號 — 開始你的第一局！";
}
function applyProfileToStartUI() {
  $("allytoggle").checked = useAlly;
  renderProfStats();
}
(function initProfileUI() {
  let last = "玩家";
  try { last = localStorage.getItem("simbafps:last") || "玩家"; } catch (e) {}
  $("acct").value = last;
  loadProfile(last);
  applyProfileToStartUI();
  $("touchtoggle").checked = touchMode;   // auto-detected default
  // Reflect the current world3d pref in the start-screen checkbox.
  const w3dToggle = document.getElementById("world3dToggle");
  if (w3dToggle) w3dToggle.checked = USE_3D_WORLD;
})();
$("acct").addEventListener("change", () => { loadProfile($("acct").value); applyProfileToStartUI(); });
$("acct").addEventListener("keydown", e => { if (e.key === "Enter") $("acct").blur(); });
$("allytoggle").addEventListener("change", () => {
  useAlly = $("allytoggle").checked;
  profile.useAlly = useAlly; saveProfile();
});
$("touchtoggle").addEventListener("change", () => { touchMode = $("touchtoggle").checked; });
// Start-screen 3D toggle: writes localStorage; the value is picked up on
// the next page load. On a fresh install the checkbox reflects the pref
// we read on module init (default true).
const _w3dToggleEl = document.getElementById("world3dToggle");
if (_w3dToggleEl) {
  _w3dToggleEl.addEventListener("change", () => {
    const val = _w3dToggleEl.checked;
    try { localStorage.setItem(WORLD3D_PREF_KEY, String(val)); } catch (e) {}
    console.log("[fps][world3d] start-screen pref:", val ? "3D" : "2.5D", "— applies on next Start / reload");
  });
}
// Pause-menu 3D toggle: matches the F2 keyboard shortcut behaviour.
const _btn3d = document.getElementById("toggle3dBtn");
if (_btn3d) _btn3d.addEventListener("click", () => toggleWorld3dMode());

function startGame() {
  // If the start-screen 3D toggle changed since page load, reload so
  // world3d init picks up the new mode. The pref was already written
  // to localStorage by the checkbox handler.
  const uiPref = document.getElementById("world3dToggle")?.checked;
  if (uiPref !== undefined && uiPref !== USE_3D_WORLD) {
    console.log("[fps][world3d] start-screen pref change → reload");
    // Don't clearRun here — we WANT the current save to be restored
    // if any (or not, depending on prior state). Just reload.
    location.reload();
    return;
  }
  // === persistence: explicit new game — nuke any auto-resume blob ===
  clearRun();
  loadProfile($("acct") ? $("acct").value : profileName);   // (re)load the chosen profile
  enemies.length = 0;
  score = 0; wave = 1; kills = 0;
  coins = profile.coins || 0;                    // carry over banked coins
  loadMap(selectedMap);
  // Phase 1: rebuild 3D wall geometry to match the newly-loaded map.
  // No-op if world3d isn't ready yet or USE_3D_WORLD is false.
  if (typeof rebuildWorld3d === "function") rebuildWorld3d();
  // Phase 2: clear leftover enemy meshes from any previous run so we
  // don't leak orphaned Groups when the roster resets to empty.
  if (world3d && world3d.enemyMeshes) {
    for (const rec of world3d.enemyMeshes.values()) world3d.scene.remove(rec.group);
    world3d.enemyMeshes.clear();
  }
  const sp = MAPS[curMap].spawn;
  player.maxHp = profile.maxHp || 100;           // carry over max-HP upgrades
  player.x = sp.x; player.y = sp.y; player.dir = 0; player.pitch = 0; player.hp = player.maxHp;
  ally.hp = ally.maxHp; ally.dead = !useAlly; ally.x = sp.x; ally.y = sp.y;
  for (const w of weapons) {
    w.mag = w.magSize; w.reloading = false; w.reloadT = 0; w.cooldown = 0; w.recoil = 0;
    // Start each run with the pistol + dagger (both free). Other weapons
    // must be bought in the shop. Dagger is `melee: true` so its
    // tryShoot branch handles range/ damage without consuming ammo.
    w.owned = (w.id === "pistol" || w.id === "dagger");
  }
  curWep = 0; weapon = weapons[0];
  hurtT = 0; bossAlive = false;
  startWave();
  gameOver = false; paused = false; running = true; shopOpen = false; awaitingNextWave = false;
  $("start").classList.add("hidden");
  $("over").classList.add("hidden");
  $("pause").classList.add("hidden");
  $("shop").classList.add("hidden");
  // Reveal the (opaque) #world3d canvas — hidden by default so the start
  // screen is visible on fresh page loads and after Reset -> reload.
  document.body.classList.add("game-running");
  buildShop();
  lock();
}
function resumeGame() {
  if (gameOver) return;
  paused = false;
  $("pause").classList.add("hidden");
  lock();
}
function endGame() {
  gameOver = true; running = false;
  if (document.exitPointerLock) document.exitPointerLock();
  // Big screen shake + red flash on death so the player feels the
  // impact before the end-of-run card appears.
  _addScreenShake(0.30);
  // Big red hurt vignette boost (the existing #hurt overlay is
  // already painted at full opacity when hurtT was 0.4; this bumps
  // it to 0.6 and holds for the death moment).
  hurtT = 0.6;
  profile.totalKills = (profile.totalKills || 0) + kills;   // lifetime kills
  bankProgress();                                            // save on death
  clearRun();                                                // === persistence: fresh next launch ===
  $("final").innerHTML = `得分：${score}　·　波數：${wave}　·　擊殺：${kills}`
    + `<br><span style="font-size:14px;opacity:.8">帳號 ${profileName}　最佳得分 ${profile.bestScore}　最遠 ${profile.bestWave} 波　累計擊殺 ${profile.totalKills}</span>`
    + `<br><span style="font-size:13px;color:#7dff9a">已保存：金幣與體質升級會帶到下一局</span>`;
  $("over").classList.remove("hidden");
}

// ---------- Shop ----------
const SHOP = [
  { id: "heal50",  ico: "🧪", name: "恢復劑",   ds: "生命值 +50",
    cost: 150, can: () => player.hp < player.maxHp,
    buy: () => { player.hp = Math.min(player.maxHp, player.hp + 50); } },
  { id: "medkit",  ico: "❤️", name: "醫療包",   ds: "生命值完全補滿",
    cost: 280, can: () => player.hp < player.maxHp,
    buy: () => { player.hp = player.maxHp; } },
  { id: "ammo",    ico: "📦", name: "彈藥補給", ds: "所有已擁有武器彈匣補滿",
    cost: 120, can: () => weapons.some(w => w.owned && w.mag < w.magSize),
    buy: () => { for (const w of weapons) if (w.owned) { w.mag = w.magSize; w.reloading = false; } } },
  { id: "vitality",ico: "🛡️", name: "強化體質", ds: "最大生命 +25 並補滿",
    cost: 350, can: () => true,
    buy: () => { player.maxHp += 25; player.hp = player.maxHp; } },
  { id: "revive",  ico: "🚑", name: "復活隊友", ds: "立即讓倒下的 AI 隊友滿血歸隊",
    cost: 200, can: () => useAlly && ally.dead,
    buy: () => { reviveAlly(); } },
  // weapon purchases are generated from the arsenal (see below)
].concat(
  weapons.filter(w => w.cost).map(w => ({
    id: "w_" + w.id, ico: w.ico, name: w.name, wep: w.id,
    cost: w.cost, unlockWave: w.unlockWave || 1,
    ds: `${w.magSize} 發 · ${w.auto ? "全自動" : "半自動"}`
      + (w.pellets > 1 ? ` · 散彈×${w.pellets}` : "") + ` · 傷害 ${w.damage}`,
  }))
);

const shopGrid = $("shopgrid");
function buildShop() {
  shopGrid.innerHTML = "";
  SHOP.forEach(item => {
    const card = document.createElement("div");
    card.className = "shopcard";
    card.dataset.id = item.id;
    card.addEventListener("click", () => buyItem(item));
    shopGrid.appendChild(item._el = card);
  });
  refreshShop();
}

function refreshShop() {
  $("shopcoins").textContent = `💰 金幣：${coins}`;
  for (const item of SHOP) {
    const el = item._el; if (!el) continue;
    const owned = item.wep && weapons.find(w => w.id === item.wep).owned;
    const locked = item.unlockWave && wave < item.unlockWave;   // not available yet
    const affordable = coins >= item.cost;
    const usable = item.wep ? true : (item.can ? item.can() : true);
    let priceTxt, disabled;
    if (owned) { priceTxt = "已擁有"; disabled = true; }
    else if (locked) { priceTxt = `🔒 第 ${item.unlockWave} 波開放`; disabled = true; }
    else { priceTxt = `💰 ${item.cost}`; disabled = !affordable || !usable; }
    el.classList.toggle("ownedcard", !!owned);
    el.classList.toggle("lockedcard", !!locked && !owned);
    el.classList.toggle("disabled", disabled);
    el.innerHTML =
      `<div class="ico">${item.ico}</div>` +
      `<div class="nm">${item.name}</div>` +
      `<div class="ds">${item.ds}</div>` +
      `<div class="pr">${priceTxt}</div>`;
  }
}

let shopMsgTimer = 0;
function shopMsg(text, color) {
  const el = $("shopmsg");
  el.textContent = text;
  el.style.color = color || "#7dff9a";
}

function buyItem(item) {
  const wepDef = item.wep ? weapons.find(w => w.id === item.wep) : null;
  if (wepDef && wepDef.owned) { shopMsg("已經擁有這把武器了", "#ff9a5a"); return; }
  if (item.unlockWave && wave < item.unlockWave) { shopMsg(`此武器第 ${item.unlockWave} 波才開放`, "#ff9a5a"); return; }
  if (coins < item.cost) { shopMsg("金幣不足！", "#ff5a5a"); return; }
  if (!wepDef && item.can && !item.can()) { shopMsg("目前不需要購買", "#ff9a5a"); return; }

  coins -= item.cost;
  if (wepDef) {
    wepDef.owned = true;
    wepDef.mag = wepDef.magSize;
    wepDef.reloading = false; wepDef.reloadT = 0; wepDef.cooldown = 0;
    // auto-equip it right away (switchWeapon is blocked while the shop is open,
    // so assign directly here)
    curWep = weapons.indexOf(wepDef);
    weapon = wepDef;
    const key = curWep + 1;
    shopMsg(`已裝備 ${item.name}！(數字鍵 ${key} 或滾輪切換)`, "#7dff9a");
  } else {
    item.buy();
    shopMsg(`已購買 ${item.name}`, "#7dff9a");
  }
  bankProgress();   // persist unlock / upgrade / coin balance right away
  saveRun();        // === persistence: snapshot run right after purchase ===
  refreshShop();
}

function openShop(betweenWaves) {
  shopOpen = true;
  awaitingNextWave = !!betweenWaves;
  if (document.exitPointerLock) document.exitPointerLock();
  shopMsg(betweenWaves ? `第 ${wave - 1} 波清空！趁機補給。` : "自由採購中…", "#7dff9a");
  refreshShop();
  $("shopClose").textContent = betweenWaves ? `開始第 ${wave} 波 →` : "返回戰場 →";
  $("shop").classList.remove("hidden");
}

function closeShop() {
  if (!shopOpen) return;
  shopOpen = false;
  $("shop").classList.add("hidden");
  if (awaitingNextWave) { awaitingNextWave = false; startWave(); }
  saveRun();          // === persistence: snapshot the new wave's opening state ===
  lock();
}
$("shopClose").onclick = closeShop;

// ---------- Shooting ----------
// Project an enemy to its on-screen sprite rectangle (must match renderEnemies).
function enemyRect(e) {
  const dx = e.x - player.x, dy = e.y - player.y;
  const dist = Math.hypot(dx, dy);
  let ang = Math.atan2(dy, dx) - player.dir;
  while (ang > Math.PI) ang -= 2 * Math.PI;
  while (ang < -Math.PI) ang += 2 * Math.PI;
  if (Math.abs(ang) > FOV) return null;                 // way off to the side / behind
  const screenX = W / 2 + Math.tan(ang) * (W / 2) / Math.tan(FOV / 2);
  const size = Math.min(H * 3.6, H / dist) * (e.sizeScale || 1);
  const spriteW = size * 0.62, spriteH = size;
  // player.bob no longer contributes to horizon — camera head-bob removed.
  const horizon = HALF_H + player.pitch;
  const groundY = horizon + Math.min(H * 1.8, H / dist) / 2;
  const topY = groundY - spriteH;
  return { x0: screenX - spriteW / 2, x1: screenX + spriteW / 2, y0: topY, y1: topY + spriteH, dist };
}

function tryShoot() {
  if (!running || paused || gameOver) return;
  if (weapon.reloading || weapon.cooldown > 0) return;
  // === Melee branch (dagger) ===
  // No ammo, no bullet, no muzzle flash. Find the closest alive enemy in
  // front of the player within `weapon.range` and apply damage instantly.
  // No wall check needed because `range` is so small (1.4 units) that a
  // wall already implies the enemy is unreachable; the isWall() sample
  // at the enemy center handles the corner case where the enemy is
  // partially behind a wall.
  if (weapon.melee) {
    weapon.cooldown = weapon.fireRate;
    weapon.recoil = 1;
    if (WEAPON_3D[weapon.vm]) weapon3dFire();
    let best = null, bestDist = weapon.range;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d > weapon.range) continue;
      // Forward cone: must be roughly in front (cosine > 0.5 = 60°)
      const ang = Math.atan2(dy, dx) - player.dir;
      const cosA = Math.cos(ang);
      if (cosA < 0.5) continue;
      // Wall between player and enemy: dagger shouldn't reach through walls.
      if (wallBetween(player.x, player.y, e.x, e.y)) continue;
      if (d < bestDist) { bestDist = d; best = e; }
    }
    if (best) {
      best.hp -= weapon.damage;
      best.hurt = 0.22;
      // Damage popup
      if (!best.damagePopups) best.damagePopups = [];
      best.damagePopups.push({ value: weapon.damage, life: 0.9, maxLife: 0.9, drift: 0 });
      // Crosshair hit-flash (re-use the same UI feedback as guns)
      const ch = $("crosshair");
      if (ch) {
        ch.classList.add("hit");
        clearTimeout(ch._hitT);
        ch._hitT = setTimeout(() => ch.classList.remove("hit"), 120);
      }
      // Small hit-spark at enemy position so melee has visible feedback
      _spawnHitSpark(best.x, best.y, 6);
      if (best.hp <= 0 && !best.dead) {
        best.dead = true; best.deadT = 0;
        kills++; score += best.scoreVal; coins += best.reward;
        _bumpStreak(best.boss ? 3 : 1);
        if (best.boss) {
          bossAlive = false;
          showBanner(`🏆 首領已擊倒！獲得 ${best.reward} 金幣`);
          _spawnHitSpark(best.x, best.y, 40, { big: true });
        } else {
          _spawnHitSpark(best.x, best.y, 10);
        }
      }
    }
    return;                                                  // skip ranged pellet loop
  }
  // === Ranged branch (all guns) ===
  if (weapon.mag <= 0) { reload(); return; }
  weapon.mag--;
  weapon.cooldown = weapon.fireRate;
  weapon.recoil = 1;
  muzzleFlash();
  // === Muzzle smoke: a small grey puff that drifts forward + up from
  // the gun, fades over ~0.7s. Adds atmosphere to the gunshot.
  _spawnMuzzleSmoke();
  // === 3D weapons prototype: mirror the fire event to the 3D viewmodel ===
  if (WEAPON_3D[weapon.vm]) weapon3dFire();

  // ---------- AOE splash branch (plasma cannon and future rockets) ---------
  // Cast forward, find impact point (wall hit or max range), then damage all
  // alive enemies within splashRadius using a smooth 1-t² falloff (t is the
  // normalized 0-1 distance to impact center). Aim doesn't need to be
  // precise — the whole point is you can throw plasma at a crowd and hit
  // everyone in the blast without lining up sprite rectangles.
  if (weapon.splashRadius) {
    // Proximity fuse: if the ray passes within fuseRange of any enemy
    // it detonates there. Otherwise it flies to a wall or maxDist and
    // pops on impact. Either way we always get an explosion.
    const impact = _castRayImpact(player.x, player.y, player.dir,
                                  weapon.range,
                                  { fuseRange: weapon.fuseRange || 0 });
    _plasmaExplosion(impact.x, impact.y, weapon.splashRadius);
    const floor = weapon.splashFloor || 0;               // % damage at edge
    let hitCount = 0;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - impact.x, dy = e.y - impact.y;
      const d = Math.hypot(dx, dy);
      if (d > weapon.splashRadius) continue;
      // Wall between enemy center and impact center → no damage (blast
      // shouldn't go through walls).
      if (wallBetween(impact.x, impact.y, e.x, e.y)) continue;
      const t = d / weapon.splashRadius;                 // 0 = center, 1 = edge
      // Quadratic falloff with a soft floor: center = 1, edge = floor.
      // (1-t²)² gives a smooth bell → floor grazing hits still sting.
      const bell = (1 - t * t) * (1 - t * t);
      const falloff = bell * (1 - floor) + floor;
      const dmg = weapon.damage * falloff;
      e.hp -= dmg;
      e.hurt = 0.18;
      hitCount++;
      if (e.hp <= 0 && !e.dead) {
        e.dead = true; e.deadT = 0;
        kills++; score += e.scoreVal; coins += e.reward;
        _bumpStreak(e.boss ? 3 : 1);
        if (e.boss) { bossAlive = false; showBanner(`🏆 首領已擊倒！獲得 ${e.reward} 金幣`); _addScreenShake(0.22); }
      }
    }
    if (hitCount > 0) console.log("[fps][plasma] AOE hit", hitCount, "enemies via", impact.hit, "at", impact.x.toFixed(1), impact.y.toFixed(1));
    return;                                              // skip the pellet loop
  }

  // Each pellet checks the crosshair (screen centre, ± spread) against the
  // enemy's on-screen sprite rectangle — so you must actually aim AT the enemy
  // (both horizontally and vertically) to hit it.
  const pxPerRad = (W / 2) / Math.tan(FOV / 2);
  for (let p = 0; p < weapon.pellets; p++) {
    const aimX = W / 2 + (Math.random() - 0.5) * weapon.spread * pxPerRad;
    const aimY = H / 2 + (Math.random() - 0.5) * weapon.spread * pxPerRad;
    let best = null, bestDist = weapon.range;
    for (const e of enemies) {
      if (e.dead) continue;
      const r = enemyRect(e);
      if (!r || r.dist > weapon.range) continue;
      if (aimX < r.x0 || aimX > r.x1 || aimY < r.y0 || aimY > r.y1) continue;  // crosshair off the sprite
      if (wallBetween(player.x, player.y, e.x, e.y)) continue;
      if (r.dist < bestDist) { bestDist = r.dist; best = e; }
    }
    if (best) {
      best.hp -= weapon.damage;
      best.hurt = 0.18;
      // === Tracer: yellow streak from player to hit point. Drawn in
      // world coords (in renderWorld) so the line is occluded by walls
      // via the existing per-column z-buffer.
      _spawnTracer(player.x, player.y, best.x, best.y, 0.32);
      // === Hit-spark: bright yellow particles scatter from the hit
      // point in screen-space, fade out. Drawn after walls + enemies
      // so it sits on top of the world.
      _spawnHitSpark(best.x, best.y, 8);
      // === Damage popup: floating number above the hit enemy. Drawn
      // in drawEnemy from the enemy's `damagePopups` array.
      if (!best.damagePopups) best.damagePopups = [];
      best.damagePopups.push({ value: weapon.damage, life: 0.9, maxLife: 0.9, drift: 0 });
      // === Crosshair hit-flash: brief yellow tint on the crosshair
      // so the player gets immediate "I hit it" feedback even before
      // the damage popup drifts up.
      const ch = $("crosshair");
      if (ch) {
        ch.classList.add("hit");
        clearTimeout(ch._hitT);
        ch._hitT = setTimeout(() => ch.classList.remove("hit"), 120);
      }
      if (best.hp <= 0 && !best.dead) {
        best.dead = true; best.deadT = 0;
        kills++; score += best.scoreVal; coins += best.reward;
        _bumpStreak(best.boss ? 3 : 1);
        if (best.boss) {
          bossAlive = false;
          showBanner(`🏆 首領已擊倒！獲得 ${best.reward} 金幣`);
          // Big death burst: ~40 particles, larger + longer-lived
          _spawnHitSpark(best.x, best.y, 40, { big: true });
          _addScreenShake(0.22);
        } else {
          // Normal kill: small but visible burst
          _spawnHitSpark(best.x, best.y, 10);
          _addScreenShake(0.04);
        }
      }
    } else {
      // Miss: trace to the wall hit so the player sees where the shot went
      const impact = _castRayImpact(player.x, player.y, player.dir, weapon.range, { fuseRange: 0 });
      _spawnTracer(player.x, player.y, impact.x, impact.y, 0.18);
      // Smaller spark on wall hit so misses still feel reactive
      _spawnHitSpark(impact.x, impact.y, 3);
    }
  }
}

// Tracer pool — bright streaks from the player to each hit. Each one
// lives for ~0.3s and is drawn as a thick yellow line in world coords.
// Per-frame, life ticks down; entries with life <= 0 are pruned.
const tracers = [];
function _spawnTracer(x1, y1, x2, y2, life, color) {
  tracers.push({ x1, y1, x2, y2, life, maxLife: life, color: color || null });
}

// Hit-spark pool — bright yellow particles that scatter from the hit
// point in screen-space. Positions are world coords; the draw branch
// projects them via the same enemyRect math so they sit at the right
// depth behind walls (well, sort of — they always render on top).
// `opts.big` (boss-kill, etc.) doubles the size + speed + life so the
// death burst reads as a real explosion, not just a hit.
const sparks = [];
function _spawnHitSpark(worldX, worldY, count, opts) {
  const big = !!(opts && opts.big);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = (big ? 1.2 : 0.6) + Math.random() * (big ? 2.4 : 1.2);
    sparks.push({
      x: worldX, y: worldY,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: (big ? 0.6 : 0.28) + Math.random() * (big ? 0.4 : 0.18),
      maxLife: 1.0,                 // overwritten right after — kept for the alpha calc
      big,
      color: (opts && opts.color) || null,  // null = yellow (default)
    });
    // maxLife is a per-spark field used by the alpha calc, so set it
    // to the actual life value (not a default) so the fade is correct.
    const s = sparks[sparks.length - 1];
    s.maxLife = s.life;
  }
}

// Blood splatter — same physics as hit-sparks but darker red, more
// particles, longer-lived. Spawned on enemy hits (replaces the single
// hit-spark with a more visceral splatter) and on enemy deaths (big
// burst). Reuses the sparks array + renderer.
function _spawnBlood(worldX, worldY, count, opts) {
  const big = !!(opts && opts.big);
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = (big ? 0.8 : 0.4) + Math.random() * (big ? 1.5 : 0.7);
    sparks.push({
      x: worldX, y: worldY,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: (big ? 0.8 : 0.45) + Math.random() * (big ? 0.3 : 0.25),
      maxLife: 1.0,
      big,
      color: big ? 0xaa1818 : 0xc82828,  // dark red for big, bright red for small
    });
    const s = sparks[sparks.length - 1];
    s.maxLife = s.life;
  }
}
function _updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.86;                                // drag
    s.vy *= 0.86;
    s.life -= dt;
    if (s.life <= 0) sparks.splice(i, 1);
  }
}

function _updateTracers(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) tracers.splice(i, 1);
  }
  // Damage popups: float up over the enemy, fade out, then expire.
  // The canvas-draw branch reads `p.drift` for the upward Y offset, so
  // we accumulate it here in world-time (px = elapsed / maxLife * 50).
  for (const e of enemies) {
    if (!e.damagePopups) continue;
    for (let i = e.damagePopups.length - 1; i >= 0; i--) {
      const p = e.damagePopups[i];
      p.life -= dt;
      p.drift = (1 - p.life / p.maxLife) * 50;
      if (p.life <= 0) e.damagePopups.splice(i, 1);
    }
  }
}

// Muzzle smoke — small grey puffs that drift forward + up from the gun
// after each shot. Different physics from sparks: rises with low drag,
// and expands in size as it ages. Drawn in screen-space (same projection
// as sparks + tracers). Limited to 24 active puffs so a SMG can't flood
// the screen.
const smoke = [];
function _spawnMuzzleSmoke() {
  const muzzleX = player.x + Math.cos(player.dir) * 0.5;
  const muzzleY = player.y + Math.sin(player.dir) * 0.5;
  for (let i = 0; i < 4; i++) {
    const ang = player.dir + (Math.random() - 0.5) * 0.4;
    const spd = 0.3 + Math.random() * 0.3;
    smoke.push({
      x: muzzleX, y: muzzleY,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 0.15,           // slight upward bias
      life: 0.6 + Math.random() * 0.3,
      maxLife: 0.9,
      size: 4 + Math.random() * 2,
    });
  }
  // Cap the pool to keep frame budget reasonable
  while (smoke.length > 24) smoke.shift();
}
function _updateSmoke(dt) {
  for (let i = smoke.length - 1; i >= 0; i--) {
    const p = smoke[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;                                // light drag
    p.vy *= 0.96;
    p.vy -= 0.12 * dt;                            // gentle buoyancy
    p.life -= dt;
    p.size += dt * 8;                              // expand as it ages
    if (p.life <= 0) smoke.splice(i, 1);
  }
}

// Draw each tracer as a thick yellow streak from the gun (bottom-center
// of the screen) to the hit point, projected to screen coords the same
// way enemies are. Two passes: a wide soft glow underneath a sharper
// bright line. Only renders in 2.5D mode (3D walls are drawn on the
// world3d canvas, not the raycaster canvas).
function _drawTracers() {
  if (tracers.length === 0 || USE_3D_WORLD) return;
  const startX = W / 2;
  const startY = H * 0.92;
  const horizon = HALF_H + player.pitch;
  ctx.save();
  ctx.lineCap = "round";
  for (const t of tracers) {
    const alpha = Math.max(0, t.life / t.maxLife);
    const dx = t.x2 - player.x, dy = t.y2 - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.0001) continue;
    let ang = Math.atan2(dy, dx) - player.dir;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (Math.abs(ang) > FOV) continue;            // hit was off-screen
    const endX = W / 2 + Math.tan(ang) * (W / 2) / Math.tan(FOV / 2);
    const endY = horizon + Math.min(H * 1.8, H / dist) / 2;
    // Color: default yellow (player), green (shooter), custom (rare)
    const outer = t.color ? t.color[0] : [255, 180, 60];
    const core  = t.color ? t.color[1] : [255, 230, 120];
    // Soft outer glow
    ctx.strokeStyle = `rgba(${outer[0]}, ${outer[1]}, ${outer[2]}, ${alpha * 0.35})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    // Bright core
    ctx.strokeStyle = `rgba(${core[0]}, ${core[1]}, ${core[2]}, ${alpha * 0.95})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
  ctx.restore();
}

// Hit-spark particles — projected from world to screen coords the same
// way the tracer is. Bright orange/yellow dots with a soft glow, sized
// ~3-4px (10px glow + 4px core for boss-kill bursts via `big` flag).
// They always render in 2.5D mode (USE_3D_WORLD skips this). Sparks
// are small enough that they look fine even when the underlying
// raycaster doesn't depth-sort them against walls — the eye reads them
// as impact effect, not part of the geometry.
function _drawSparks() {
  if (sparks.length === 0 || USE_3D_WORLD) return;
  const horizon = HALF_H + player.pitch;
  ctx.save();
  for (const s of sparks) {
    const a = Math.max(0, s.life / s.maxLife);
    const dx = s.x - player.x, dy = s.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) continue;
    let ang = Math.atan2(dy, dx) - player.dir;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (Math.abs(ang) > FOV) continue;
    const sx = W / 2 + Math.tan(ang) * (W / 2) / Math.tan(FOV / 2);
    const sy = horizon + Math.min(H * 1.8, H / dist) / 2;
    const core = s.big ? 4 : 2.5;
    const glow = s.big ? 10 : 6;
    // Color: blood (red) vs hit-spark (yellow). Sparks without a color
    // use the original yellow palette; ones with a color field render
    // in that color (used by _spawnBlood for the visceral splatter).
    if (s.color) {
      const r = (s.color >> 16) & 0xff;
      const g = (s.color >> 8) & 0xff;
      const b = s.color & 0xff;
      // Glow
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a * 0.45})`;
      ctx.beginPath(); ctx.arc(sx, sy, glow, 0, 7); ctx.fill();
      // Core
      ctx.fillStyle = `rgba(${Math.min(255, r + 50)}, ${g}, ${b}, ${a})`;
      ctx.beginPath(); ctx.arc(sx, sy, core, 0, 7); ctx.fill();
    } else {
      // Soft glow (yellow)
      ctx.fillStyle = `rgba(255, 180, 50, ${a * 0.4})`;
      ctx.beginPath(); ctx.arc(sx, sy, glow, 0, 7); ctx.fill();
      // Bright core
      ctx.fillStyle = `rgba(255, 240, 160, ${a})`;
      ctx.beginPath(); ctx.arc(sx, sy, core, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

// Muzzle smoke puffs — drawn in screen-space using the same projection
// as sparks/tracers. Greyscale, semi-transparent, grows as it ages
// (size field is incremented each frame in _updateSmoke). 2.5D only.
function _drawSmoke() {
  if (smoke.length === 0 || USE_3D_WORLD) return;
  const horizon = HALF_H + player.pitch;
  ctx.save();
  for (const p of smoke) {
    const a = Math.max(0, p.life / p.maxLife);
    const dx = p.x - player.x, dy = p.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) continue;
    let ang = Math.atan2(dy, dx) - player.dir;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (Math.abs(ang) > FOV) continue;
    const sx = W / 2 + Math.tan(ang) * (W / 2) / Math.tan(FOV / 2);
    const sy = horizon + Math.min(H * 1.8, H / dist) / 2;
    // Two soft layers so the smoke reads as volume, not a flat disc
    const outer = `rgba(180, 180, 180, ${a * 0.18})`;
    const inner = `rgba(220, 220, 220, ${a * 0.30})`;
    ctx.fillStyle = outer;
    ctx.beginPath(); ctx.arc(sx, sy, p.size * 1.4, 0, 7); ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(sx, sy, p.size, 0, 7); ctx.fill();
  }
  ctx.restore();
}

function reload() {
  // Melee weapons have no mag and never reload — bail early.
  if (weapon.melee) return;
  if (!running || weapon.reloading || weapon.mag === weapon.magSize) return;
  weapon.reloading = true; weapon.reloadT = weapon.reloadTime;
}

function wallBetween(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist * 8);
  const sx = dx / steps, sy = dy / steps;
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    x += sx; y += sy;
    if (isWall(x, y)) return true;
  }
  return false;
}

// Fire-and-forget forward ray: from (x0,y0) along `dir` radians, walk until
// the first wall hit, the first PROXIMITY-FUSE trigger, or maxDist. Returns
// the impact point in grid units.
//
// Proximity fuse: at each step, if any alive enemy is within `fuseRange`
// units of the current ray position, detonate right there. This is what
// makes plasma feel like a "map cannon" — you don't need to line up the
// shot precisely; if the projectile passes anywhere near a crowd, it pops.
//
// Wall-hit returns the last cell BEFORE the wall so we don't spawn effects
// inside geometry. If no wall and no fuse trigger, the ray flies to maxDist.
function _castRayImpact(x0, y0, dir, maxDist, opts) {
  const fuseRange = (opts && opts.fuseRange) || 0;
  const cos = Math.cos(dir), sin = Math.sin(dir);
  const steps = Math.ceil(maxDist * 8);
  const step = maxDist / steps;
  const fuseR2 = fuseRange * fuseRange;
  for (let i = 1; i <= steps; i++) {
    const nx = x0 + cos * i * step;
    const ny = y0 + sin * i * step;
    if (isWall(nx, ny)) {
      const back = Math.max(0, (i - 0.5)) * step;
      return { x: x0 + cos * back, y: y0 + sin * back, hit: "wall", dist: back };
    }
    if (fuseRange > 0 && typeof enemies !== "undefined") {
      for (const e of enemies) {
        if (e.dead) continue;
        const dx2 = e.x - nx, dy2 = e.y - ny;
        if (dx2*dx2 + dy2*dy2 <= fuseR2) {
          return { x: nx, y: ny, hit: "fuse", dist: i * step };
        }
      }
    }
  }
  return { x: x0 + cos * maxDist, y: y0 + sin * maxDist, hit: "max", dist: maxDist };
}

// Plasma cannon impact FX — a two-layer bloom:
//   1. A glowing pink sphere at the impact point that expands from a
//      point out to splashRadius while fading (the "energy core").
//   2. A flat white → magenta shockwave RING around the ground that
//      races outward to the same radius (the "blast wave") so the
//      player has a visual anchor for how far the damage reaches.
// Uses requestAnimationFrame so it can self-terminate without touching
// any per-frame update slot.
// === Kill streak helper ===
// Bumps the kill streak and triggers a banner when crossing
// thresholds. Boss kills count as a +3 streak bonus so a boss kill
// during a streak feels punchy. Returns the new streak count.
const STREAK_LABELS = {
  2: "🔥 雙殺!",
  3: "🔥🔥 三殺!",
  4: "💀 四殺!",
  5: "⚡ 五殺!",
  6: "🌟 神一般!",
};
function _bumpStreak(amount) {
  const now = performance.now() / 1000;
  if (now - lastKillT < STREAK_WINDOW_S) {
    killStreak += amount;
  } else {
    killStreak = amount;
  }
  lastKillT = now;
  const label = STREAK_LABELS[killStreak];
  if (label) {
    showBanner(label);
    _addScreenShake(0.06);
  }
  return killStreak;
}

function _plasmaExplosion(gridX, gridY, radius) {
  // ----- 1) Energy core sphere -----
  const coreGeo = new THREE.SphereGeometry(1, 20, 14);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xff40cf, transparent: true, opacity: 0.55,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.set(gridX, 0.6, gridY);
  world3d.scene.add(core);
  // ----- 2) Shockwave ring on the ground plane -----
  // Start ring with inner=0.01, outer=0.02 (invisible) and grow both
  // together so the ring stays thin as it expands.
  const ringGeo = new THREE.RingGeometry(0.01, 0.02, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;  // lay flat
  ring.position.set(gridX, 0.02, gridY);  // just above the floor
  world3d.scene.add(ring);
  const start = performance.now();
  const DURATION = 420;  // ms — a bit longer than before to sell the range
  function _tick() {
    const t = Math.min(1, (performance.now() - start) / DURATION);
    // Core sphere: scale from ~0 to radius, fade out with a slight
    // easing so it looks like a fireball, not a linear balloon.
    const coreT = 1 - (1 - t) * (1 - t);
    core.scale.setScalar(0.05 + coreT * radius);
    core.material.opacity = 0.55 * (1 - t) * (1 - t);
    // Ring: scale outward faster (the leading edge should reach the
    // damage boundary near the end of the animation). Color shifts
    // white → magenta so the leading edge and trailing edge read
    // differently.
    const ringT = Math.min(1, t * 1.05);
    ring.scale.setScalar(0.05 + ringT * radius);
    ring.material.opacity = 0.85 * (1 - ringT * 0.9);
    ring.material.color.setRGB(1, 0.4 + (1 - ringT) * 0.6, 1);
    if (t >= 1) {
      world3d.scene.remove(core);
      world3d.scene.remove(ring);
      coreGeo.dispose(); coreMat.dispose();
      ringGeo.dispose(); ringMat.dispose();
      return;
    }
    requestAnimationFrame(_tick);
  }
  requestAnimationFrame(_tick);
}

function muzzleFlash() {
  const f = $("flash");
  f.style.opacity = "0.9";
  setTimeout(() => { f.style.opacity = "0"; }, 55);
}

// Boss-spawn red flash — a different gradient + a slow fade so the
// player FEELS the boss appear. Reuses the same #flash element with
// an inline background override + longer hold.
function _bossSpawnFlash() {
  const f = $("flash");
  f.style.background = "radial-gradient(circle at 50% 50%, rgba(180,30,30,0.0) 0%, rgba(180,30,30,0.6) 60%, rgba(60,0,0,0.85) 100%)";
  f.style.opacity = "1";
  // Two-stage fade: quick drop to 0.4, then slow drop to 0.
  setTimeout(() => { f.style.opacity = "0.4"; }, 120);
  setTimeout(() => { f.style.opacity = "0"; }, 700);
  // Restore the default muzzle-flash background so the next shot uses
  // the warm yellow gradient as intended.
  setTimeout(() => { f.style.background = ""; }, 750);
}

let bannerTimer = null;
function showBanner(text) {
  const b = $("banner");
  b.textContent = text;
  b.classList.add("show");
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove("show"), 2600);
}

// ---------- AI teammate ----------
function updateAlly(dt) {
  if (ally.hurt > 0) ally.hurt -= dt;
  if (ally.muzzle > 0) ally.muzzle -= dt;
  if (ally.dead) { ally.deadT += dt; return; }
  if (ally.fireCd > 0) ally.fireCd -= dt;
  ally.dist = Math.hypot(player.x - ally.x, player.y - ally.y);

  // nearest visible enemy within range
  let target = null, best = ally.range;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - ally.x, e.y - ally.y);
    if (d < best && !wallBetween(ally.x, ally.y, e.x, e.y)) { best = d; target = e; }
  }

  // aim at the target, else look toward the player
  ally.dir = target
    ? Math.atan2(target.y - ally.y, target.x - ally.x)
    : Math.atan2(player.y - ally.y, player.x - ally.x);

  // shoot
  if (target && ally.fireCd <= 0) {
    ally.fireCd = ally.fireRate;
    ally.muzzle = 0.12;
    target.hp -= ally.damage;
    target.hurt = 0.18;
    if (target.hp <= 0 && !target.dead) {
      target.dead = true; target.deadT = 0;
      kills++; score += target.scoreVal; coins += Math.round(target.reward * 0.6);
      if (target.boss) { bossAlive = false; showBanner("🏆 隊友擊倒了首領！"); }
    }
  }

  // movement: regroup toward player, but keep spacing from enemies
  let mx = 0, my = 0;
  if (ally.dist > 3.2) {
    mx = (player.x - ally.x) / ally.dist; my = (player.y - ally.y) / ally.dist;
  } else if (target && best < 2.2) {
    mx = (ally.x - target.x) / best; my = (ally.y - target.y) / best;
  }
  const ml = Math.hypot(mx, my);
  if (ml > 0) {
    const step = ally.speed * dt;
    mx = mx / ml * step; my = my / ml * step;
    const buf = 0.16;
    if (!isWall(ally.x + mx + Math.sign(mx) * buf, ally.y)) ally.x += mx;
    if (!isWall(ally.x, ally.y + my + Math.sign(my) * buf)) ally.y += my;
  }
}

// place the ally next to the player on a free tile and heal to full
function reviveAlly() {
  if (!useAlly) { ally.dead = true; return; }   // teammate disabled this run
  ally.dead = false; ally.deadT = 0; ally.hp = ally.maxHp;
  ally.fireCd = 0; ally.hurt = 0;
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
  for (const [ox, oy] of spots) {
    if (!isWall(player.x + ox, player.y + oy)) { ally.x = player.x + ox; ally.y = player.y + oy; break; }
  }
}

// ---------- Update ----------
function update(dt) {
  // Jump physics — integrate vertical velocity + gravity, clamp to ground.
  // Air control (WASD movement in-flight) is a natural consequence of the
  // movement block below not gating on `jumping`.
  if (jumping || playerZ > 0) {
    playerVelZ -= GRAVITY * dt;
    playerZ += playerVelZ * dt;
    if (playerZ <= 0) {
      playerZ = 0;
      playerVelZ = 0;
      jumping = false;
    }
  }
  // === persistence: enemy-AI grace period after auto-resume ===
  // For ~1.2s after a page-refresh restore, enemies stop moving/attacking
  // so the player isn't ambushed the instant they unpause.
  if (resumeSafetyT > 0) resumeSafetyT -= dt;
  if (weapon.cooldown > 0) weapon.cooldown -= dt;
  if (weapon.recoil > 0) weapon.recoil = Math.max(0, weapon.recoil - dt * 6);
  if (weapon.reloading) {
    weapon.reloadT -= dt;
    if (weapon.reloadT <= 0) { weapon.reloading = false; weapon.mag = weapon.magSize; }
  }
  if (hurtT > 0) hurtT -= dt;
  if (mouseDown && weapon.auto) tryShoot();

  // Movement — combine keyboard and touch joystick into forward/strafe scalars.
  // Complete case-based speed matrix (user-specified, tactical FPS feel):
  //   pure W           1.0x  sprint OK
  //   W + A / W + D    1.0x  sprint OK   ← diagonal-forward DOES sprint
  //   pure S           0.5x  sprint NO
  //   S + A / S + D    0.7x  sprint NO   ← strafe wins over backward
  //   pure A / D       0.7x  sprint NO
  //   (no input)       -                 ← gated by `if (mlen > 0)`
  // Sprint rule: fwd > 0 (any forward component allows sprint).
  const BACKWARD_MULT = 0.5;
  const STRAFE_MULT   = 0.7;
  const sprinting = keys["ShiftLeft"] || keys["ShiftRight"] || touchSprint;
  const cos = Math.cos(player.dir), sin = Math.sin(player.dir);
  let fwd = 0, strafe = 0;
  if (keys["KeyW"]) fwd += 1;
  if (keys["KeyS"]) fwd -= 1;
  if (keys["KeyD"]) strafe += 1;
  if (keys["KeyA"]) strafe -= 1;
  if (stick.id !== null) { fwd += -stick.dy; strafe += stick.dx; }   // joystick: up = forward
  // Case-based mult + sprint gate. Handles joystick float values, not just
  // ±1 (isFwd = fwd > 0, isBack = fwd < 0, isStrafe = strafe !== 0).
  const isFwd    = fwd > 0;
  const isBack   = fwd < 0;
  const isStrafe = strafe !== 0;
  let mult = 0, allowSprint = false;                              // no-input default
  if      (isFwd  && !isStrafe) { mult = 1.0;           allowSprint = true;  }  // pure W
  else if (isFwd  &&  isStrafe) { mult = 1.0;           allowSprint = true;  }  // W+A / W+D (sprint OK)
  else if (isBack && !isStrafe) { mult = BACKWARD_MULT; allowSprint = false; }  // pure S
  else if (isBack &&  isStrafe) { mult = STRAFE_MULT;   allowSprint = false; }  // S+A / S+D (strafe wins over backward)
  else if (             isStrafe) { mult = STRAFE_MULT; allowSprint = false; }  // pure A / D
  // Sniper scope walk penalty — locks you to a slow crouch-crawl while
  // aiming so the reticle isn't yanked around at running speed.
  // Sniper scope 0.4×, laser holo sight 0.7× (lighter penalty for the
  // mid-zoom sci-fi sight), everything else 1×.
  const scopedFactor = _isScoped() ? 0.4 : (_isLaserScoped() ? 0.7 : 1);
  const spd = ((sprinting && allowSprint) ? player.sprint : player.speed) * dt * scopedFactor;
  let mvx = cos * fwd - sin * strafe;
  let mvy = sin * fwd + cos * strafe;
  const mlen = Math.hypot(mvx, mvy);
  if (mlen > 0) {
    mvx = mvx / mlen * spd * mult; mvy = mvy / mlen * spd * mult;
    const buf = 0.18;
    if (!isWall(player.x + mvx + Math.sign(mvx) * buf, player.y)) player.x += mvx;
    if (!isWall(player.x, player.y + mvy + Math.sign(mvy) * buf)) player.y += mvy;
    player.bob += (mlen / spd) * mlen * 0 + Math.hypot(mvx, mvy) * 60;
  }

  updateAlly(dt);

  // Enemies — each targets the nearest visible member of the team (player or ally)
  for (const e of enemies) {
    if (e.dead) { e.deadT += dt; continue; }
    if (e.hurt > 0) e.hurt -= dt;
    if (e.muzzle > 0) e.muzzle -= dt;
    e.dist = Math.hypot(player.x - e.x, player.y - e.y);

    // boss enrages below 40% HP: faster, hits more often
    if (e.boss && !e.enraged && e.hp < e.maxHp * 0.4) {
      // First-time enrage — fire a one-shot banner + screen shake so
      // the player feels the boss level up its aggression.
      e.enraged = true;
      showBanner("🔥 首領狂暴！");
      _addScreenShake(0.12);
    } else if (e.boss) {
      e.enraged = e.hp < e.maxHp * 0.4;
    }

    // pick target
    const dPlayer = e.dist;
    const dAlly = ally.dead ? Infinity : Math.hypot(ally.x - e.x, ally.y - e.y);
    let tgt = player, tdist = dPlayer;
    if (dAlly < dPlayer) { tgt = ally; tdist = dAlly; }
    const tx = tgt.x - e.x, ty = tgt.y - e.y;

    const reach = e.reach || 1.1;
    const sees = !wallBetween(e.x, e.y, tgt.x, tgt.y);

    // === RANGED AI (shooter) — keep distance, fire from optimal range ===
    if (e.ranged) {
      const ENGAGE_MIN = 3.5, ENGAGE_MAX = 7.5;
      if (sees && resumeSafetyT <= 0) {
        if (tdist > ENGAGE_MAX) {
          // approach target
          const step = e.speed * dt;
          const nx = tx / tdist * step, ny = ty / tdist * step;
          if (!isWall(e.x + nx, e.y)) e.x += nx;
          if (!isWall(e.x, e.y + ny)) e.y += ny;
        } else if (tdist < ENGAGE_MIN) {
          // retreat (back away from target)
          const step = e.speed * dt;
          const nx = -tx / tdist * step, ny = -ty / tdist * step;
          if (!isWall(e.x + nx, e.y)) e.x += nx;
          if (!isWall(e.x, e.y + ny)) e.y += ny;
        }
        // strafe sideways while in band (small wobble so the player has to lead)
        if (tdist >= ENGAGE_MIN && tdist <= ENGAGE_MAX) {
          const strafeDir = ((e.x * 7 + e.y * 13) | 0) % 2 === 0 ? 1 : -1;   // cheap per-enemy sign
          const px = -ty / tdist, py = tx / tdist;          // perpendicular to target
          const step = e.speed * 0.4 * dt;
          const nx = px * step * strafeDir, ny = py * step * strafeDir;
          if (!isWall(e.x + nx, e.y)) e.x += nx;
          if (!isWall(e.x, e.y + ny)) e.y += ny;
        }
      }
      if (e.attackCd > 0) e.attackCd -= dt;
      if (sees && tdist >= ENGAGE_MIN && tdist <= ENGAGE_MAX &&
          e.attackCd <= 0 && resumeSafetyT <= 0) {
        e.attackCd = 1.7;                  // ~0.6 shots/sec
        e.muzzle = 0.18;                   // visual flash, consumed by drawEnemy
        // === Shooter tracer ===
        // Green tracer line from the shooter to the target so the
        // player can see WHERE the shot came from. Mirrors the
        // player-side yellow tracer in tryShoot but with a shorter
        // lifetime + green color (matches the shooter's scope lens).
        _spawnTracer(e.x, e.y, tgt.x, tgt.y, 0.22, [[100, 230, 130], [180, 255, 200]]);
        if (tgt === player) {
          player.hp -= e.dmg;
          hurtT = 0.3;
          // Record damage direction (where the attacker IS, in world coords).
          // Used by the damage-direction indicator to draw a red arrow.
          lastHurtDir = Math.atan2(e.y - player.y, e.x - player.x);
          lastHurtT = 0.4;
          if (player.hp <= 0) { player.hp = 0; endGame(); return; }
        } else {
          ally.hp -= e.dmg;
          ally.hurt = 0.2;
          if (ally.hp <= 0 && !ally.dead) {
            ally.hp = 0; ally.dead = true; ally.deadT = 0;
            showBanner("⚠ 隊友倒下了！可在商店復活");
          }
        }
      }
      continue;   // ranged: skip the melee branch
    }

    // === MELEE AI (existing) ===
    // === persistence: freeze enemy movement during resume-safety grace ===
    if (sees && tdist > reach - 0.2 && resumeSafetyT <= 0) {
      const step = e.speed * (e.enraged ? 1.5 : 1) * dt;
      const nx = tx / tdist * step, ny = ty / tdist * step;
      if (!isWall(e.x + nx, e.y)) e.x += nx;
      if (!isWall(e.x, e.y + ny)) e.y += ny;
    }
    if (e.attackCd > 0) e.attackCd -= dt;
    // === Charger "lunge" ===
    // The charger is fast and gets a visible sudden-pounce when it
    // crosses into striking range. e.lungeT starts at 0.35, decays
    // each frame in _syncEnemyMeshes, and during the visible window
    // the body's Z scale is bumped so the silhouette stretches forward.
    if (e.kind === "charger" && tdist < reach + 0.4 && tdist > reach - 0.6
        && e.attackCd <= 0 && e.lungeT === undefined) {
      e.lungeT = 0.35;
      _addScreenShake(0.05);
    }
    // === persistence: no attacks during the grace period either ===
    if (tdist < reach && sees && e.attackCd <= 0 && resumeSafetyT <= 0) {
      e.attackCd = (e.boss ? 1.2 : 0.9) * (e.enraged ? 0.55 : 1) * (e.kind === "charger" ? 0.7 : 1);
      if (tgt === player) {
        player.hp -= e.dmg;
        hurtT = 0.4;
        if (player.hp <= 0) { player.hp = 0; endGame(); return; }
      } else {
        ally.hp -= e.dmg;
        ally.hurt = 0.2;
        if (ally.hp <= 0 && !ally.dead) {
          ally.hp = 0; ally.dead = true; ally.deadT = 0;
          showBanner("⚠ 隊友倒下了！可在商店復活");
        }
      }
    }
  }

  // remove finished corpses
  for (let i = enemies.length - 1; i >= 0; i--)
    if (enemies[i].dead && enemies[i].deadT > 1.2) enemies.splice(i, 1);

  // arena cleared -> reward, then open the shop before the next wave
  if (enemies.length === 0) {
    wave++;
    score += 250;
    coins += 80 + wave * 20;                       // wave-clear bonus
    player.hp = Math.min(player.maxHp, player.hp + 20);
    // === Wave-clear celebration: shake + extended-duration banner.
    // Small shake so the shop opening doesn't jar the player.
    _addScreenShake(0.08);
    showBanner(`✓ 第 ${wave - 1} 波清空！金幣 +${80 + (wave - 1) * 20} · 生命 +20`);
    // Reset streak at wave boundary so it doesn't carry over.
    killStreak = 0;
    bankProgress();                                // auto-save between waves
    saveRun();                                     // === persistence: snapshot wave transition ===
    openShop(true);
  }
}

// ---------- Render: walls (raycasting DDA) ----------
const zbuffer = new Float32Array(8192);
function renderWorld() {
  // Phase 2: when USE_3D_WORLD is on, world3d covers the whole viewport
  // (walls + floor + ceiling as textured Three.js meshes). Skip the 2D
  // floor/ceiling gradient AND the wall paint below — but keep the DDA
  // march running so zbuffer[] remains populated for any consumer that
  // still peeks at it (belt-and-braces; enemies no longer use it).
  if (USE_3D_WORLD) {
    // clear the 2D canvas to fully transparent so nothing beneath is
    // painted (world3d canvas covers it, but be explicit).
    ctx.clearRect(0, 0, W, H);
  }
  // Camera head-bob during movement removed per user request (motion-
  // comfort). player.bob is still accumulated by the movement code
  // so the weapon viewmodel bob keeps its animated value.
  const horizon = HALF_H + player.pitch;                 // vertical look shifts the horizon
  const hz = Math.max(1, Math.min(H - 1, horizon));   // clamp only for gradient endpoints
  const top = Math.max(0, horizon);

  if (!USE_3D_WORLD) {
  const g1 = ctx.createLinearGradient(0, 0, 0, hz);
  g1.addColorStop(0, "#0b0f1a"); g1.addColorStop(1, "#20293b");
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, top);
  const g2 = ctx.createLinearGradient(0, hz, 0, H);
  g2.addColorStop(0, "#2a2118"); g2.addColorStop(1, "#0a0806");
  ctx.fillStyle = g2; ctx.fillRect(0, top, W, H - top);
  }   // end of !USE_3D_WORLD 2D floor/ceiling gradient guard

  const startAng = player.dir - FOV / 2;
  const step = FOV / NUM_RAYS;

  for (let i = 0; i < NUM_RAYS; i++) {
    const rayAng = startAng + i * step;
    const cos = Math.cos(rayAng), sin = Math.sin(rayAng);
    let mapX = Math.floor(player.x), mapY = Math.floor(player.y);
    const deltaX = Math.abs(1 / (cos || 1e-9)), deltaY = Math.abs(1 / (sin || 1e-9));
    let stepX, stepY, sideX, sideY;
    if (cos < 0) { stepX = -1; sideX = (player.x - mapX) * deltaX; }
    else { stepX = 1; sideX = (mapX + 1 - player.x) * deltaX; }
    if (sin < 0) { stepY = -1; sideY = (player.y - mapY) * deltaY; }
    else { stepY = 1; sideY = (mapY + 1 - player.y) * deltaY; }

    // Guard the march by step count, NOT by sideX/sideY: those are per-axis
    // crossing distances and spike huge for near-axis-aligned rays, which
    // would bail the march out early and punch holes in distant walls.
    // A straight ray crosses at most (W+H) cells before reaching a border wall.
    let hit = false, side = 0;
    const maxSteps = (MAP_W + MAP_H) * 2 + 4;
    for (let s = 0; !hit && s < maxSteps; s++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else { sideY += deltaY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) break;
      if (MAP[mapY][mapX] === 1) hit = true;
    }
    if (!hit) { zbuffer[i] = MAX_DEPTH; continue; }

    let perp = side === 0
      ? (mapX - player.x + (1 - stepX) / 2) / (cos || 1e-9)
      : (mapY - player.y + (1 - stepY) / 2) / (sin || 1e-9);
    const corrected = Math.abs(perp) * Math.cos(rayAng - player.dir);
    if (corrected <= 0.0001) { zbuffer[i] = 0.0001; continue; }
    zbuffer[i] = corrected;

    const lineH = Math.min(H * 3, H / corrected);
    const y0 = horizon - lineH / 2;

    const shade = Math.max(0.09, 1 - corrected / 16) * (side === 1 ? 0.72 : 1);
    let wallHit = side === 0 ? player.y + perp * sin : player.x + perp * cos;
    wallHit -= Math.floor(wallHit);
    const band = (Math.floor(wallHit * 6) % 2 === 0) ? 1 : 0.86;

    // Phase 1: 3D walls in world3d overlay render on top of everything on
    // this 2D canvas. Skip the 2D wall paint to save overdraw. The DDA
    // above still runs so `zbuffer` is populated for renderEnemies to
    // use for its per-column occlusion of 2D billboards.
    if (USE_3D_WORLD) continue;
    const sh = shade * band;
    ctx.fillStyle = `rgb(${(wallRGB[0]*sh)|0},${(wallRGB[1]*sh)|0},${(wallRGB[2]*sh)|0})`;
    ctx.fillRect(i * COL_W, y0, COL_W + 1, lineH);
    ctx.fillStyle = `rgba(0,0,0,${0.18 * shade})`;
    ctx.fillRect(i * COL_W, y0 + lineH * 0.5, COL_W + 1, Math.max(1, lineH * 0.02));
  }
}

// ---------- Render: enemies + ally (billboards) ----------
function renderEnemies() {
  // Phase 2: enemies now render as 3D humanoid meshes inside world3d.
  // Skip the 2D billboard pass entirely when the 3D world is active.
  if (USE_3D_WORLD) return;
  const horizon = HALF_H + player.pitch;                 // camera head-bob removed
  const sprites = enemies.slice();
  // === 3D world entities: when the 3D layer is active, the teammate is drawn
  // by renderWorld3d() as a full mesh — skip the 2D billboard so we don't
  // double-render. If the 3D path failed (WebGL disabled, THREE missing) the
  // 2D billboard still shows as a fallback. ===
  const ally3dActive = ENABLE_3D_ENTITIES && world3d.ready && !world3d.disabled;
  if (!ally.dead && !ally3dActive) sprites.push(ally);          // the ally renders as a friendly billboard
  const sorted = sprites.sort((a, b) => b.dist - a.dist);
  for (const e of sorted) {
    const dx = e.x - player.x, dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    e.dist = dist;
    if (dist < 0.2) continue;
    let ang = Math.atan2(dy, dx) - player.dir;
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    if (Math.abs(ang) > FOV / 2 + 0.4) continue;

    const screenX = W / 2 + Math.tan(ang) * (W / 2) / Math.tan(FOV / 2);
    const size = Math.min(H * 3.6, H / dist) * (e.sizeScale || 1);
    const spriteH = size * (e.dead ? 0.5 : 1);
    const spriteW = size * 0.62;
    // keep the enemy's feet on the ground regardless of size scale
    const groundY = horizon + Math.min(H * 1.8, H / dist) / 2;
    const topY = groundY - spriteH;

    // Per-column occlusion: draw the sprite only in the screen columns where the
    // enemy is actually nearer than the wall. Compare the enemy's perpendicular
    // distance to the fisheye-corrected wall depth in the z-buffer.
    const perpDist = dist * Math.cos(ang);
    const c0 = Math.max(0, Math.floor((screenX - spriteW / 2) / COL_W));
    const c1 = Math.min(NUM_RAYS - 1, Math.ceil((screenX + spriteW / 2) / COL_W));
    let runStart = -1;
    for (let c = c0; c <= c1 + 1; c++) {
      const vis = c <= c1 && perpDist < zbuffer[c] + 0.05;
      if (vis && runStart < 0) {
        runStart = c;                       // begin a visible span
      } else if (!vis && runStart >= 0) {
        ctx.save();                         // draw the sprite clipped to this span
        ctx.beginPath();
        ctx.rect(runStart * COL_W, 0, (c - runStart) * COL_W, H);
        ctx.clip();
        drawEnemy(screenX, topY, spriteW, spriteH, e);
        ctx.restore();
        runStart = -1;
      }
    }
  }
}

function drawEnemy(cx, top, w, h, e) {
  ctx.save();
  if (e.dead) ctx.globalAlpha = Math.max(0, 1 - e.deadT / 1.2);
  const flash = e.hurt > 0;

  // === SPRITE PATH ===
  // If we have a pre-keyed PNG for this enemy's kind, draw it instead of
  // the hand-rolled geometric body. The 1024x1024 sprite is foot-anchored
  // to the same groundY the geometric path used (top + h), and scaled to
  // the enemy height. Per-column occlusion in renderEnemies() already
  // clipped the canvas to a visible span, so drawImage just paints.
  // Old enemies without a `kind` field (e.g. from a saved run) fall back
  // to "grunt" so they don't render as the default geometric blob.
  const spriteKind = e.friendly ? "grunt" : (e.kind || (e.boss ? "boss" : "grunt"));
  const spriteImg  = enemyImages[spriteKind];
  if (spriteImg) {
    // Image is 1024x1024 (square). Scale to enemy height so the silhouette
    // matches what the geometric version used to occupy. Trim a sliver off
    // top + bottom of the source image (headFrac / footFrac) so the head
    // doesn't crowd the health bar and the feet don't clip below the
    // ground shadow.
    const HEAD_FRAC = 0.06, FOOT_FRAC = 0.97;
    const srcW = spriteImg.width, srcH = spriteImg.height;
    const usableFrac = FOOT_FRAC - HEAD_FRAC;
    const drawH = h * 1.05;                         // a touch taller than the geo sprite
    const drawW = drawH;                            // square aspect
    const srcCropH = srcH * usableFrac;
    const drawSrcH = srcH;
    // srcRect: top-left + size of the slice we want
    const sy = srcH * HEAD_FRAC;
    const sx = (srcW - srcW * usableFrac) / 2;      // also crop sides if the image has horizontal padding
    const sw = srcW * usableFrac;
    const sh = srcH * usableFrac;
    // dstRect: where on the game canvas the sprite lands (foot at top + h)
    const dx = cx - drawW / 2;
    const dy = top + h - drawH;
    // Hurt flash: draw sprite first, then a translucent white overlay
    ctx.drawImage(spriteImg, sx, sy, sw, sh, dx, dy, drawW, drawH);
    if (flash) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(dx, dy, drawW, drawH);
    }
    // Shooter muzzle flash — small green dot near the rifle scope area
    if (e.muzzle > 0 && e.ranged) {
      const a = e.muzzle / 0.18;
      ctx.fillStyle = `rgba(120,255,140,${a})`;
      ctx.beginPath();
      ctx.arc(cx + w * 0.18, top + h * 0.36, 5 + 6 * a, 0, 7);
      ctx.fill();
    }
    // "友" tag above the ally (kept even though 3D world owns the ally)
    if (e.friendly) {
      ctx.fillStyle = "#6cf0ff"; ctx.font = `bold ${Math.max(10, w * 0.22) | 0}px Courier New`;
      ctx.textAlign = "center"; ctx.fillText("友", cx, top - h * 0.05);
    }
    // health bar (same as geometric path)
    if (e.boss || e.friendly || e.hp < e.maxHp) {
      const bw = w * (e.boss ? 0.9 : 0.72), bx = cx - bw / 2, by = top - h * (e.boss ? 0.05 : 0.02);
      const bh = h * (e.boss ? 0.045 : 0.028);
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = e.friendly ? "#4dd0ff" : e.boss ? "#ff4bd0" : "#4dff6a";
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
    }
    // === Damage popups: yellow numbers floating up over the enemy.
    // Each popup drifts upward via its `drift` value (set in the
    // per-frame update) and fades out as life ticks down.
    if (e.damagePopups && e.damagePopups.length) {
      ctx.textAlign = "center";
      for (const p of e.damagePopups) {
        const a = Math.max(0, p.life / p.maxLife);
        const fontSize = Math.max(11, w * 0.10) | 0;
        ctx.font = `bold ${fontSize}px Courier New`;
        const py = top - h * 0.05 - p.drift;
        ctx.fillStyle = `rgba(0,0,0,${a * 0.7})`;
        ctx.fillText("-" + p.value, cx + 1, py + 1);
        ctx.fillStyle = `rgba(255,230,80,${a})`;
        ctx.fillText("-" + p.value, cx, py);
      }
    }
    ctx.restore();
    return;
  }

  // per-type colour palette (base / dark / light / trim / eye-glow)
  let base, dark, lite, trim, eye;
  if (e.friendly) { base = "#33935e"; dark = "#123a24"; lite = "#63d68c"; trim = "#6cf0ff"; eye = "#8ff4ff"; }
  else if (e.boss) { base = "#7c37a2"; dark = "#26123c"; lite = "#b473db"; trim = "#ffcf3b"; eye = "#ffd12b"; }
  else { base = "#8f3232"; dark = "#3a1414"; lite = "#c25c5c"; trim = "#e59a9a"; eye = "#ff4b4b"; }
  if (flash) { base = "#ffffff"; dark = "#ffc2c2"; lite = "#ffffff"; }
  const detailed = w > 40;   // skip the costliest touches on small/distant sprites

  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,.38)";
  ctx.beginPath(); ctx.ellipse(cx, top + h, w * 0.42, h * 0.05, 0, 0, 7); ctx.fill();

  // ---- legs + boots ----
  const legTop = top + h * 0.58, legBot = top + h * 0.96, legW = w * 0.15;
  ctx.fillStyle = dark;
  roundRect(ctx, cx - w * 0.19, legTop, legW, legBot - legTop, legW * 0.45); ctx.fill();
  roundRect(ctx, cx + w * 0.04, legTop, legW, legBot - legTop, legW * 0.45); ctx.fill();
  ctx.fillStyle = "#0c0c0e";
  roundRect(ctx, cx - w * 0.22, legBot - h * 0.03, legW * 1.3, h * 0.035, 3); ctx.fill();
  roundRect(ctx, cx + w * 0.01, legBot - h * 0.03, legW * 1.3, h * 0.035, 3); ctx.fill();

  // ---- arms behind torso + fists ----
  ctx.fillStyle = base;
  roundRect(ctx, cx - w * 0.41, top + h * 0.31, w * 0.14, h * 0.30, w * 0.06); ctx.fill();
  roundRect(ctx, cx + w * 0.27, top + h * 0.31, w * 0.14, h * 0.30, w * 0.06); ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(cx - w * 0.34, top + h * 0.61, w * 0.09, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w * 0.34, top + h * 0.61, w * 0.09, 0, 7); ctx.fill();

  // ---- torso with chest plate + belt ----
  const tW = w * 0.54, tX = cx - tW / 2, tTop = top + h * 0.30, tBot = top + h * 0.62;
  if (detailed) {
    const g = ctx.createLinearGradient(0, tTop, 0, tBot);
    g.addColorStop(0, lite); g.addColorStop(0.5, base); g.addColorStop(1, dark);
    ctx.fillStyle = g;
  } else ctx.fillStyle = base;
  roundRect(ctx, tX, tTop, tW, tBot - tTop, w * 0.12); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.10)";                       // chest plate highlight
  roundRect(ctx, cx - tW * 0.32, tTop + h * 0.03, tW * 0.64, h * 0.13, w * 0.05); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = Math.max(1, w * 0.02);  // center seam
  ctx.beginPath(); ctx.moveTo(cx, tTop + h * 0.02); ctx.lineTo(cx, tBot - h * 0.02); ctx.stroke();
  ctx.fillStyle = dark;                                          // belt
  roundRect(ctx, tX, tBot - h * 0.05, tW, h * 0.05, w * 0.03); ctx.fill();
  ctx.fillStyle = trim;                                          // buckle
  roundRect(ctx, cx - w * 0.05, tBot - h * 0.045, w * 0.10, h * 0.038, 2); ctx.fill();

  // ---- shoulder pauldrons ----
  ctx.fillStyle = lite;
  ctx.beginPath(); ctx.arc(tX + w * 0.02, tTop + h * 0.015, w * 0.13, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(tX + tW - w * 0.02, tTop + h * 0.015, w * 0.13, 0, 7); ctx.fill();

  // ---- ally rifle (drawn across the chest) ----
  if (e.friendly && !e.dead) {
    ctx.fillStyle = "#1a1a1e";
    roundRect(ctx, cx - w * 0.06, top + h * 0.44, w * 0.44, h * 0.045, 2); ctx.fill();
    if (e.muzzle > 0) {
      ctx.fillStyle = `rgba(255,230,140,${e.muzzle / 0.12})`;
      ctx.beginPath(); ctx.arc(cx + w * 0.40, top + h * 0.462, w * 0.11, 0, 7); ctx.fill();
    }
  }

  // ---- neck ----
  ctx.fillStyle = dark;
  roundRect(ctx, cx - w * 0.07, top + h * 0.24, w * 0.14, h * 0.08, w * 0.03); ctx.fill();

  // ---- head ----
  const hCX = cx, hCY = top + h * 0.16, hr = w * 0.19;
  if (detailed) {
    const hg = ctx.createRadialGradient(hCX - hr * 0.35, hCY - hr * 0.35, hr * 0.2, hCX, hCY, hr);
    hg.addColorStop(0, lite); hg.addColorStop(1, base);
    ctx.fillStyle = hg;
  } else ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(hCX, hCY, hr, 0, 7); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.28)";                            // brow ridge
  roundRect(ctx, hCX - hr * 0.82, hCY - hr * 0.12, hr * 1.64, hr * 0.32, hr * 0.14); ctx.fill();

  // boss curved horns
  if (e.boss && !e.dead) {
    ctx.fillStyle = flash ? "#fff" : trim;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hCX + s * hr * 0.7, hCY - hr * 0.45);
      ctx.quadraticCurveTo(hCX + s * hr * 1.7, hCY - hr * 1.7, hCX + s * hr * 0.55, hCY - hr * 1.95);
      ctx.quadraticCurveTo(hCX + s * hr * 0.75, hCY - hr * 1.05, hCX + s * hr * 0.28, hCY - hr * 0.7);
      ctx.fill();
    }
  }
  // ally helmet dome + glowing visor
  if (e.friendly && !e.dead) {
    ctx.fillStyle = flash ? "#fff" : "#2a6b48";
    ctx.beginPath(); ctx.arc(hCX, hCY - hr * 0.12, hr * 1.05, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    ctx.fillStyle = trim; ctx.shadowColor = trim; ctx.shadowBlur = w * 0.2;
    roundRect(ctx, hCX - hr * 0.68, hCY - hr * 0.05, hr * 1.36, hr * 0.32, hr * 0.12); ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (!e.dead) {
    if (!e.friendly) {
      // glowing eyes
      ctx.fillStyle = flash ? "#600" : eye;
      ctx.shadowColor = eye; ctx.shadowBlur = w * (e.boss ? 0.35 : 0.22);
      const er = w * (e.boss ? 0.055 : 0.042);
      ctx.beginPath(); ctx.arc(hCX - hr * 0.42, hCY + hr * 0.05, er, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(hCX + hr * 0.42, hCY + hr * 0.05, er, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      // snarling mouth with fangs
      ctx.fillStyle = "rgba(0,0,0,.55)";
      roundRect(ctx, hCX - hr * 0.42, hCY + hr * 0.42, hr * 0.84, hr * 0.26, hr * 0.08); ctx.fill();
      if (detailed) {
        ctx.fillStyle = "#f2f2f2";
        for (const t of [-0.55, -0.18, 0.18, 0.55]) {
          ctx.beginPath();
          ctx.moveTo(hCX + t * hr * 0.7 - hr * 0.08, hCY + hr * 0.44);
          ctx.lineTo(hCX + t * hr * 0.7 + hr * 0.08, hCY + hr * 0.44);
          ctx.lineTo(hCX + t * hr * 0.7, hCY + hr * 0.62);
          ctx.fill();
        }
      }
    }
    // "友" tag above the ally
    if (e.friendly) {
      ctx.fillStyle = "#6cf0ff"; ctx.font = `bold ${Math.max(10, w * 0.22) | 0}px Courier New`;
      ctx.textAlign = "center"; ctx.fillText("友", cx, top - h * 0.05);
    }

    // health bar: boss & ally always show it; minions only when damaged
    if (e.boss || e.friendly || e.hp < e.maxHp) {
      const bw = w * (e.boss ? 0.9 : 0.72), bx = cx - bw / 2, by = top - h * (e.boss ? 0.05 : 0.02);
      const bh = h * (e.boss ? 0.045 : 0.028);
      ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = e.friendly ? "#4dd0ff" : e.boss ? "#ff4bd0" : "#4dff6a";
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
    }
  } else {
    // X eyes when dead
    ctx.strokeStyle = "#000"; ctx.lineWidth = Math.max(1, w * 0.03);
    const ex = hr * 0.28;
    ctx.beginPath();
    for (const s of [-1, 1]) {
      const ec = hCX + s * hr * 0.42, ey = hCY + hr * 0.05;
      ctx.moveTo(ec - ex, ey - ex); ctx.lineTo(ec + ex, ey + ex);
      ctx.moveTo(ec + ex, ey - ex); ctx.lineTo(ec - ex, ey + ex);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// ---------- Render: weapon viewmodel ----------
// Gun sprite images replace the previous hand-drawn geometric viewmodel. Each
// sprite is a 1024x1024 photo-realistic 3D render with a magenta #FF00FF
// background, keyed to transparent at load time. The image is pre-tilted ~30°
// in the source (grip lower-right, barrel upper-left) so we draw it with no
// rotation transform — the grip anchor lands at the same canvas pivot the
// old code used, and bob/recoil just translate the draw position.
const wcv = $("weapon"), wctx = wcv.getContext("2d");

const GUN_SPRITES = {
  // grip:   where the player's hand sits in image 0..1 coords (lands at canvas pivot)
  // muzzle: where the barrel tip is in image 0..1 coords (muzzle flash anchor)
  // scale:  drawn image scale (image is 1024px; scale 0.4 -> ~410px drawn)
  pistol:  { src: "fps_assets/pistol.png",  grip: [0.70, 0.82], muzzle: [0.18, 0.18], scale: 0.42 },
  smg:     { src: "fps_assets/smg.png",     grip: [0.66, 0.84], muzzle: [0.20, 0.14], scale: 0.42 },
  shotgun: { src: "fps_assets/shotgun.png", grip: [0.78, 0.90], muzzle: [0.10, 0.10], scale: 0.34 },
  rifle:   { src: "fps_assets/rifle.png",   grip: [0.70, 0.88], muzzle: [0.10, 0.10], scale: 0.38 },
  // Sniper has no dedicated PNG asset — the 3D viewmodel is the primary
  // path. This entry only fires as a PNG fallback if Three.js/WebGL is
  // unavailable, and reuses the rifle sprite for a reasonable silhouette.
  sniper:  { src: "fps_assets/rifle.png",   grip: [0.70, 0.88], muzzle: [0.10, 0.10], scale: 0.40 },
};
const gunImages = {};   // weapon.vm -> HTMLImageElement (pre-chroma-keyed RGBA PNG)

// Why no in-browser chroma key: loading a file:// image into a canvas taints
// it in Chrome/Safari, so any subsequent getImageData() throws SecurityError.
// The PNGs in fps_assets/ are pre-keyed (magenta -> transparent) by an
// offline step; we just drawImage() them here, which is NOT blocked by taint.
function loadGunImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log("[fps] gun sprite loaded:", key, img.naturalWidth + "x" + img.naturalHeight);
      gunImages[key] = img; resolve();
    };
    img.onerror = () => { console.warn("[fps] failed to load gun sprite:", src); resolve(); };
    img.src = src;
  });
}

// Preload all gun sprites at page load. By the time the player clicks "Start"
// the images are decoded, so the first in-game frame already shows the gun.
Promise.all(Object.entries(GUN_SPRITES).map(([k, s]) => loadGunImage(k, s.src)))
  .then(() => console.log("[fps] all gun sprites ready. gunImages keys =", Object.keys(gunImages)));

// =========================================================================
// ENEMY SPRITES — high-res 3D-rendered monsters, pre-chroma-keyed PNGs.
// Each enemy type has its own silhouette so the player can read "shield guy"
// vs "shooter" vs "boss" at a glance. The 2.5D billboard path uses these
// directly via drawImage; the 3D world path applies them as canvas textures
// on a camera-facing plane so depth + lighting still work. Same deal as the
// gun sprites: magenta-bg JPEG → keyed RGBA PNG via an offline PIL pass.
// =========================================================================
const ENEMY_SPRITES = {
  // kind:    one of "grunt" | "shield" | "shooter" | "charger" | "boss"  (matches e.kind)
  // src:     relative PNG path
  // scale2d: drawn size on the 2.5D canvas (image is 1024px, scale 0.5 = 512px)
  // baseHpMul / baseDmgMul / baseSpdMul: per-type stat tuning applied at spawn
  // reach:   melee attack reach (only used by melee kinds)
  // ranged:  if true, the enemy keeps distance and fires projectiles instead
  //          of melee charges
  grunt:   { src: "fps_assets/enemy_grunt.png",   scale2d: 0.48, baseHpMul: 1.00, baseDmgMul: 1.00, baseSpdMul: 1.00, reach: 1.10, ranged: false },
  shield:  { src: "fps_assets/enemy_shield.png",  scale2d: 0.52, baseHpMul: 1.80, baseDmgMul: 1.30, baseSpdMul: 0.65, reach: 1.20, ranged: false },
  shooter: { src: "fps_assets/enemy_shooter.png", scale2d: 0.52, baseHpMul: 0.60, baseDmgMul: 1.20, baseSpdMul: 0.80, reach: 0.90, ranged: true  },
  charger: { src: "fps_assets/enemy_charger.png", scale2d: 0.40, baseHpMul: 0.80, baseDmgMul: 0.80, baseSpdMul: 1.80, reach: 1.05, ranged: false },
  boss:    { src: "fps_assets/enemy_boss.png",    scale2d: 0.70, baseHpMul: 1.00, baseDmgMul: 1.00, baseSpdMul: 1.00, reach: 1.80, ranged: false },
};
const enemyImages = {};   // kind -> HTMLImageElement
function loadEnemyImage(kind, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log("[fps] enemy sprite loaded:", kind, img.naturalWidth + "x" + img.naturalHeight);
      enemyImages[kind] = img; resolve();
    };
    img.onerror = () => { console.warn("[fps] failed to load enemy sprite:", src); resolve(); };
    img.src = src;
  });
}
Promise.all(Object.entries(ENEMY_SPRITES).map(([k, s]) => loadEnemyImage(k, s.src)))
  .then(() => console.log("[fps] all enemy sprites ready. enemyImages keys =", Object.keys(enemyImages)));

function renderWeapon() {
  const bw = 560, bh = 440;
  if (wcv.width !== bw) { wcv.width = bw; wcv.height = bh; }
  wctx.clearRect(0, 0, bw, bh);

  const sprite = GUN_SPRITES[weapon.vm];
  const img = gunImages[weapon.vm];
  if (!sprite || !img) {
    // No sprite available — draw a visible red placeholder so it's obvious
    // the canvas is rendering. Helps distinguish "image not loaded" from
    // "code path is broken".
    wctx.fillStyle = "rgba(255,60,60,0.55)";
    wctx.fillRect(80, 60, bw - 160, bh - 120);
    wctx.fillStyle = "#fff"; wctx.font = "bold 20px Courier New"; wctx.textAlign = "center";
    wctx.fillText("gun sprite missing: " + (weapon.vm || "?"), bw / 2, bh / 2);
    wctx.font = "14px Courier New";
    wctx.fillText("(check browser console for load errors)", bw / 2, bh / 2 + 26);
    return;
  }

  const bobX = Math.sin(player.bob) * 6;
  const bobY = Math.abs(Math.cos(player.bob)) * 6;
  const recoil = weapon.recoil * 26;
  const cx = bw / 2 + bobX;
  const baseY = bh + bobY + recoil;

  // Position: place the grip anchor (hand area) at (cx+28, baseY) — the same
  // pivot the old geometric viewmodel used. The barrel then extends up-and-left
  // naturally because the source image is already pre-tilted ~30°.
  const scale = sprite.scale;
  const iw = img.width, ih = img.height;
  const gripX = sprite.grip[0] * iw, gripY = sprite.grip[1] * ih;
  const dx = cx + 28 - gripX * scale;
  const dy = baseY - gripY * scale;
  wctx.drawImage(img, dx, dy, iw * scale, ih * scale);

  // Muzzle flash — drawn at the muzzle anchor in canvas coords (outside the
  // old tilt transform, which is no longer needed).
  if (weapon.recoil > 0.5) {
    const mx = dx + sprite.muzzle[0] * iw * scale;
    const my = dy + sprite.muzzle[1] * ih * scale;
    const fscale = weapon.vm === "shotgun" ? 1.4 : 1;
    wctx.fillStyle = `rgba(255,220,120,${(weapon.recoil - 0.5) * 1.6})`;
    wctx.beginPath();
    for (let a = 0; a < 12; a++) {
      const ang = a / 12 * Math.PI * 2;
      const rad = (a % 2 ? 34 : 15) * fscale;
      wctx.lineTo(mx + Math.cos(ang) * rad, my + Math.sin(ang) * rad);
    }
    wctx.closePath(); wctx.fill();
  }

  // Reload label — drawn upright, outside any transform.
  if (weapon.reloading) {
    wctx.fillStyle = "#ffd45a"; wctx.font = "bold 18px Courier New"; wctx.textAlign = "center";
    wctx.fillText("換彈中…", cx, bh - 90);
  }
}

// =========================================================================
// === 3D weapons prototype (pistol + smg + shotgun + rifle + sniper) ===
// Five distinct meshes back the nine-weapon arsenal. Sniper has its own
// silhouette (long barrel, prominent scope, bipod). The remaining vm
// aliases still stand: autosg=shotgun, laser=smg, minigun=smg, plasma=rifle.
//
// Anything with a matching key in WEAPON_3D below shows the 3D overlay;
// anything else falls through to the PNG code path (there is none left
// in the current arsenal, but the fallback is preserved).
//
// The 3D scene is a HUD-only viewmodel — camera at origin, weapon in
// camera-local coords, no world geometry. The world is still the 2D
// raycaster.
//
// TODO (future passes):
//  - Swap procedural meshes for Kenney/CC0 GLBs
//  - Sound effects (fire, dry-fire click, reload rack)
//  - Real 3D world scene + hit particles / decals
//  - Recoil could couple back into player.dir/pitch instead of just the
//    weapon (camera shake on shotgun etc.)
//  - Pump animation on shotgun reload; slide-lock on empty pistol mag
//  - Crosshair recoil bloom (grow the CSS crosshair on fire when not aimed)
// =========================================================================

let aiming3d = false;

// Per-weapon HUD offsets (camera-local, meters) + recoil intensity.
// Larger recoilScale = harder muzzle rise. Tuned so shotgun feels heavy,
// SMG feels snappy but small, rifle sits in the middle. Sniper is the
// heaviest single-shot kick and also the only weapon that overrides the
// default ADS FOV — its adsFov: 30 gives a real scope-zoom feel.
const WEAPON_3D = {
  pistol:  { hipPos: [ 0.30, -0.40, -0.60 ], aimPos: [ 0.00, -0.15, -0.50 ], recoilScale: 1.00 },
  // Dagger: held at lower-center, ready to swing. The dagger's actual
  // swing motion is handled in render3dWeapon via the pivot group inside
  // the holder — it arcs the star from upper-right to lower-left over
  // the swingT bell curve, plus a forward stab.
  //   swingScale: amplitude of the swing (radians at peak).
  //   swingStab: forward Z- thrust at peak (world units).
  // Position is held close to center to keep the dagger on-screen at
  // the swing's extreme angles (canvas is 560x440 with FOV 75°, so
  // visible at z=-0.30 is roughly x∈[-0.23,+0.23], y∈[-0.23,+0.23]).
  dagger:  { hipPos: [ 0.00, -0.18, -0.32 ], aimPos: [ 0.00, -0.18, -0.32 ],
             recoilScale: 0.0, swingScale: 1.0, swingStab: 0.18 },
  smg:     { hipPos: [ 0.32, -0.42, -0.62 ], aimPos: [ 0.00, -0.17, -0.55 ], recoilScale: 0.60 },
  shotgun: { hipPos: [ 0.35, -0.44, -0.72 ], aimPos: [ 0.00, -0.20, -0.60 ], recoilScale: 1.80 },
  rifle:   { hipPos: [ 0.34, -0.42, -0.70 ], aimPos: [ 0.00, -0.19, -0.58 ], recoilScale: 1.10 },
  // Sniper: slightly further back at hip (heavier feel), aim pose centres
  // the scope tube on the crosshair, hard zoom (30° FOV) on ADS.
  sniper:  { hipPos: [ 0.35, -0.44, -0.78 ], aimPos: [ 0.00, -0.05, -0.40 ], recoilScale: 1.50, adsFov: 30 },
  // Tier-2 weapons (previously aliased to other vm ids):
  autosg:  { hipPos: [ 0.35, -0.44, -0.72 ], aimPos: [ 0.00, -0.20, -0.60 ], recoilScale: 1.40 },
  laser:   { hipPos: [ 0.32, -0.42, -0.62 ], aimPos: [ 0.00, -0.17, -0.55 ], recoilScale: 0.50 },
  minigun: { hipPos: [ 0.36, -0.44, -0.68 ], aimPos: [ 0.00, -0.20, -0.60 ], recoilScale: 0.40 },
  plasma:  { hipPos: [ 0.36, -0.46, -0.75 ], aimPos: [ 0.00, -0.19, -0.60 ], recoilScale: 2.00 },
};

const w3d = {
  canvas: null, scene: null, camera: null, renderer: null,
  meshes: {},                           // vm -> THREE.Group (built at init)
  ready: false, disabled: false,
  aimT: 0,                              // 0 = hip, 1 = aimed
  recoilKick: 0, muzzleFlashT: 0,
  swingT: 0,                            // dagger thrust animation: 0=idle, 1=full swing, decays
  turnLagX: 0, turnLagY: 0,             // spring-damped weapon lag on mouse look
  prevDir: 0, prevPitch: 0,
  t: 0,
  hipFOV: 75, aimFOV: 55,
};

// One-shot debug flags so console isn't spammed every frame.
const _dbg3d = { warnedNoThree: false, firstFrame: true };

// ----- mesh construction helpers -----
// Gunmetal palette: dark gray tones layered from light (slide) to darkest
// (muzzle collar), never a pure black — keeps small details readable.
//
// Procedural weapon textures — generated once at init as CanvasTextures
// and assigned to weapon material `.map`. The flat-color PBR look reads
// as "plastic toy"; a subtle brush/grain overlay reads as "real military
// hardware". Three variants cover every weapon part:
//   metal_brushed  — horizontal brush lines, used for slide / barrel / receiver
//   metal_dark     — darker variant, used for sights / muzzle collar
//   wood           — vertical grain, used for stock / handguard
//   polymer        — stippled rubberized texture, used for grip
const weaponTextures = {};

// Draw a random pattern on a 256² canvas. `painter` is called with the
// 2D context, base colour, and a deterministic-but-varied seed.
function _genWeaponTextures() {
  if (weaponTextures._ready) return;
  weaponTextures._ready = true;

  // ---- metal_brushed: horizontal scratch lines on a dark base ----
  const c1 = document.createElement("canvas");
  c1.width = c1.height = 256;
  const g1 = c1.getContext("2d");
  g1.fillStyle = "#7a7a7a"; g1.fillRect(0, 0, 256, 256);
  // long horizontal scratches
  for (let i = 0; i < 600; i++) {
    const y = Math.random() * 256;
    const w = 50 + Math.random() * 180;
    const x = Math.random() * 256 - 60;
    g1.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.18})`;
    g1.lineWidth = 0.4 + Math.random() * 1.2;
    g1.beginPath(); g1.moveTo(x, y); g1.lineTo(x + w, y); g1.stroke();
  }
  for (let i = 0; i < 200; i++) {
    const y = Math.random() * 256;
    const w = 20 + Math.random() * 80;
    const x = Math.random() * 256;
    g1.strokeStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.22})`;
    g1.lineWidth = 0.4 + Math.random() * 0.8;
    g1.beginPath(); g1.moveTo(x, y); g1.lineTo(x + w, y); g1.stroke();
  }
  // scuff clusters near the corners — looks like handling wear
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 4 + Math.random() * 10;
    const grad = g1.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.18)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g1.fillStyle = grad;
    g1.beginPath(); g1.arc(x, y, r, 0, 7); g1.fill();
  }
  weaponTextures.metal_brushed = new THREE.CanvasTexture(c1);
  weaponTextures.metal_brushed.wrapS = weaponTextures.metal_brushed.wrapT = THREE.RepeatWrapping;
  weaponTextures.metal_brushed.repeat.set(1, 1);
  if (THREE.SRGBColorSpace !== undefined) weaponTextures.metal_brushed.colorSpace = THREE.SRGBColorSpace;
  weaponTextures.metal_brushed.anisotropy = 4;

  // ---- metal_dark: same family, lower brightness, for collar/sight parts ----
  const c2 = document.createElement("canvas");
  c2.width = c2.height = 256;
  const g2 = c2.getContext("2d");
  g2.fillStyle = "#3a3a3a"; g2.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    const y = Math.random() * 256;
    const w = 40 + Math.random() * 160;
    const x = Math.random() * 256 - 50;
    g2.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.10})`;
    g2.lineWidth = 0.3 + Math.random() * 0.8;
    g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x + w, y); g2.stroke();
  }
  weaponTextures.metal_dark = new THREE.CanvasTexture(c2);
  weaponTextures.metal_dark.wrapS = weaponTextures.metal_dark.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace !== undefined) weaponTextures.metal_dark.colorSpace = THREE.SRGBColorSpace;
  weaponTextures.metal_dark.anisotropy = 4;

  // ---- wood: vertical grain, warm walnut ----
  const c3 = document.createElement("canvas");
  c3.width = c3.height = 256;
  const g3 = c3.getContext("2d");
  g3.fillStyle = "#5a3a20"; g3.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 2) {
    const shade = 0.65 + Math.random() * 0.35;
    g3.fillStyle = `rgb(${Math.floor(110 * shade)},${Math.floor(65 * shade)},${Math.floor(32 * shade)})`;
    g3.fillRect(x, 0, 2, 256);
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256;
    g3.strokeStyle = `rgba(0,0,0,${0.25 + Math.random() * 0.35})`;
    g3.lineWidth = 0.5 + Math.random() * 1.0;
    g3.beginPath();
    g3.moveTo(x, 0);
    g3.lineTo(x + (Math.random() - 0.5) * 24, 256);
    g3.stroke();
  }
  // a few knot whorls
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    for (let r = 8; r > 0; r -= 2) {
      g3.strokeStyle = `rgba(0,0,0,${0.3 * (8 - r) / 8})`;
      g3.lineWidth = 0.6;
      g3.beginPath();
      g3.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, 7);
      g3.stroke();
    }
  }
  weaponTextures.wood = new THREE.CanvasTexture(c3);
  weaponTextures.wood.wrapS = weaponTextures.wood.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace !== undefined) weaponTextures.wood.colorSpace = THREE.SRGBColorSpace;
  weaponTextures.wood.anisotropy = 4;

  // ---- polymer: stippled rubberized grip texture ----
  const c4 = document.createElement("canvas");
  c4.width = c4.height = 256;
  const g4 = c4.getContext("2d");
  g4.fillStyle = "#18181b"; g4.fillRect(0, 0, 256, 256);
  for (let y = 4; y < 256; y += 6) {
    for (let x = 4; x < 256; x += 6) {
      const shade = 40 + Math.random() * 40;
      g4.fillStyle = `rgba(${shade},${shade},${shade + 4},${0.5 + Math.random() * 0.4})`;
      g4.beginPath();
      g4.arc(x + Math.random() * 2, y + Math.random() * 2, 0.6 + Math.random() * 1.1, 0, 7);
      g4.fill();
    }
  }
  weaponTextures.polymer = new THREE.CanvasTexture(c4);
  weaponTextures.polymer.wrapS = weaponTextures.polymer.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace !== undefined) weaponTextures.polymer.colorSpace = THREE.SRGBColorSpace;
  weaponTextures.polymer.anisotropy = 4;
}
// Build the textures the moment this module is parsed — every weapon
// factory below expects weaponTextures.metal_brushed / .metal_dark / .wood /
// .polymer to be defined before the first call to _mat.
_genWeaponTextures();

// Procedural env-map: a soft 3-stop vertical gradient that fakes studio
// lighting on the metal parts of the 3D weapons. Without an env-map, the
// weapons look "flat" because Three.js's IBL (image-based lighting)
// only kicks in when material.envMap is set. The gradient is intentionally
// subtle (low contrast) so reflections look like a dim armory, not a
// showroom floor.
function _genWeaponEnvMap() {
  if (weaponTextures.envMap) return;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, "#5a6478");   // top — cool sky
  grad.addColorStop(0.45, "#1a1c20");   // horizon — dark
  grad.addColorStop(0.55, "#1a1c20");
  grad.addColorStop(1.00, "#2a2418");   // floor — warm
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  // A few soft light "windows" for highlights
  for (let i = 0; i < 3; i++) {
    const x = 40 + i * 70 + Math.random() * 20;
    const y = 30 + Math.random() * 40;
    const r = 30 + Math.random() * 25;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, "rgba(255,240,200,0.6)");
    rg.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;  // for envMap use
  if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  weaponTextures.envMap = tex;
}
_genWeaponEnvMap();

function _mat(color, metalness, roughness, texKey) {
  const params = { color, metalness, roughness };
  if (texKey && weaponTextures[texKey]) {
    params.map = weaponTextures[texKey];
  }
  // Attach the envmap to metal-bearing parts so the studio lighting
  // gradient reflects on them. Low envMapIntensity (0.45) keeps the
  // look subtle — without it the weapons would look like a
  // showroom floor; with it they look like a dimly-lit armory.
  if (metalness > 0.3 && weaponTextures.envMap) {
    params.envMap = weaponTextures.envMap;
    params.envMapIntensity = 0.45;
  }
  return new THREE.MeshStandardMaterial(params);
}
function _makeMuzzleFlash(size) {
  const m = new THREE.MeshBasicMaterial({
    color: 0xffe0a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
}

// -------------------- PISTOL --------------------
// Compact L-shape: slide (upper) + short barrel + angled grip + trigger
// guard + front/rear sights. Muzzle flash anchored at barrel tip.
function createPistolMesh() {
  const g = new THREE.Group();
  const steel = _mat(0x35393f, 0.60, 0.50, "metal_brushed");   // slide
  const grip = _mat(0x2a2d33, 0.15, 0.85, "polymer");   // grip (matte)
  const dark = _mat(0x22252a, 0.55, 0.50, "metal_dark");   // barrel, guard, sights
  const collar = _mat(0x1a1c1f, 0.65, 0.45, "metal_dark");   // muzzle collar (darkest)

  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.28), steel);
  slide.position.set(0, 0.038, -0.06); g.add(slide);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.16, 14), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.038, -0.20); g.add(barrel);

  const muzzleCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.028, 14), collar);
  muzzleCollar.rotation.x = Math.PI / 2; muzzleCollar.position.set(0, 0.038, -0.275); g.add(muzzleCollar);

  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.16, 0.062), grip);
  gripMesh.position.set(0, -0.06, 0.04); gripMesh.rotation.x = -0.28; g.add(gripMesh);

  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.028, 0.008, 8, 22, Math.PI * 1.15), dark);
  guard.rotation.y = Math.PI / 2; guard.rotation.z = -Math.PI * 0.42;
  guard.position.set(0, -0.005, -0.005); g.add(guard);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.010, 0.016), collar);
  frontSight.position.set(0, 0.083, -0.19); g.add(frontSight);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.014), collar);
  rearSight.position.set(0, 0.083, 0.02); g.add(rearSight);

  const flash = _makeMuzzleFlash(0.16);
  flash.position.set(0, 0.038, -0.32); g.add(flash);
  g.userData.flash = flash;
  return g;
}

// -------------------- RIFLE (long, scoped, wood stock) --------------------
// M4/AK-ish silhouette: long barrel + receiver + magazine + wood stock,
// small scope with two rings mounted above the receiver.
function createRifleMesh() {
  const g = new THREE.Group();
  const steel = _mat(0x35393f, 0.60, 0.50, "metal_brushed");
  const grip = _mat(0x2a2d33, 0.15, 0.85, "polymer");
  const dark = _mat(0x22252a, 0.55, 0.50, "metal_dark");
  const collar = _mat(0x1a1c1f, 0.65, 0.45, "metal_dark");
  const wood = _mat(0x4a3a2a, 0.05, 0.85, "wood");   // warm walnut stock

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 14), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.045, -0.28); g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.026, 14), collar);
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.045, -0.50); g.add(muzzle);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.070, 0.22), steel);
  receiver.position.set(0, 0.035, 0.02); g.add(receiver);
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.050, 0.055, 0.18), steel);
  handguard.position.set(0, 0.030, -0.16); g.add(handguard);

  // magazine sticks down, slightly angled forward
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.100, 0.048), dark);
  mag.rotation.x = -0.08; mag.position.set(0, -0.04, 0.02); g.add(mag);

  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.100, 0.05), grip);
  gripMesh.position.set(0, -0.03, 0.14); gripMesh.rotation.x = -0.40; g.add(gripMesh);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.14), wood);
  stock.position.set(0, 0.020, 0.24); g.add(stock);
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.075, 0.020), collar);
  stockPad.position.set(0, 0.010, 0.31); g.add(stockPad);

  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.006, 8, 22, Math.PI * 1.2), dark);
  guard.rotation.y = Math.PI / 2; guard.rotation.z = -Math.PI * 0.42;
  guard.position.set(0, -0.010, 0.10); g.add(guard);

  // scope body + objective/eyepiece lenses + two mount rings
  const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.09, 12), dark);
  scopeBody.rotation.x = Math.PI / 2; scopeBody.position.set(0, 0.082, -0.02); g.add(scopeBody);
  const scopeObj = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.010, 12), collar);
  scopeObj.rotation.x = Math.PI / 2; scopeObj.position.set(0, 0.082, -0.075); g.add(scopeObj);
  const scopeEye = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.010, 12), collar);
  scopeEye.rotation.x = Math.PI / 2; scopeEye.position.set(0, 0.082, 0.035); g.add(scopeEye);
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.005, 8, 16), collar);
  ring1.rotation.y = Math.PI / 2; ring1.position.set(0, 0.070, -0.05); g.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.005, 8, 16), collar);
  ring2.rotation.y = Math.PI / 2; ring2.position.set(0, 0.070, 0.02); g.add(ring2);

  const flash = _makeMuzzleFlash(0.18);
  flash.position.set(0, 0.045, -0.52); g.add(flash);
  g.userData.flash = flash;
  return g;
}

// -------------------- SNIPER (long-barrel marksman rifle) --------------------
// Signature silhouette: extended thin barrel + prominent scope (~2x the
// rifle's small scope, with an objective bell and blue-tinted glass hint)
// + long marksman stock with cheek riser + bipod folded forward + bolt
// handle poking out to the right. Heavier recoil, tighter ADS FOV (30°).
function createSniperMesh() {
  const g = new THREE.Group();
  const steel = _mat(0x35393f, 0.60, 0.50, "metal_brushed");
  const grip = _mat(0x2a2d33, 0.15, 0.85, "polymer");
  const dark = _mat(0x22252a, 0.55, 0.50, "metal_dark");
  const collar = _mat(0x1a1c1f, 0.65, 0.45, "metal_dark");
  const wood = _mat(0x4a3a2a, 0.05, 0.85, "wood");
  const glass  = _mat(0x3a5a7a, 0.40, 0.20);    // blue-tinted objective lens

  // Long thin barrel (~1.5x rifle's 0.42, radius 0.012 vs rifle 0.014)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 14), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.038, -0.38); g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.028, 14), collar);
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.038, -0.70); g.add(muzzle);

  // Receiver — shorter than rifle's, matches marksman-rifle silhouette
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.068, 0.18), steel);
  receiver.position.set(0, 0.030, 0.02); g.add(receiver);

  // Bolt handle sticking out to the right (arm + ball knob)
  const boltArm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.05, 8), steel);
  boltArm.rotation.z = Math.PI / 2; boltArm.position.set(0.045, 0.030, 0.05); g.add(boltArm);
  const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), collar);
  boltKnob.position.set(0.072, 0.030, 0.05); g.add(boltKnob);

  // Long marksman stock (wood) — 1.3x rifle stock length
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.20), wood);
  stock.position.set(0, 0.020, 0.22); g.add(stock);
  // Cheek riser sits on top of the stock so the shooter can align with the scope
  const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.020, 0.11), wood);
  cheek.position.set(0, 0.058, 0.20); g.add(cheek);
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.080, 0.020), collar);
  stockPad.position.set(0, 0.008, 0.33); g.add(stockPad);

  // Pistol grip
  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.100, 0.05), grip);
  gripMesh.position.set(0, -0.030, 0.14); gripMesh.rotation.x = -0.40; g.add(gripMesh);

  // Trigger guard
  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.006, 8, 22, Math.PI * 1.2), dark);
  guard.rotation.y = Math.PI / 2; guard.rotation.z = -Math.PI * 0.42;
  guard.position.set(0, -0.010, 0.10); g.add(guard);

  // Small precision magazine (5-round like the arsenal's magSize)
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.055, 0.038), dark);
  mag.position.set(0, -0.030, 0.02); g.add(mag);

  // ---- Prominent scope ----
  // Main tube — 2x wider than the rifle's small scope, ~0.15 long
  const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.15, 16), dark);
  scopeTube.rotation.x = Math.PI / 2; scopeTube.position.set(0, 0.085, -0.02); g.add(scopeTube);
  // Objective bell — front, +30% wider than the tube
  const objBell = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.03, 16), dark);
  objBell.rotation.x = Math.PI / 2; objBell.position.set(0, 0.085, -0.105); g.add(objBell);
  // Blue-tinted glass hint on the objective front
  const objGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.005, 16), glass);
  objGlass.rotation.x = Math.PI / 2; objGlass.position.set(0, 0.085, -0.122); g.add(objGlass);
  // Eyepiece — back, slightly narrower
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.03, 16), collar);
  eyepiece.rotation.x = Math.PI / 2; eyepiece.position.set(0, 0.085, 0.070); g.add(eyepiece);
  // Two mount rings clamped around the tube onto the receiver
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 20), collar);
  ring1.rotation.y = Math.PI / 2; ring1.position.set(0, 0.085, -0.05); g.add(ring1);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 20), collar);
  ring2.rotation.y = Math.PI / 2; ring2.position.set(0, 0.085, 0.02); g.add(ring2);

  // ---- Bipod: two thin legs splayed forward-down from the barrel's front third ----
  const bipodLen = 0.10, bipodAngle = 0.5;   // ~28° splay from vertical
  for (const s of [-1, 1]) {
    const half = bipodLen * 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, bipodLen, 8), collar);
    leg.position.set(s * Math.sin(bipodAngle) * half,
                     0.038 - Math.cos(bipodAngle) * half,
                     -0.50);
    leg.rotation.z = s * bipodAngle;
    g.add(leg);
    // Small rectangular foot at the leg tip
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.005, 0.014), collar);
    foot.position.set(s * Math.sin(bipodAngle) * bipodLen,
                      0.038 - Math.cos(bipodAngle) * bipodLen,
                      -0.50);
    g.add(foot);
  }

  const flash = _makeMuzzleFlash(0.20);         // long-barrel flash, not shotgun-large
  flash.position.set(0, 0.038, -0.72); g.add(flash);
  g.userData.flash = flash;
  return g;
}

// -------------------- SHOTGUN (pump-action, wide bore, wood) --------------------
// Rem-870 vibe: fat barrel + wooden pump under the barrel + wooden stock +
// brass bead sight at the muzzle. No fancy sights.
function createShotgunMesh() {
  const g = new THREE.Group();
  const steel = _mat(0x35393f, 0.55, 0.55, "metal_brushed");
  const grip = _mat(0x2a2d33, 0.15, 0.85, "polymer");
  const dark = _mat(0x22252a, 0.55, 0.50, "metal_dark");
  const collar = _mat(0x1a1c1f, 0.65, 0.45, "metal_dark");
  const wood = _mat(0x4a3a2a, 0.05, 0.85, "wood");
  const brass = _mat(0xd0a04a, 0.75, 0.30, "metal_brushed");    // brass bead

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.40, 14), steel);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.052, -0.22); g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 14), collar);
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.052, -0.435); g.add(muzzle);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), brass);
  bead.position.set(0, 0.080, -0.42); g.add(bead);

  const pump = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.038, 0.14), wood);
  pump.position.set(0, 0.008, -0.18); g.add(pump);
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.078, 0.18), steel);
  receiver.position.set(0, 0.032, 0.02); g.add(receiver);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.070, 0.22), wood);
  stock.position.set(0, 0.010, 0.22); g.add(stock);
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.088, 0.020), collar);
  stockPad.position.set(0, -0.005, 0.33); g.add(stockPad);

  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.100, 0.05), grip);
  gripMesh.position.set(0, -0.030, 0.11); gripMesh.rotation.x = -0.36; g.add(gripMesh);
  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.006, 8, 22, Math.PI * 1.2), dark);
  guard.rotation.y = Math.PI / 2; guard.rotation.z = -Math.PI * 0.42;
  guard.position.set(0, -0.010, 0.07); g.add(guard);

  const flash = _makeMuzzleFlash(0.26);        // bigger flash for the big boomstick
  flash.position.set(0, 0.052, -0.46); g.add(flash);
  g.userData.flash = flash;
  return g;
}

// -------------------- SMG (compact, angled mag, folding stock) --------------------
// MP5/MP7 vibe: short barrel, compact receiver, angled magazine sticking
// forward-down, thin folding stock. Iron sights.
function createSmgMesh() {
  const g = new THREE.Group();
  const steel = _mat(0x35393f, 0.60, 0.50, "metal_brushed");
  const grip = _mat(0x2a2d33, 0.15, 0.85, "polymer");
  const dark = _mat(0x22252a, 0.55, 0.50, "metal_dark");
  const collar = _mat(0x1a1c1f, 0.65, 0.45, "metal_dark");

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.20, 14), dark);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.035, -0.16); g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.026, 14), collar);
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.035, -0.275); g.add(muzzle);

  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.078, 0.20), steel);
  receiver.position.set(0, 0.030, 0.02); g.add(receiver);

  // long magazine, tilted forward a bit
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.130, 0.046), dark);
  mag.rotation.x = 0.15; mag.position.set(0, -0.07, 0.03); g.add(mag);

  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.055, 0.045), grip);
  foregrip.position.set(0, -0.010, -0.08); foregrip.rotation.x = -0.15; g.add(foregrip);
  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.090, 0.05), grip);
  gripMesh.position.set(0, -0.030, 0.12); gripMesh.rotation.x = -0.40; g.add(gripMesh);

  // thin folding stock arm + shoulder pad
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.030, 0.14), steel);
  stock.position.set(0, 0.050, 0.14); g.add(stock);
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.054, 0.014), collar);
  stockPad.position.set(0, 0.040, 0.22); g.add(stockPad);

  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.014, 0.012), collar);
  frontSight.position.set(0, 0.082, -0.14); g.add(frontSight);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.014), collar);
  rearSight.position.set(0, 0.082, 0.08); g.add(rearSight);

  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.006, 8, 22, Math.PI * 1.2), dark);
  guard.rotation.y = Math.PI / 2; guard.rotation.z = -Math.PI * 0.42;
  guard.position.set(0, -0.010, 0.08); g.add(guard);

  const flash = _makeMuzzleFlash(0.14);
  flash.position.set(0, 0.035, -0.31); g.add(flash);
  g.userData.flash = flash;
  return g;
}

// -------------------- AUTO SHOTGUN (Saiga-12 vibe, drum mag) --------------------
// Fat matte-black barrel, big drum magazine under the receiver, folded stock.
// Louder than the pump, faster than pump — recoilScale 1.4 (< pump's 1.8).
function createAutoShotgunMesh() {
  const g = new THREE.Group();
  const steel = _mat(0x2a2c30, 0.55, 0.55, "metal_brushed");
  const grip = _mat(0x1a1c1f, 0.15, 0.85, "polymer");
  const dark = _mat(0x22252a, 0.55, 0.50, "metal_dark");
  const collar = _mat(0x1a1c1f, 0.65, 0.45, "metal_dark");

  // Barrel — thicker than the manual shotgun but shorter
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.30, 14), steel);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.048, -0.14); g.add(barrel);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.024, 14), collar);
  muzzle.rotation.x = Math.PI / 2; muzzle.position.set(0, 0.048, -0.30); g.add(muzzle);

  // Compact receiver
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.080, 0.16), steel);
  receiver.position.set(0, 0.028, 0.02); g.add(receiver);

  // Drum magazine — cylinder rotated onto side, hanging below receiver
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.050, 20), dark);
  drum.rotation.z = Math.PI / 2; drum.position.set(0, -0.045, 0.02); g.add(drum);
  const drumCap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.006, 20), collar);
  drumCap.rotation.z = Math.PI / 2; drumCap.position.set(0.028, -0.045, 0.02); g.add(drumCap);

  // Thin folding stock arm (single tube), matches SMG style
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.030, 0.13), steel);
  stock.position.set(0, 0.048, 0.14); g.add(stock);
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.052, 0.014), collar);
  stockPad.position.set(0, 0.040, 0.21); g.add(stockPad);

  // Grip + guard
  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.095, 0.05), grip);
  gripMesh.position.set(0, -0.020, 0.10); gripMesh.rotation.x = -0.36; g.add(gripMesh);
  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.006, 8, 22, Math.PI * 1.2), dark);
  guard.rotation.y = Math.PI / 2; guard.rotation.z = -Math.PI * 0.42;
  guard.position.set(0, -0.010, 0.05); g.add(guard);

  // Wide muzzle flash (still a shotgun, still a boomstick)
  const flash = _makeMuzzleFlash(0.24);
  flash.position.set(0, 0.048, -0.32); g.add(flash);
  g.userData.flash = flash;
  return g;
}

// -------------------- LASER RIFLE (sci-fi, cyan emissive focus ring) -----------
// Deep blue chassis + cyan glowing focus ring at the muzzle + shark-fin
// heatsinks along the receiver. No physical magazine — energy weapon.
function createLaserMesh() {
  const g = new THREE.Group();
  const chassis = _mat(0x1a2540, 0.55, 0.45, "metal_dark");      // deep blue
  const dark = _mat(0x0d1220, 0.55, 0.50, "metal_dark");
  const grip = _mat(0x181828, 0.15, 0.85, "polymer");
  // Emissive materials for the "energy" bits
  const focusMat = new THREE.MeshStandardMaterial({
    color: 0x40cfff, roughness: 0.30, metalness: 0.20,
    emissive: 0x40cfff, emissiveIntensity: 0.9,
  });
  const emitterMat = new THREE.MeshStandardMaterial({
    color: 0x80e8ff, roughness: 0.25,
    emissive: 0x80e8ff, emissiveIntensity: 1.4,
  });

  // Smooth barrel — cylinder
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.35, 16), chassis);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.040, -0.16); g.add(barrel);
  // Focus ring — wider cylinder glowing cyan
  const focus = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.030, 16), focusMat);
  focus.rotation.x = Math.PI / 2; focus.position.set(0, 0.040, -0.32); g.add(focus);
  // Emitter tip — small bright sphere at the very front
  const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), emitterMat);
  emitter.position.set(0, 0.040, -0.340); g.add(emitter);

  // Streamlined receiver
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.070, 0.20), chassis);
  receiver.position.set(0, 0.030, 0.02); g.add(receiver);
  // Heatsink fins — three thin boxes along the top of the receiver
  const finY = 0.070;
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.010, 0.028), dark);
    fin.position.set(0, finY, -0.04 + i * 0.045); g.add(fin);
  }
  // Second row of fins slightly higher for silhouette texture
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.014, 0.024), dark);
    fin.position.set(0, finY + 0.014, -0.04 + i * 0.045); g.add(fin);
  }

  // Grip + guard
  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.090, 0.05), grip);
  gripMesh.position.set(0, -0.030, 0.11); gripMesh.rotation.x = -0.40; g.add(gripMesh);
  const guard = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.006, 8, 20, Math.PI * 1.2), dark);
  guard.rotation.y = Math.PI / 2; guard.rotation.z = -Math.PI * 0.42;
  guard.position.set(0, -0.012, 0.08); g.add(guard);

  // Sights are just tiny visible blips — clean sci-fi
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.010), dark);
  frontSight.position.set(0, 0.075, -0.18); g.add(frontSight);
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.008, 0.012), dark);
  rearSight.position.set(0, 0.075, 0.06); g.add(rearSight);

  // Cyan-tinted muzzle flash (kept in the yellow-white family via the
  // material factory to avoid over-saturating on additive blend, but
  // scaled small to match the crisp laser feel)
  const flash = _makeMuzzleFlash(0.16);
  flash.position.set(0, 0.040, -0.36); g.add(flash);
  g.userData.flash = flash;
  // Stash the emissive parts so a future fire-response can pulse them.
  g.userData.emissive = [focusMat, emitterMat];
  return g;
}

// -------------------- MINIGUN (6-barrel rotating cluster) ----------------------
// Bulky receiver, thick grip, no stock. Barrel cluster spins in render.
function createMinigunMesh() {
  const g = new THREE.Group();
  const steel = _mat(0x35393f, 0.60, 0.50, "metal_brushed");
  const grip = _mat(0x1a1c1f, 0.15, 0.85, "polymer");
  const dark = _mat(0x22252a, 0.55, 0.50, "metal_dark");
  const collar = _mat(0x1a1c1f, 0.65, 0.45, "metal_dark");

  // Barrel cluster — 6 cylinders arranged around Z axis. Grouped so the
  // render loop can spin the whole cluster via userData.barrelCluster.rotation.z.
  const cluster = new THREE.Group();
  const nBarrels = 6, radius = 0.030;
  for (let i = 0; i < nBarrels; i++) {
    const th = (i / nBarrels) * Math.PI * 2;
    const bx = Math.cos(th) * radius, by = Math.sin(th) * radius;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 10), dark);
    b.rotation.x = Math.PI / 2; b.position.set(bx, by, 0);
    cluster.add(b);
  }
  // Front hub + rear hub to bind the barrels visually
  const hubF = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 16), collar);
  hubF.rotation.x = Math.PI / 2; hubF.position.set(0, 0, -0.164); cluster.add(hubF);
  const hubR = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.020, 16), steel);
  hubR.rotation.x = Math.PI / 2; hubR.position.set(0, 0, 0.164); cluster.add(hubR);
  cluster.position.set(0, 0.040, -0.16);
  g.add(cluster);
  g.userData.barrelCluster = cluster;

  // Big receiver housing the ammo drum
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.090, 0.22), steel);
  receiver.position.set(0, 0.030, 0.06); g.add(receiver);
  // Side ammo belt hint — a fat box sticking out sideways
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.11), dark);
  belt.position.set(-0.055, 0.020, 0.10); g.add(belt);

  // Thick grip
  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.100, 0.06), grip);
  gripMesh.position.set(0, -0.035, 0.16); gripMesh.rotation.x = -0.30; g.add(gripMesh);

  const flash = _makeMuzzleFlash(0.20);
  flash.position.set(0, 0.040, -0.34); g.add(flash);
  g.userData.flash = flash;
  return g;
}

// -------------------- PLASMA CANNON (heavy energy weapon) ---------------------
// Fat barrel with a glowing plasma orb at the muzzle, exposed energy core in
// the receiver, side vent fins. Recoil is the heaviest of any weapon.
function createPlasmaMesh() {
  const g = new THREE.Group();
  const chassis = _mat(0x22252a, 0.60, 0.45, "metal_dark");
  const chassis2 = _mat(0x2e3238, 0.55, 0.50);
  const dark = _mat(0x0f1114, 0.55, 0.50, "metal_dark");
  const collar = _mat(0x121418, 0.65, 0.40, "metal_dark");
  const grip = _mat(0x181820, 0.15, 0.85, "polymer");
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xff60d0, roughness: 0.30, emissive: 0xff40cf, emissiveIntensity: 1.6,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xff90e0, roughness: 0.25, emissive: 0xff30cf, emissiveIntensity: 1.1,
  });
  const boreMat = new THREE.MeshBasicMaterial({ color: 0xff20a0 });   // solid glow "into" the bore

  // ---- FAT SINGLE BARREL — the whole point of the redesign ----
  // Bore radius 0.070 (was 0.035, ~2x fatter). Slight taper: the muzzle
  // end (front) is 0.075, the breech end (back) is 0.062, so it reads
  // like a proper flared cannon rather than a fat pipe.
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.062, 0.26, 20), chassis);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.055, -0.13); g.add(barrel);
  // Reinforcement bands — three thin dark rings around the barrel.
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.078, 0.014, 20), collar);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.055, -0.04 - i * 0.075); g.add(band);
  }
  // Wide muzzle collar / bore lip — the fat opening at the tip.
  const muzzleCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.090, 0.078, 0.030, 20), collar);
  muzzleCollar.rotation.x = Math.PI / 2;
  muzzleCollar.position.set(0, 0.055, -0.256); g.add(muzzleCollar);
  // Bore interior — a flat pink disk you can see when looking down the
  // barrel, so the muzzle reads "loaded" even when not firing.
  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.058, 20), boreMat);
  bore.position.set(0, 0.055, -0.269); bore.rotation.y = Math.PI; g.add(bore);
  // Plasma orb sitting in the muzzle — bigger to match the wider bore.
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.070, 20, 14), orbMat);
  orb.position.set(0, 0.055, -0.260); g.add(orb);

  // ---- Larger receiver to house the fatter barrel ----
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.110, 0.24), chassis);
  receiver.position.set(0, 0.038, 0.04); g.add(receiver);
  // Receiver top plate (slight color break for silhouette).
  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.014, 0.20), chassis2);
  topPlate.position.set(0, 0.100, 0.04); g.add(topPlate);
  // Exposed energy core — glowing pink cylinder visible through the receiver.
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.17, 16), coreMat);
  core.rotation.x = Math.PI / 2; core.position.set(0, 0.055, 0.05); g.add(core);
  // Twin exposed core caps at each end so the core reads as "plugged into" the receiver.
  const capF = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.016, 16), collar);
  capF.rotation.x = Math.PI / 2; capF.position.set(0, 0.055, -0.035); g.add(capF);
  const capR = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.016, 16), collar);
  capR.rotation.x = Math.PI / 2; capR.position.set(0, 0.055,  0.135); g.add(capR);

  // ---- Underbarrel plasma canister (fuel tank vibe) ----
  const canister = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.14, 16), chassis2);
  canister.rotation.x = Math.PI / 2;
  canister.position.set(0, -0.008, -0.02); g.add(canister);
  const canCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.010, 16), collar);
  canCap.rotation.x = Math.PI / 2;
  canCap.position.set(0, -0.008, -0.093); g.add(canCap);

  // ---- Side vent fins — bigger and more of them for the cannon silhouette ----
  for (let side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.060, 0.030), dark);
      fin.position.set(side * 0.052, 0.036, -0.02 + i * 0.032); g.add(fin);
    }
  }

  // ---- Grip + short stock ----
  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.105, 0.056), grip);
  gripMesh.position.set(0, -0.038, 0.17); gripMesh.rotation.x = -0.38; g.add(gripMesh);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.058, 0.10), dark);
  stock.position.set(0, 0.020, 0.24); g.add(stock);
  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.074, 0.020), dark);
  stockPad.position.set(0, 0.010, 0.30); g.add(stockPad);

  // ---- Big muzzle flash for the heavy discharge ----
  const flash = _makeMuzzleFlash(0.40);
  flash.position.set(0, 0.055, -0.32); g.add(flash);
  g.userData.flash = flash;
  g.userData.emissive = [orbMat, coreMat];
  return g;
}

function init3dWeapons() {
  if (w3d.ready || w3d.disabled) return;
  if (typeof THREE === "undefined") {
    if (!_dbg3d.warnedNoThree) {
      console.warn("[fps][3d] init: THREE global not defined — script tag may not have loaded. Will retry each frame; PNG fallback stays shown until then.");
      _dbg3d.warnedNoThree = true;
    }
    return;
  }
  try {
    const canvas = document.getElementById("weapon3d");
    // Match the PNG viewmodel canvas footprint so bob/positioning feels similar.
    const bw = 560, bh = 440;
    canvas.width = bw; canvas.height = bh;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(w3d.hipFOV, bw / bh, 0.01, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(bw, bh, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);           // fully transparent — see the 2D world through it

    // Three-light rig: warm key from upper-right, cool rim from behind-left,
    // ambient fill so the shadowed side of gunmetal isn't pure black.
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyL = new THREE.DirectionalLight(0xfff2c8, 0.9);   keyL.position.set(2, 3, 2);   scene.add(keyL);
    const rimL = new THREE.DirectionalLight(0x9ac0ff, 0.35);  rimL.position.set(-3, 1, -2); scene.add(rimL);

    // Build all nine weapon meshes up front, add to scene, hide until equipped.
    // Cheap enough to keep them all resident — a few dozen primitives each.
    w3d.meshes.pistol  = createPistolMesh();
    w3d.meshes.smg     = createSmgMesh();
    w3d.meshes.shotgun = createShotgunMesh();
    w3d.meshes.rifle   = createRifleMesh();
    w3d.meshes.sniper  = createSniperMesh();
    w3d.meshes.autosg  = createAutoShotgunMesh();
    w3d.meshes.laser   = createLaserMesh();
    w3d.meshes.minigun = createMinigunMesh();
    w3d.meshes.plasma  = createPlasmaMesh();
    for (const key of Object.keys(w3d.meshes)) {
      w3d.meshes[key].visible = false;
      scene.add(w3d.meshes[key]);
    }

    // === Dagger: loaded asynchronously from assets/models/vanguard/Star.glb
    // (the off-hand shuriken/star from the Mixamo Vanguard set). GLB loading
    // is async, so we register a placeholder hidden group, then swap in the
    // real mesh when GLTFLoader finishes. render3dWeapon already no-ops if
    // the mesh is null/missing, so the dagger just appears once decoded.
    w3d.meshes.dagger = new THREE.Group();
    w3d.meshes.dagger.visible = false;
    scene.add(w3d.meshes.dagger);
    _loadDaggerMesh(w3d.meshes.dagger);

    Object.assign(w3d, { canvas, scene, camera, renderer, ready: true });
    if (typeof window !== "undefined") window.__w3d = w3d;  // debug hook
    w3d.prevDir = player.dir; w3d.prevPitch = player.pitch;
    console.log("[fps][3d] init OK", {
      canvas: canvas.width + "x" + canvas.height,
      three: THREE.REVISION,
      webgl: renderer.getContext().getParameter(renderer.getContext().VERSION),
      weapons: Object.keys(w3d.meshes),
    });
  } catch (err) {
    console.warn("[fps][3d] init failed — falling back to PNG:", err);
    w3d.disabled = true;
  }
}

function weapon3dFire() {
  // Fire event: kick recoil + flash to full. Both decay in render3dWeapon.
  w3d.recoilKick = 1;
  w3d.muzzleFlashT = 0.09;
  // Dagger: drive a short swing animation. swingT goes 0→1 on fire, then
  // decays in render3dWeapon. The dagger's mesh rotation is offset by
  // sin(swingT * π) * swingScale so the user sees a forward thrust.
  if (weapon && weapon.id === "dagger") {
    w3d.swingT = 1.0;
  }
}

// Asynchronously load the Star.glb dagger model and populate the placeholder
// group. The placeholder group is already added to the scene by
// init3dWeapons; we just replace its children with the real mesh when the
// GLB decodes. No-op safe if THREE / GLTFLoader missing — placeholder
// stays empty, render3dWeapon skips it, gameplay still works.
//
// === Dagger holder structure (built here, animated in render3dWeapon) ===
//   holder (w3d.meshes.dagger, the WEAPON_3D.dagger.hipPos reference)
//     ├── pivot  (a Group at origin — its rotation IS the swing)
//     │     └── star  (the loaded GLB, centered)
//     ├── slashTrail  (a curved plane mesh, hidden by default, fades in
//     │                during swing, faces the camera each frame)
//     └── glowTip     (small bright sphere at the blade's far point,
//                      pulses on swing)
function _loadDaggerMesh(holder) {
  if (typeof THREE === "undefined" || !THREE.GLTFLoader) {
    console.warn("[fps][3d] dagger: GLTFLoader unavailable, viewmodel empty");
    return;
  }
  const loader = new THREE.GLTFLoader();
  loader.load(
    "assets/models/vanguard/Star.glb",
    (gltf) => {
      const model = gltf.scene;
      // Auto-fit to a held-prop size (~0.40 world units long). Star.glb
      // doesn't ship a known scale, so we read the bounding box and scale
      // uniformly. The 0.40 size + a 0.30 arm length keeps the star
      // visible on screen at the swing's extreme angles — anything bigger
      // clips off the right edge.
      const bbox = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const longest = Math.max(size.x, size.y, size.z) || 1;
      const TARGET = 0.40;
      const s = TARGET / longest;
      model.scale.setScalar(s);
      // Recompute bbox after scale, then re-center the model on its own
      // bbox so the star's geometric center sits on the pivot origin.
      const bbox2 = new THREE.Box3().setFromObject(model);
      const c = new THREE.Vector3();
      bbox2.getCenter(c);
      model.position.sub(c);

      // === Pivot group ===
      // The pivot's rotation IS the swing. Render3dWeapon rotates the
      // pivot around the camera-relative Z axis (perpendicular to the
      // screen) so the star arcs from up-right to down-left.
      //
      // CRITICAL: the star must be offset on a NON-Z axis for the
      // rotation to move it. A point on the z-axis is invariant under
      // z-axis rotation. We put the star on the +Y axis (camera-up in
      // the standard FPS viewmodel orientation) so the z-rotation
      // swings it through the +X (right) / -X (left) range — a natural
      // "right-handed chop" arc.
      //
      // The Star.glb is the Mixamo Vanguard off-hand shuriken, with its
      // 18 nodes already baked at "rotation 90° + scale 0.02" so the
      // main blade (left_blade, 11.4 units long) points along +Y in the
      // GLB's own frame. So the dagger's "tip" is in our +Y direction.
      // (Before the GLB was re-baked, the tip was along +X and the model
      // sat on the +X arm. Re-baking changed the principal axis.)
      const pivot = new THREE.Group();
      // Arm length tuned so the star stays within the 560x440 weapon3d
      // canvas at all swing angles. With hipPos (0, -0.18, -0.32) and
      // FOV 75°, visible at z=-0.32 is roughly x∈[-0.245,+0.245].
      // armLength 0.20 keeps the star y≤0.20 even at the swing extremes.
      const armLength = 0.20;
      model.position.set(0, armLength, 0);
      // === Dagger tuning: apply rotation from _daggerDbg (URL query or
      // live keyboard) to the star model. Re-applied each time the
      // dagger reloads so URL overrides always take effect on a fresh
      // load. The hotkey path also re-applies it on each press for
      // instant feedback.
      _daggerDbgApplyToModel(model);
      pivot.add(model);

      // === Slash trail (CHILD OF MODEL — rides with the dagger tip) ===
      // A quarter-arc plane that becomes visible during swing, fades out.
      // Procedural canvas texture: a thin bright arc with soft edges so
      // the trail reads as a swipe of light, not a hard ring sector.
      //
      // IMPORTANT: this used to be a child of the pivot (the swing Group),
      // so its center sat at the pivot's origin and the whole arc orbited
      // around the hub instead of following the blade tip. The user
      // reported the trail as "appearing in the lower-left of the screen
      // when I swing" — that's the pivot-centered ring sweeping through
      // the bottom of the frame as the pivot rotates. Attaching the trail
      // to the model (the dagger) makes it follow the blade, which is
      // what a swipe-of-light FX should look like.
      const trailGeo = _buildSlashTrailGeometry(TARGET * 0.4, Math.PI * 0.55);
      const trailMat = new THREE.MeshBasicMaterial({
        map: _buildSlashTrailTexture(),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const slashTrail = new THREE.Mesh(trailGeo, trailMat);
      slashTrail.visible = false;
      // Position the trail at the blade tip and rotate it so the arc
      // opens "downward" (toward the user's hand). The trail geometry
      // sweeps from angle 0 (toward +X) down to -sweep. Rotating -π/2
      // (90° CCW) so it opens toward -Y (away from the tip toward the
      // hand) puts the bright outer edge of the arc right at the tip.
      slashTrail.position.set(0, TARGET * 0.4, 0);
      slashTrail.rotation.set(0, 0, -Math.PI / 2 - Math.PI * 0.275);
      model.add(slashTrail);

      // === Glow tip (child of model — sits at the star's tip) ===
      // Small bright sphere at the tip of the star, pulses on swing.
      const tipGeo = new THREE.SphereGeometry(0.030, 12, 8);
      const tipMat = new THREE.MeshBasicMaterial({
        color: 0xfff0a0,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      });
      const glowTip = new THREE.Mesh(tipGeo, tipMat);
      // Tip is at +Y direction per the GLB re-bake (was +X before).
      glowTip.position.set(0, TARGET * 0.4, 0);
      model.add(glowTip);

      holder.add(pivot);

      // Stash the parts on the holder so render3dWeapon can animate them.
      holder.userData.dagger = {
        pivot, slashTrail, glowTip, armLength,
      };
      console.log("[fps][3d] dagger viewmodel loaded",
        "bbox=" + size.toArray().map(v => v.toFixed(2)).join(","),
        "scale=" + s.toFixed(3));
    },
    undefined,
    (err) => {
      console.warn("[fps][3d] dagger GLB load failed:", err && err.message);
    }
  );
}

// Build a curved plane (ring sector) for the slash trail. The plane is
// defined in the XY plane, sweeping from angle 0 to `sweep` rad, at
// radius `radius` from origin. The blade-end is at the outer edge so
// the trail visually attaches to the dagger tip during the swing.
function _buildSlashTrailGeometry(radius, sweep) {
  const segments = 22;
  const positions = [];
  const uvs = [];
  const indices = [];
  // Ring-sector: inner radius = radius*0.5, outer = radius.
  // v=0 at the inner edge, v=1 at the outer edge.
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = -sweep * t;   // sweep from 0 down to -sweep
    const cos = Math.cos(a), sin = Math.sin(a);
    // Inner edge
    positions.push(cos * radius * 0.5, sin * radius * 0.5, 0);
    uvs.push(t, 0);
    // Outer edge
    positions.push(cos * radius,       sin * radius,       0);
    uvs.push(t, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    indices.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Procedural canvas texture for the slash trail. A bright cyan/white arc
// with a sharp center line and soft alpha falloff toward the inner edge
// and along the ends. Additive blending on the material makes the trail
// look like a streak of light rather than a hard painted shape.
function _buildSlashTrailTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 32;
  const g = c.getContext("2d");
  // Soft vertical gradient: clear at top (inner edge), bright at bottom
  // (outer edge / blade tip). Cyan-white core.
  const grad = g.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0.0, "rgba(180, 240, 255, 0.0)");
  grad.addColorStop(0.4, "rgba(200, 250, 255, 0.55)");
  grad.addColorStop(0.7, "rgba(255, 255, 255, 1.0)");
  grad.addColorStop(1.0, "rgba(220, 255, 240, 0.95)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 32);
  // Horizontal fade at the two ends so the trail doesn't have a hard
  // cut-off mid-swing.
  const fade = g.createLinearGradient(0, 0, 256, 0);
  fade.addColorStop(0.0, "rgba(0, 0, 0, 1)");
  fade.addColorStop(0.15, "rgba(0, 0, 0, 0)");
  fade.addColorStop(0.85, "rgba(0, 0, 0, 0)");
  fade.addColorStop(1.0, "rgba(0, 0, 0, 1)");
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = fade;
  g.fillRect(0, 0, 256, 32);
  g.globalCompositeOperation = "source-over";
  const tex = new THREE.CanvasTexture(c);
  if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function render3dWeapon(dt) {
  if (!w3d.ready) { init3dWeapons(); if (!w3d.ready) return; }
  const vm = weapon && weapon.vm;
  const cfg = WEAPON_3D[vm];
  const mesh = w3d.meshes[vm];
  if (!cfg || !mesh) return;
  w3d.t += dt;

  // Only the current weapon is visible each frame; the others sit dormant.
  for (const key of Object.keys(w3d.meshes)) {
    w3d.meshes[key].visible = (key === vm);
  }

  // ----- gather input state -----
  const moving = !!(keys["KeyW"] || keys["KeyS"] || keys["KeyA"] || keys["KeyD"]
                    || (stick && stick.id !== null && Math.hypot(stick.dx, stick.dy) > 0.1));
  const targetAim = aiming3d ? 1 : 0;
  w3d.aimT += (targetAim - w3d.aimT) * Math.min(1, dt * 12);       // ~80ms lerp
  const swayMul = 1 - w3d.aimT * 0.8;                              // sway drops to 0.2 while aiming

  // ----- walking bob + idle breathing -----
  const t = w3d.t;
  const bobY = (moving ? Math.sin(t * 8) * 0.020 : Math.sin(t * 1.8) * 0.005) * swayMul;
  const bobX = (moving ? Math.cos(t * 4) * 0.010 : Math.cos(t * 1.4) * 0.003) * swayMul;

  // ----- turn lag: weapon lags fast mouse-look, springs back to zero -----
  let dDir = player.dir - w3d.prevDir;
  if (dDir >  Math.PI) dDir -= Math.PI * 2;                        // wrap ±2π jumps
  if (dDir < -Math.PI) dDir += Math.PI * 2;
  const dPitch = (player.pitch - w3d.prevPitch) / Math.max(1, H);  // pitch is in px; normalise
  w3d.prevDir = player.dir; w3d.prevPitch = player.pitch;
  const decay = Math.pow(0.001, dt);                               // spring decay per second
  w3d.turnLagX = w3d.turnLagX * decay - dDir * 0.6;
  w3d.turnLagY = w3d.turnLagY * decay - dPitch * 1.4;
  w3d.turnLagX = Math.max(-0.25, Math.min(0.25, w3d.turnLagX));    // clamp so wild swipes don't fly the gun off-screen
  w3d.turnLagY = Math.max(-0.20, Math.min(0.20, w3d.turnLagY));

  // ----- recoil / flash decay -----
  w3d.recoilKick   = Math.max(0, w3d.recoilKick   - dt * 7);       // ~150ms decay
  w3d.muzzleFlashT = Math.max(0, w3d.muzzleFlashT - dt);
  w3d.swingT       = Math.max(0, w3d.swingT       - dt * 3.5);     // dagger: ~285ms full swing — slow enough to read
  const rk = w3d.recoilKick * cfg.recoilScale;                     // per-weapon intensity
  const sw = Math.sin(w3d.swingT * Math.PI) * (cfg.swingScale || 0); // bell-curve thrust

  // ----- compose final pose -----
  const a = w3d.aimT;
  const hx = cfg.hipPos[0], hy = cfg.hipPos[1], hz = cfg.hipPos[2];
  const ax = cfg.aimPos[0], ay = cfg.aimPos[1], az = cfg.aimPos[2];
  // === Dagger position tuning offset (added on top of hipPos) ===
  // The daggerDbg.tx/ty/tz are world-unit deltas that the user
  // dials in with [-/=] [Bksp/\] [N/M] to fix the Star.glb viewmodel
  // position on the weapon3d canvas. Applied to all weapons' meshes
  // (no-op when tx=ty=tz=0) so the same code path serves the future
  // case where a 3D weapon needs live tuning.
  const dtx = _daggerDbg.tx, dty = _daggerDbg.ty, dtz = _daggerDbg.tz;
  const px = hx * (1 - a) + ax * a + bobX + w3d.turnLagX * 0.4 + dtx;
  // MUZZLE RISE on fire: weapon translates UP (+y) and BACK toward viewer (+z).
  // DAGGER thrust instead: forward (-z) + slight down (-y) — a stab, not a kick.
  const isDagger = vm === "dagger";
  const py = hy * (1 - a) + ay * a + bobY + w3d.turnLagY * 0.35
              + (isDagger ? -sw * 0.10 : rk * 0.055) + dty;
  const pz = hz * (1 - a) + az * a
              + (isDagger ? -((cfg.swingStab || 0.20) * sw) : rk * 0.030) + dtz;
  mesh.position.set(px, py, pz);
  // MUZZLE RISE (rotation): +rotation.x lifts the barrel tip up. The previous
  // version had this sign flipped, so recoil looked like muzzle DEPRESSION.
  // Also flipped the turnLagY coupling so a look-up-fast lag now tilts the
  // barrel slightly DOWN relative to the new view (natural lag).
  // DAGGER swing: the HOLDER doesn't rotate — the pivot INSIDE the holder
  // does (the wrist). rotateZ on the holder adds a small extra tilt for
  // follow-through feel.
  mesh.rotation.set(
    +rk * 0.28 - w3d.turnLagY * 1.2,
    -w3d.turnLagX * 1.4,
    w3d.turnLagX * 0.15 + (isDagger ? -sw * 0.25 : 0)
  );
  // === DAGGER pivot + trail + glow ===
  // The pivot group (built in _loadDaggerMesh) arcs the star from upper-
  // right to lower-left over the swingT bell curve. The slash trail and
  // glow tip are CHILDREN of the pivot so they automatically follow the
  // star's rotation — we only animate their opacity here.
  if (isDagger) {
    const parts = mesh.userData && mesh.userData.dagger;
    if (parts) {
      // Swing arc: start at +1.05 rad (up-right), end at -0.45 rad (down-
      // left). Total arc ≈ 1.5 rad ≈ 86° — a strong, readable wrist flick.
      // lerp from start to end across the bell-shaped sw curve.
      parts.pivot.rotation.z = 0.50 - sw * 1.3;
      // Slash trail: visible only when sw > 0.05. Opacity peaks with sw.
      const trailOn = sw > 0.05;
      parts.slashTrail.visible = trailOn;
      if (trailOn) {
        // Opacity follows a square curve so the trail flashes bright at
        // mid-swing and fades at the ends.
        parts.slashTrail.material.opacity = Math.min(1, sw * sw * 1.4);
      } else {
        parts.slashTrail.material.opacity = 0;
      }
      // Glow tip: pulse with sw. Always slightly visible so the player
      // sees where the blade "is" even at rest.
      parts.glowTip.material.opacity = 0.30 + sw * 0.70;
    }
  }

  // ----- FOV lerp (ADS zoom feel) -----
  // Each weapon can override the ADS FOV via cfg.adsFov. Sniper uses 30°
  // for real scope-zoom feel; the rest default to w3d.aimFOV (55°).
  const adsFov = cfg.adsFov || w3d.aimFOV;
  const fov = w3d.hipFOV * (1 - a) + adsFov * a;
  if (Math.abs(w3d.camera.fov - fov) > 0.01) {
    w3d.camera.fov = fov;
    w3d.camera.updateProjectionMatrix();
  }

  // ----- muzzle flash pulse (per-weapon quad lives in mesh.userData.flash) -----
  // Guarded: melee weapons (dagger) don't have a flash quad in their
  // userData — they have no muzzle. Skip the access cleanly.
  const flash = mesh.userData && mesh.userData.flash;
  const mf = w3d.muzzleFlashT / 0.09;
  if (flash && flash.material) {
    flash.material.opacity = Math.max(0, mf);
    flash.rotation.z += dt * 40;                                     // twinkle
    flash.scale.setScalar(0.7 + mf * 0.9);
  }

  // ----- minigun barrel spin — the cluster stashed on userData spins when
  // firing (muzzle flash timer active) and coasts down to a stop otherwise.
  if (mesh.userData.barrelCluster) {
    const spinAccel = mf > 0.05 ? 40 : -8;                         // rad/s^2
    mesh.userData.barrelSpin = (mesh.userData.barrelSpin || 0) + spinAccel * dt;
    if (mesh.userData.barrelSpin < 0) mesh.userData.barrelSpin = 0;
    if (mesh.userData.barrelSpin > 22) mesh.userData.barrelSpin = 22;
    mesh.userData.barrelCluster.rotation.z += mesh.userData.barrelSpin * dt;
  }
  // ----- energy weapon pulse — laser/plasma glow brighter during firing -----
  if (mesh.userData.emissive) {
    const pulse = 0.7 + mf * 1.2;
    for (const m of mesh.userData.emissive) {
      m.emissiveIntensity = pulse;
    }
  }

  w3d.renderer.render(w3d.scene, w3d.camera);
  if (_dbg3d.firstFrame) {
    _dbg3d.firstFrame = false;
    const rect = w3d.canvas.getBoundingClientRect();
    console.log("[fps][3d] first frame drawn", {
      vm,
      buffer: w3d.canvas.width + "x" + w3d.canvas.height,
      css_rect: rect.width + "x" + rect.height + " @ (" + rect.left + "," + rect.top + ")",
      display: getComputedStyle(w3d.canvas).display,
      z_index: getComputedStyle(w3d.canvas).zIndex,
    });
  }
}

// Show 3D layer for any weapon with a 3D counterpart; PNG otherwise.
// If Three.js failed to load or WebGL init threw, we fall back to PNG for
// all slots.
function updateWeaponLayerVisibility() {
  const use3d = !!weapon && !!WEAPON_3D[weapon.vm]
                && typeof THREE !== "undefined" && !w3d.disabled;
  const w2d   = document.getElementById("weapon");
  const w3dc  = document.getElementById("weapon3d");
  const cross = document.getElementById("crosshair");
  // Bug fix from previous pass: #weapon3d has CSS `display: none` by default
  // (hidden until Three.js is ready). Clearing the inline style with "" lets
  // the CSS default win and keeps the canvas hidden — so we must set "block"
  // explicitly.
  if (w2d)   w2d.style.display   = use3d ? "none"  : "block";
  if (w3dc)  w3dc.style.display  = use3d ? "block" : "none";
  if (cross) cross.classList.toggle("aim3d", use3d && aiming3d);
}
// === /3D weapons prototype ===

// =========================================================================
// === 3D world entities — batch 1: tactical teammate ===
// The 2D raycaster keeps drawing walls, floor, ceiling. This module owns a
// separate full-screen Three.js overlay whose camera tracks the player and
// whose meshes represent in-world entities. Batch 1 = the AI teammate.
// Later batches will move enemies (grunt/elite) and the boss over.
//
// Coordinate mapping (crucial to get right — v2 after fix):
//   raycaster grid X  ->  Three.js X       (both go "right")
//   raycaster grid Y  ->  Three.js +Z      (SAME sign — earlier version
//                                            used -Z and turned out to
//                                            reverse the horizontal
//                                            handedness, so when the
//                                            player rotated in place
//                                            the teammate slid relative
//                                            to the walls. Verified by
//                                            comparing camera-right vs
//                                            raycaster screenX for a
//                                            fixed-ally / dir+=0.1 case.)
//   height (up)       ->  Three.js Y
//
// Ally facing formula (re-derived for +Z mapping AND +Z mesh-forward):
// rotation.y = PI/2 - ally.dir. The teammate mesh's front actually faces
// LOCAL +Z (chest plate at Z=+0.13, visor at Z=+0.075, rifle barrel at
// Z=+0.18) — NOT -Z (which is the default Three.js camera convention).
// The v2 fix derivation assumed -Z was forward, so it produced a 180°
// backwards facing where the teammate was always shown from behind.
//
// Correct derivation: R_y(θ)(0,0,1) = (sin θ, 0, cos θ); set equal to
// world-facing dir (cos ally.dir, 0, sin ally.dir); solve θ = PI/2 - dir.
// Verified all four cardinals produce the right rifle-pointing direction.
//
// Occlusion: we call the existing wallBetween() helper to hide the teammate
// when a wall is between them and the player — the raycaster's z-buffer
// isn't accessible from the Three.js layer, so we approximate with a ray
// test. Frustum culling is handled automatically by Three.js.
//
// TODO (future batches):
//   * batch 2: 3D enemies (grunt/elite) — swap billboard for mesh
//   * batch 3: 3D boss with unique silhouette + attack anim
//   * shared floating health bar sprite (canvas texture, face-camera)
//   * shadow blob under feet (circle sprite on floor plane)
//   * lower-body detach animation for ragdolls
// =========================================================================
const ENABLE_3D_ENTITIES = true;
// === Phase 1 of 3D world rewrite ===
// User chose 'B — full 3D world rewrite' after wall-corner clipping
// still visible even with 5-point occlusion. Rollout plan:
//   Phase 1 (this commit): walls / floor / ceiling as Three.js geometry
//                          in world3d.scene. Z-buffer solves teammate
//                          occlusion naturally. 2D raycaster skips wall
//                          drawing when USE_3D_WORLD is true; falls back
//                          to full 2D if this flag flips false.
//   Phase 2:              collapse to a single player-camera driving
//                          this scene; retire the raycaster wall loop
//                          entirely (it currently short-circuits).
//   Phase 3:              enemies + boss migrate from 2D billboard to
//                          Three.js sprites, get natural depth sort.
//   Phase 4:              bullets / hit-test move to THREE.Raycaster
//                          from camera.
//   Phase 5:              polish + retire the raycaster module.
// HUD (weapon viewmodel, minimap, health bar, shop, save/load) is
// untouched by any phase — pure DOM overlays. Save schema unchanged.
// USE_3D_WORLD, WORLD3D_PREF_KEY, _readWorld3dPref, and toggleWorld3dMode
// are declared at the TOP of this file so initProfileUI (which reads
// USE_3D_WORLD to sync the start-screen checkbox) doesn't hit a TDZ.

const world3d = {
  canvas: null, scene: null, camera: null, renderer: null,
  ready: false, disabled: false,
  entities: {},                  // key -> entity record (mesh + anim state)
  t: 0,
  eyeH: 0.5,                     // camera height in world units (mid-wall)
};

// =========================================================================
// === Mixamo Vanguard loader (async, with procedural fallback) ===
// The teammate uses a rigged Mixamo character with real skeletal animation
// clips (Idle / Walking / Firing Rifle / Standing Aim Walk Forward /
// Hit Reaction / Dying). Loading is async — the game starts with the
// procedural mesh visible (createTeammateMesh below), then swaps to the
// Mixamo mesh once GLB files decode. If GLTFLoader isn't available or
// any file fails to load, we stay on the procedural mesh forever.
//
// Root motion: Mixamo bakes hip translation into the walk / aim-walk
// clips. Since our game code drives world position independently, we
// strip the Hips.position tracks from every clip so animations play in
// place — no double-translation slide.
//
// Scale: Vanguard's default height is ~180 (cm-based). We measure the
// bounding box and rescale so the character is 0.55 world units tall
// (head at ~player eye level 0.5, small margin above). Vertical offset
// aligns feet at world Y = 0 (no more sunken feet from the procedural
// mesh's hip-centered origin).
// =========================================================================
const MIXAMO_BASE = "assets/models/vanguard/";
// Idle / Walking / Firing now come from Mixamo's "Basic Shooter Pack" —
// the base Vanguard idle+walking clips have the rifle tucked under the
// armpit which reads badly for a combat teammate. The Shooter Pack ships
// rifle-ready poses: chest-carry idle, tactical carry walking, and a
// noticeably subtler firing pose than Firing_Rifle.glb. AimWalk /
// HitReact / Dying stay on the original clips because they still
// integrate the rifle plausibly and re-authoring them isn't worth it.
const MIXAMO_FILES = {
  character: "vanguard.glb",
  Idle:      "Rifle_Aim_Idle.glb",   // was Idle.glb (arms-down)
  Walking:   "Rifle_Walking.glb",    // was Walking.glb (unarmed stride)
  Firing:    "Rifle_Firing.glb",     // was Firing_Rifle.glb (very dramatic)
  AimWalk:   "Standing_Aim_Walk_Forward.glb",
  HitReact:  "Hit_Reaction.glb",
  Dying:     "Dying.glb",
};

function _stripRootMotion(clip) {
  // Strip any position / rotation / quaternion / scale track that targets
  // a root-like bone so the clip animates the LIMBS in-place while our
  // outer Group owns the world position + heading.
  //
  // Mixamo track naming varies: `mixamorigHips.quaternion`,
  // `Armature.mixamorig:Hips.rotation`, occasionally `Hips.position` or
  // `RootNode.quaternion`. Original regex only matched the last of these.
  // Widen to catch any node whose *name segment* contains 'Hip'/'hip' or
  // 'root'/'Root', with any position / quaternion / rotation / scale
  // property. Also log what got stripped so we can verify from the
  // console — a 'stripped 0' line means we still didn't catch the real
  // track names and I need to see the raw list.
  const before = clip.tracks.length;
  const stripped = [];
  const kept = [];
  clip.tracks = clip.tracks.filter(t => {
    const n = t.name || "";
    const isRootBone = /(Hip|Hips|hip|hips|root|Root|RootNode|Armature)/.test(n);
    const isTransformProp = /\.(position|quaternion|rotation|scale)$/i.test(n);
    if (isRootBone && isTransformProp) { stripped.push(n); return false; }
    kept.push(n);
    return true;
  });
  console.log(`[fps][world3d] stripRootMotion "${clip.name || "?"}": kept ${clip.tracks.length}/${before}, stripped ${stripped.length}`, {
    stripped,
    // Print ALL kept track names so we can see if any Hips-adjacent
    // track we didn't recognise slipped through and is now writing
    // rotation.y again.
    keptSample: kept.slice(0, 3).concat(kept.length > 6 ? ["…"] : []).concat(kept.slice(-3)),
  });
  return clip;
}

async function _loadGLB(loader, path) {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, err => reject(err));
  });
}

async function createTeammateFromMixamo() {
  if (typeof THREE === "undefined" || !THREE.GLTFLoader) {
    throw new Error("GLTFLoader unavailable");
  }
  const loader = new THREE.GLTFLoader();
  const [charGltf, idle, walk, fire, aimWalk, hit, die] = await Promise.all([
    _loadGLB(loader, MIXAMO_BASE + MIXAMO_FILES.character),
    _loadGLB(loader, MIXAMO_BASE + MIXAMO_FILES.Idle),
    _loadGLB(loader, MIXAMO_BASE + MIXAMO_FILES.Walking),
    _loadGLB(loader, MIXAMO_BASE + MIXAMO_FILES.Firing),
    _loadGLB(loader, MIXAMO_BASE + MIXAMO_FILES.AimWalk),
    _loadGLB(loader, MIXAMO_BASE + MIXAMO_FILES.HitReact),
    _loadGLB(loader, MIXAMO_BASE + MIXAMO_FILES.Dying),
  ]);

  const model = charGltf.scene;
  // Bounding box & scale — target head at ~0.55 world units (slightly above
  // player eye 0.5 so we're looking at the visor, not the top of the head).
  const bbox = new THREE.Box3().setFromObject(model);
  const rawHeight = bbox.max.y - bbox.min.y;
  const targetHeight = 0.55;
  const scale = targetHeight / rawHeight;
  model.scale.setScalar(scale);
  // Vertical offset so feet touch world Y=0.
  const feetLocalY = bbox.min.y * scale;
  model.position.y = -feetLocalY;

  // Wrap in a group so we can rotate / translate cleanly at the outer level.
  const g = new THREE.Group();
  g.add(model);

  // Actions
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  const clipMap = { Idle: idle, Walking: walk, Firing: fire, AimWalk: aimWalk, HitReact: hit, Dying: die };
  for (const [name, gltf] of Object.entries(clipMap)) {
    const clip = gltf.animations && gltf.animations[0];
    if (!clip) { console.warn("[fps][world3d] no clip in", name, "— skipping"); continue; }
    clip.name = name;
    _stripRootMotion(clip);
    actions[name] = mixer.clipAction(clip);
  }
  // Loop policies
  if (actions.HitReact) { actions.HitReact.setLoop(THREE.LoopOnce, 1); actions.HitReact.clampWhenFinished = true; }
  if (actions.Dying)    { actions.Dying.setLoop(THREE.LoopOnce, 1);    actions.Dying.clampWhenFinished    = true; }
  if (actions.Firing)   {
    actions.Firing.setLoop(THREE.LoopOnce, 1);
    actions.Firing.clampWhenFinished   = true;
    // User feedback: the Mixamo Firing_Rifle clip is very dramatic — the
    // whole spine + arms jerk hard on each shot, making the attached
    // rifle jump violently. Reduce effective weight so the pose blends
    // subtly over the base Idle/Walking pose instead of overwriting it.
    // 0.35 keeps a visible kick without making the rifle look like it's
    // firing a howitzer.
    actions.Firing.setEffectiveWeight(0.35);
  }
  // Start on Idle
  if (actions.Idle) actions.Idle.play();

  // Re-tag color-carrying textures with the modern sRGB color space AND
  // clamp the reflectivity down. fbx2gltf exports Mixamo characters with
  // metallicFactor=0.4 + roughnessFactor=0.3 (verified via GLB JSON
  // inspection). Without an environment map (this scene has none), a
  // 40%-metallic 70%-smooth surface renders as near-mirror black —
  // exactly the "shiny-black" bug. Metals have no diffuse response;
  // they only reflect the environment. We force fully-diffuse (metalness
  // 0) and rough (roughness 0.85) so the base-color texture actually
  // reads.
  //
  // sRGB tagging: r128 GLTFLoader sets the OLD `texture.encoding =
  // THREE.sRGBEncoding` field (undefined in r160), so we set the new
  // colorSpace field explicitly. Data maps (normal / roughness /
  // metalness / AO) legitimately stay in linear color space.
  // DIAGNOSTIC PASS — user reports 'matte grey, no camo pattern' meaning
  // the material clamp worked (no more shiny-black) but base-color textures
  // still don't render. Log every material with enough detail to pinpoint
  // which of these is happening:
  //   (a) m.map is NULL          → r128 GLTFLoader didn't parse the texture
  //                                 (mismatch with r160-generated GLB)
  //   (b) m.map yes, m.map.image null → texture decode still in progress or failed
  //   (c) map + image present but not visible → color/side/opacity blocking
  const mixamoMatDebug = [];
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      const img = m.map && m.map.image;
      const info = {
        mesh: o.name,
        matName: m.name,
        matType: m.type,
        map: m.map ? "yes" : "NULL",
        mapImage: img ? `${img.width || "?"}x${img.height || "?"}` : "none",
        mapImageSrcTail: img && img.src ? String(img.src).slice(-60) : "n/a",
        mapColorSpace: m.map ? m.map.colorSpace : "n/a",
        mapFormat: m.map ? m.map.format : "n/a",
        mapEncoding: m.map ? m.map.encoding : "n/a",
        normalMap: m.normalMap ? "yes" : "NULL",
        color: m.color ? "#" + m.color.getHexString() : "n/a",
        metalness_before: m.metalness,
        roughness_before: m.roughness,
        transparent: m.transparent,
        opacity: m.opacity,
        side: m.side,
        vertexColors: m.vertexColors,
      };
      mixamoMatDebug.push(info);
      // Clamp reflectivity so it doesn't render mirror-black without an env map.
      if (m.metalness !== undefined && m.metalness > 0.15) m.metalness = 0.0;
      if (m.roughness !== undefined && m.roughness < 0.7)  m.roughness = 0.85;
      // r128↔r160 texture-format compat: r160 WebGLRenderer refuses to
      // upload sRGB textures that aren't RGBAFormat+UnsignedByteType, and
      // r128 GLTFLoader leaves these fields as undefined / 0. The GPU
      // then rejects the texture with INVALID_ENUM (0x0000) and the
      // texture sampler returns black — the exact 'no camo pattern'
      // symptom the user observed. Force valid values for every texture
      // slot on the material; base-color and emissive get sRGB tag, data
      // maps stay linear.
      const _COLOR_KEYS  = ["map", "emissiveMap"];
      const _LINEAR_KEYS = ["normalMap", "roughnessMap", "metalnessMap", "aoMap"];
      const _fixTex = (tex, isColor) => {
        if (!tex) return;
        if (THREE.RGBAFormat !== undefined && (!tex.format || tex.format === 0)) {
          tex.format = THREE.RGBAFormat;
        }
        if (THREE.UnsignedByteType !== undefined && (!tex.type || tex.type === 0)) {
          tex.type = THREE.UnsignedByteType;
        }
        if (isColor && THREE.SRGBColorSpace !== undefined) {
          tex.colorSpace = THREE.SRGBColorSpace;
        } else if (!isColor && THREE.LinearSRGBColorSpace !== undefined) {
          tex.colorSpace = THREE.LinearSRGBColorSpace;
        }
        tex.needsUpdate = true;
      };
      for (const k of _COLOR_KEYS)  _fixTex(m[k], true);
      for (const k of _LINEAR_KEYS) _fixTex(m[k], false);
      // Force base color to white so texture isn't tinted grey. Some
      // fbx2gltf exports set m.color to a mid-grey which multiplies with
      // texture output and washes the pattern out — this override is safe
      // because the base-color TEXTURE carries the intended tinting.
      if (m.map && m.color) m.color.setHex(0xffffff);
      m.needsUpdate = true;
    }
  });
  console.log("[fps][world3d] mixamo materials DIAGNOSTIC", mixamoMatDebug);

  // ---- Attach a procedural rifle to the RightHand bone -------------------
  // Vanguard's Firing Rifle clip is a proper aim-down-sights pose but the
  // model has no weapon geometry — teammate was gesturing empty-handed.
  // Build a small rifle Group, find the RightHand bone by name, add the
  // rifle as its child with a tuned local offset so it sits in the palm.
  //
  // Mixamo bone naming varies (mixamorigRightHand, mixamorig:RightHand,
  // RightHand). Match any of those. If none found, log a warning and skip.
  const _buildAllyRifle = () => {
    const rg = new THREE.Group();
    const bodyMat  = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.55, metalness: 0.55 });
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.85, metalness: 0.05 });
    const collar   = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.55, metalness: 0.60 });
    // Barrel — cylinder pointing along +Z (mesh-local forward)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 12), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.18;
    rg.add(barrel);
    // Muzzle collar
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.028, 12), collar);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = 0.35;
    rg.add(muzzle);
    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.058, 0.18), bodyMat);
    receiver.position.set(0, -0.008, 0.02);
    rg.add(receiver);
    // Wooden stock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.045, 0.13), stockMat);
    stock.position.set(0, -0.008, -0.12);
    rg.add(stock);
    // Magazine (drops down from receiver)
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.10, 0.048), bodyMat);
    mag.position.set(0, -0.070, 0.02);
    rg.add(mag);
    // Trigger guard (partial torus)
    const guard = new THREE.Mesh(
      new THREE.TorusGeometry(0.024, 0.006, 8, 20, Math.PI * 1.2), collar);
    guard.rotation.y = Math.PI / 2; guard.rotation.z = -Math.PI * 0.42;
    guard.position.set(0, -0.020, 0.03);
    rg.add(guard);
    return rg;
  };

  let rightHand = null;
  let rifle = null;                            // hoisted so the returned entity can hold a ref for periodic orientation diagnostics
  let rifleInvScale = 1;                       // hoisted so live re-apply of debug position can multiply bone-local coords
  const allBones = [];
  model.traverse(o => {
    if (o.isBone || o.type === "Bone") allBones.push(o.name);
    if (rightHand) return;
    if (/RightHand$/i.test(o.name) || /right[_:-]?hand$/i.test(o.name)) {
      rightHand = o;
    }
  });
  if (rightHand) {
    rifle = _buildAllyRifle();
    // Measure the hand bone's actual world scale so we can counter-scale
    // the rifle. Previous naive numeric guesses (6, -3, 4) put the rifle
    // in the sky because the bone chain's cumulative world scale wasn't
    // the 0.003 I assumed — Mixamo skeletons carry intermediate scale
    // nodes that vary per export.
    rightHand.updateMatrixWorld(true);
    const handScale = new THREE.Vector3();
    rightHand.getWorldScale(handScale);
    const handWorldPos = new THREE.Vector3().setFromMatrixPosition(rightHand.matrixWorld);
    // Guard against a zero-scale (shouldn't happen but Three.js would divide-by-zero).
    const sx = Math.max(1e-6, handScale.x);
    const invScale = 1 / sx;
    rifleInvScale = invScale;                        // stash for live debug re-apply
    console.log("[fps][world3d] rightHand world scale:", handScale.toArray().map(v => v.toFixed(4)));
    console.log("[fps][world3d] rightHand world position:", handWorldPos.toArray().map(v => v.toFixed(3)));
    // Rifle geometry was built at world-unit sizes (0.36 barrel etc.).
    // Attaching as a bone-child multiplies vertices by handScale, so we
    // pre-scale by 1/handScale to end up back at world size — then knock
    // that world size down to ~0.5 so the rifle isn't cartoonishly huge
    // in the teammate's grip. User feedback: the previous 1.0-world-unit
    // rifle looked bigger than the teammate's whole torso; 0.5 puts the
    // barrel-to-grip span at ~0.35 world units which reads as a compact
    // carbine on a 0.55-unit-tall figure.
    const RIFLE_WORLD_SCALE = 0.5;
    rifle.scale.setScalar(invScale * RIFLE_WORLD_SCALE);
    // Bone-local axis mapping (typical Mixamo hand): fingers extend along
    // +X, palm faces -Y. Rifle's built-forward is +Z.
    // Rotation history:
    //   1. `(0, -π/2, 0)`         — muzzle pointed backwards.
    //   2. `(π, -π/2, 0)`         — still backwards (X π got consumed by yaw).
    //   3. `(0, -π/2, π)`         — still backwards.
    //   4. `(0, +π/2, 0)`         — muzzle forward but rifle upside-down.
    //   5. `(π, +π/2, 0)`         — top/bottom OK on old arms-down Idle.
    //   6. NEW POSE (Shooter Pack): live-tunable via URL + keys.
    //      URL: ?rifleRX=<n>&rifleRY=<n>&rifleRZ=<n> (n in units of π).
    //      Keys: [/] adjust X, ;/' adjust Y, ,/. adjust Z (0.05π step).
    //      P prints current values to console so they can be copied back.
    // === BAKED RIFLE ORIENTATION ===
    // The Vanguard teammate's rifle position was previously live-tunable
    // via the [_rifleDbg] system. That system was removed in favor of
    // dagger viewmodel tuning; the rifle values are now committed
    // here as the final defaults. (Previous baked values: RX=-0.5π,
    // RY=0, RZ=-0.5π, TX=-0.04, TY=0.07, TZ=0.)
    rifle.rotation.set(-0.5 * Math.PI, 0, -0.5 * Math.PI);
    rifle.position.set(
      (0.05 - 0.04) * invScale,
      (-0.02 + 0.07) * invScale,
      (0.02 + 0) * invScale);
    rightHand.add(rifle);
    // One-shot world-position log after add so we can see where it landed.
    rifle.updateMatrixWorld(true);
    const riflePos = new THREE.Vector3().setFromMatrixPosition(rifle.matrixWorld);
    // Also log the world-space bounding box so we can eyeball if the rifle
    // is a plausible size relative to the teammate figure (should be
    // ~0.3-0.5 units on its longest axis for a 0.55-tall Vanguard).
    const rifleBBox = new THREE.Box3().setFromObject(rifle);
    const rifleSize = new THREE.Vector3();
    rifleBBox.getSize(rifleSize);
    console.log("[fps][world3d] rifle attached to", rightHand.name,
      "→ world pos", riflePos.toArray().map(v => v.toFixed(3)),
      "invScale", invScale.toFixed(3),
      "world size", rifleSize.toArray().map(v => v.toFixed(3)));
  } else {
    console.warn("[fps][world3d] no RightHand bone found on Vanguard — rifle NOT attached. Available bones (first 20):", allBones.slice(0, 20));
  }

  console.log("[fps][world3d] mixamo load OK", {
    scale: scale.toFixed(4),
    raw_height: rawHeight.toFixed(2),
    target_height: targetHeight,
    feet_offset: (-feetLocalY).toFixed(4),
    animations: Object.keys(actions),
  });

  return {
    group: g,
    mixer,
    actions,
    current: "Idle",
    isMixamo: true,
    // References for the live rifle-orientation tuning. rifle is null if
    // we couldn't find the hand bone. rifleInvScale is the 1/handScale we
    // multiplied bone-local coords by; _rifleDbgApply reuses it when
    // re-applying the position offset live.
    rifle,
    rightHand,
    rifleInvScale,
    // Same tracking fields as procedural mesh so updateTeammate can share code.
    walkT: 0, prevX: 0, prevY: 0,
    wasDead: true, aimDir: 0, prevMuzzle: 0,
  };
}

// -------- teammate mesh factory (procedural fallback) --------
// Human-shaped stack of primitives. ~18 meshes. Torso at Y=0.6, head at 1.02;
// legs pivot at hip (Y=0.32), arms pivot at shoulder (Y=0.86).
//
// Hierarchy (v2: torso split for walk-bob):
//   g                    ← main group, positioned at ally world coord
//   ├─ torsoGroup        ← upper body: torso/head/arms/rifle. Bobs on Y for walk cycle
//   │   ├─ torso, chest plate, ID patch, shoulder pauldrons
//   │   ├─ head + helmet + visor
//   │   ├─ armL, armR    (pivot at shoulder — rotate.x for arm swing)
//   │   ├─ rifleGroup + parts
//   │   └─ muzzleFlash
//   └─ legL, legR        ← lower body: pivot at hip, rotate.x for leg swing.
//                          NOT children of torsoGroup — feet stay planted while
//                          upper body bobs.
function createTeammateMesh() {
  const g = new THREE.Group();
  const torsoGroup = new THREE.Group();               // upper-body — bobs during walk
  g.add(torsoGroup);

  // Materials
  const vest  = new THREE.MeshStandardMaterial({ color: 0x3a4a35, roughness: 0.70, metalness: 0.10 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.50, metalness: 0.35 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x3a3a2a, roughness: 0.85, metalness: 0.05 });
  const skin  = new THREE.MeshStandardMaterial({ color: 0xc9a58a, roughness: 0.75, metalness: 0.00 });
  const glove = new THREE.MeshStandardMaterial({ color: 0x1a1e18, roughness: 0.80, metalness: 0.15 });
  const helm  = new THREE.MeshStandardMaterial({ color: 0x30362a, roughness: 0.45, metalness: 0.35 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x2a3d55, roughness: 0.10, metalness: 0.75, emissive: 0x0a1a2a });
  const boot  = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.90, metalness: 0.05 });
  const patch = new THREE.MeshStandardMaterial({ color: 0x4aaa4a, roughness: 0.60, emissive: 0x1a4a1a });

  // ---- Torso (at chest height) — all children of torsoGroup ----
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.60, 0.25), vest);
  torso.position.set(0, 0.62, 0); torsoGroup.add(torso);
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.04), plate);
  chestPlate.position.set(0, 0.66, 0.13); torsoGroup.add(chestPlate);
  // Friendly-ID patch (green) — makes it obvious this is your teammate at a glance
  const idPatch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), patch);
  idPatch.position.set(-0.11, 0.76, 0.15); torsoGroup.add(idPatch);
  // Shoulder pauldrons
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.19), plate);
  shoulderL.position.set(-0.24, 0.86, 0); torsoGroup.add(shoulderL);
  const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.09, 0.19), plate);
  shoulderR.position.set(+0.24, 0.86, 0); torsoGroup.add(shoulderR);

  // ---- Head ----
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), skin);
  head.position.set(0, 1.02, 0); torsoGroup.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), helm);
  helmet.position.set(0, 1.05, 0);
  helmet.scale.set(1.0, 0.85, 1.0); torsoGroup.add(helmet);
  const visorStrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.030, 0.020), visor);
  visorStrip.position.set(0, 1.03, 0.075); torsoGroup.add(visorStrip);

  // ---- Arms (each in its own pivot Group at the shoulder for walk sway) ----
  // Arms live inside torsoGroup so their shoulder pivots move with the bob.
  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.24, 0.86, 0);            // shoulder pivot
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.050, 0.24, 10), vest);
    upper.position.set(0, -0.12, 0); arm.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), vest);
    elbow.position.set(0, -0.24, 0); arm.add(elbow);
    const fore  = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 10), vest);
    fore.position.set(0, -0.36, 0.04); fore.rotation.x = -0.45; arm.add(fore);
    const hand  = new THREE.Mesh(new THREE.SphereGeometry(0.050, 10, 8), glove);
    hand.position.set(0, -0.47, 0.10); arm.add(hand);
    return arm;
  }
  const armL = makeArm(-1); torsoGroup.add(armL);
  const armR = makeArm(+1); torsoGroup.add(armR);

  // ---- Legs (pivot at hip) — kept on g, NOT torsoGroup, so feet stay planted ----
  function makeLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.09, 0.32, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.060, 0.28, 10), pants);
    thigh.position.set(0, -0.14, 0); leg.add(thigh);
    const knee  = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), pants);
    knee.position.set(0, -0.28, 0); leg.add(knee);
    const shin  = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.048, 0.25, 10), pants);
    shin.position.set(0, -0.41, 0); leg.add(shin);
    const bootM = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.055, 0.15), boot);
    bootM.position.set(0, -0.56, 0.025); leg.add(bootM);
    return leg;
  }
  const legL = makeLeg(-1); g.add(legL);
  const legR = makeLeg(+1); g.add(legR);

  // ---- Rifle held at chest — attach to torsoGroup so it bobs with upper body ----
  const rifleGroup = new THREE.Group();
  rifleGroup.position.set(0.06, 0.72, 0.18);
  rifleGroup.rotation.y = -0.15;      // barrel angles slightly outward
  const rDark = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.5, metalness: 0.6 });
  const rWood = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.85 });
  const rBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.30, 10), rDark);
  rBarrel.rotation.x = Math.PI / 2; rBarrel.position.set(0, 0, 0.10); rifleGroup.add(rBarrel);
  const rRecv   = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.048, 0.14), rDark);
  rRecv.position.set(0, -0.008, -0.06); rifleGroup.add(rRecv);
  const rStock  = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.036, 0.10), rWood);
  rStock.position.set(0, -0.008, -0.16); rifleGroup.add(rStock);
  const rMag    = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.060, 0.030), rDark);
  rMag.position.set(0, -0.052, -0.04); rifleGroup.add(rMag);
  torsoGroup.add(rifleGroup);

  // ---- Muzzle flash quad (fires when ally.muzzle > 0) — also on torsoGroup ----
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffe0a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), flashMat);
  muzzleFlash.position.copy(rifleGroup.position);
  muzzleFlash.position.z += 0.28;                    // in front of barrel tip
  torsoGroup.add(muzzleFlash);

  // ---- height scale (v3: calibrated to player eye level) --------------
  // Player camera eye sits at world3d.eyeH = 0.5 (mid-wall in the raycaster).
  // Head sphere center is at local Y = 1.02. Solving 1.02 * scale = 0.5
  // gives scale ≈ 0.49, which puts the teammate's face right at the
  // player's eye level — no more "kid looking up at adult" feeling.
  //
  // v2 used 0.66/0.95 ≈ 0.695, which left the head at Y = 0.71 (0.21 above
  // player eye). Uniform scale keeps every proportion identical.
  //
  // Feet after this scale: -0.2675 * 0.49 ≈ -0.13 (sinks 0.13 below the
  // 2D floor). That's tolerable — the raycaster paints the floor as a
  // 2D gradient with no depth buffer, so no z-fighting. If it becomes
  // visually distracting we can lift group.position.y by ~0.13 at the
  // cost of nudging the head 0.13 above eye level again.
  const TEAMMATE_SCALE = 0.5 / 1.02;                // head center -> player eye
  g.scale.setScalar(TEAMMATE_SCALE);
  return {
    group: g,
    torsoGroup,                                      // upper body — bobs during walk cycle
    armL, armR, legL, legR,
    chestMat: plate,                                 // for hurt-tint emissive
    muzzleFlash,
    walkT: 0,                                        // walk cycle phase
    prevX: 0, prevY: 0,                              // previous world pos for speed detection
    wasDead: true,                                   // treats first frame as revive so facing snaps once
    aimDir: 0,                                       // snapshot of ally.dir taken on each fire event
    prevMuzzle: 0,                                   // to detect fire rising edge (muzzle went up this frame)
  };
}

// Phase 2 — procedural texture helpers.
// All zero-external-asset: everything drawn to an offscreen canvas at load
// time, wrapped in a THREE.CanvasTexture. Textures cached on world3d so
// rebuilding walls on a map change doesn't leak or re-canvas.
function _makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}
function _buildWallTexture(rgb) {
  // Brick pattern in the map's wall color. 4 rows × 4 bricks, staggered.
  const c = _makeCanvas(256);
  const g = c.getContext("2d");
  g.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "rgba(0,0,0,0.35)";
  const rowH = 32, brickW = 64;
  for (let y = 0; y < 256; y += rowH) {
    const stagger = (y / rowH) % 2 === 0 ? 0 : brickW / 2;
    g.fillRect(0, y, 256, 2);                                  // horizontal mortar
    for (let x = stagger; x < 256 + brickW; x += brickW) {
      g.fillRect(x, y, 2, rowH);                               // vertical mortar
    }
  }
  // Per-brick shading noise so identical repeats don't look tiled
  for (let by = 0; by < 256; by += rowH) {
    const stagger = (by / rowH) % 2 === 0 ? 0 : brickW / 2;
    for (let bx = stagger; bx < 256; bx += brickW) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
      g.fillRect(bx + 2, by + 2, brickW - 4, rowH - 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function _buildFloorTexture() {
  const c = _makeCanvas(128);
  const g = c.getContext("2d");
  g.fillStyle = "#3a3530";
  g.fillRect(0, 0, 128, 128);
  // Stone-tile mortar cross
  g.strokeStyle = "#1a1512"; g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.stroke();
  g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  // Darkening speckle
  for (let i = 0; i < 350; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.30})`;
    g.fillRect(Math.random() * 128 | 0, Math.random() * 128 | 0, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function _buildCeilingTexture() {
  const c = _makeCanvas(128);
  const g = c.getContext("2d");
  g.fillStyle = "#181d2a";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#0a0d18"; g.lineWidth = 1;
  g.strokeRect(1, 1, 126, 126);
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.stroke();
  g.beginPath(); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  // A few pin-light dots for atmosphere
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(200,220,255,${Math.random() * 0.10 + 0.05})`;
    g.fillRect(Math.random() * 128 | 0, Math.random() * 128 | 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
// Phase 2 (user pivot): enemies as REAL 3D humanoid meshes, not sprites.
// Same procedural primitive-stack approach as the teammate: box torso,
// sphere head, cylinder limbs, everything a THREE.Group so we can add /
// remove / animate freely. One factory function per enemy variant, keyed
// off e.boss for now (grunt vs boss). Elite variant can slot in later
// without disturbing the plumbing.
//
// === v2: enemies now use the same pre-keyed PNG sprites as the 2.5D path.
// A THREE.Sprite is a camera-facing plane with the sprite texture, so the
// enemy reads as a high-detail 3D-render from any angle (with proper
// depth-test against walls and the teammate). The primitive body fallback
// is kept in case the sprite image failed to load. The group is still
// scaled by sizeScale so the boss / shield height rules still apply.
// =========================================================================
// =============================================================================
// === 3D enemy mesh builders (Phase 3) ===
// =============================================================================
//
// Each kind gets a procedural humanoid / creature built from
// BoxGeometry / CylinderGeometry / SphereGeometry / ConeGeometry primitives.
// Goal: distinct silhouettes readable at a glance, walk-cycle + hurt tint
// driven from _syncEnemyMeshes.
//
// Returned record shape (consumed by _syncEnemyMeshes):
//   {
//     group,           // THREE.Group — the parent (foot at y=0)
//     kind,            // string for log + dispatch
//     armL, armR,      // THREE.Group pivots at shoulder (humanoids only)
//     legL, legR,      // THREE.Group pivots at hip
//     legFL, legFR,    // front legs (charger only)
//     legBL, legBR,    // back legs  (charger only)
//     bodyMat,         // for hurt-tint (optional)
//     eyeMat,          // for emissive flicker (optional)
//     weapon,          // held-prop group (e.g. club, axe, rifle) for swing
//     extra: { ... },  // kind-specific extras (sword flame, hood, etc.)
//     walkAmp,         // scalar amplitude for leg/arm swing (0.5 = normal)
//     bounceAmp,       // vertical hop per step (m)
//   }

// ----- Shared helper: a humanoid limb group with upper + lower segment -----
function _makeHumanLimb(material, upperR, upperH, lowerR, lowerH) {
  const limb = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(upperR, upperR, upperH, 8), material);
  upper.position.y = -upperH / 2; limb.add(upper);
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(upperR * 0.9, lowerR, lowerH, 8), material);
  lower.position.y = -(upperH + lowerH / 2); limb.add(lower);
  // Knee sphere — softens the joint visually
  const knee = new THREE.Mesh(new THREE.SphereGeometry(upperR * 1.05, 6, 6), material);
  knee.position.y = -upperH; limb.add(knee);
  return limb;
}

// ----- GRUNT — red demon humanoid with spiked club -----
function createGrunt3DMesh() {
  const g = new THREE.Group();
  // Saturated reds for clear "demon" silhouette. Bumped emissive on
  // the eyes so they read as glowing through dim ambient light.
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc92828, roughness: 0.70, metalness: 0.10 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a1212, roughness: 0.85, metalness: 0.05 });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0x1a0808, roughness: 0.95, metalness: 0.0 });
  const eyeMat  = new THREE.MeshStandardMaterial({ color: 0xff7838, emissive: 0xff5028, emissiveIntensity: 2.2 });
  const clubMat = new THREE.MeshStandardMaterial({ color: 0x5a3220, roughness: 0.90, metalness: 0.05 });
  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.24), bodyMat);
  torso.position.y = 0.55; g.add(torso);
  // Chest plate (slightly darker)
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.05), darkMat);
  chest.position.set(0, 0.58, 0.13); g.add(chest);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), bodyMat);
  head.position.y = 0.95; g.add(head);
  // Horns (2 forward-curving cones)
  const hornGeo = new THREE.ConeGeometry(0.035, 0.20, 6);
  const hornL = new THREE.Mesh(hornGeo, hornMat);
  hornL.position.set(-0.10, 1.10, 0);
  hornL.rotation.z = +0.55; hornL.rotation.x = -0.20; g.add(hornL);
  const hornR = new THREE.Mesh(hornGeo, hornMat);
  hornR.position.set(+0.10, 1.10, 0);
  hornR.rotation.z = -0.55; hornR.rotation.x = -0.20; g.add(hornR);
  // Eyes (glowing)
  const eyeGeo = new THREE.SphereGeometry(0.028, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.06, 0.97, 0.14); g.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(+0.06, 0.97, 0.14); g.add(eyeR);
  // Fangs (2 small white triangles on the lower face)
  const fangMat = new THREE.MeshStandardMaterial({ color: 0xfff0e0, roughness: 0.4 });
  const fangGeo = new THREE.ConeGeometry(0.018, 0.06, 4);
  const fangL = new THREE.Mesh(fangGeo, fangMat);
  fangL.position.set(-0.05, 0.85, 0.13); fangL.rotation.x = Math.PI; g.add(fangL);
  const fangR = new THREE.Mesh(fangGeo, fangMat);
  fangR.position.set(+0.05, 0.85, 0.13); fangR.rotation.x = Math.PI; g.add(fangR);
  // Arms (pivots at shoulder)
  function makeArm() {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8), bodyMat);
    upper.position.y = -0.13; arm.add(upper);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), darkMat);
    fist.position.y = -0.27; arm.add(fist);
    return arm;
  }
  const armL = makeArm(); armL.position.set(-0.26, 0.78, 0); g.add(armL);
  const armR = makeArm(); armR.position.set(+0.26, 0.78, 0); g.add(armR);
  // Legs
  function makeLeg() {
    const leg = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.30, 8), darkMat);
    thigh.position.y = -0.15; leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.27, 8), darkMat);
    shin.position.y = -0.43; leg.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.16), darkMat);
    boot.position.set(0, -0.58, 0.02); leg.add(boot);
    return leg;
  }
  const legL = makeLeg(); legL.position.set(-0.10, 0.30, 0); g.add(legL);
  const legR = makeLeg(); legR.position.set(+0.10, 0.30, 0); g.add(legR);
  // Spiked club in right hand
  const club = new THREE.Group();
  club.position.set(0, -0.30, 0.05);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 8), clubMat);
  handle.position.y = -0.20; club.add(handle);
  const clubHead = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.22, 0.20), clubMat);
  clubHead.position.y = -0.44; club.add(clubHead);
  // Spikes around the club head
  const spikeGeo = new THREE.ConeGeometry(0.028, 0.10, 5);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const sp = new THREE.Mesh(spikeGeo, hornMat);
    sp.position.set(Math.cos(a) * 0.10, -0.40, Math.sin(a) * 0.10);
    sp.rotation.z = Math.cos(a) * 0.4;
    sp.rotation.x = Math.sin(a) * 0.4;
    club.add(sp);
  }
  armR.add(club);
  return { group: g, kind: "grunt", armL, armR, legL, legR, bodyMat, eyeMat, walkAmp: 0.55, bounceAmp: 0.04 };
}

// ----- SHIELD — dark knight with tower shield + battle axe -----
function createShield3DMesh() {
  const g = new THREE.Group();
  // Lower metalness on the armor so the dark gray doesn't get washed
  // out by the blue-tinted environment reflection. Trim / blade stay
  // metallic for highlights.
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.70, metalness: 0.25 });
  const darkMat  = new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.75, metalness: 0.20 });
  const trimMat  = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.25, metalness: 0.85 });
  const eyeMat   = new THREE.MeshStandardMaterial({ color: 0x60c0ff, emissive: 0x60c0ff, emissiveIntensity: 1.0 });
  // Torso (armored)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.60, 0.28), armorMat);
  torso.position.y = 0.58; g.add(torso);
  // Breastplate detail
  const breast = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.40, 0.05), trimMat);
  breast.position.set(0, 0.60, 0.15); g.add(breast);
  // Cross emblem on breastplate
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.02), darkMat);
  crossV.position.set(0, 0.60, 0.18); g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.02), darkMat);
  crossH.position.set(0, 0.60, 0.18); g.add(crossH);
  // Helmet head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), armorMat);
  head.position.y = 0.98; g.add(head);
  // Helmet visor slit (glowing blue)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.04, 0.02), eyeMat);
  visor.position.set(0, 0.99, 0.155); g.add(visor);
  // Helmet crest
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.20, 0.20), trimMat);
  crest.position.set(0, 1.15, -0.02); g.add(crest);
  // Arms
  function makeArm() {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.27, 8), armorMat);
    upper.position.y = -0.14; arm.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), trimMat);
    elbow.position.y = -0.28; arm.add(elbow);
    return arm;
  }
  const armL = makeArm(); armL.position.set(-0.30, 0.82, 0); g.add(armL);
  const armR = makeArm(); armR.position.set(+0.30, 0.82, 0); g.add(armR);
  // Legs
  function makeLeg() {
    const leg = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.30, 8), armorMat);
    thigh.position.y = -0.15; leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.30, 8), armorMat);
    shin.position.y = -0.45; leg.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.20), darkMat);
    boot.position.set(0, -0.65, 0.02); leg.add(boot);
    return leg;
  }
  const legL = makeLeg(); legL.position.set(-0.13, 0.32, 0); g.add(legL);
  const legR = makeLeg(); legR.position.set(+0.13, 0.32, 0); g.add(legR);
  // Tower shield on left arm
  const shield = new THREE.Group();
  shield.position.set(0, -0.05, 0.04);
  shield.rotation.x = -0.15;
  const shieldBody = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.55, 0.06), armorMat);
  shield.add(shieldBody);
  // Shield trim
  const shieldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.04, 0.04), trimMat);
  shieldTrim.position.set(0, 0.26, 0.04); shield.add(shieldTrim);
  const shieldTrim2 = shieldTrim.clone();
  shieldTrim2.position.y = -0.26; shield.add(shieldTrim2);
  // Shield emblem
  const emblem = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 8), trimMat);
  emblem.position.set(0, 0.0, 0.04); shield.add(emblem);
  armL.add(shield);
  // Battle axe on right arm
  const axe = new THREE.Group();
  axe.position.set(0, -0.30, 0.05);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), trimMat);
  shaft.position.y = -0.25; axe.add(shaft);
  // Axe head (double-bladed)
  const axeBladeMat = new THREE.MeshStandardMaterial({ color: 0x9097a4, roughness: 0.20, metalness: 0.95 });
  const axeBladeL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.03), axeBladeMat);
  axeBladeL.position.set(-0.10, -0.42, 0); axe.add(axeBladeL);
  const axeBladeR = axeBladeL.clone();
  axeBladeR.position.x = +0.10; axe.add(axeBladeR);
  armR.add(axe);
  return { group: g, kind: "shield", armL, armR, legL, legR, bodyMat: armorMat, walkAmp: 0.40, bounceAmp: 0.02 };
}

// ----- SHOOTER — hooded sniper with scoped rifle -----
function createShooter3DMesh() {
  const g = new THREE.Group();
  const cloakMat = new THREE.MeshStandardMaterial({ color: 0x1a1a26, roughness: 0.95, metalness: 0.05 });
  const darkMat  = new THREE.MeshStandardMaterial({ color: 0x0d0d14, roughness: 0.95, metalness: 0.05 });
  const skinMat  = new THREE.MeshStandardMaterial({ color: 0x4a3030, roughness: 0.85, metalness: 0.05 });
  const eyeMat   = new THREE.MeshStandardMaterial({ color: 0x60ff90, emissive: 0x60ff90, emissiveIntensity: 1.4 });
  const rifleMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.55, metalness: 0.55 });
  const scopeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.20, metalness: 0.95 });
  // Cloaked torso (tapered cylinder for the cloak shape)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.65, 10), cloakMat);
  torso.position.y = 0.50; g.add(torso);
  // Hood opening (dark inner shadow)
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), cloakMat);
  hood.position.y = 0.92; hood.rotation.x = -0.1; g.add(hood);
  // Face inside the hood
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
  face.position.set(0, 0.88, 0.06); g.add(face);
  // Glowing eye (just one visible, single-eye-scope look)
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat);
  eye.position.set(0, 0.90, 0.16); g.add(eye);
  // Arms (slim, hidden under cloak)
  function makeArm() {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.25, 8), cloakMat);
    upper.position.y = -0.13; arm.add(upper);
    return arm;
  }
  const armL = makeArm(); armL.position.set(-0.24, 0.78, 0); g.add(armL);
  const armR = makeArm(); armR.position.set(+0.24, 0.78, 0); g.add(armR);
  // Legs (also hidden under cloak but visible at the bottom)
  function makeLeg() {
    const leg = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.30, 8), darkMat);
    upper.position.y = -0.15; leg.add(upper);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.16), darkMat);
    boot.position.set(0, -0.32, 0.02); leg.add(boot);
    return leg;
  }
  const legL = makeLeg(); legL.position.set(-0.08, 0.18, 0); g.add(legL);
  const legR = makeLeg(); legR.position.set(+0.08, 0.18, 0); g.add(legR);
  // Scoped rifle held in both arms
  const rifle = new THREE.Group();
  rifle.position.set(0.05, -0.18, 0.10);
  // Stock
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.30), rifleMat);
  stock.position.set(0, 0, -0.05); rifle.add(stock);
  // Receiver
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.30), rifleMat);
  receiver.position.set(0, 0, 0.18); rifle.add(receiver);
  // Long barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.40, 10), rifleMat);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, 0.50); rifle.add(barrel);
  // Scope (tube + 2 caps)
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.20, 12), scopeMat);
  scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.10, 0.18); rifle.add(scope);
  // Scope front cap (green lens)
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x40ff80, emissive: 0x40ff80, emissiveIntensity: 1.2,
    transparent: true, opacity: 0.85,
  });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), lensMat);
  lens.position.set(0, 0.10, 0.28); lens.rotation.y = 0; rifle.add(lens);
  // Magazine
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.06), rifleMat);
  mag.position.set(0, -0.10, 0.18); rifle.add(mag);
  armR.add(rifle);
  // Sling loop on left arm
  const sling = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.012, 6, 12, Math.PI), darkMat);
  sling.position.set(0, -0.20, 0.05); sling.rotation.y = Math.PI / 2;
  armL.add(sling);
  return { group: g, kind: "shooter", armL, armR, legL, legR, eyeMat,
           walkAmp: 0.30, bounceAmp: 0.02, rifle, lensMat };
}

// ----- CHARGER — 4-legged demonic hound (no humanoid torso) -----
function createCharger3DMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb34a18, roughness: 0.80, metalness: 0.10 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a1a08, roughness: 0.90, metalness: 0.05 });
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0x1a0a0a, roughness: 0.95, metalness: 0.0 });
  const eyeMat  = new THREE.MeshStandardMaterial({ color: 0xffe080, emissive: 0xffe080, emissiveIntensity: 1.6 });
  // Main body (long, low) — stretched sphere
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), bodyMat);
  body.scale.set(1.6, 0.7, 0.9);
  body.position.y = 0.32; g.add(body);
  // Head (forward, slightly raised)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), bodyMat);
  head.position.set(0.35, 0.40, 0); g.add(head);
  // Snout (extending forward)
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.22, 8), bodyMat);
  snout.rotation.z = -Math.PI / 2; snout.position.set(0.46, 0.36, 0); g.add(snout);
  // Eyes (yellow, glowing)
  const eyeGeo = new THREE.SphereGeometry(0.025, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(0.42, 0.46, 0.10); g.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.42, 0.46, -0.10); g.add(eyeR);
  // Ears (pointed cones)
  const earGeo = new THREE.ConeGeometry(0.04, 0.12, 5);
  const earL = new THREE.Mesh(earGeo, darkMat);
  earL.position.set(0.28, 0.55, 0.10); earL.rotation.z = -0.3; g.add(earL);
  const earR = new THREE.Mesh(earGeo, darkMat);
  earR.position.set(0.28, 0.55, -0.10); earR.rotation.z = -0.3; g.add(earR);
  // Fangs (2 small white triangles hanging down)
  const fangMat = new THREE.MeshStandardMaterial({ color: 0xfff0e0, roughness: 0.4 });
  const fangGeo = new THREE.ConeGeometry(0.015, 0.05, 4);
  const fangL = new THREE.Mesh(fangGeo, fangMat);
  fangL.position.set(0.55, 0.32, 0.05); fangL.rotation.x = Math.PI; g.add(fangL);
  const fangR = new THREE.Mesh(fangGeo, fangMat);
  fangR.position.set(0.55, 0.32, -0.05); fangR.rotation.x = Math.PI; g.add(fangR);
  // Spikes along the back
  for (let i = 0; i < 5; i++) {
    const t = -0.5 + (i / 4) * 0.7;
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.10, 5), spikeMat);
    sp.position.set(t, 0.50, 0);
    sp.rotation.x = 0;
    g.add(sp);
  }
  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.012, 0.40, 6), darkMat);
  tail.position.set(-0.38, 0.36, 0); tail.rotation.z = 0.6; g.add(tail);
  // 4 legs
  function makeLeg() {
    const leg = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.22, 8), bodyMat);
    upper.position.y = -0.11; leg.add(upper);
    const paw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.10), darkMat);
    paw.position.set(0, -0.22, 0); leg.add(paw);
    return leg;
  }
  // Front legs
  const legFL = makeLeg(); legFL.position.set(0.25, 0.28, 0.14); g.add(legFL);
  const legFR = makeLeg(); legFR.position.set(0.25, 0.28, -0.14); g.add(legFR);
  // Back legs
  const legBL = makeLeg(); legBL.position.set(-0.25, 0.28, 0.14); g.add(legBL);
  const legBR = makeLeg(); legBR.position.set(-0.25, 0.28, -0.14); g.add(legBR);
  return { group: g, kind: "charger", legFL, legFR, legBL, legBR,
           bodyMat, eyeMat, walkAmp: 0.65, bounceAmp: 0.06 };
}

// ----- BOSS — purple/gold warlord with flaming sword + cape -----
function createBoss3DMesh() {
  const g = new THREE.Group();
  // Deep purple + gold with low metalness on the armor (env-map was
  // washing it pink). Gold stays high-metal for highlight specular.
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x4a0e6a, roughness: 0.55, metalness: 0.30 });
  const darkMat  = new THREE.MeshStandardMaterial({ color: 0x1a0428, roughness: 0.65, metalness: 0.20 });
  const goldMat  = new THREE.MeshStandardMaterial({ color: 0xf2c235, roughness: 0.20, metalness: 0.95 });
  const capeMat  = new THREE.MeshStandardMaterial({ color: 0x2a0612, roughness: 0.85, metalness: 0.10, side: THREE.DoubleSide });
  const eyeMat   = new THREE.MeshStandardMaterial({ color: 0xffd12b, emissive: 0xffd12b, emissiveIntensity: 1.8 });
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff8030, emissive: 0xff5020, emissiveIntensity: 2.2 });
  // Torso (large armored chest)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.40), armorMat);
  torso.position.y = 0.72; g.add(torso);
  // Gold chestplate ornament
  const breast = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.05), goldMat);
  breast.position.set(0, 0.72, 0.22); g.add(breast);
  // Skull emblem on chest
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), darkMat);
  skull.position.set(0, 0.85, 0.25); g.add(skull);
  const eyeSkullL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeMat);
  eyeSkullL.position.set(-0.035, 0.87, 0.33); g.add(eyeSkullL);
  const eyeSkullR = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), eyeMat);
  eyeSkullR.position.set(+0.035, 0.87, 0.33); g.add(eyeSkullR);
  // Head (large, horned)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), armorMat);
  head.position.y = 1.30; g.add(head);
  // Horns (big, curving outward + forward)
  const hornGeo = new THREE.ConeGeometry(0.06, 0.35, 8);
  const hornL = new THREE.Mesh(hornGeo, goldMat);
  hornL.position.set(-0.18, 1.50, 0);
  hornL.rotation.z = +0.65; hornL.rotation.x = -0.25; g.add(hornL);
  const hornR = new THREE.Mesh(hornGeo, goldMat);
  hornR.position.set(+0.18, 1.50, 0);
  hornR.rotation.z = -0.65; hornR.rotation.x = -0.25; g.add(hornR);
  // Glowing eyes
  const eyeGeo = new THREE.SphereGeometry(0.04, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.08, 1.32, 0.20); g.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(+0.08, 1.32, 0.20); g.add(eyeR);
  // Cape (flat plane, hangs from shoulders)
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.80, 1, 3), capeMat);
  cape.position.set(0, 0.55, -0.22);
  cape.rotation.x = 0.15;  // slight forward tilt so cape flows behind
  g.add(cape);
  // Arms (big, armored)
  function makeArm() {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 10), armorMat);
    upper.position.y = -0.18; arm.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), goldMat);
    elbow.position.y = -0.36; arm.add(elbow);
    return arm;
  }
  const armL = makeArm(); armL.position.set(-0.42, 1.10, 0); g.add(armL);
  const armR = makeArm(); armR.position.set(+0.42, 1.10, 0); g.add(armR);
  // Legs
  function makeLeg() {
    const leg = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.40, 10), armorMat);
    thigh.position.y = -0.20; leg.add(thigh);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.40, 10), armorMat);
    shin.position.y = -0.60; leg.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.26), darkMat);
    boot.position.set(0, -0.86, 0.04); leg.add(boot);
    return leg;
  }
  const legL = makeLeg(); legL.position.set(-0.18, 0.42, 0); g.add(legL);
  const legR = makeLeg(); legR.position.set(+0.18, 0.42, 0); g.add(legR);
  // Flaming sword in right hand
  const sword = new THREE.Group();
  sword.position.set(0, -0.40, 0.05);
  // Hilt
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 8), goldMat);
  hilt.position.y = -0.06; sword.add(hilt);
  // Crossguard
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.04, 0.08), goldMat);
  guard.position.y = -0.12; sword.add(guard);
  // Blade
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.02), goldMat);
  blade.position.y = -0.45; sword.add(blade);
  // Flame overlay on blade (semi-transparent emissive)
  const flame = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.70, 0.05), flameMat);
  flame.position.y = -0.45; sword.add(flame);
  // Pommel
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), goldMat);
  pommel.position.y = -0.02; sword.add(pommel);
  armR.add(sword);
  return { group: g, kind: "boss", armL, armR, legL, legR, bodyMat: armorMat, eyeMat,
           cape, sword, flameMat, walkAmp: 0.50, bounceAmp: 0.05 };
}

// Dispatch: build the right 3D mesh for an enemy's kind. Returns the
// standard mesh record consumed by _syncEnemyMeshes. Falls back to a
// grunt mesh if the kind is unknown (shouldn't happen — pickEnemyKind
// only returns the 5 known kinds).
function _buildEnemy3DMesh(kind) {
  switch (kind) {
    case "shield":  return createShield3DMesh();
    case "shooter": return createShooter3DMesh();
    case "charger": return createCharger3DMesh();
    case "boss":    return createBoss3DMesh();
    case "grunt":
    default:        return createGrunt3DMesh();
  }
}

function _createEnemyMesh(e) {
  // === 3D mesh path (Phase 3) ===
  // Build a procedural 3D mesh for this enemy kind. No more THREE.Sprite
  // billboards — every enemy now has a real 3D body with walk cycle,
  // hurt tint, and kind-specific silhouette.
  const kind = e.kind || (e.boss ? "boss" : "grunt");
  const rec = _buildEnemy3DMesh(kind);
  // Same final scale as the pre-sprite version: 0.55 baseline * sizeScale.
  // Boss uses sizeScale=2.4 → final 1.32; charger uses 1.0 → 0.55.
  const scale = (e.sizeScale || 1) * 0.55;
  rec.group.scale.setScalar(scale);
  rec.walkT = 0;
  rec.kind = kind;
  rec.sprite = null;  // legacy: kept null so old code paths that check `rec.sprite` no-op cleanly
  return rec;
}

// Phase 1+2: build wall / floor / ceiling geometry with textured materials.
function _buildWorld3dGeometry(scene) {
  const wallTex = _buildWallTexture(wallRGB || [96, 108, 150]);
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex, roughness: 0.90, metalness: 0.05,
  });
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const wallsGroup = new THREE.Group();
  let wallCount = 0;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (MAP[y][x] !== 1) continue;
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x + 0.5, 0.5, y + 0.5);
      wallsGroup.add(wall);
      wallCount++;
    }
  }
  scene.add(wallsGroup);

  // Floor plane — tiled stone. Repeat = one tile per world unit so the
  // pattern grid aligns with wall cells.
  const floorTex = _buildFloorTexture();
  floorTex.repeat.set(MAP_W, MAP_H);
  const floorGeo = new THREE.PlaneGeometry(MAP_W, MAP_H);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(MAP_W / 2, 0, MAP_H / 2);
  scene.add(floor);

  // Ceiling REMOVED — was blocking the boss (~1.32 units tall) at the
  // Y=1 wall top. Open-sky arena feel matches the outdoor floor tile.
  // TODO: skybox / gradient background when we want atmosphere back.

  console.log("[fps][world3d] Phase 2 geometry built", {
    walls: wallCount, map: MAP_W + "x" + MAP_H, textured: true, ceiling: false,
  });

  world3d.wallsGroup = wallsGroup;
  world3d.floor      = floor;
  world3d.wallTex    = wallTex;
  world3d.floorTex   = floorTex;
}

// Enemy mesh lifecycle + per-frame animation. Called each frame while
// USE_3D_WORLD is on. Creates a Three.js Group per enemy on first sight
// (via _createEnemyMesh), removes when the enemy exits enemies[] after
// its death timeout. Walk cycle + hurt tint + death roll are procedural,
// matching the humble teammate animation approach.
//
// === v2: enemies render as camera-facing sprite billboards (THREE.Sprite
// with the pre-keyed PNG texture). The primitive fallback (above) is
// reached only when the sprite image failed to load. Sprite path can't
// animate limbs (the PNG is a single frame), so we substitute a Y-bob
// (sine wave on group.position.y) for a "step" feel, and apply the hurt
// flash to the sprite material's color instead of a chest plate.
function _syncEnemyMeshes(dt) {
  if (!world3d.scene) return;
  if (!world3d.enemyMeshes) world3d.enemyMeshes = new Map();
  const meshes = world3d.enemyMeshes;
  const live = new Set(enemies);
  // Prune meshes for enemies no longer in the roster (removed after
  // deadT window elapses in update()).
  for (const [enemy, rec] of meshes) {
    if (!live.has(enemy)) {
      // Dispose the texture we created for the sprite so we don't leak
      // GPU memory across wave restarts. 3D meshes are built per
      // enemy with their own materials, so we walk the tree and dispose.
      if (rec.sprite && rec.sprite.material) {
        if (rec.sprite.material.map) rec.sprite.material.map.dispose();
        rec.sprite.material.dispose();
      } else {
        rec.group.traverse(o => {
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
            else o.material.dispose();
          }
        });
      }
      world3d.scene.remove(rec.group);
      meshes.delete(enemy);
    }
  }
  for (const e of enemies) {
    let rec = meshes.get(e);
    if (!rec) {
      rec = _createEnemyMesh(e);
      world3d.scene.add(rec.group);
      meshes.set(e, rec);
    }
    // Position on the floor at ally-style +Z mapping used everywhere else
    rec.group.position.set(e.x, 0, e.y);
    // Face the player. AI chases the player so this gives the 3D body a
    // natural facing direction (limb swing reads as forward-stride).
    const dxE = player.x - e.x, dyE = player.y - e.y;
    const faceDir = Math.atan2(dyE, dxE);
    rec.group.rotation.y = Math.PI / 2 - faceDir;
    // Visibility + death: fall forward + slight roll for a more dynamic
    // corpse pose, then hide once the despawn window (~1.2 s) elapses.
    if (e.dead) {
      const t = Math.min(1, e.deadT / 0.4);
      rec.group.rotation.x = t * (Math.PI / 2);
      // Lateral roll: a small extra rotation.y that grows with t so the
      // corpse isn't lying in a perfect forward-only pose. Bosses get
      // a bigger roll so the dramatic death reads.
      const roll = (e.boss ? 0.7 : 0.3) * t;
      rec.group.rotation.z = Math.sin(e.deadT * 4) * roll;
      rec.group.visible = e.deadT < 1.2;
    } else {
      rec.group.rotation.x = 0;
      rec.group.rotation.z = 0;
      rec.group.visible = true;
    }
    // === Per-frame animation ===
    // Walk cycle: speed-based. Stationary enemies hold still (shooter
    // aiming pose), charging enemies bounce hard, grunts take a normal
    // step. The sw value is the sin of walkT; legs/arms swing
    // proportional to sw, plus a vertical hop proportional to |sw|.
    rec.walkT += dt * 9;
    const alive = !e.dead;
    const speed = e.speed || 1;
    const sw = alive ? Math.sin(rec.walkT) : 0;
    const swAbs = Math.abs(sw);
    const legAmp = alive ? (rec.walkAmp || 0.5) : 0;
    const bounceAmp = alive ? (rec.bounceAmp || 0.03) * speed : 0;
    rec.group.position.y = swAbs * bounceAmp;
    // Vertical bob (the group's y, applied to the local frame).
    // Wait — group.position is set to (e.x, 0, e.y) above. We need to
    // add to that, not overwrite. Apply bob as a child offset instead
    // via a wrapper, OR just update y inline:
    rec.group.position.y = swAbs * bounceAmp;
    // === Per-kind walk animation ===
    const kind = rec.kind || e.kind || "grunt";
    if (kind === "charger") {
      // 4-legged gallop: front-left + back-right in phase, front-right +
      // back-left in opposite phase. Bigger amplitude than humanoids.
      if (rec.legFL) rec.legFL.rotation.x = +sw * legAmp;
      if (rec.legFR) rec.legFR.rotation.x = -sw * legAmp;
      if (rec.legBL) rec.legBL.rotation.x = -sw * legAmp;
      if (rec.legBR) rec.legBR.rotation.x = +sw * legAmp;
      // === Charger lunge pose ===
      // When e.lungeT is set (one-shot in update on reaching attack
      // range), stretch the body along its local +Z (forward) so the
      // silhouette lunges. Decay back to normal pose.
      if (e.lungeT && e.lungeT > 0) {
        e.lungeT = Math.max(0, e.lungeT - dt);
        const t = e.lungeT / 0.35;  // 1 = just-lunged, 0 = recovered
        // Find the body group (the first Mesh child with a non-empty
        // body color = the main torso). We just stretch the whole
        // group along Z; visually reads as a forward pounce.
        rec.group.scale.z = (e.sizeScale || 1) * 0.55 * (1 + t * 0.6);
        rec.group.scale.x = (e.sizeScale || 1) * 0.55 * (1 - t * 0.1);
      } else {
        rec.group.scale.z = (e.sizeScale || 1) * 0.55;
        rec.group.scale.x = (e.sizeScale || 1) * 0.55;
      }
    } else {
      // Humanoid: legs opposite phase, arms opposite to legs.
      if (rec.legL) rec.legL.rotation.x = +sw * legAmp;
      if (rec.legR) rec.legR.rotation.x = -sw * legAmp;
      if (rec.armL) rec.armL.rotation.x = -sw * legAmp * 0.45;
      if (rec.armR) rec.armR.rotation.x = +sw * legAmp * 0.45;
    }
    // === Boss sword flame pulse ===
    // The boss carries a flaming sword; the flameMat's emissiveIntensity
    // pulses with time so the blade looks alive. Same effect on the
    // shooter's scope lens so the scope "reads" as a powered optic.
    if (rec.flameMat) {
      rec.flameMat.emissiveIntensity = 1.8 + 0.6 * Math.sin(rec.walkT * 0.7);
    }
    if (rec.lensMat) {
      rec.lensMat.emissiveIntensity = 1.0 + 0.4 * Math.sin(rec.walkT * 0.5);
    }
    // === Shooter muzzle-flash raise ===
    // When the shooter fires (e.muzzle > 0), tilt the right arm up
    // briefly so the rifle kicks up to the firing position. Otherwise
    // the arm is held at the walk-cycle angle. The arm angle blends
    // smoothly between the walk pose and the firing pose.
    if (kind === "shooter" && rec.armR) {
      const muzzleT = e.muzzle > 0 ? Math.min(1, e.muzzle / 0.18) : 0;
      // Walk pose: armR rotation.x was set above. Firing pose: lift up
      // by ~0.4 rad (rifle points up-forward). Lerp between them.
      const walkPose = +sw * legAmp * 0.45;  // current value (re-derived)
      const firingPose = -0.5;  // arm lifted forward/up
      rec.armR.rotation.x = walkPose * (1 - muzzleT) + firingPose * muzzleT;
      // Also flare the rifle's scope lens when firing.
      if (rec.lensMat) {
        rec.lensMat.emissiveIntensity = 1.0 + 0.4 * Math.sin(rec.walkT * 0.5) + muzzleT * 2.5;
      }
    }
    // === Boss enrage visuals ===
    // When the boss drops below 40% HP, switch its eye color to red
    // and brighten the sword flame so the player sees the threat
    // escalation. The body emissive adds a faint red glow on the
    // armor for a "heated" look.
    if (kind === "boss" && rec.eyeMat) {
      if (e.enraged) {
        // Red, brighter
        rec.eyeMat.color.setHex(0xff3030);
        rec.eyeMat.emissive.setHex(0xff2010);
        rec.eyeMat.emissiveIntensity = 3.0;
        if (rec.flameMat) {
          rec.flameMat.emissive.setHex(0xff3010);
          rec.flameMat.emissiveIntensity = 3.2 + 0.8 * Math.sin(rec.walkT * 0.7);
        }
        if (rec.bodyMat && rec.bodyMat.emissive) {
          rec.bodyMat.emissive.setRGB(0.45, 0.05, 0.05);
        }
      } else {
        // Normal yellow eyes, gentle flame pulse
        rec.eyeMat.color.setHex(0xffd12b);
        rec.eyeMat.emissive.setHex(0xffd12b);
        rec.eyeMat.emissiveIntensity = 1.8;
        if (rec.bodyMat && rec.bodyMat.emissive) {
          rec.bodyMat.emissive.setRGB(0, 0, 0);
        }
      }
    }
    // === Cape flutter (boss) ===
    // Sway the cape around the base rotation so it looks like it's
    // flowing in the wind. Bigger amplitude when moving / enraged.
    if (kind === "boss" && rec.cape) {
      const speed = e.speed || 0;
      const amp = 0.06 + speed * 0.04 + (e.enraged ? 0.10 : 0);
      rec.cape.rotation.y = Math.sin(rec.walkT * 0.8) * amp;
      rec.cape.rotation.z = Math.cos(rec.walkT * 0.5) * amp * 0.4;
    }
    // === Hurt tint ===
    // Whole-body flash by lerping the body material's emissive toward
    // white. e.hurt ticks down from 0.18 to 0; we map that to a 0..1
    // factor and add white to the emissive color so the body briefly
    // glows.
    const hurt = e.hurt > 0 ? Math.min(1, e.hurt / 0.18) : 0;
    if (rec.bodyMat && rec.bodyMat.emissive) {
      // Restore to black on every frame, then add the hurt emissive.
      // Cheap because we're just doing 3 setRGB calls.
      rec.bodyMat.emissive.setRGB(hurt * 0.9, hurt * 0.6, hurt * 0.6);
    }
    if (rec.eyeMat && rec.eyeMat.emissive) {
      // Eyes flare brighter on hit.
      rec.eyeMat.emissiveIntensity = 1.4 + hurt * 1.5;
    }
  }
}

// Rebuild the 3D world when the player picks a different map at retry.
// initWorld3d runs once and pins the first MAP; without this hook, a
// second run on a different map would draw walls in the wrong places.
function rebuildWorld3d() {
  if (!world3d.ready || !USE_3D_WORLD) return;
  if (world3d.wallsGroup) {
    world3d.scene.remove(world3d.wallsGroup);
    world3d.wallsGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  _buildWorld3dGeometry(world3d.scene);
}

function initWorld3d() {
  if (world3d.ready || world3d.disabled) return;
  if (typeof THREE === "undefined") return;         // Three.js not loaded yet — retry next frame
  if (!ENABLE_3D_ENTITIES) return;
  try {
    const canvas = document.getElementById("world3d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const scene = new THREE.Scene();
    // Vertical FOV matched to the raycaster's horizontal FOV so silhouettes
    // line up when the teammate stands next to a wall segment.
    const aspect = canvas.width / canvas.height;
    const vFov = 2 * Math.atan(Math.tan(FOV / 2) / aspect) * 180 / Math.PI;
    const camera = new THREE.PerspectiveCamera(vFov, aspect, 0.02, MAX_DEPTH);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(canvas.width, canvas.height, false);
    // Phase 2: 3D world (walls+floor+ceiling+enemies+teammate) fills the
    // whole scene now, so make the world3d canvas fully opaque. Fallback
    // (USE_3D_WORLD=false) keeps the pre-Phase-1 transparent behaviour
    // so the raycaster's #game canvas shows through.
    renderer.setClearColor(USE_3D_WORLD ? 0x101015 : 0x000000, USE_3D_WORLD ? 1 : 0);
    // Three.js r155 renamed outputEncoding -> outputColorSpace and made
    // SRGBColorSpace the default for the output pipeline. r128 GLTFLoader
    // still writes the old `texture.encoding = sRGBEncoding` (which is
    // undefined in r160), so we set the output space explicitly here and
    // re-tag the loaded Vanguard textures inside createTeammateFromMixamo.
    if (THREE.SRGBColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Use PBR-correct lighting (r155+ default). The legacy mode was
    // washing dark grays into pink because the warm key light
    // dominated. PBR intensities are physical, so 1.0 means "1 lux"
    // and values stay near 0-2 to feel reasonable.

    // Lights tuned for procedural enemy meshes too — the warm key used
    // to wash dark grays into pink, so the key now sits more neutral
    // (slightly warm 0xfff4dc) and the rim is stronger cool. Ambient
    // bumped so the saturated reds / purples on the enemies don't get
    // diluted by shadow side.
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xfff4dc, 1.5); key.position.set( 2, 4,  1); scene.add(key);
    const rim = new THREE.DirectionalLight(0x6a90d0, 0.7); rim.position.set(-2, 2, -3); scene.add(rim);
    // A second warm fill from the front so enemy faces aren't in deep
    // shadow at typical viewing angles. Neutral white to avoid the
    // previous warm tint that washed the dark knight armor into pink.
    const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(0, 1, 4); scene.add(fill);
    // Apply the weapon env-map as the scene environment so PBR materials
    // (enemy armor, the Vanguard mesh) pick up the same cool-sky / warm-
    // floor reflection gradient the weapons use. Without this, materials
    // with metalness > 0.1 render flat (no reflection contribution) and
    // the colors look washed out.
    if (weaponTextures && weaponTextures.envMap) {
      scene.environment = weaponTextures.envMap;
    }

    // Phase 1 world geometry — walls / floor / ceiling from MAP grid.
    // Adds the same scene the teammate lives in, so z-buffer solves
    // teammate-vs-wall occlusion naturally.
    if (USE_3D_WORLD) _buildWorld3dGeometry(scene);

    // Build entities up front. Each entity stashes its animation state on
    // its own record so the render loop is a simple for-each dispatch.
    // Start with the procedural mesh so the game is visible immediately;
    // kick off the async Mixamo load in the background and swap when ready.
    const teammate = createTeammateMesh();
    scene.add(teammate.group);
    world3d.entities.teammate = teammate;

    Object.assign(world3d, { canvas, scene, camera, renderer, ready: true });
    console.log("[fps][world3d] init OK", {
      canvas: canvas.width + "x" + canvas.height, three: THREE.REVISION,
      entities: Object.keys(world3d.entities),
    });

    // Async: try to swap teammate to the Mixamo Vanguard mesh. On failure
    // we stay on the procedural mesh forever — no user-visible error.
    createTeammateFromMixamo().then(mixamoTeammate => {
      const cur = world3d.entities.teammate;
      // Preserve tracking state so the state machine doesn't miss beats
      // (aimDir snapshot, prev-position, wasDead flag) AND — critical —
      // carry over the current facing direction so we don't reset to
      // rotation.y=0 (mesh's default forward) at the swap moment.
      mixamoTeammate.aimDir     = cur.aimDir;
      mixamoTeammate.prevMuzzle = cur.prevMuzzle;
      mixamoTeammate.prevX      = cur.prevX;
      mixamoTeammate.prevY      = cur.prevY;
      mixamoTeammate.wasDead    = cur.wasDead;
      mixamoTeammate.group.rotation.y = cur.group.rotation.y;
      // Swap in the scene graph.
      scene.remove(cur.group);
      scene.add(mixamoTeammate.group);
      world3d.entities.teammate = mixamoTeammate;
      // (HUD not shown on load — the debug tuning harness is still wired
      // up, so pressing any of the adjust keys ([/] ;/' ,/. -/= etc.)
      // will lazily create + populate the HUD if a future re-tune is
      // needed. URL query params also still override the baked defaults.)
    }).catch(err => {
      console.warn("[fps][world3d] mixamo load FAILED — staying on procedural mesh:", err);
    });
  } catch (err) {
    console.warn("[fps][world3d] init failed — falling back to 2D billboards:", err);
    world3d.disabled = true;
  }
}

// Angle lerp with -π/π wrap. Used by the Mixamo walking branch to smoothly
// rotate the body toward the movement direction — the clip animates the
// legs stepping forward along the mesh's local +Z, so if we hard-snap the
// body to velocity every frame it flickers, and if we don't track velocity
// at all the legs march in one direction while the body faces another.
function _lerpAngle(a, b, t) {
  let d = b - a;
  while (d >  Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * Math.min(1, Math.max(0, t));
}

// Cross-fade helper for the Mixamo state machine. No-op if the new state
// is already current or the target clip didn't load. Enforces a minimum
// dwell time on the current state so per-frame movement-jitter doesn't
// crossfade Walking↔Idle every tick (visible as "walk animation stutters"
// / "跳針"). High-priority states (Dying, HitReact, Firing) bypass the
// hold so damage / death respond immediately.
const _ANIM_HOLD_MS = 200;                            // minimum dwell per state
const _ANIM_PRIORITY = { Dying: 3, HitReact: 2, Firing: 1, Walking: 0, Idle: 0 };
function _crossfadeTeammate(e, next, dur = 0.15) {
  if (!e.isMixamo || !e.actions) return;
  if (next === e.current) return;
  // Priority override: higher-priority state can preempt the hold.
  const newP = _ANIM_PRIORITY[next] ?? 0;
  const curP = _ANIM_PRIORITY[e.current] ?? 0;
  const held = (e.stateHoldT || 0) > 0;
  if (held && newP <= curP) return;                   // still holding low-priority state
  const oldAct = e.actions[e.current];
  const newAct = e.actions[next];
  if (!newAct) return;
  if (oldAct) oldAct.fadeOut(dur);
  newAct.reset().fadeIn(dur).play();
  const _vDbg = typeof e.velBuf !== "undefined" && e.velBuf.length
    ? (e.velBuf.reduce((a, b) => a + b, 0) / e.velBuf.length).toFixed(4)
    : "n/a";
  console.log("[fps][world3d] anim state:", e.current, "->", next, "vAvg=" + _vDbg);
  e.current = next;
  e.stateHoldT = _ANIM_HOLD_MS / 1000;                // arm the hold timer
}

function updateTeammate(dt) {
  const e = world3d.entities.teammate;
  if (!e) return;

  // Mixamo: always tick the animation mixer so poses interpolate between
  // frames. Skipped for procedural (has no mixer).
  if (e.isMixamo && e.mixer) e.mixer.update(dt);

  // Decay the state-hold timer used by _crossfadeTeammate to prevent
  // sub-frame flapping between Idle and Walking.
  if (e.stateHoldT > 0) e.stateHoldT -= dt;

  // ----- occlusion & death -----
  // Hide when wall blocks LOS OR when ally has despawned. Two animation
  // strategies: Mixamo plays the Dying clip (loops once, clamps at last
  // frame); procedural manually rotates the whole model forward by 90°
  // over ~0.4s. Position + facing logic shared.
  if (ally.dead) {
    e.group.position.set(ally.x, 0, ally.y);          // +Z mapping (v2)
    e.group.rotation.y = Math.PI / 2 - ally.dir;      // v3: mesh forward is +Z
    e.group.visible = ally.deadT < 2.0;
    e.wasDead = true;                                 // v4: force facing-snap on next revive
    if (e.isMixamo) {
      _crossfadeTeammate(e, "Dying", 0.15);
    } else {
      // Procedural fallback — rotate the whole model forward.
      const t = Math.min(1, ally.deadT / 0.4);
      e.group.rotation.x = t * (Math.PI / 2);
    }
    return;
  }
  // Multi-sample occlusion — a single ray to the ally's center fails
  // to hide the teammate when their body clips the corner of a wall.
  // Cast rays to 5 sample points (center + 4 body-radius offsets) and
  // show the mesh if ANY has clear LOS. This dramatically improves the
  // "teammate visible through a wall corner" case without full z-buffer
  // integration. Not perfect — the raycaster grid is unit cells so
  // sub-cell partial occlusion still looks wrong — but a good enough
  // patch until we decide on a proper 3D world rewrite.
  const R = 0.22;                                     // body sample offset in world units
  const samples = [
    [ally.x,      ally.y      ],                     // center
    [ally.x + R,  ally.y      ],                     // +X
    [ally.x - R,  ally.y      ],                     // -X
    [ally.x,      ally.y + R  ],                     // +Y
    [ally.x,      ally.y - R  ],                     // -Y
  ];
  let anyVisible = false;
  for (const [sx, sy] of samples) {
    if (!wallBetween(player.x, player.y, sx, sy)) { anyVisible = true; break; }
  }
  e.group.visible = anyVisible;
  if (!anyVisible) return;

  // ----- rotation.x / z always cleared (in case ally revived from death) ----
  e.group.rotation.x = 0;
  e.group.rotation.z = 0;

  // ----- just-revived (or first-ever) snap ---------------------------------
  // On the transition dead -> alive the ally teleports to a spawn tile near
  // the player. If we let the movement-detector see that as a frame's worth
  // of "movement", the teammate would spin to face the teleport direction.
  // Snap prev-pos to current and set facing from ally.dir once. Reset the
  // aim-snapshot machinery so we don't false-trigger a fire event next tick.
  // For Mixamo, also stop the Dying action so the next state transition
  // can play cleanly instead of blending from the clamped last-frame pose.
  if (e.wasDead) {
    e.prevX = ally.x; e.prevY = ally.y;
    e.aimDir = ally.dir;
    e.prevMuzzle = ally.muzzle;
    e.group.rotation.y = Math.PI / 2 - ally.dir;
    e.wasDead = false;
    if (e.isMixamo && e.actions && e.actions.Dying) {
      e.actions.Dying.stop();
    }
  }

  // ----- fire rising-edge detection ----------------------------------------
  // updateAlly() peaks ally.muzzle to 0.12 whenever it fires (a real target
  // is guaranteed alive at that moment — see the `if (target && ally.fireCd
  // <= 0)` guard). Snapshot the AI's aim direction at that exact instant so
  // subsequent frames use the SNAPSHOT rather than the live ally.dir. This
  // fixes the "target dies mid-muzzle-flash and teammate spins to face the
  // player" bug — the AI immediately switches ally.dir to face the player
  // once no target is visible, and if we followed ally.dir live we'd see
  // that spin during the flash decay.
  if (ally.muzzle > e.prevMuzzle) {
    e.aimDir = ally.dir;
    // Trigger a rifle-mesh recoil kick — the Firing_Rifle animation
    // in the Basic Shooter Pack reads wrong so we skip it and pulse
    // the rifle mesh only. Set the kick scalar to 1.0 on the rising
    // edge; the per-frame block below decays it exponentially and
    // applies position + rotation offsets.
    if (e.isMixamo) e._kickT = 1.0;
  }
  e.prevMuzzle = ally.muzzle;

  // ---- Apply rifle-mesh recoil kick (mixamo teammates only) ----
  // Previous version pitched rotation.x by 0.25 rad which, under the
  // baked (-π/2, 0, -π/2) rifle rotation, read as the muzzle jutting
  // FORWARD, not up — the wrong axis mapped to "forward" in world
  // space with those Eulers. Also 14° was too dramatic.
  //
  // New model: reaction force pushes the rifle back and slightly up,
  // plus a tiny pitch up. All three overlay the baked base transform.
  //
  //   backKick  = 0.04 world units (adds to tz — positive tz is back
  //               under the user's calibration; -0.1 was "forward"
  //               out of the chest).
  //   upKick    = 0.008 world units (~8 mm on ty).
  //   pitchKick = 0.05 rad (~3° on rx).
  //
  // Decay time constant ~50 ms → ~150 ms to <5% amplitude.
  if (e.isMixamo && e.rifle && e._kickT !== undefined) {
    // === BAKED RIFLE ORIENTATION (was live-tunable, see _daggerDbg commit) ===
    // The Vanguard rifle transform is fixed at construction time (see the
    // BAKED RIFLE ORIENTATION block when the rifle is added to the right
    // hand). These constants must match those baked values; the kick
    // decay just adds tiny per-frame offsets on top of them.
    const BASE_RX = -0.5 * Math.PI;
    const BASE_RY =  0;
    const BASE_RZ = -0.5 * Math.PI;
    const BASE_TX =  0.01;
    const BASE_TY =  0.05;
    const BASE_TZ =  0.02;
    if (e._kickT > 0.001) {
      e._kickT *= Math.exp(-dt * 20);
      const k = e._kickT;
      const inv = e.rifleInvScale || 1;
      e.rifle.position.set(
        (BASE_TX)         * inv,
        (BASE_TY + 0.008 * k) * inv,
        (BASE_TZ + 0.04  * k) * inv);
      e.rifle.rotation.set(
        BASE_RX + 0.05 * k,
        BASE_RY,
        BASE_RZ);
      e._kickWasActive = true;
    } else if (e._kickWasActive) {
      // Snap back to the baked base one last time so the rifle doesn't
      // get stranded at the last kick-decay position.
      e._kickT = 0;
      e._kickWasActive = false;
      const inv = e.rifleInvScale || 1;
      e.rifle.position.set(BASE_TX * inv, BASE_TY * inv, BASE_TZ * inv);
      e.rifle.rotation.set(BASE_RX, BASE_RY, BASE_RZ);
    }
  }

  // ----- position + walking detection --------------------------------------
  // Velocity-averaged + hysteresis. Previous version used an 8-frame
  // buffer (~130 ms @ 60 fps) which was long enough to smooth per-frame
  // dx=0 stalls but NOT long enough for the "AI stops briefly to re-check
  // target" pauses — user's log showed vAvg=0.0000 flipping the state
  // machine Walking→Idle every ~500 ms. Bumped to 30 frames (~500 ms
  // window) which spans those pauses.
  //
  //   1. Buffer last 30 frames of |velocity| and use the mean.
  //   2. Two thresholds — need vAvg > 0.010 to ENTER walking, and only
  //      drop back to Idle when vAvg < 0.003. Asymmetric hysteresis:
  //      "hard to start moving, easy to keep moving, sticky to stopping".
  const dx = ally.x - e.prevX, dy = ally.y - e.prevY;
  const vNow = Math.hypot(dx, dy);
  e.velBuf = e.velBuf || [];
  e.velBuf.push(vNow);
  if (e.velBuf.length > 30) e.velBuf.shift();
  const vAvg = e.velBuf.reduce((a, b) => a + b, 0) / e.velBuf.length;
  const enterT = 0.010, exitT = 0.003;
  const walking = e.wasWalking ? (vAvg > exitT) : (vAvg > enterT);
  e.wasWalking = walking;
  e.prevX = ally.x; e.prevY = ally.y;

  // ----- facing: Mixamo tracks velocity, procedural locks -----
  // Split per mesh type because the two use fundamentally different walk
  // animations:
  //
  //   Mixamo:      Walking clip is DIRECTIONAL — legs step along the mesh's
  //                local forward. If body doesn't match velocity, feet march
  //                one way while chest points another → visual break.
  //                → Lerp rotation.y toward velocity direction each frame.
  //
  //   Procedural:  Legs swing symmetrically around the hip pivot. Facing
  //                left/right/backward while walking looks the same as
  //                facing forward — the lock semantics work naturally.
  //                → Freeze rotation.y at walk-start; hold for the session.
  //
  // Firing and idle behave the same for both — snap to aim / preserve.
  if (ally.muzzle > 0) {
    e.group.rotation.y = Math.PI / 2 - e.aimDir;
    e.walkFacingLocked = false;
    e.idleSince = 0;
  } else if (walking) {
    e.idleSince = 0;
    if (e.isMixamo) {
      // User's simplified spec: while walking, face velocity direction
      // immediately (no lerp). When stopped, preserve rotation.
      //
      // Zero-velocity guard is important: hysteresis holds `walking = true`
      // for frames where the AI momentarily stops (target re-check),
      // during which dx=dy=0 and atan2(0,0)=0 would compute a spurious
      // desiredRotY=π/2. Skip the write on those frames — rotation
      // preserves naturally, no drift toward the +X axis.
      if (dx !== 0 || dy !== 0) {
        const moveDir = Math.atan2(dy, dx);
        e.group.rotation.y = Math.PI / 2 - moveDir;
      }
    } else {
      // Procedural: freeze whatever rotation.y is at walk-start.
      if (!e.walkFacingLocked) {
        e.walkFacingLockedRotY = e.group.rotation.y;
        e.walkFacingLocked = true;
      }
      e.group.rotation.y = e.walkFacingLockedRotY;
    }
  } else {
    // Idle: preserve. For procedural, unlock after >1 s of continuous
    // idle so the next walking session gets a fresh freeze reference.
    e.idleSince = (e.idleSince || 0) + dt;
    if (e.idleSince > 1.0) e.walkFacingLocked = false;
  }

  // ----- position (world) — always Y=0 for Mixamo (mesh's own feet-anchor)
  // and for procedural (torsoGroup handles bob) --------------------------
  e.group.position.set(ally.x, 0, ally.y);          // +Z mapping (v2)

  if (e.isMixamo) {
    // ---- Mixamo state machine — pick target clip and cross-fade ----
    // Priority: dying > hurt > firing > walking > idle. Dying is handled
    // in the ally.dead branch above; we never reach here while dead.
    let next;
    if (ally.hurt > 0.05)      next = "HitReact";
    // NOTE: Firing skipped intentionally. The Basic Shooter Pack's
    // "firing rifle" clip is a hip-fire with the arms flung wide, which
    // reads terribly on top of an aim-ready Idle. We keep the skeleton
    // on Idle/Walking and instead pitch the rifle mesh up per-shot
    // (see _rifleKickT block in updateTeammate above). The action is
    // still LOADED so future firing clips can be dropped in.
    else if (walking)          next = "Walking";
    else                       next = "Idle";
    // Fallback graceful-degrade: if a specific clip didn't load, pick
    // whatever we do have that fits the mood.
    if (!e.actions[next]) {
      if (walking && e.actions.Idle) next = "Idle";
      else if (e.actions.Idle)       next = "Idle";
      else return;                                  // nothing to play
    }
    _crossfadeTeammate(e, next, 0.15);
    // No manual muzzle-flash quad on Mixamo — the Firing clip's arm pose
    // is the visual signal. A future pass could attach a bone-tracked
    // additive flash sprite; TODO.
  } else {
    // ---- Procedural fallback — hand-driven walk cycle + bob + flash ----
    const WALK_LEG_SWING = 0.65;                    // ~37° hip rotation
    const WALK_ARM_SWING = 0.35;                    // ~20° shoulder rotation
    const WALK_BOB_AMP   = 0.06;                    // mesh-local; ~3cm world after scale
    const WALK_BOB_FREQ  = 2.0;                     // 2x step frequency
    if (walking) {
      e.walkT += dt * 9;
    } else {
      e.walkT *= Math.max(0, 1 - dt * 6);
    }
    const legAmp = walking ? WALK_LEG_SWING : 0.0;
    const armAmp = walking ? WALK_ARM_SWING : 0.0;
    const sw = Math.sin(e.walkT);
    e.legL.rotation.x = +sw * legAmp;
    e.legR.rotation.x = -sw * legAmp;
    e.armL.rotation.x = -sw * armAmp;
    e.armR.rotation.x = +sw * armAmp;
    // Upper-body bob: -amp * (1 - cos(walkT*2)) / 2  → [-amp, 0]
    const walkBobPhase = (1 - Math.cos(e.walkT * WALK_BOB_FREQ)) / 2;
    const walkBob = walking ? -WALK_BOB_AMP * walkBobPhase : 0;
    const idleBreath = walking ? 0 : Math.sin(world3d.t * 1.5) * 0.010;
    e.torsoGroup.position.y = walkBob + idleBreath;
    // Muzzle flash + hurt tint (only for procedural; Mixamo has clip poses)
    e.muzzleFlash.material.opacity = Math.max(0, ally.muzzle / 0.12);
    e.muzzleFlash.rotation.z += dt * 30;
    const hurt = Math.max(0, ally.hurt / 0.2);
    e.chestMat.emissive.setRGB(hurt * 0.7, 0, 0);
  }
}

function renderWorld3d(dt) {
  if (!ENABLE_3D_ENTITIES) return;
  if (!world3d.ready) { initWorld3d(); if (!world3d.ready) return; }
  world3d.t += dt;

  // ----- sync camera to player -----
  // Use SAME sign for grid Y -> Three.js Z. Verified: for player at (2,2),
  // ally at (4,2), dir += 0.1, both raycaster (via screenX < W/2) and
  // Three.js (via dot(ally_dir, camera_right) < 0) put the ally to the
  // LEFT of the screen. With the previous -Z mapping they disagreed and
  // the teammate slid relative to the walls when the player only rotated.
  const cam = world3d.camera;
  // Jump lifts the eye by playerZ (0 when grounded).
  const eyeY = world3d.eyeH + playerZ;
  cam.position.set(player.x, eyeY, player.y);
  // Convert player.pitch (px offset of the horizon) to an equivalent camera
  // pitch in radians. The raycaster clamps pitch to ±H*0.6; using a
  // proportional map to the vertical FOV keeps horizon lines aligned.
  const vFovRad = cam.fov * Math.PI / 180;
  const pitchRad = (player.pitch / H) * vFovRad;
  const targetX = player.x + Math.cos(player.dir) * Math.cos(pitchRad);
  const targetY = eyeY + Math.sin(pitchRad);
  const targetZ = player.y + Math.sin(player.dir) * Math.cos(pitchRad);
  // === Screen shake ===
  // Apply a random offset to the camera position (not the lookAt target)
  // so the world "shakes" but the player's gaze direction is preserved.
  // Random walk ensures the shake feels chaotic, not sinusoidal.
  if (screenShake > 0.001) {
    const s = screenShake;
    const offX = (Math.random() - 0.5) * 2 * s;
    const offY = (Math.random() - 0.5) * 2 * s;
    const offZ = (Math.random() - 0.5) * 2 * s;
    cam.position.set(player.x + offX, eyeY + offY, player.y + offZ);
  } else {
    cam.position.set(player.x, eyeY, player.y);
  }
  cam.lookAt(targetX, targetY, targetZ);
  // Decay the shake magnitude (exponential).
  screenShake = Math.max(0, screenShake - dt * 4.0);
  // Apply a matching CSS shake to the foreground canvas so the world
  // feels shaky in 3D mode. The canvas covers the full viewport, so
  // translating it visually shakes the whole game. transform is reset
  // when shake settles.
  const w3dCanvas = document.getElementById("world3d");
  if (w3dCanvas) {
    if (screenShake > 0.001) {
      const s = screenShake;
      const tx = (Math.random() - 0.5) * 16 * s;
      const ty = (Math.random() - 0.5) * 16 * s;
      w3dCanvas.style.transform = `translate(${tx}px, ${ty}px)`;
    } else {
      w3dCanvas.style.transform = "";
    }
  }
  // Also shake the 2.5D canvas for users on the legacy rendering path.
  const gameCanvas = document.getElementById("game");
  if (gameCanvas && !USE_3D_WORLD) {
    if (screenShake > 0.001) {
      const s = screenShake;
      const tx = (Math.random() - 0.5) * 16 * s;
      const ty = (Math.random() - 0.5) * 16 * s;
      gameCanvas.style.transform = `translate(${tx}px, ${ty}px)`;
    } else {
      gameCanvas.style.transform = "";
    }
  }

  // ----- per-entity updates (batch 1: just the teammate) -----
  updateTeammate(dt);
  if (USE_3D_WORLD) _syncEnemyMeshes(dt);           // Phase 2: enemies as 3D humanoids

  // ----- sniper scope OR laser holo sight: world FOV zoom + overlay -----
  // Base hFOV = FOV (~60°). Sniper scoped hFOV = 20° (deep zoom). Laser
  // holo sight hFOV = 35° (mid zoom). We lerp the camera's VERTICAL FOV
  // so silhouettes align with the current aspect ratio.
  const scoped = _isScoped();
  const holo   = _isLaserScoped();
  if (world3d.baseVFov === undefined) world3d.baseVFov = cam.fov;
  const aspect = cam.aspect;
  const targetHFov = scoped ? 20 : (holo ? 35 : (FOV * 180 / Math.PI));
  const targetVFov = 2 * Math.atan(Math.tan(targetHFov * Math.PI / 360) / aspect) * 180 / Math.PI;
  cam.fov += (targetVFov - cam.fov) * Math.min(1, dt * 12);
  cam.updateProjectionMatrix();

  // Sync the DOM overlays + body classes. Toggle only on change to avoid
  // hitting the layout engine every frame.
  if (world3d._prevScoped !== scoped) {
    world3d._prevScoped = scoped;
    document.body.classList.toggle("scope-active", scoped);
    const ov = document.getElementById("scopeOverlay");
    if (ov) ov.classList.toggle("hidden", !scoped);
  }
  if (world3d._prevHolo !== holo) {
    world3d._prevHolo = holo;
    document.body.classList.toggle("holo-active", holo);
    const ov = document.getElementById("laserScopeOverlay");
    if (ov) ov.classList.toggle("hidden", !holo);
  }

  world3d.renderer.render(world3d.scene, cam);
}

// Keep the world3d canvas / renderer / camera aspect in sync with viewport.
window.addEventListener("resize", () => {
  if (!world3d.ready) return;
  const w = window.innerWidth, h = window.innerHeight;
  world3d.canvas.width = w; world3d.canvas.height = h;
  world3d.renderer.setSize(w, h, false);
  const aspect = w / h;
  world3d.camera.aspect = aspect;
  world3d.camera.fov = 2 * Math.atan(Math.tan(FOV / 2) / aspect) * 180 / Math.PI;
  world3d.camera.updateProjectionMatrix();
});
// === /3D world entities ===

// ---------- Render: minimap ----------
const mm = $("minimap"), mmx = mm.getContext("2d");
function renderMinimap() {
  const s = 150 / MAP_W;
  mmx.clearRect(0, 0, 150, 150);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++)
    if (MAP[y][x] === 1) { mmx.fillStyle = "#4a5578"; mmx.fillRect(x * s, y * s, s + 0.5, s + 0.5); }
  for (const e of enemies) {
    if (e.dead) continue;
    if (e.boss) {
      mmx.fillStyle = "#ff4bd0";
      mmx.beginPath(); mmx.arc(e.x * s, e.y * s, 4, 0, 7); mmx.fill();
    } else {
      mmx.fillStyle = "#ff4b4b";
      mmx.fillRect(e.x * s - 1.5, e.y * s - 1.5, 3, 3);
    }
  }
  // ally
  if (!ally.dead) {
    mmx.fillStyle = "#4dd0ff";
    mmx.beginPath(); mmx.arc(ally.x * s, ally.y * s, 2.5, 0, 7); mmx.fill();
  }
  mmx.fillStyle = "#7dff9a";
  mmx.beginPath(); mmx.arc(player.x * s, player.y * s, 2.5, 0, 7); mmx.fill();
  mmx.strokeStyle = "#7dff9a"; mmx.lineWidth = 1;
  mmx.beginPath();
  mmx.moveTo(player.x * s, player.y * s);
  mmx.lineTo(player.x * s + Math.cos(player.dir) * 10, player.y * s + Math.sin(player.dir) * 10);
  mmx.stroke();
}

// ---------- HUD ----------
// Build the weapon selector bar once; each owned weapon shows its hotkey digit.
const wepbar = $("wepbar");
weapons.forEach((w, i) => {
  const slot = document.createElement("div");
  slot.className = "wepslot";
  slot.dataset.idx = i;
  slot.innerHTML = `<span class="num">${i + 1}</span>${w.name}`;
  slot.addEventListener("click", () => switchWeapon(i));
  wepbar.appendChild(slot);
});
const wepSlots = Array.from(wepbar.children);
let lastHurtOp = -1;
// Direction of the last hit (in world space, radians, where the
// damage came FROM). The damage-direction indicator uses this to
// show a small red arrow at the edge of the screen pointing toward
// the attacker. Defaults to straight back (PI) when unset.
let lastHurtDir = Math.PI;
let lastHurtT = 0;

function updateHUD() {
  $("hpval").textContent = Math.ceil(player.hp);
  $("hpbar").style.width = (player.hp / player.maxHp * 100) + "%";
  $("ammoval").textContent = weapon.reloading ? "…" : (weapon.melee ? "∞" : weapon.mag);
  $("ammomax").textContent = weapon.melee ? "" : weapon.magSize;
  $("wepname").textContent = weapon.name;
  $("scoreval").textContent = score;
  $("waveval").textContent = wave;
  $("killval").textContent = kills;
  $("coinval").textContent = coins;
  // Only touch the overlay opacity when it actually changes.
  const hurtOp = Math.round(Math.max(0, hurtT / 0.4) * 0.9 * 100) / 100;
  if (hurtOp !== lastHurtOp) { $("hurt").style.opacity = hurtOp; lastHurtOp = hurtOp; }
  // === Damage direction indicator ===
  // 2.5D only: draw a small red triangle at the screen edge pointing
  // toward the attacker. The angle is `lastHurtDir - player.dir` in
  // the player's local frame; the indicator is placed 80px in from
  // the screen edge, in the direction of the attacker.
  if (!USE_3D_WORLD && lastHurtT > 0) {
    lastHurtT = Math.max(0, lastHurtT - dt);
    const a = lastHurtT / 0.4;            // 1 = just-hit, 0 = expired
    let rel = lastHurtDir - player.dir;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    // Convert world-relative angle to screen edge point.
    // The screen is 1280x800; we place the indicator 60px from the edge.
    const margin = 60;
    const cx = W / 2 + Math.sin(rel) * (W / 2 - margin);
    const cy = H / 2 - Math.cos(rel) * (H / 2 - margin);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rel);                          // arrow points outward
    // Soft red glow
    ctx.fillStyle = `rgba(255, 60, 60, ${a * 0.45})`;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, 7); ctx.fill();
    // Bright triangle pointing toward attacker
    ctx.fillStyle = `rgba(255, 120, 120, ${a})`;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(-14, 12);
    ctx.lineTo(14, 12);
    ctx.closePath();
    ctx.fill();
    // White center for readability
    ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.9})`;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, 7); ctx.fill();
    ctx.restore();
  }

  // Show on-screen touch controls only while actively playing in touch mode
  const showTouch = touchMode && running && !paused && !gameOver && !shopOpen;
  $("touchui").classList.toggle("on", showTouch);

  // Boss health bar
  const boss = enemies.find(e => e.boss && !e.dead);
  if (boss) {
    $("bossbar").classList.remove("hidden");
    $("bosshp").style.width = Math.max(0, boss.hp / boss.maxHp * 100) + "%";
    $("bossname").textContent = boss.enraged ? "👹 首領 · 狂暴!" : "👹 首領";
  } else {
    $("bossbar").classList.add("hidden");
  }

  // Ally status (hidden entirely when the teammate is disabled)
  $("allystat").style.display = useAlly ? "flex" : "none";
  if (useAlly) {
    $("allyhp").style.width = Math.max(0, ally.hp / ally.maxHp * 100) + "%";
    $("allytxt").textContent = ally.dead ? "已倒下（商店可復活）" : "";
    $("allyhp-wrap").style.opacity = ally.dead ? "0.3" : "1";
  }
  for (let i = 0; i < wepSlots.length; i++) {
    const w = weapons[i];
    wepSlots[i].style.display = w.owned ? "" : "none";   // only owned weapons show in the bar
    wepSlots[i].classList.toggle("active", i === curWep);
    wepSlots[i].classList.toggle("empty", w.mag === 0 && !w.reloading);
  }
}

// ---------- Main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (running && !paused && !gameOver && !shopOpen) {
    update(dt);
    // === persistence: throttled auto-save every AUTOSAVE_INTERVAL_S seconds ===
    autosaveT += dt;
    if (autosaveT >= AUTOSAVE_INTERVAL_S) { saveRun(); autosaveT = 0; }
  }
  _updateTracers(dt);
  _updateSparks(dt);
  _updateSmoke(dt);
  renderWorld();
  renderEnemies();
  _drawTracers();
  _drawSparks();
  _drawSmoke();
  // === 3D world entities: draw the teammate + (future batches) enemies + boss.
  // Runs BEFORE weapon layer so the viewmodel stays on top of world entities. ===
  renderWorld3d(dt);
  renderWeapon();
  // === 3D weapons prototype: overlay render + layer visibility swap ===
  if (weapon && WEAPON_3D[weapon.vm]) render3dWeapon(dt);
  updateWeaponLayerVisibility();
  // === /3D weapons prototype ===
  renderMinimap();
  updateHUD();
  requestAnimationFrame(frame);
}
// === persistence: catch-all save on tab close / refresh / hide ===
// beforeunload is the primary trigger; pagehide + visibilitychange are
// backups because some browsers throttle beforeunload for bfcache /
// background tabs.
addEventListener("beforeunload", () => { saveRun(); });
addEventListener("pagehide",     () => { saveRun(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveRun();
});

// === persistence: ESC-menu Reset button — clears run save + reload ===
// Confirms first so the "Danger Zone" button isn't a one-tap footgun.
$("resetBtn").onclick = () => {
  if (!confirm("重置會清除當前存檔並回到主選單,確定嗎?")) return;
  console.log("[fps][save] state cleared by user, reloading");
  // CRITICAL: neutralize saveRun before location.reload() triggers
  // beforeunload / pagehide / visibilitychange, all three of which call
  // saveRun(). That was RE-WRITING the run state we just cleared,
  // undoing the reset before the page navigated. saveRun's guard is
  // `if (!running || gameOver) return;` — so flipping either flag
  // neutralizes it. Setting BOTH to be extra explicit.
  running = false;
  gameOver = true;
  clearRun();
  // Verify the clear stuck before we navigate — if it didn't, the
  // reload would just auto-resume again.
  const post = localStorage.getItem(RUN_KEY);
  if (post !== null) {
    console.error("[fps][save] clearRun didn't take — reload would re-resume. Sample:", String(post).slice(0, 60));
  } else {
    console.log("[fps][save] verified: run key removed, reloading now");
  }
  location.reload();
};

// === persistence: auto-resume on page load =================================
// Runs after all module-level state, functions, and UI wiring exist.
// If a valid run save is present, restoreRun() rebuilds the world and
// shows the pause menu (so the player unpauses on their own click).
// Any restore failure is caught and treated as "no save" — fresh start.
(function tryAutoResume() {
  const d = loadRun();
  console.log("[fps][save] check localStorage:",
    d ? ("found run @ wave " + d.wave + ", resuming") : "none, fresh start");
  console.log("[fps][boot] page-state @ IIFE", {
    saveExists:      !!localStorage.getItem("simbafps:run:v1"),
    bodyClasses:     document.body.className || "(empty)",
    startHidden:     $("start").classList.contains("hidden"),
    pauseHidden:     $("pause").classList.contains("hidden"),
    overHidden:      $("over").classList.contains("hidden"),
  });
  if (!d) {
    // Fresh page (no save, or Reset just cleared it): explicitly force the
    // start-screen state. Belt-and-braces against any pre-IIFE code path
    // that might have left body / screen classes in an intermediate state.
    document.body.classList.remove("game-running");
    $("start").classList.remove("hidden");
    $("pause").classList.add("hidden");
    $("over").classList.add("hidden");
    $("shop").classList.add("hidden");
    return;
  }
  try {
    restoreRun(d);
  } catch (err) {
    console.warn("[fps][save] restoreRun threw — clearing corrupt save and falling back to start screen:", err);
    clearRun();
    running = false; paused = false; gameOver = false; shopOpen = false;
    document.body.classList.remove("game-running");
    $("pause").classList.add("hidden");
    $("over").classList.add("hidden");
    $("shop").classList.add("hidden");
    $("start").classList.remove("hidden");
  }
})();
requestAnimationFrame(frame);

// === 3D weapons prototype: startup diagnostics ===
console.log("[fps] fps.js loaded", {
  THREE: typeof THREE !== "undefined" ? ("r" + THREE.REVISION) : "MISSING (CDN blocked or slow?)",
  curWep: curWep,
  weapon_id: weapon && weapon.id,
  weapon_vm: weapon && weapon.vm,
  weapon_canvas: !!document.getElementById("weapon"),
  weapon3d_canvas: !!document.getElementById("weapon3d"),
  vm_3d_slots: typeof WEAPON_3D !== "undefined" ? Object.keys(WEAPON_3D) : [],
});
// === /3D weapons prototype ===
