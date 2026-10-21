// Evaluated in the page by N64Recomp-browser's tools/record_shaders.mjs (tools/shader_plan.json), to start any chapter
// or multiplayer mode by code, without anyone playing. It needs no change to the game: the bar's menus (func_151E51EC
// runs one of them a frame, by the phase in D_800E0B94) end each choice with phase 7, which fades the screen out at
// the speed in D_8008FD74 and then calls the function in D_800E0A88, and this sets those as a menu would:
//
// - startCheckpoint(i) calls func_151E30C4, Continue's function, with D_8008FDB4 (a developer's switch the game never
//   writes) set, so that it starts at checkpoint i of the table at 0x80087438 (20 bytes each: the scene, its entry
//   point, the names) instead of the save's.
// - startMulti(mode, bots) calls func_151E2834, the multiplayer menu's start, with mode (gGameState[0x42]: an entry
//   of the table at 0x800AB68C, the scene at +2) and player 1 plus that many bots (-2) in the player slots at
//   D_8008FE44, on teams 0 and 1 by turns (D_800E0C00).
//
// Both starts resolve once the scene (0x800BE9F0) has changed, or with false after 30 s, which is what a checkpoint in
// the scene already gives (Windy's later ones are scene 6 again). allowSkip() lets L skip the cutscene playing, scene() gives
// the scene and phase, and waitScene(id, ms) waits for one. startAt(i, scene, ms) starts checkpoint i and resolves
// with scene() once the scene it gives is that one, and throws, naming the scene playing, if it isn't (or if the scene
// hasn't changed in ms, 30 s if not given): a play plan's need before each place it plays. RDRAM is found as the
// recorder's n64r finds it; bytes and halfwords sit at the address XOR 3 and XOR 2 in its little-endian words.
(() => {
  if (!window.__rdram) {
    const h = HEAPU32;
    for (let i = 2; i < h.length - 8; i++) {
      if (h[i] === 0xB0000000 && h[i - 2] <= 2 && (h[i + 4] === 0x400000 || h[i + 4] === 0x800000)) {
        window.__rdram = i * 4 - 0x308;
        break;
      }
    }
  }
  const base = window.__rdram;
  const off = (a) => base + (a - 0x80000000);
  const w8 = (a, v) => { HEAPU8[off(a) ^ 3] = v; };
  const w16 = (a, v) => { HEAPU16[(off(a) ^ 2) >>> 1] = v; };
  const w32 = (a, v) => { HEAPU32[off(a) >>> 2] = v >>> 0; };
  const r8 = (a) => HEAPU8[off(a) ^ 3];
  const r32 = (a) => HEAPU32[off(a) >>> 2];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  window.scene = () => ({ scene: r32(0x800BE9F0), phase: r8(0x800E0B94) });
  window.waitScene = async (id, ms = 120000) => {
    for (let t = 0; t < ms; t += 100) { if (r32(0x800BE9F0) === id) return true; await sleep(100); }
    return false;
  };
  const fadeThenCall = async (func, ms = 30000) => {
    const before = r32(0x800BE9F0);
    w32(0x800E0A88, func);
    w8(0x8008FD74, 3);
    w8(0x800E0B94, 7);
    for (let t = 0; t < ms; t += 100) { if (r32(0x800BE9F0) !== before) return true; await sleep(100); }
    return false;
  };
  // L skips the cutscene playing (func_1501E05C) once these say it may: D_800D2E40 as Continue sets it, and
  // D_800C3C9C, which a cutscene that may never be skipped sets as it starts (the new game's opening is one).
  window.allowSkip = () => { w8(0x800D2E40, 1); w8(0x800C3C9C, 0); return true; };
  window.startCheckpoint = (i, ms) => {
    w8(0x8008FDB4, 1);
    w16(0x8008FDAC, i);
    return fadeThenCall(0x151E30C4, ms);
  };
  window.startAt = async (i, want, ms) => {
    const changed = await window.startCheckpoint(i, ms);
    const now = window.scene();
    if (!changed || (want !== undefined && now.scene !== want)) throw new Error(`checkpoint ${i}: scene ${JSON.stringify(now)}, not ${want}`);
    return now;
  };
  window.startMulti = (mode, bots = 3) => {
    const state = r32(0x8008FDD4);
    w8(state + 0x42, mode);
    w8(0x8008FE44, 0);
    for (let p = 1; p < 16; p++) w8(0x8008FE44 + p, (p <= bots) ? 0xFE : 0xFF);
    for (let p = 0; p < 16; p++) w8(0x800E0C00 + p, p & 1);
    return fadeThenCall(0x151E2834);
  };
  return base ? 'rdram at ' + base.toString(16) + ', scene ' + JSON.stringify(window.scene()) : 'RDRAM not found';
})()
