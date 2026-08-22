import * as THREE from "three";
import { AudioEngine } from "./audio";
import { COLORS, MATCH, MOVE, TEAM, type Team } from "./config";
import {
  buildAshpier,
  nearestWaypoint,
  siteAt,
  waypointById,
  type MapData,
  type Site,
  type Waypoint,
} from "./map";
import {
  collideCircleBoxes,
  groundSpeed,
  moveInaccuracy,
  segmentHitsBoxes,
  stepMovement,
} from "./physics";
import { isLockAcquireClick, isMatchPhase, nextBuyOpen, shouldDiscardLook, shouldIgnoreLockShot, siteUseState } from "./playControls";
import { radarWorldToCanvas, radarYawTip } from "./radar";
import { isTitleStartKey } from "./titleStart";
import {
  GEAR,
  WEAPONS,
  applyRecoil,
  cycleTime,
  PLAYER_HURT_PER_SECOND,
  PLAYER_HURT_PER_TICK,
  botChipDamage,
  hitDamage,
  makeWeapon,
  soakArmor,
  sprayOffset,
  takePlayerHurt,
  viewKick,
  type WeaponState,
} from "./weapons";

export type Actor = {
  id: number;
  name: string;
  team: Team;
  bot: boolean;
  alive: boolean;
  hp: number;
  armor: number;
  helm: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  crouch: boolean;
  walk: boolean;
  onGround: boolean;
  money: number;
  kit: boolean;
  flashes: number;
  smokes: number;
  frags: number;
  primary: WeaponState | null;
  pistol: WeaponState;
  active: "primary" | "pistol";
  hasBomb: boolean;
  loss: number;
  kills: number;
  deaths: number;
  spawnOffset: number;
  nextWp: string;
  aimT: number;
  fireHold: boolean;
  lastFoot: number;
};

type Phase = "menu" | "freeze" | "live" | "planted" | "end";

type KillLine = { t: number; text: string; head: boolean };

const NAMES_RAID = ["Ash", "Harbor", "Weld", "Cinder", "Keel"];
const NAMES_LINE = ["Vera", "Quay", "Nox", "Pylon", "Reef"];

function el<T extends HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`#${id} missing`);
  return n as T;
}

export class Raidline {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  map: MapData;
  audio = new AudioEngine();
  player!: Actor;
  actors: Actor[] = [];
  phase: Phase = "menu";
  attackTeam: Team = TEAM.RAID;
  score = [0, 0];
  round = 0;
  timer = 0;
  bombT = 0;
  plantT = 0;
  defuseT = 0;
  bombSite: Site | null = null;
  bombX = 0;
  bombZ = 0;
  bombArmed = false;
  keys = new Set<string>();
  mouseDown = false;
  lookX = 0;
  locked = false;
  buyOpen = false;
  tabOpen = false;
  scoped = false;
  flash = 0;
  hitmark = 0;
  dmgDir = 0;
  dmgT = 0;
  kills: KillLine[] = [];
  bombBeep = 0;
  idSeq = 1;
  clock = new THREE.Clock();
  meshes = new Map<number, THREE.Group>();
  bombMesh: THREE.Mesh | null = null;
  smokeMeshes: THREE.Mesh[] = [];
  smokeT: { x: number; z: number; t: number }[] = [];
  tracers: { mesh: THREE.Mesh; t: number }[] = [];
  impacts: { mesh: THREE.Mesh; t: number }[] = [];
  screenFx: { x0: number; y0: number; x1: number; y1: number; t: number; muzzle: boolean }[] = [];
  viewmodel = new THREE.Group();
  muzzle: THREE.PointLight | null = null;
  muzzleSprite: THREE.Mesh | null = null;
  muzzleT = 0;
  bob = 0;
  hitHead = false;
  lockBound = false;
  paused = false;
  ignoreLook = 0;
  fireHeld = false;
  ignoreFireUntilUp = false;
  pendingLockClick = false;
  lockButtonDown = false;
  liveElapsed = 0;
  siteHintT = 0;
  hpTicks: { n: number; t: number }[] = [];
  playerHurtBudget = PLAYER_HURT_PER_TICK;
  playerHurtSecondBudget = PLAYER_HURT_PER_SECOND;
  playerHurtSecondT = 0;
  spawnProtT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6b7c86);
    this.scene.fog = new THREE.Fog(0x6b7c86, 70, 160);
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 160);
    this.buildViewmodel();
    this.map = buildAshpier();
    this.scene.add(this.map.visuals);
    this.light();
    this.bind();
    this.resetMatch();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.hud();
  }

  light(): void {
    const hemi = new THREE.HemisphereLight(0xc8d6e0, 0x3a3228, 1.05);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe2c4, 1.15);
    sun.position.set(-20, 34, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);
    const aWarm = new THREE.PointLight(0xffb040, 18, 16, 2);
    aWarm.position.set(-23, 3.2, 18);
    this.scene.add(aWarm);
    const bCool = new THREE.PointLight(0x40d0e8, 18, 16, 2);
    bCool.position.set(24, 3.2, 16);
    this.scene.add(bCool);
  }

  bind(): void {
    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    addEventListener("keydown", (e) => {
      if (this.phase === "menu" && isTitleStartKey(e.code, e.key)) {
        e.preventDefault();
        this.start();
        return;
      }
      if (this.paused && isTitleStartKey(e.code, e.key)) {
        e.preventDefault();
        this.resume();
        return;
      }
      this.keys.add(e.code);
      if (e.code === "KeyB" && !e.repeat) {
        this.buyOpen = nextBuyOpen(this.buyOpen, this.canBuy(), true);
        this.hud();
      }
      if (e.code === "Tab") {
        e.preventDefault();
        this.tabOpen = true;
        this.hud();
      }
      if (e.code === "Escape" && !e.repeat) {
        e.preventDefault();
        this.onEscape();
      }
      if (this.paused) return;
      if (e.code === "KeyR") this.reload(this.player);
      if (e.code === "Digit1") this.equip(this.player, "primary");
      if (e.code === "Digit2") this.equip(this.player, "pistol");
      if (e.code === "KeyF") this.throwNade(this.player, "flash");
      if (e.code === "KeyC") this.throwNade(this.player, "smoke");
      if (e.code === "KeyV") this.throwNade(this.player, "frag");
      if (this.buyOpen) this.buyKey(e.code);
    });
    addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Tab") {
        this.tabOpen = false;
        this.hud();
      }
    });
    document.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    document.addEventListener("pointerup", (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.fireHeld = false;
        this.ignoreFireUntilUp = false;
        this.pendingLockClick = false;
        this.lockButtonDown = false;
      }
    });
    document.addEventListener("pointermove", (e) => {
      if (shouldIgnoreLockShot(this.locked, this.ignoreFireUntilUp)) {
        this.fireHeld = false;
        return;
      }
      this.fireHeld = (e.buttons & 1) !== 0;
    });
    addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("mousemove", (e) => this.onLook(e));
    const play = el<HTMLButtonElement>("btn-play");
    play.addEventListener("click", (e) => {
      e.preventDefault();
      this.start();
    });
    play.addEventListener("pointerup", (e) => {
      if (e.button !== 0 || this.phase !== "menu") return;
      e.preventDefault();
      this.start();
    });
    document.querySelectorAll("[data-buy]").forEach((n) => {
      n.addEventListener("click", () => this.buyItem(this.player, (n as HTMLElement).dataset.buy!));
    });
    el("btn-resume").addEventListener("click", () => this.resume());
    el("btn-quit").addEventListener("click", () => this.quitToTitle());
  }

  start(): void {
    if (this.phase !== "menu") return;
    this.audio.unlock();
    el("menu").classList.add("hidden");
    if (!this.lockBound) {
      this.lockBound = true;
      document.addEventListener("pointerlockchange", () => this.onPointerLockChange());
    }
    this.ignoreLook = 2;
    this.requestLock();
    this.beginRound();
  }

  onPointerLockChange(): void {
    const canvas = this.renderer.domElement;
    const now = document.pointerLockElement === canvas;
    const lost = this.locked && !now;
    this.locked = now;
    if (now) {
      this.ignoreLook = 2;
      this.fireHeld = false;
      this.mouseDown = false;
      if (this.pendingLockClick) this.ignoreFireUntilUp = true;
    }
    if (lost) {
      this.fireHeld = false;
      this.mouseDown = false;
      if (isMatchPhase(this.phase) && !this.paused) this.openPause();
    }
    this.hud();
  }

  requestLock(): void {
    const canvas = this.renderer.domElement;
    this.ignoreLook = 2;
    this.ignoreFireUntilUp = true;
    this.fireHeld = false;
    this.mouseDown = false;
    try {
      const lock = canvas.requestPointerLock();
      if (lock && typeof (lock as Promise<void>).catch === "function") {
        void (lock as Promise<void>).catch(() => undefined);
      }
    } catch {
      /* pointer lock is optional */
    }
  }

  onLook(e: MouseEvent): void {
    if (!this.locked || this.paused || this.phase === "menu") return;
    if (shouldDiscardLook(this.ignoreLook, e.movementX, e.movementY)) {
      if (this.ignoreLook > 0) this.ignoreLook -= 1;
      return;
    }
    const sens = 0.0022;
    this.player.yaw -= e.movementX * sens;
    this.player.pitch -= e.movementY * sens;
    this.player.pitch = Math.max(-1.35, Math.min(1.35, this.player.pitch));
  }

  onPointerDown(e: PointerEvent): void {
    const t = e.target as HTMLElement | null;
    if (t?.closest("#menu, #pause, #btn-play, #btn-resume, #btn-quit, [data-buy]")) return;
    if (this.phase === "menu" || this.paused) return;
    if (t?.closest("#buy")) {
      return;
    }
    if (e.button === 2) {
      this.scoped = !this.scoped;
      return;
    }
    if (e.button !== 0) return;
    if (isLockAcquireClick(this.locked)) {
      this.buyOpen = false;
      this.hud();
      this.pendingLockClick = true;
      this.lockButtonDown = true;
      this.ignoreFireUntilUp = true;
      this.fireHeld = false;
      this.mouseDown = false;
      this.requestLock();
      return;
    }
    if (this.ignoreFireUntilUp) return;
    this.buyOpen = false;
    this.mouseDown = true;
    this.fireHeld = true;
    e.preventDefault();
    if (this.phase === "live" || this.phase === "planted") this.tryShoot(this.player);
  }

  onEscape(): void {
    if (this.phase === "menu") return;
    if (this.buyOpen) {
      this.buyOpen = false;
      this.hud();
      return;
    }
    if (this.paused) {
      this.resume();
      return;
    }
    if (isMatchPhase(this.phase)) this.openPause();
  }

  openPause(): void {
    if (this.paused || !isMatchPhase(this.phase)) return;
    this.paused = true;
    this.buyOpen = false;
    this.fireHeld = false;
    this.mouseDown = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.audio.unlock();
    this.ignoreLook = 2;
    this.requestLock();
    this.hud();
  }

  quitToTitle(): void {
    this.paused = false;
    this.buyOpen = false;
    this.fireHeld = false;
    this.mouseDown = false;
    if (document.pointerLockElement) document.exitPointerLock();
    el("menu").classList.remove("hidden");
    this.resetMatch();
    this.hud();
  }

  resetMatch(): void {
    this.score = [0, 0];
    this.round = 0;
    this.attackTeam = TEAM.RAID;
    this.actors = [];
    this.player = this.makeActor("You", TEAM.RAID, false, 0);
    this.actors.push(this.player);
    for (let i = 1; i < 5; i++) this.actors.push(this.makeActor(NAMES_RAID[i], TEAM.RAID, true, i));
    for (let i = 0; i < 5; i++) this.actors.push(this.makeActor(NAMES_LINE[i], TEAM.LINE, true, i));
    for (const a of this.actors) a.money = MATCH.startMoney;
    this.syncMeshes();
    this.phase = "menu";
    this.paused = false;
    this.fireHeld = false;
    this.mouseDown = false;
    this.buyOpen = false;
  }

  makeActor(name: string, team: Team, bot: boolean, offset: number): Actor {
    return {
      id: this.idSeq++,
      name,
      team,
      bot,
      alive: true,
      hp: 100,
      armor: 0,
      helm: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      crouch: false,
      walk: false,
      onGround: true,
      money: MATCH.startMoney,
      kit: false,
      flashes: 0,
      smokes: 0,
      frags: 0,
      primary: null,
      pistol: makeWeapon("dart"),
      active: "pistol",
      hasBomb: false,
      loss: 0,
      kills: 0,
      deaths: 0,
      spawnOffset: offset,
      nextWp: team === TEAM.RAID ? "raid" : "line",
      aimT: 0,
      fireHold: false,
      lastFoot: 0,
    };
  }

  weapon(a: Actor): WeaponState {
    return a.active === "primary" && a.primary ? a.primary : a.pistol;
  }

  equip(a: Actor, slot: "primary" | "pistol"): void {
    if (slot === "primary" && !a.primary) return;
    a.active = slot;
  }

  beginRound(): void {
    this.round += 1;
    if (this.round === MATCH.swapAt + 1) this.attackTeam = this.attackTeam === TEAM.RAID ? TEAM.LINE : TEAM.RAID;
    this.phase = "freeze";
    this.timer = MATCH.freezeTime;
    this.bombArmed = false;
    this.bombSite = null;
    this.plantT = 0;
    this.defuseT = 0;
    this.bombT = 0;
    this.liveElapsed = 0;
    this.spawnProtT = 0;
    this.siteHintT = 0;
    this.hpTicks = [];
    this.playerHurtBudget = PLAYER_HURT_PER_TICK;
    this.playerHurtSecondBudget = PLAYER_HURT_PER_SECOND;
    this.playerHurtSecondT = 0;
    this.buyOpen = true;
    this.scoped = false;
    this.smokeT = [];
    for (const m of this.smokeMeshes) this.scene.remove(m);
    this.smokeMeshes = [];
    if (this.bombMesh) {
      this.scene.remove(this.bombMesh);
      this.bombMesh = null;
    }

    const attackers = this.actors.filter((a) => a.team === this.attackTeam);
    const bombCarrier = this.player.team === this.attackTeam ? this.player : attackers[Math.floor(Math.random() * attackers.length)];
    for (const a of this.actors) {
      a.alive = true;
      a.hp = 100;
      a.vx = a.vy = a.vz = 0;
      a.hasBomb = a === bombCarrier;
      a.pistol.mag = a.pistol.def.mag;
      if (a.primary) a.primary.mag = a.primary.def.mag;
      a.active = a.primary ? "primary" : "pistol";
      this.placeAtSpawn(a);
    }
    this.audio.roundStart();
    this.hud();
  }

  placeAtSpawn(a: Actor): void {
    const side = a.team === TEAM.RAID ? this.map.raidSpawn : this.map.lineSpawn;
    const lane = (a.spawnOffset - 2) * 1.85;
    const forward = a === this.player ? 0 : a.team === TEAM.RAID ? 2.4 : -2.4;
    a.x = side.x + lane;
    a.z = side.z + forward;
    a.y = 0;
    a.vx = a.vy = a.vz = 0;
    a.yaw = side.yaw;
    a.pitch = 0;
    a.fireHold = false;
    a.aimT = 0;
    a.nextWp = a.team === TEAM.RAID ? "raid" : "line";
  }

  canBuy(): boolean {
    if (this.paused) return false;
    if (this.phase !== "freeze" && this.phase !== "live") return false;
    if (this.phase === "live" && this.timer < MATCH.roundTime - MATCH.buyWindow) return false;
    const spawnZ = this.player.team === TEAM.RAID ? this.map.raidSpawn.z : this.map.lineSpawn.z;
    return Math.abs(this.player.z - spawnZ) < 8;
  }

  buyKey(code: string): void {
    const map: Record<string, string> = {
      Digit1: "dart",
      Digit2: "anvil",
      Digit3: "stitch",
      Digit4: "ridge",
      Digit5: "quarrel",
      Digit6: "longline",
      Digit7: "hatch",
      Digit8: "full",
      Digit9: "kit",
      Digit0: "flash",
    };
    if (map[code]) this.buyItem(this.player, map[code]);
  }

  buyItem(a: Actor, id: string): void {
    if (!this.canBuy() && a === this.player) {
      this.audio.deny();
      return;
    }
    if (WEAPONS[id]) {
      const def = WEAPONS[id];
      if (a.money < def.price) {
        if (a === this.player) this.audio.deny();
        return;
      }
      a.money -= def.price;
      const w = makeWeapon(id);
      if (def.slot === 1) {
        a.primary = w;
        a.active = "primary";
      } else {
        a.pistol = w;
        if (!a.primary) a.active = "pistol";
      }
      if (a === this.player) this.audio.buy();
      this.hud();
      return;
    }
    const gear = Object.values(GEAR).find((g) => g.id === id);
    if (!gear || a.money < gear.price) {
      if (a === this.player) this.audio.deny();
      return;
    }
    a.money -= gear.price;
    if (id === "kevlar") a.armor = 100;
    if (id === "full") {
      a.armor = 100;
      a.helm = true;
    }
    if (id === "kit") a.kit = true;
    if (id === "flash") a.flashes = Math.min(2, a.flashes + 1);
    if (id === "smoke") a.smokes = Math.min(1, a.smokes + 1);
    if (id === "frag") a.frags = Math.min(1, a.frags + 1);
    if (a === this.player) this.audio.buy();
    this.hud();
  }

  botBuy(a: Actor): void {
    if (a.money >= 1000 && a.armor < 50) this.buyItem(a, "full");
    else if (a.money >= 650 && a.armor < 50) this.buyItem(a, "kevlar");
    if (a.team !== this.attackTeam && a.money >= 400) this.buyItem(a, "kit");
    if (!a.primary) {
      if (a.money >= 3100) this.buyItem(a, "quarrel");
      else if (a.money >= 2700) this.buyItem(a, "ridge");
      else if (a.money >= 1800) this.buyItem(a, Math.random() < 0.4 ? "hatch" : "stitch");
      else if (a.money >= 1250) this.buyItem(a, "stitch");
    }
    if (a.pistol.def.id === "dart" && a.money >= 700) this.buyItem(a, "anvil");
    if (a.money >= 200 && a.flashes < 1) this.buyItem(a, "flash");
  }

  loop(): void {
    const dt = Math.min(0.033, this.clock.getDelta());
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }

  update(dt: number): void {
    if (this.phase === "menu") {
      this.orbitMenu(dt);
      return;
    }
    if (this.paused) {
      this.hud();
      return;
    }
    this.timer -= dt;
    if (this.phase === "live" || this.phase === "planted") this.liveElapsed += dt;
    this.spawnProtT = Math.max(0, this.spawnProtT - dt);
    this.playerHurtSecondT += dt;
    if (this.playerHurtSecondT >= 1) {
      this.playerHurtSecondT = 0;
      this.playerHurtSecondBudget = PLAYER_HURT_PER_SECOND;
    }
    this.flash = Math.max(0, this.flash - dt * 0.65);
    this.hitmark = Math.max(0, this.hitmark - dt * 1.7);
    this.dmgT = Math.max(0, this.dmgT - dt);
    this.siteHintT = Math.max(0, this.siteHintT - dt);
    this.hpTicks = this.hpTicks.filter((tick) => (tick.t -= dt) > 0);
    this.kills = this.kills.filter((k) => (k.t -= dt) > 0);
    for (const s of this.smokeT) s.t -= dt;
    this.smokeT = this.smokeT.filter((s) => s.t > 0);

    if (this.phase === "freeze") {
      for (const a of this.actors) if (a.bot) this.botBuy(a);
      this.controlPlayer(this.player, dt);
      this.integrate(this.player, dt);
      this.stepSound(this.player, dt);
      this.refreshMesh(this.player);
      for (const a of this.actors) {
        if (!a.bot) continue;
        a.vx = a.vz = 0;
        a.fireHold = false;
        a.aimT = 0;
        this.refreshMesh(a);
      }
      this.camFrom(this.player);
      if (this.timer <= 0) this.goLive();
    } else if (this.phase === "live" || this.phase === "planted") {
      this.simulate(dt);
      this.checkRound();
      if (this.phase === "planted") {
        this.bombT -= dt;
        this.bombBeep -= dt;
        if (this.bombBeep <= 0) {
          const u = 1 - this.bombT / MATCH.bombTime;
          this.audio.bombBeep(u);
          this.bombBeep = Math.max(0.12, 1 - u * 0.85);
        }
        if (this.bombT <= 0) this.endRound(this.attackTeam, "Charge detonated");
      } else if (this.timer <= 0 && !this.bombArmed) {
        this.endRound(this.attackTeam === TEAM.RAID ? TEAM.LINE : TEAM.RAID, "Time");
      }
    } else if (this.phase === "end") {
      this.simulate(dt);
      if (this.timer <= 0) {
        if (this.score[0] >= MATCH.firstTo || this.score[1] >= MATCH.firstTo) {
          this.resetMatch();
          this.beginRound();
        } else this.beginRound();
      }
    }

    this.useHold(dt);
    this.tickFx(dt);
    this.hud();
  }

  goLive(): void {
    this.phase = "live";
    this.timer = MATCH.roundTime;
    this.liveElapsed = 0;
    this.spawnProtT = MATCH.spawnProt;
    this.buyOpen = false;
    this.playerHurtBudget = PLAYER_HURT_PER_TICK;
    this.playerHurtSecondBudget = PLAYER_HURT_PER_SECOND;
    this.playerHurtSecondT = 0;
    if (!this.lockButtonDown) {
      this.ignoreFireUntilUp = false;
      this.pendingLockClick = false;
      this.fireHeld = false;
    }
    for (const a of this.actors) {
      if (!a.bot) continue;
      this.placeAtSpawn(a);
    }
    this.hud();
  }

  simulate(dt: number): void {
    this.playerHurtBudget = PLAYER_HURT_PER_TICK;
    for (const a of this.actors) {
      if (!a.alive) {
        this.refreshMesh(a);
        continue;
      }
      applyRecoil(this.weapon(a), dt);
      if (this.weapon(a).cooldown > 0) this.weapon(a).cooldown -= dt;
      if (this.weapon(a).reloading > 0) {
        this.weapon(a).reloading -= dt;
        if (this.weapon(a).reloading <= 0) {
          const w = this.weapon(a);
          const need = w.def.mag - w.mag;
          const take = Math.min(need, w.reserve);
          w.mag += take;
          w.reserve -= take;
        }
      }
      if (a === this.player) this.controlPlayer(a, dt);
      else this.controlBot(a, dt);
      this.integrate(a, dt);
      this.stepSound(a, dt);
      this.tryShoot(a);
      this.refreshMesh(a);
    }
    this.camFrom(this.player);
  }

  controlPlayer(a: Actor, dt: number): void {
    const f = (this.keys.has("KeyW") ? 1 : 0) + (this.keys.has("KeyS") ? -1 : 0);
    const r = (this.keys.has("KeyD") ? 1 : 0) + (this.keys.has("KeyA") ? -1 : 0);
    a.walk = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    a.crouch = this.keys.has("ControlLeft") || this.keys.has("ControlRight");
    const jump = this.keys.has("Space") && a.onGround;
    const next = stepMovement(a.vx, a.vz, a.vy, {
      forward: f,
      right: r,
      jump,
      walk: a.walk,
      crouch: a.crouch,
      onGround: a.onGround,
    }, a.yaw, dt);
    if (next.jumped) {
      this.audio.jump();
      this.keys.delete("Space");
    }
    a.vx = next.vx;
    a.vz = next.vz;
    a.vy = next.vy;
  }

  stepSound(a: Actor, dt: number): void {
    const spd = groundSpeed(a.vx, a.vz);
    if (!a.onGround || spd < 1.05) return;
    a.lastFoot += dt * (spd / MOVE.run);
    if (a.lastFoot <= MOVE.stepInterval) return;
    a.lastFoot = 0;
    const dist = a === this.player ? 0 : Math.hypot(a.x - this.player.x, a.z - this.player.z);
    if (dist > 30) return;
    const gain = a === this.player ? 1 : Math.max(0.12, 1 - dist / 30);
    this.audio.footstep(a.walk, gain);
  }

  controlBot(a: Actor, dt: number): void {
    const enemy = this.closestVisible(a);
    const attacking = a.team === this.attackTeam;
    let tx = a.x;
    let tz = a.z;

    if (this.bombArmed && a.team !== this.attackTeam) {
      tx = this.bombX;
      tz = this.bombZ;
    } else if (this.bombArmed && attacking && Math.hypot(a.x - this.bombX, a.z - this.bombZ) < 14) {
      tx = this.bombX;
      tz = this.bombZ;
    } else if (enemy && a.hp < 28) {
      tx = a.x - Math.sin(a.yaw) * 4;
      tz = a.z - Math.cos(a.yaw) * 4;
    } else if (enemy) {
      tx = enemy.x;
      tz = enemy.z;
    } else {
      const goal = this.botGoal(a);
      const here = nearestWaypoint(this.map.waypoints, a.x, a.z);
      if (here.id !== goal && here.links.length) {
        const step = this.stepToward(here, goal);
        a.nextWp = step.id;
        tx = step.x;
        tz = step.z;
      } else {
        const g = waypointById(this.map.waypoints, goal);
        tx = g.x;
        tz = g.z;
      }
    }

    const dx = tx - a.x;
    const dz = tz - a.z;
    const dist = Math.hypot(dx, dz);
    const wantYaw = enemy ? Math.atan2(enemy.x - a.x, enemy.z - a.z) : Math.atan2(dx, dz);
    const live = this.phase === "live" || this.phase === "planted";
    a.yaw = this.turn(a.yaw, wantYaw, dt * (enemy ? 4.2 : 3.2));
    if (enemy && live) {
      a.aimT += dt;
      const chest = enemy.y + (enemy.crouch ? 0.82 : 1.05);
      const wantPitch = Math.atan2(chest - (a.y + 1.5), Math.hypot(enemy.x - a.x, enemy.z - a.z));
      a.pitch = this.turn(a.pitch, wantPitch + (Math.random() - 0.5) * 0.04, dt * 4.4);
      let aim = wantYaw - a.yaw;
      while (aim > Math.PI) aim -= Math.PI * 2;
      while (aim < -Math.PI) aim += Math.PI * 2;
      const vsPlayer = enemy === this.player;
      const allowBotFight = vsPlayer || this.liveElapsed >= MATCH.minWipeTime;
      a.fireHold = allowBotFight && a.aimT > 0.55 && Math.abs(aim) < 0.28;
    } else {
      a.aimT = 0;
      a.pitch *= 1 - dt * 3;
      a.fireHold = false;
    }

    const fight = !!enemy && a.fireHold && dist < 28;
    const wishF = fight ? 0 : dist > 0.7 ? 1 : 0;
    a.walk = !!enemy && dist < 5;
    a.crouch = false;
    const next = stepMovement(a.vx, a.vz, a.vy, {
      forward: wishF,
      right: 0,
      jump: false,
      walk: a.walk,
      crouch: a.crouch,
      onGround: a.onGround,
    }, a.yaw, dt);
    a.vx = next.vx;
    a.vz = next.vz;
    a.vy = next.vy;
    if (a.team !== this.player.team && this.player.alive && !fight) {
      a.vx *= 1.28;
      a.vz *= 1.28;
    }

    if (!this.bombArmed && this.bombMesh && a.team === this.attackTeam && !a.hasBomb) {
      if (Math.hypot(a.x - this.bombX, a.z - this.bombZ) < 1.3) {
        a.hasBomb = true;
        this.scene.remove(this.bombMesh);
        this.bombMesh = null;
      }
    }
    if (a.hasBomb && !this.bombArmed && this.phase !== "freeze" && siteAt(this.map.sites, a.x, a.z) && !enemy) {
      this.plantT += dt;
      if (this.plantT >= MATCH.plantTime) this.plant(a);
    }
    if (this.bombArmed && a.team !== this.attackTeam && Math.hypot(a.x - this.bombX, a.z - this.bombZ) < 1.4 && !enemy) {
      this.defuseT += dt;
      if (this.defuseT >= (a.kit ? MATCH.defuseTime : MATCH.defuseNoKit)) this.defuse(a);
    }
  }

  botGoal(a: Actor): string {
    if (a.hasBomb) return a.id % 2 === 0 ? "aSite" : "bSite";
    if (this.bombArmed && this.bombSite) return this.bombSite.id === "A" ? "aSite" : "bSite";
    if (a.team !== this.player.team && this.player.alive) {
      return nearestWaypoint(this.map.waypoints, this.player.x, this.player.z).id;
    }
    return a.id % 2 === 0 ? "mid" : "aSite";
  }

  stepToward(from: Waypoint, goalId: string): Waypoint {
    if (from.id === goalId) return from;
    const q: string[] = [from.id];
    const prev = new Map<string, string>();
    prev.set(from.id, from.id);
    while (q.length) {
      const id = q.shift()!;
      if (id === goalId) break;
      const node = waypointById(this.map.waypoints, id);
      for (const n of node.links) {
        if (!prev.has(n)) {
          prev.set(n, id);
          q.push(n);
        }
      }
    }
    if (!prev.has(goalId)) return from;
    let cur = goalId;
    while (prev.get(cur) !== from.id) cur = prev.get(cur)!;
    return waypointById(this.map.waypoints, cur);
  }

  turn(from: number, to: number, max: number): number {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (d > max) d = max;
    if (d < -max) d = -max;
    return from + d;
  }

  integrate(a: Actor, dt: number): void {
    const wasGround = a.onGround;
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.y += a.vy * dt;
    const c = collideCircleBoxes(a.x, a.z, MOVE.radius, this.map.solids);
    if (c.x !== a.x) a.vx = 0;
    if (c.z !== a.z) a.vz = 0;
    a.x = c.x;
    a.z = c.z;
    if (a.y <= 0) {
      a.y = 0;
      if (!wasGround && a === this.player && a.vy < -2) this.audio.land();
      a.vy = 0;
      a.onGround = true;
    } else a.onGround = false;
    a.x = Math.max(-42, Math.min(34, a.x));
    a.z = Math.max(-46, Math.min(48, a.z));
  }

  useHold(dt: number): void {
    if (!this.player.alive || this.phase === "end" || this.phase === "freeze") return;
    const holding = this.keys.has("KeyE");
    const site = siteAt(this.map.sites, this.player.x, this.player.z);
    const nearBomb = this.bombArmed && Math.hypot(this.player.x - this.bombX, this.player.z - this.bombZ) < 1.5;
    const use = siteUseState({
      holdingE: holding,
      onSite: !!site,
      nearBomb,
      hasBomb: this.player.hasBomb,
      bombArmed: this.bombArmed,
      defending: this.player.team !== this.attackTeam,
    });
    if (use.offSiteHint) this.siteHintT = 1.8;
    if (use.progressPlant) {
      this.plantT += dt;
      if (Math.floor(this.plantT * 4) !== Math.floor((this.plantT - dt) * 4)) this.audio.plantTick();
      if (this.plantT >= MATCH.plantTime) this.plant(this.player);
    } else if (!this.bombArmed) {
      this.plantT = 0;
    }
    if (use.progressDefuse) {
      this.defuseT += dt;
      if (Math.floor(this.defuseT * 8) !== Math.floor((this.defuseT - dt) * 8)) this.audio.defuse();
      const need = this.player.kit ? MATCH.defuseTime : MATCH.defuseNoKit;
      if (this.defuseT >= need) this.defuse(this.player);
    } else if (this.player.team !== this.attackTeam) {
      this.defuseT = 0;
    }
  }

  plant(a: Actor): void {
    const site = siteAt(this.map.sites, a.x, a.z);
    if (!site) return;
    a.hasBomb = false;
    this.bombArmed = true;
    this.bombSite = site;
    this.bombX = site.x;
    this.bombZ = site.z;
    this.bombT = MATCH.bombTime;
    this.phase = "planted";
    this.plantT = 0;
    a.money = Math.min(MATCH.maxMoney, a.money + MATCH.plantMoney);
    const geo = new THREE.BoxGeometry(0.35, 0.22, 0.45);
    this.bombMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x881111, emissiveIntensity: 0.6 }));
    this.bombMesh.position.set(this.bombX, 0.14, this.bombZ);
    this.scene.add(this.bombMesh);
    this.pushKill(`${a.name} armed site ${site.id}`, false);
  }

  defuse(a: Actor): void {
    this.bombArmed = false;
    this.defuseT = 0;
    if (this.bombMesh) {
      this.scene.remove(this.bombMesh);
      this.bombMesh = null;
    }
    a.money = Math.min(MATCH.maxMoney, a.money + MATCH.plantMoney);
    this.endRound(a.team, `${a.name} cut the charge`);
  }

  tryShoot(a: Actor): void {
    if (this.paused) return;
    if (a === this.player && this.ignoreFireUntilUp) return;
    const want = a === this.player ? this.fireHeld || this.mouseDown : a.fireHold;
    if (!want || !a.alive) return;
    if (this.phase === "freeze" || this.phase === "end") return;
    if (a.bot && this.liveElapsed < MATCH.botFireDelay) return;
    if (a === this.player && this.buyOpen) {
      if (!this.locked) return;
      this.buyOpen = false;
    }
    const w = this.weapon(a);
    if (w.reloading > 0 || w.cooldown > 0) return;
    if (w.mag <= 0) {
      this.reload(a);
      return;
    }
    if (w.def.mode === "semi" || w.def.mode === "bolt") {
      if (a === this.player) {
        this.mouseDown = false;
        this.fireHeld = false;
      } else a.fireHold = false;
    }
    this.fire(a);
    if (a.bot) this.weapon(a).cooldown += 0.12;
  }

  fire(a: Actor): void {
    const w = this.weapon(a);
    const shotIndex = w.shots;
    const spray = sprayOffset(w);
    w.mag -= 1;
    w.cooldown = cycleTime(w.def);
    w.recoil += w.def.recoilY;
    w.shots += 1;
    w.idle = 0;
    const dist = Math.hypot(a.x - this.player.x, a.z - this.player.z);
    const hear = a === this.player ? 1 : Math.max(0.18, 1 - dist / 42);
    if (a === this.player || hear > 0.2) this.audio.gun(w.def.sound, hear);
    const eye = this.eye(a);
    const spd = groundSpeed(a.vx, a.vz);
    const move = moveInaccuracy(spd, !a.onGround, a.crouch, a.walk);
    const ads = a === this.player && this.scoped && w.def.id === "longline" ? 0.15 : 1;
    const botTight = a.bot ? 1.35 : 1;
    const spread = (w.def.spreadStand + move * (w.def.spreadMove / 0.03) + Math.abs(spray.x) * 0.25) * ads * botTight;
    for (let p = 0; p < w.def.pellets; p++) {
      const yaw = a.yaw + spray.x + (Math.random() - 0.5) * spread * 2;
      const pitch = a.pitch + spray.y + (Math.random() - 0.5) * spread * 2;
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).normalize();
      this.traceShot(a, eye, dir, w);
    }
    const kick = viewKick(w.def, shotIndex);
    if (a === this.player) {
      a.pitch += kick.pitch;
      a.yaw += kick.yaw;
      a.pitch = Math.max(-1.35, Math.min(1.35, a.pitch));
      this.muzzleT = 0.12;
      if (this.muzzle) this.muzzle.intensity = 28;
    }
  }

  eye(a: Actor): THREE.Vector3 {
    const h = a.crouch ? MOVE.eyeCrouch : MOVE.eyeStand;
    return new THREE.Vector3(a.x, a.y + h, a.z);
  }

  traceShot(a: Actor, origin: THREE.Vector3, dir: THREE.Vector3, w: WeaponState): void {
    const reach = 80;
    const dest = origin.clone().addScaledVector(dir, reach);
    const wallT = segmentHitsBoxes(origin.x, origin.y, origin.z, dest.x, dest.y, dest.z, this.map.solids);
    let bestT = wallT;
    let hit: Actor | null = null;
    let head = false;
    for (const o of this.actors) {
      if (!o.alive || o.team === a.team || o === a) continue;
      const body = this.hitActor(origin, dir, o, bestT);
      if (body && body.t < bestT) {
        bestT = body.t;
        hit = o;
        head = body.head;
      }
    }
    const end = origin.clone().addScaledVector(dir, reach * bestT);
    this.flashTracer(origin, end);
    if (hit) {
      if (a.bot && Math.random() > 0.1) head = false;
      const dist = origin.distanceTo(new THREE.Vector3(hit.x, hit.y, hit.z));
      const dmg = hitDamage(w.def, dist, head, hit.armor > 0, hit.helm);
      this.spawnImpact(end, head);
      if (a === this.player) this.spawnBlood(end, head);
      this.hurt(hit, dmg, a, head);
    } else {
      this.spawnImpact(end, false);
      if (a === this.player) this.audio.impact();
    }
  }

  hitActor(origin: THREE.Vector3, dir: THREE.Vector3, o: Actor, maxT: number): { t: number; head: boolean } | null {
    const h = o.crouch ? MOVE.crouchHeight : MOVE.standHeight;
    const radius = 0.34;
    const cx = o.x;
    const cz = o.z;
    const t = this.rayYCylinder(origin, dir, cx, o.y, cz, radius, h);
    if (t === null || t < 0 || t > maxT) return null;
    const py = origin.y + dir.y * t * 80;
    const head = py > o.y + h * 0.72;
    return { t, head };
  }

  rayYCylinder(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    cx: number,
    y0: number,
    cz: number,
    r: number,
    h: number,
  ): number | null {
    const dx = origin.x - cx;
    const dz = origin.z - cz;
    const a = dir.x * dir.x + dir.z * dir.z;
    const b = 2 * (dx * dir.x + dz * dir.z);
    const c = dx * dx + dz * dz - r * r;
    let t: number;
    if (a < 1e-8) {
      if (c > 0) return null;
      t = 0;
    } else {
      const disc = b * b - 4 * a * c;
      if (disc < 0) return null;
      t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t < 0) t = (-b + Math.sqrt(disc)) / (2 * a);
    }
    if (t < 0) return null;
    const y = origin.y + dir.y * t;
    if (y < y0 || y > y0 + h) return null;
    return t / 80;
  }

  hurt(target: Actor, dmg: number, src: Actor, head: boolean): void {
    if (!target.alive) return;
    if (target === this.player && (this.phase === "freeze" || this.spawnProtT > 0)) return;
    if (src.bot && target.bot && this.liveElapsed < MATCH.minWipeTime) return;
    let incoming = soakArmor(target.armor, target.helm, dmg, head);
    if (src.bot && target === this.player) {
      incoming = { hp: botChipDamage(incoming.hp, target.armor > 0), armor: incoming.armor };
      const tick = takePlayerHurt(this.playerHurtBudget, incoming.hp);
      this.playerHurtBudget = tick.budget;
      const second = takePlayerHurt(this.playerHurtSecondBudget, tick.take);
      this.playerHurtSecondBudget = second.budget;
      incoming = { hp: second.take, armor: incoming.armor };
    }
    target.armor = incoming.armor;
    target.hp -= incoming.hp;
    if (src === this.player) {
      this.hitmark = 1;
      this.hitHead = head;
      this.audio.hit(head);
    }
    if (target === this.player) {
      this.audio.hurt();
      this.dmgT = 0.55;
      this.dmgDir = Math.atan2(src.x - target.x, src.z - target.z) - target.yaw;
      el("hurt").style.setProperty("--from", `${(this.dmgDir * 180) / Math.PI}deg`);
      this.hpTicks.unshift({ n: Math.max(1, Math.round(incoming.hp)), t: 0.7 });
      this.hpTicks = this.hpTicks.slice(0, 4);
    }
    if (target.hp <= 0) this.kill(target, src, head);
  }

  kill(target: Actor, src: Actor, head: boolean): void {
    target.alive = false;
    target.hp = 0;
    target.deaths += 1;
    src.kills += 1;
    src.money = Math.min(MATCH.maxMoney, src.money + this.weapon(src).def.killAward);
    if (target.hasBomb) {
      target.hasBomb = false;
      this.bombX = target.x;
      this.bombZ = target.z;
      if (!this.bombMesh) {
        this.bombMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.22, 0.45),
          new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x553300, emissiveIntensity: 0.5 }),
        );
        this.scene.add(this.bombMesh);
      }
      this.bombMesh.position.set(this.bombX, 0.14, this.bombZ);
    }
    this.pushKill(`${src.name}  ${head ? "HS " : ""} ${target.name}`, head);
  }

  reload(a: Actor): void {
    const w = this.weapon(a);
    if (w.reloading > 0 || w.mag >= w.def.mag || w.reserve <= 0) return;
    w.reloading = w.def.reload;
    if (a === this.player) this.audio.reload();
  }

  throwNade(a: Actor, kind: "flash" | "smoke" | "frag"): void {
    if (this.phase === "freeze" || this.phase === "end" || !a.alive) return;
    if (kind === "flash" && a.flashes <= 0) return;
    if (kind === "smoke" && a.smokes <= 0) return;
    if (kind === "frag" && a.frags <= 0) return;
    if (kind === "flash") a.flashes--;
    if (kind === "smoke") a.smokes--;
    if (kind === "frag") a.frags--;
    const eye = this.eye(a);
    const dir = new THREE.Vector3(Math.sin(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), Math.cos(a.yaw) * Math.cos(a.pitch));
    const dest = eye.clone().addScaledVector(dir, 11);
    const t = segmentHitsBoxes(eye.x, eye.y, eye.z, dest.x, dest.y, dest.z, this.map.solids);
    dest.lerpVectors(eye, dest, Math.max(0.2, t * 0.92));
    if (kind === "flash") {
      this.audio.flash();
      for (const o of this.actors) {
        if (!o.alive) continue;
        const to = this.eye(o);
        const los = segmentHitsBoxes(dest.x, dest.y, dest.z, to.x, to.y, to.z, this.map.solids);
        if (los < 0.98) continue;
        if (o === this.player) this.flash = Math.max(this.flash, 1);
      }
    } else if (kind === "smoke") {
      this.smokeT.push({ x: dest.x, z: dest.z, t: 14 });
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0x9aa0a4, transparent: true, opacity: 0.72, depthWrite: false }),
      );
      m.position.set(dest.x, 1.4, dest.z);
      this.scene.add(m);
      this.smokeMeshes.push(m);
    } else {
      this.audio.explode();
      for (const o of this.actors) {
        if (!o.alive) continue;
        const d = Math.hypot(o.x - dest.x, o.z - dest.z);
        if (d < 5.5) this.hurt(o, 78 * (1 - d / 5.5), a, false);
      }
    }
  }

  closestVisible(a: Actor): Actor | null {
    let best: Actor | null = null;
    let bestD = 64;
    const eye = this.eye(a);
    for (const o of this.actors) {
      if (!o.alive || o.team === a.team) continue;
      if (a.bot && o.bot && this.liveElapsed < MATCH.minWipeTime) continue;
      const d = Math.hypot(o.x - a.x, o.z - a.z);
      if (d > bestD) continue;
      const to = this.eye(o);
      if (this.inSmoke(a.x, a.z, o.x, o.z)) continue;
      const t = segmentHitsBoxes(eye.x, eye.y, eye.z, to.x, to.y, to.z, this.map.solids);
      if (d > 16 && t < 0.88) continue;
      if (d > 8 && t < 0.45) continue;
      bestD = d;
      best = o;
    }
    return best;
  }

  inSmoke(x0: number, z0: number, x1: number, z1: number): boolean {
    for (const s of this.smokeT) {
      const d0 = Math.hypot(x0 - s.x, z0 - s.z);
      const d1 = Math.hypot(x1 - s.x, z1 - s.z);
      if (d0 < 3.1 && d1 < 7) return true;
      if (d1 < 3.1 && d0 < 7) return true;
    }
    return false;
  }

  checkRound(): void {
    const raidA = this.actors.some((a) => a.alive && a.team === TEAM.RAID);
    const lineA = this.actors.some((a) => a.alive && a.team === TEAM.LINE);
    const early = this.liveElapsed < MATCH.minWipeTime && this.player.alive;
    if (!raidA && !this.bombArmed) this.endRound(TEAM.LINE, "Line holds");
    else if (!lineA && !this.bombArmed && !early) this.endRound(TEAM.RAID, "Raid clears");
    else if (!lineA && this.bombArmed) {
      /* attackers already planted — clock must run unless defused; no instant win */
    } else if (!raidA && this.bombArmed) {
      /* defenders still need the cut */
    }
  }

  endRound(winner: Team, why: string): void {
    if (this.phase === "end") return;
    this.phase = "end";
    this.timer = 4;
    this.buyOpen = false;
    this.score[winner] += 1;
    if (this.bombArmed && this.bombT <= 0) this.audio.explode();
    for (const a of this.actors) {
      if (a.team === winner) {
        a.money = Math.min(MATCH.maxMoney, a.money + MATCH.winMoney);
        a.loss = 0;
      } else {
        a.loss = Math.min(MATCH.lossBonusMax, a.loss + 1);
        a.money = Math.min(MATCH.maxMoney, a.money + MATCH.lossBase + a.loss * MATCH.lossBonus);
      }
    }
    this.pushKill(why, false);
    if (winner === this.player.team) this.audio.win();
    else this.audio.lose();
  }

  pushKill(text: string, head: boolean): void {
    this.kills.unshift({ t: 4.2, text, head });
    this.kills = this.kills.slice(0, 6);
  }

  pickupBomb(): void {
    if (this.bombArmed || !this.bombMesh || this.player.hasBomb) return;
    if (!this.player.alive || this.player.team !== this.attackTeam) return;
    if (Math.hypot(this.player.x - this.bombX, this.player.z - this.bombZ) < 1.3) {
      this.player.hasBomb = true;
      this.scene.remove(this.bombMesh);
      this.bombMesh = null;
    }
  }

  camFrom(a: Actor): void {
    this.pickupBomb();
    const eye = this.eye(a);
    this.camera.position.copy(eye);
    const fov = this.scoped && this.weapon(a).def.id === "longline" ? 32 : 78;
    if (this.camera.fov !== fov) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const look = new THREE.Vector3(
      eye.x + Math.sin(a.yaw) * Math.cos(a.pitch),
      eye.y + Math.sin(a.pitch),
      eye.z + Math.cos(a.yaw) * Math.cos(a.pitch),
    );
    this.camera.lookAt(look);
    this.updateViewmodel(a);
  }

  buildViewmodel(): void {
    this.viewmodel.clear();
    const steel = new THREE.MeshStandardMaterial({ color: 0x5a5e62, metalness: 0.45, roughness: 0.4 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.8 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xc45a2a, roughness: 0.4, metalness: 0.2 });
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.028, 0.09), steel);
    rec.position.set(0.085, -0.062, -0.2);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.07), steel);
    bar.position.set(0.085, -0.052, -0.26);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.034, 0.022), grip);
    mag.position.set(0.085, -0.086, -0.185);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.01, 0.02), accent);
    sight.position.set(0.085, -0.044, -0.22);
    this.muzzle = new THREE.PointLight(0xffcc66, 0, 4.5, 2);
    this.muzzle.position.set(0.085, -0.052, -0.31);
    this.muzzleSprite = new THREE.Mesh(
      new THREE.PlaneGeometry(0.32, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
    );
    this.muzzleSprite.position.set(0.085, -0.052, -0.315);
    this.muzzleSprite.renderOrder = 10;
    this.viewmodel.add(rec, bar, mag, sight, this.muzzle, this.muzzleSprite);
    this.camera.add(this.viewmodel);
    this.scene.add(this.camera);
  }

  updateViewmodel(a: Actor): void {
    this.viewmodel.visible = this.phase !== "menu";
    const spd = groundSpeed(a.vx, a.vz);
    this.bob += spd * 0.018;
    const w = this.weapon(a);
    const holster = this.phase === "freeze" ? 0.08 : 0;
    const rel = w.reloading > 0 ? 1 - w.reloading / w.def.reload : 0;
    const dip = w.reloading > 0 ? 0.08 + Math.sin(rel * Math.PI) * 0.05 : 0;
    this.viewmodel.position.set(Math.sin(this.bob) * 0.012, Math.abs(Math.sin(this.bob * 2)) * 0.01 - holster - dip, 0);
    this.viewmodel.rotation.x = w.reloading > 0 ? 0.72 + Math.sin(rel * 14) * 0.16 : 0;
    this.viewmodel.rotation.z = w.reloading > 0 ? Math.sin(rel * 10) * 0.28 : 0;
  }

  orbitMenu(dt: number): void {
    this.lookX += dt * 0.12;
    this.viewmodel.visible = false;
    this.camera.position.set(Math.sin(this.lookX) * 28, 14, Math.cos(this.lookX) * 28 - 4);
    this.camera.lookAt(0, 1, 4);
  }

  syncMeshes(): void {
    for (const [, g] of this.meshes) this.scene.remove(g);
    this.meshes.clear();
    for (const a of this.actors) {
      if (a === this.player) continue;
      const g = new THREE.Group();
      const color = a.team === TEAM.RAID ? COLORS.raid : COLORS.line;
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.34, 0.78, 5, 10),
        new THREE.MeshStandardMaterial({ color, roughness: 0.45, emissive: color, emissiveIntensity: 0.18 }),
      );
      body.position.y = 0.94;
      body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xf0d2b0, roughness: 0.65 }),
      );
      head.position.y = 1.58;
      head.castShadow = true;
      const pack = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.22, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 }),
      );
      pack.position.set(0, 1.05, -0.22);
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 64;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = a.team === TEAM.RAID ? "#e07a3a" : "#3ec8c0";
      ctx.font = "700 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(a.name, 128, 44);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
      spr.position.y = 2.05;
      spr.scale.set(1.6, 0.4, 1);
      g.add(body, head, pack, spr);
      this.scene.add(g);
      this.meshes.set(a.id, g);
    }
  }

  refreshMesh(a: Actor): void {
    const g = this.meshes.get(a.id);
    if (!g) return;
    g.visible = a.alive;
    g.position.set(a.x, a.y, a.z);
    g.rotation.y = a.yaw;
    g.scale.y = a.crouch ? 0.7 : 1;
  }

  flashTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const dir = to.clone().sub(from);
    const len = Math.max(0.35, dir.length());
    dir.normalize();
    const start = from.clone().addScaledVector(dir, 0.55);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, len),
      new THREE.MeshBasicMaterial({ color: 0xfff6c4, transparent: true, opacity: 1, depthTest: false }),
    );
    mesh.position.copy(start).lerp(to, 0.5);
    mesh.lookAt(to);
    mesh.renderOrder = 8;
    this.scene.add(mesh);
    this.tracers.push({ mesh, t: 0.12 });
    const a = this.project2(start);
    const b = this.project2(to);
    if (a && b) this.screenFx.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, t: 0.12, muzzle: false });
    const m = this.project2(from.clone().addScaledVector(dir, 0.35));
    if (m) this.screenFx.push({ x0: m.x, y0: m.y, x1: m.x, y1: m.y, t: 0.12, muzzle: true });
  }

  project2(p: THREE.Vector3): { x: number; y: number } | null {
    const v = p.clone().project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }

  spawnImpact(at: THREE.Vector3, head: boolean): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(head ? 0.1 : 0.07, 8, 6),
      new THREE.MeshBasicMaterial({ color: head ? 0x2a1a12 : 0x1a1612, transparent: true, opacity: 0.95, depthTest: true }),
    );
    mesh.position.copy(at);
    mesh.renderOrder = 7;
    this.scene.add(mesh);
    this.impacts.push({ mesh, t: 1.45 });
  }

  spawnBlood(at: THREE.Vector3, head: boolean): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(head ? 0.2 : 0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x8a1c18, transparent: true, opacity: 0.92, depthTest: false }),
    );
    mesh.position.copy(at);
    mesh.renderOrder = 9;
    this.scene.add(mesh);
    this.impacts.push({ mesh, t: 1.25 });
  }

  tickFx(dt: number): void {
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    if (this.muzzle) this.muzzle.intensity = this.muzzleT > 0 ? 28 * (this.muzzleT / 0.12) : 0;
    if (this.muzzleSprite) {
      const mat = this.muzzleSprite.material as THREE.MeshBasicMaterial;
      mat.opacity = this.muzzleT > 0 ? Math.min(1, this.muzzleT / 0.04) : 0;
      const s = 1.2 + this.muzzleT * 10;
      this.muzzleSprite.scale.set(s, s, 1);
    }
    const fade = (list: { mesh: THREE.Mesh; t: number }[]) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const fx = list[i];
        fx.t -= dt;
        const mat = fx.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = fx.t > 0.35 ? Math.min(1, fx.t) : Math.max(0, fx.t / 0.35);
        if (fx.t <= 0) {
          this.scene.remove(fx.mesh);
          fx.mesh.geometry.dispose();
          mat.dispose();
          list.splice(i, 1);
        }
      }
    };
    fade(this.tracers);
    fade(this.impacts);
    for (let i = this.screenFx.length - 1; i >= 0; i--) {
      this.screenFx[i].t -= dt;
      if (this.screenFx[i].t <= 0) this.screenFx.splice(i, 1);
    }
  }

  draw(): void {
    this.renderer.render(this.scene, this.camera);
    this.drawRadar();
    this.drawScreenFx();
  }

  drawScreenFx(): void {
    const c = el<HTMLCanvasElement>("fx");
    if (c.width !== innerWidth) c.width = innerWidth;
    if (c.height !== innerHeight) c.height = innerHeight;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, c.width, c.height);
    for (const fx of this.screenFx) {
      const a = fx.t > 0.05 ? 1 : Math.max(0, fx.t / 0.05);
      if (fx.muzzle) {
        const grd = g.createRadialGradient(fx.x0, fx.y0, 2, fx.x0, fx.y0, 42);
        grd.addColorStop(0, `rgba(255,250,210,${a})`);
        grd.addColorStop(0.45, `rgba(255,200,80,${0.7 * a})`);
        grd.addColorStop(1, "rgba(255,160,40,0)");
        g.fillStyle = grd;
        g.beginPath();
        g.arc(fx.x0, fx.y0, 42, 0, Math.PI * 2);
        g.fill();
      } else {
        g.strokeStyle = `rgba(255,220,90,${0.45 * a})`;
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(fx.x0, fx.y0);
        g.lineTo(fx.x1, fx.y1);
        g.stroke();
        g.strokeStyle = `rgba(255,248,200,${0.98 * a})`;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(fx.x0, fx.y0);
        g.lineTo(fx.x1, fx.y1);
        g.stroke();
      }
    }
  }

  drawRadar(): void {
    const c = el<HTMLCanvasElement>("radar");
    const g = c.getContext("2d")!;
    const w = c.width;
    g.clearRect(0, 0, w, w);
    g.fillStyle = "rgba(8, 12, 12, 0.78)";
    g.fillRect(0, 0, w, w);
    const p = this.player;
    const to = (x: number, z: number) => radarWorldToCanvas(x, z, w);
    g.strokeStyle = "rgba(230,220,190,0.32)";
    g.lineWidth = 1;
    for (const b of this.map.solids) {
      const a = to(b.minX, b.minZ);
      const c2 = to(b.maxX, b.maxZ);
      g.strokeRect(Math.min(a.x, c2.x), Math.min(a.y, c2.y), Math.abs(c2.x - a.x), Math.abs(c2.y - a.y));
    }
    const aSite = to(-23, 18);
    g.fillStyle = "#e6b422";
    g.beginPath();
    g.arc(aSite.x, aSite.y, 4, 0, Math.PI * 2);
    g.fill();
    const bSite = to(24, 16);
    g.fillStyle = "#2ec4d6";
    g.beginPath();
    g.arc(bSite.x, bSite.y, 4, 0, Math.PI * 2);
    g.fill();
    for (const a of this.actors) {
      if (!a.alive || a === p) continue;
      const q = to(a.x, a.z);
      if (q.x < 2 || q.y < 2 || q.x > w - 2 || q.y > w - 2) continue;
      g.fillStyle = a.team === TEAM.RAID ? COLORS.raidBright : COLORS.lineBright;
      g.beginPath();
      g.arc(q.x, q.y, 2.6, 0, Math.PI * 2);
      g.fill();
    }
    if (this.bombArmed || (this.bombMesh && !p.hasBomb)) {
      const q = to(this.bombX, this.bombZ);
      g.fillStyle = "#ff3344";
      g.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    const pip = to(p.x, p.z);
    const tip = radarYawTip(p.x, p.z, p.yaw, 5.5, w);
    g.strokeStyle = "#f4f0e4";
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(pip.x, pip.y);
    g.lineTo(tip.x, tip.y);
    g.stroke();
    g.fillStyle = "#f4f0e4";
    g.beginPath();
    g.arc(pip.x, pip.y, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#111";
    g.lineWidth = 1;
    g.stroke();
  }

  hud(): void {
    const p = this.player;
    const w = this.weapon(p);
    el("hp").textContent = String(Math.max(0, Math.ceil(p.hp)));
    el("armor").textContent = String(Math.ceil(p.armor));
    el("ammo").textContent = w.reloading > 0 ? "REL" : `${w.mag} / ${w.reserve}`;
    el("gun").textContent = w.reloading > 0 ? "RELOAD" : w.def.name;
    el("money").textContent = `$${p.money}`;
    el("score-raid").textContent = String(this.score[0]);
    el("score-line").textContent = String(this.score[1]);
    const showT = this.phase === "planted" ? this.bombT : this.timer;
    el("clock").textContent = this.fmt(Math.max(0, showT));
    el("phase").textContent = this.phaseLabel();
    const protOn = this.phase === "freeze" || (this.phase === "live" && this.spawnProtT > 0);
    el("spawn-prot").classList.toggle("hidden", !protOn);
    el("bomb-icon").classList.toggle("hidden", !p.hasBomb && !this.bombArmed);
    el("bomb-icon").textContent = p.hasBomb ? "CHARGE" : this.bombArmed ? `LIVE ${this.bombSite?.id ?? ""}` : "";
    el("buy").classList.toggle("hidden", !this.buyOpen);
    el("scoreboard").classList.toggle("hidden", !this.tabOpen);
    el("crosshair").classList.toggle("scoped", this.scoped);
    const gap = 6 + groundSpeed(p.vx, p.vz) * 3 + w.recoil * 40;
    document.documentElement.style.setProperty("--gap", `${gap}px`);
    el("hitmark").style.opacity = String(this.hitmark);
    el("hitmark").classList.toggle("hs", this.hitHead);
    el("flash").style.opacity = String(Math.min(1, this.flash));
    el("hurt").style.opacity = this.dmgT > 0 ? String(Math.min(0.72, this.dmgT * 1.4)) : "0";
    el("hurt-dir").style.opacity = this.dmgT > 0 ? "1" : "0";
    el("hurt-dir").style.transform = `translate(-50%, -50%) rotate(${(this.dmgDir * 180) / Math.PI}deg)`;
    el("hp-ticks").innerHTML = this.hpTicks.map((tick) => `<span>-${tick.n}</span>`).join("");
    const site = siteAt(this.map.sites, p.x, p.z);
    const nearBomb = this.bombArmed && Math.hypot(p.x - this.bombX, p.z - this.bombZ) < 1.6;
    const use = siteUseState({
      holdingE: this.keys.has("KeyE"),
      onSite: !!site,
      nearBomb,
      hasBomb: p.hasBomb,
      bombArmed: this.bombArmed,
      defending: p.team !== this.attackTeam,
    });
    const showBar = use.showBar && this.phase !== "end" && this.phase !== "freeze";
    const planting = use.progressPlant;
    const denom = planting ? MATCH.plantTime : p.kit ? MATCH.defuseTime : MATCH.defuseNoKit;
    const raw = planting ? this.plantT : this.defuseT;
    el("progress").classList.toggle("hidden", !showBar);
    el("progress-bar").style.width = `${Math.min(100, (raw / denom) * 100)}%`;
    const siteName = site?.id === "A" ? "A VAULT" : site?.id === "B" ? "B QUAY" : this.bombSite?.id === "A" ? "A VAULT" : "B QUAY";
    const remain = Math.max(0, denom - raw);
    el("progress-label").textContent = planting ? `ARM ${siteName}  ${remain.toFixed(1)}` : `CUT ${siteName}  ${remain.toFixed(1)}`;
    const kf = el("killfeed");
    kf.innerHTML = this.kills.map((k) => `<div class="${k.head ? "hs" : ""}">${escapeHtml(k.text)}</div>`).join("");
    if (this.tabOpen) this.fillBoard();
    el("hint").textContent = this.hint();
    el("relock").classList.toggle("hidden", this.locked || this.phase === "menu" || this.paused);
    el("pause").classList.toggle("hidden", !this.paused);
    document.body.dataset.team = p.team === TEAM.RAID ? "raid" : "line";
  }

  hint(): string {
    if (this.paused) return "Paused — Resume to re-lock mouse";
    if (this.siteHintT > 0) return "Get to A Vault or B Quay — hold E on the pad";
    if (this.phase === "freeze") return "Buy window — B to close  ·  walk is live  ·  1–7 guns";
    const site = siteAt(this.map.sites, this.player.x, this.player.z);
    if (this.player.hasBomb && site) return `On ${site.id === "A" ? "A Vault" : "B Quay"} — hold E to arm the charge`;
    if (this.player.hasBomb) return "Carry the charge to A Vault or B Quay  ·  hold E to arm";
    if (this.bombArmed && this.player.team !== this.attackTeam) return "Charge is live — hold E on the site to cut it";
    if (this.phase === "end") return "Next round…";
    return "WASD move  ·  Shift walk  ·  Ctrl crouch  ·  R reload  ·  F flare  ·  C veil  ·  V burst";
  }

  phaseLabel(): string {
    if (this.paused) return "PAUSE";
    if (this.phase === "freeze") return "FREEZE";
    if (this.phase === "planted") return "CHARGE";
    if (this.phase === "end") return "ROUND";
    return `R${this.round}`;
  }

  fmt(t: number): string {
    const s = Math.ceil(t);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  fillBoard(): void {
    const body = el("board-body");
    const rows = [...this.actors].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    body.innerHTML = rows
      .map(
        (a) =>
          `<tr class="${a.team === TEAM.RAID ? "raid" : "line"} ${a === this.player ? "you" : ""}">
            <td>${escapeHtml(a.name)}</td><td>${a.kills}</td><td>${a.deaths}</td><td>$${a.money}</td></tr>`,
      )
      .join("");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
