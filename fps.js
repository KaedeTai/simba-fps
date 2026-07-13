"use strict";
/* =========================================================================
   SIMBA FPS — raycasting first-person shooter, single file, no dependencies
   ========================================================================= */

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

// AI teammate — follows the player and shoots the nearest visible enemy
const ally = {
  x: 3.5, y: 4.5, dir: 0, hp: 100, maxHp: 100, speed: 2.9,
  dead: false, deadT: 0, fireCd: 0, muzzle: 0, hurt: 0,
  fireRate: 0.45, damage: 19, range: 11, dist: 999,
  friendly: true, sizeScale: 0.95,
};

// Weapon arsenal — pistol is free from the start; the rest appear in the shop
// as you clear waves (unlockWave) and are bought with coins (cost).
// vm = which viewmodel shape to draw. Every entry also gets per-weapon runtime
// state (mag, reload…) via the .map() below.
const weapons = [
  { id: "pistol",  name: "手槍",     ico: "🔫", magSize: 12, fireRate: 0.13, reloadTime: 1.0,
    damage: 34,  range: 16, spread: 0.030, pellets: 1, auto: false, vm: "pistol",  owned: true },
  { id: "smg",     name: "衝鋒槍",   ico: "💥", magSize: 30, fireRate: 0.06, reloadTime: 1.4,
    damage: 16,  range: 14, spread: 0.080, pellets: 1, auto: true,  vm: "smg",     cost: 150,  unlockWave: 2 },
  { id: "shotgun", name: "霰彈槍",   ico: "🔩", magSize: 6,  fireRate: 0.70, reloadTime: 1.7,
    damage: 14,  range: 10, spread: 0.280, pellets: 8, auto: false, vm: "shotgun", cost: 250,  unlockWave: 3 },
  { id: "rifle",   name: "突擊步槍", ico: "🎯", magSize: 25, fireRate: 0.11, reloadTime: 1.5,
    damage: 30,  range: 20, spread: 0.025, pellets: 1, auto: true,  vm: "rifle",   cost: 350,  unlockWave: 4 },
  { id: "sniper",  name: "狙擊槍",   ico: "🔭", magSize: 5,  fireRate: 0.80, reloadTime: 1.8,
    damage: 130, range: 28, spread: 0.002, pellets: 1, auto: false, vm: "sniper",  cost: 500,  unlockWave: 5 },
  { id: "autosg",  name: "自動霰彈", ico: "🧨", magSize: 10, fireRate: 0.28, reloadTime: 1.9,
    damage: 12,  range: 11, spread: 0.300, pellets: 7, auto: true,  vm: "shotgun", cost: 550,  unlockWave: 6 },
  { id: "laser",   name: "雷射槍",   ico: "⚡", magSize: 40, fireRate: 0.05, reloadTime: 1.6,
    damage: 22,  range: 22, spread: 0.006, pellets: 1, auto: true,  vm: "smg",     cost: 700,  unlockWave: 7 },
  { id: "minigun", name: "機槍",     ico: "🌀", magSize: 80, fireRate: 0.04, reloadTime: 2.6,
    damage: 15,  range: 16, spread: 0.100, pellets: 1, auto: true,  vm: "smg",     cost: 900,  unlockWave: 8 },
  { id: "plasma",  name: "電漿炮",   ico: "☄️", magSize: 20, fireRate: 0.22, reloadTime: 1.9,
    damage: 75,  range: 20, spread: 0.020, pellets: 1, auto: true,  vm: "rifle",   cost: 1400, unlockWave: 10 },
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
  try { localStorage.removeItem(RUN_KEY); } catch (e) {}
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

function spawnWave(n) {
  const count = n * mapScale();
  for (let i = 0; i < count; i++) {
    const p = findSpawn(25);
    if (!p) continue;
    const hp = 40 + wave * 8;
    enemies.push({
      x: p.x, y: p.y, hp, maxHp: hp,
      speed: 0.9 + Math.random() * 0.5 + wave * 0.05,
      dmg: 8 + wave, reward: 25, scoreVal: 100,
      radius: 0.45, sizeScale: 1, boss: false,
      hurt: 0, dead: false, deadT: 0, attackCd: 0, dist: 999,
    });
  }
}

function spawnBoss() {
  const p = findSpawn(36) || { x: MAP_W - 3.5, y: MAP_H - 3.5 };
  const hp = 900 + wave * 180;                 // tougher: bigger HP pool
  const reward = 650 + wave * 110;
  enemies.push({
    x: p.x, y: p.y, hp, maxHp: hp,
    speed: 0.8 + wave * 0.03,
    dmg: 30 + wave * 2, reward, scoreVal: 2500,
    radius: 0.95, sizeScale: 2.4, boss: true, reach: 1.8,
    enraged: false,
    hurt: 0, dead: false, deadT: 0, attackCd: 0, dist: 999,
  });
  bossAlive = true;
  showBanner(`⚠ 首領來襲！血量 ${hp}，血低時會狂暴！擊倒可獲 ${reward} 金幣`);
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
  const dm = e.code.match(/^Digit([1-9])$/);
  if (dm) switchWeapon(+dm[1] - 1);
  if (e.code === "KeyQ") cycleWeapon(-1);
  if (e.code === "KeyE") cycleWeapon(1);
  if (e.code === "KeyB" || e.code === "Tab") {
    e.preventDefault();
    if (shopOpen) closeShop(); else if (running && !gameOver && !paused) openShop(false);
  }
});
addEventListener("keyup", e => { keys[e.code] = false; });
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
document.addEventListener("mousemove", e => {
  if (document.pointerLockElement === screen && !paused) {
    player.dir += e.movementX * 0.0022;
    // vertical look: shift the horizon (moving mouse up looks up)
    player.pitch -= e.movementY * 1.3;
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
})();
$("acct").addEventListener("change", () => { loadProfile($("acct").value); applyProfileToStartUI(); });
$("acct").addEventListener("keydown", e => { if (e.key === "Enter") $("acct").blur(); });
$("allytoggle").addEventListener("change", () => {
  useAlly = $("allytoggle").checked;
  profile.useAlly = useAlly; saveProfile();
});
$("touchtoggle").addEventListener("change", () => { touchMode = $("touchtoggle").checked; });

function startGame() {
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
    w.owned = (w.id === "pistol");   // start each run with only the pistol; buy the rest in the shop
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
  if (weapon.mag <= 0) { reload(); return; }
  weapon.mag--;
  weapon.cooldown = weapon.fireRate;
  weapon.recoil = 1;
  muzzleFlash();
  // === 3D weapons prototype: mirror the fire event to the 3D viewmodel ===
  if (WEAPON_3D[weapon.vm]) weapon3dFire();

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
      if (best.hp <= 0 && !best.dead) {
        best.dead = true; best.deadT = 0;
        kills++; score += best.scoreVal; coins += best.reward;
        if (best.boss) { bossAlive = false; showBanner(`🏆 首領已擊倒！獲得 ${best.reward} 金幣`); }
      }
    }
  }
}

function reload() {
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

function muzzleFlash() {
  const f = $("flash");
  f.style.opacity = "0.9";
  setTimeout(() => { f.style.opacity = "0"; }, 55);
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
  const spd = ((sprinting && allowSprint) ? player.sprint : player.speed) * dt;
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
    e.dist = Math.hypot(player.x - e.x, player.y - e.y);

    // boss enrages below 40% HP: faster, hits more often
    if (e.boss) e.enraged = e.hp < e.maxHp * 0.4;

    // pick target
    const dPlayer = e.dist;
    const dAlly = ally.dead ? Infinity : Math.hypot(ally.x - e.x, ally.y - e.y);
    let tgt = player, tdist = dPlayer;
    if (dAlly < dPlayer) { tgt = ally; tdist = dAlly; }
    const tx = tgt.x - e.x, ty = tgt.y - e.y;

    const reach = e.reach || 1.1;
    const sees = !wallBetween(e.x, e.y, tgt.x, tgt.y);
    // === persistence: freeze enemy movement during resume-safety grace ===
    if (sees && tdist > reach - 0.2 && resumeSafetyT <= 0) {
      const step = e.speed * (e.enraged ? 1.5 : 1) * dt;
      const nx = tx / tdist * step, ny = ty / tdist * step;
      if (!isWall(e.x + nx, e.y)) e.x += nx;
      if (!isWall(e.x, e.y + ny)) e.y += ny;
    }
    if (e.attackCd > 0) e.attackCd -= dt;
    // === persistence: no attacks during the grace period either ===
    if (tdist < reach && sees && e.attackCd <= 0 && resumeSafetyT <= 0) {
      e.attackCd = (e.boss ? 1.2 : 0.9) * (e.enraged ? 0.55 : 1);
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
  smg:     { hipPos: [ 0.32, -0.42, -0.62 ], aimPos: [ 0.00, -0.17, -0.55 ], recoilScale: 0.60 },
  shotgun: { hipPos: [ 0.35, -0.44, -0.72 ], aimPos: [ 0.00, -0.20, -0.60 ], recoilScale: 1.80 },
  rifle:   { hipPos: [ 0.34, -0.42, -0.70 ], aimPos: [ 0.00, -0.19, -0.58 ], recoilScale: 1.10 },
  // Sniper: slightly further back at hip (heavier feel), aim pose centres
  // the scope tube on the crosshair, hard zoom (30° FOV) on ADS.
  sniper:  { hipPos: [ 0.35, -0.44, -0.78 ], aimPos: [ 0.00, -0.05, -0.40 ], recoilScale: 1.50, adsFov: 30 },
};

const w3d = {
  canvas: null, scene: null, camera: null, renderer: null,
  meshes: {},                           // vm -> THREE.Group (built at init)
  ready: false, disabled: false,
  aimT: 0,                              // 0 = hip, 1 = aimed
  recoilKick: 0, muzzleFlashT: 0,
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
function _mat(color, metalness, roughness) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
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
  const steel  = _mat(0x35393f, 0.60, 0.50);   // slide
  const grip   = _mat(0x2a2d33, 0.15, 0.85);   // grip (matte)
  const dark   = _mat(0x22252a, 0.55, 0.50);   // barrel, guard, sights
  const collar = _mat(0x1a1c1f, 0.65, 0.45);   // muzzle collar (darkest)

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
  const steel  = _mat(0x35393f, 0.60, 0.50);
  const grip   = _mat(0x2a2d33, 0.15, 0.85);
  const dark   = _mat(0x22252a, 0.55, 0.50);
  const collar = _mat(0x1a1c1f, 0.65, 0.45);
  const wood   = _mat(0x4a3a2a, 0.05, 0.85);   // warm walnut stock

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
  const steel  = _mat(0x35393f, 0.60, 0.50);
  const grip   = _mat(0x2a2d33, 0.15, 0.85);
  const dark   = _mat(0x22252a, 0.55, 0.50);
  const collar = _mat(0x1a1c1f, 0.65, 0.45);
  const wood   = _mat(0x4a3a2a, 0.05, 0.85);
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
  const steel  = _mat(0x35393f, 0.55, 0.55);
  const grip   = _mat(0x2a2d33, 0.15, 0.85);
  const dark   = _mat(0x22252a, 0.55, 0.50);
  const collar = _mat(0x1a1c1f, 0.65, 0.45);
  const wood   = _mat(0x4a3a2a, 0.05, 0.85);
  const brass  = _mat(0xd0a04a, 0.75, 0.30);    // brass bead

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
  const steel  = _mat(0x35393f, 0.60, 0.50);
  const grip   = _mat(0x2a2d33, 0.15, 0.85);
  const dark   = _mat(0x22252a, 0.55, 0.50);
  const collar = _mat(0x1a1c1f, 0.65, 0.45);

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

    // Build all five weapon meshes up front, add to scene, hide until equipped.
    // Cheap enough to keep them all resident — a few dozen primitives each.
    w3d.meshes.pistol  = createPistolMesh();
    w3d.meshes.smg     = createSmgMesh();
    w3d.meshes.shotgun = createShotgunMesh();
    w3d.meshes.rifle   = createRifleMesh();
    w3d.meshes.sniper  = createSniperMesh();
    for (const key of Object.keys(w3d.meshes)) {
      w3d.meshes[key].visible = false;
      scene.add(w3d.meshes[key]);
    }

    Object.assign(w3d, { canvas, scene, camera, renderer, ready: true });
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
  const rk = w3d.recoilKick * cfg.recoilScale;                     // per-weapon intensity

  // ----- compose final pose -----
  const a = w3d.aimT;
  const hx = cfg.hipPos[0], hy = cfg.hipPos[1], hz = cfg.hipPos[2];
  const ax = cfg.aimPos[0], ay = cfg.aimPos[1], az = cfg.aimPos[2];
  const px = hx * (1 - a) + ax * a + bobX + w3d.turnLagX * 0.4;
  // MUZZLE RISE on fire: weapon translates UP (+y) and BACK toward viewer (+z).
  const py = hy * (1 - a) + ay * a + bobY + w3d.turnLagY * 0.35 + rk * 0.055;
  const pz = hz * (1 - a) + az * a + rk * 0.030;
  mesh.position.set(px, py, pz);
  // MUZZLE RISE (rotation): +rotation.x lifts the barrel tip up. The previous
  // version had this sign flipped, so recoil looked like muzzle DEPRESSION.
  // Also flipped the turnLagY coupling so a look-up-fast lag now tilts the
  // barrel slightly DOWN relative to the new view (natural lag).
  mesh.rotation.set(
    +rk * 0.28 - w3d.turnLagY * 1.2,        // pitch: +x = barrel up (muzzle rise on fire)
    -w3d.turnLagX * 1.4,                    // yaw lag
     w3d.turnLagX * 0.15                    // subtle roll on turn
  );

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
  const flash = mesh.userData.flash;
  const mf = w3d.muzzleFlashT / 0.09;
  flash.material.opacity = Math.max(0, mf);
  flash.rotation.z += dt * 40;                                     // twinkle
  flash.scale.setScalar(0.7 + mf * 0.9);

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
const USE_3D_WORLD = true;

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
const MIXAMO_FILES = {
  character: "vanguard.glb",
  Idle:      "Idle.glb",
  Walking:   "Walking.glb",
  Firing:    "Firing_Rifle.glb",
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
  if (actions.Firing)   { actions.Firing.setLoop(THREE.LoopOnce, 1);   actions.Firing.clampWhenFinished   = true; }
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
  const allBones = [];
  model.traverse(o => {
    if (o.isBone || o.type === "Bone") allBones.push(o.name);
    if (rightHand) return;
    if (/RightHand$/i.test(o.name) || /right[_:-]?hand$/i.test(o.name)) {
      rightHand = o;
    }
  });
  if (rightHand) {
    const rifle = _buildAllyRifle();
    // Mixamo hand local axes (typical): fingers extend along +X, palm faces
    // -Y (down toward wrist), thumb toward +Z. Rifle's forward is +Z. To
    // point the barrel along the fingers (out of the palm), rotate the
    // rifle -π/2 around Y so its local +Z aligns with the hand's +X.
    // Position it slightly forward of the palm and rotate the grip to
    // sit in the hand.
    // Scale accounts for the outer group.scale (~0.0031) — bones are in
    // model-local coords which are also affected by the outer scale.
    // Building the rifle in model-scale means the outer scale shrinks it
    // properly; sizes above are in model-scale (~1.7 m tall), so the
    // rifle geometry is in "world-ish" size.
    rifle.rotation.set(0, -Math.PI / 2, 0);
    rifle.position.set(6, -3, 4);              // model-local units before outer scale
    rightHand.add(rifle);
    console.log("[fps][world3d] rifle attached to", rightHand.name);
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
function _createEnemyMesh(e) {
  const isBoss = !!e.boss;
  const g = new THREE.Group();

  const bodyColor = isBoss ? 0x7c37a2 : 0x8f3232;
  const darkColor = isBoss ? 0x26123c : 0x3a1414;
  const trimColor = isBoss ? 0xffcf3b : 0xe59a9a;
  const eyeHex    = isBoss ? 0xffd12b : 0xff4b4b;

  const bodyMat  = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.85, metalness: 0.10 });
  const darkMat  = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.90, metalness: 0.05 });
  const trimMat  = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.70, metalness: 0.30 });
  const chestMat = new THREE.MeshStandardMaterial({ color: darkColor, roughness: 0.90 });   // hurt-tint target
  const eyeMat   = new THREE.MeshStandardMaterial({
    color: eyeHex, roughness: 0.30, emissive: eyeHex, emissiveIntensity: 0.9,
  });

  // Torso (main body)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.50, 0.20), bodyMat);
  torso.position.y = 0.55; g.add(torso);
  // Chest plate — for hurt flash target
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.05), chestMat);
  chest.position.set(0, 0.60, 0.11); g.add(chest);
  // Pauldrons
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.16), trimMat);
  shoulderL.position.set(-0.21, 0.77, 0); g.add(shoulderL);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = +0.21; g.add(shoulderR);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), bodyMat);
  head.position.set(0, 0.94, 0); g.add(head);
  // Glowing eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat);
  eyeL.position.set(-0.05, 0.96, 0.11); g.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = +0.05; g.add(eyeR);

  // Boss horns — curved cones tilted outward
  if (isBoss) {
    const hornGeo = new THREE.ConeGeometry(0.030, 0.18, 6);
    const hornL = new THREE.Mesh(hornGeo, trimMat);
    hornL.position.set(-0.08, 1.06, 0);
    hornL.rotation.z = +0.5; hornL.rotation.x = -0.3; g.add(hornL);
    const hornR = hornL.clone();
    hornR.position.x = +0.08;
    hornR.rotation.z = -0.5; hornR.rotation.x = -0.3; g.add(hornR);
  }

  // Arms — pivoted at shoulder for swing animation
  function makeArm(sideX) {
    const arm = new THREE.Group();
    arm.position.set(sideX, 0.77, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), bodyMat);
    upper.position.y = -0.12; arm.add(upper);
    const fist  = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), darkMat);
    fist.position.y = -0.27; arm.add(fist);
    return arm;
  }
  const armL = makeArm(-0.22); g.add(armL);
  const armR = makeArm(+0.22); g.add(armR);

  // Legs — pivoted at hip for walk cycle
  function makeLeg(sideX) {
    const leg = new THREE.Group();
    leg.position.set(sideX, 0.32, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.28, 8), darkMat);
    thigh.position.y = -0.14; leg.add(thigh);
    const shin  = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.045, 0.25, 8), darkMat);
    shin.position.y = -0.40; leg.add(shin);
    const boot  = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.050, 0.13), darkMat);
    boot.position.set(0, -0.54, 0.02); leg.add(boot);
    return leg;
  }
  const legL = makeLeg(-0.08); g.add(legL);
  const legR = makeLeg(+0.08); g.add(legR);

  // Scale — the base mesh is ~1.06 units feet-to-top-of-head. Multiply
  // by 0.55 (roughly matching TEAMMATE_SCALE 0.49 for consistent perceived
  // size) and then by the enemy's sizeScale (2.4 for boss, 1 for grunt).
  const scale = (e.sizeScale || 1) * 0.55;
  g.scale.setScalar(scale);

  return {
    group: g, bodyMat, darkMat, chestMat,
    armL, armR, legL, legR,
    walkT: 0,
  };
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

  // Ceiling plane — darker tiled panel, faint pin-lights.
  const ceilTex = _buildCeilingTexture();
  ceilTex.repeat.set(MAP_W, MAP_H);
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 });
  const ceiling = new THREE.Mesh(floorGeo.clone(), ceilMat);
  ceiling.rotation.x = +Math.PI / 2;
  ceiling.position.set(MAP_W / 2, 1, MAP_H / 2);
  scene.add(ceiling);

  console.log("[fps][world3d] Phase 2 geometry built", {
    walls: wallCount, map: MAP_W + "x" + MAP_H, textured: true,
  });

  world3d.wallsGroup = wallsGroup;
  world3d.floor      = floor;
  world3d.ceiling    = ceiling;
  world3d.wallTex    = wallTex;
  world3d.floorTex   = floorTex;
  world3d.ceilTex    = ceilTex;
}

// Enemy mesh lifecycle + per-frame animation. Called each frame while
// USE_3D_WORLD is on. Creates a Three.js Group per enemy on first sight
// (via _createEnemyMesh), removes when the enemy exits enemies[] after
// its death timeout. Walk cycle + hurt tint + death roll are procedural,
// matching the humble teammate animation approach.
function _syncEnemyMeshes(dt) {
  if (!world3d.scene) return;
  if (!world3d.enemyMeshes) world3d.enemyMeshes = new Map();
  const meshes = world3d.enemyMeshes;
  const live = new Set(enemies);
  // Prune meshes for enemies no longer in the roster (removed after
  // deadT window elapses in update()).
  for (const [enemy, rec] of meshes) {
    if (!live.has(enemy)) {
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
    // Face the player (AI has enemies chase the player, so pointing at
    // them makes the 3D silhouette read correctly).
    const dxE = player.x - e.x, dyE = player.y - e.y;
    const faceDir = Math.atan2(dyE, dxE);
    rec.group.rotation.y = Math.PI / 2 - faceDir;
    // Visibility + death: fall forward and hide once the despawn window
    // (~1.2 s) elapses.
    if (e.dead) {
      const t = Math.min(1, e.deadT / 0.4);
      rec.group.rotation.x = t * (Math.PI / 2);
      rec.group.visible = e.deadT < 1.2;
    } else {
      rec.group.rotation.x = 0;
      rec.group.visible = true;
    }
    // Walk cycle — legs and arms swing in counter-phase. Speed roughly
    // matched to enemy movement speed (grunts ~1 unit/s → 1.4 Hz cadence).
    rec.walkT += dt * 9;
    const sw = Math.sin(rec.walkT);
    const legAmp = e.dead ? 0 : 0.50;
    const armAmp = e.dead ? 0 : 0.25;
    rec.legL.rotation.x = +sw * legAmp;
    rec.legR.rotation.x = -sw * legAmp;
    rec.armL.rotation.x = -sw * armAmp;
    rec.armR.rotation.x = +sw * armAmp;
    // Hurt tint — chestMat's emissive briefly glows red on damage.
    const hurt = e.hurt > 0 ? Math.min(1, e.hurt / 0.18) : 0;
    if (rec.chestMat && rec.chestMat.emissive) {
      rec.chestMat.emissive.setRGB(hurt * 0.8, 0, 0);
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
    // Also keep the pre-r155 non-physical light math so the intensity
    // values below match what worked in earlier revisions of this scene.
    if ("useLegacyLights" in renderer) renderer.useLegacyLights = true;

    // Lights bumped up from the earlier procedural-only values now that
    // the Vanguard mesh (with real PBR textures) shares this scene.
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xfff2c8, 1.10); key.position.set( 2, 4,  1); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ac0ff, 0.45); rim.position.set(-2, 2, -3); scene.add(rim);

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
  }
  e.prevMuzzle = ally.muzzle;

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
    else if (ally.muzzle > 0)  next = "Firing";
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
  cam.position.set(player.x, world3d.eyeH, player.y);
  // Convert player.pitch (px offset of the horizon) to an equivalent camera
  // pitch in radians. The raycaster clamps pitch to ±H*0.6; using a
  // proportional map to the vertical FOV keeps horizon lines aligned.
  const vFovRad = cam.fov * Math.PI / 180;
  const pitchRad = (player.pitch / H) * vFovRad;
  const targetX = player.x + Math.cos(player.dir) * Math.cos(pitchRad);
  const targetY = world3d.eyeH + Math.sin(pitchRad);
  const targetZ = player.y + Math.sin(player.dir) * Math.cos(pitchRad);
  cam.lookAt(targetX, targetY, targetZ);

  // ----- per-entity updates (batch 1: just the teammate) -----
  updateTeammate(dt);
  if (USE_3D_WORLD) _syncEnemyMeshes(dt);           // Phase 2: enemies as 3D humanoids

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

function updateHUD() {
  $("hpval").textContent = Math.ceil(player.hp);
  $("hpbar").style.width = (player.hp / player.maxHp * 100) + "%";
  $("ammoval").textContent = weapon.reloading ? "…" : weapon.mag;
  $("ammomax").textContent = weapon.magSize;
  $("wepname").textContent = weapon.name;
  $("scoreval").textContent = score;
  $("waveval").textContent = wave;
  $("killval").textContent = kills;
  $("coinval").textContent = coins;
  // Only touch the overlay opacity when it actually changes.
  const hurtOp = Math.round(Math.max(0, hurtT / 0.4) * 0.9 * 100) / 100;
  if (hurtOp !== lastHurtOp) { $("hurt").style.opacity = hurtOp; lastHurtOp = hurtOp; }

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
  renderWorld();
  renderEnemies();
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
  clearRun();
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
  if (!d) return;
  try {
    restoreRun(d);
  } catch (err) {
    console.warn("[fps][save] restoreRun threw — clearing corrupt save and falling back to start screen:", err);
    clearRun();
    running = false; paused = false; gameOver = false; shopOpen = false;
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
