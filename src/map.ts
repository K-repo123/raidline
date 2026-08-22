import * as THREE from "three";
import { COLORS } from "./config";

export type AABB = {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  solid: boolean;
};

export type Site = { id: "A" | "B"; x: number; z: number; r: number };

export type Waypoint = { id: string; x: number; z: number; links: string[]; area: string };

export type MapData = {
  solids: AABB[];
  visuals: THREE.Group;
  sites: Site[];
  raidSpawn: { x: number; z: number; yaw: number };
  lineSpawn: { x: number; z: number; yaw: number };
  waypoints: Waypoint[];
  labels: { text: string; x: number; y: number; z: number; color: number }[];
};

/** RAID / LINE spawn lips + mid plug. Closes spawn-to-spawn LOS; sides stay walkable. */
export function spawnCoverBoxes(): AABB[] {
  return [
    box(0, 0, -33, 10, 3.6, 1.2),
    box(0, 0, 33, 10, 3.6, 1.2),
    box(0, 0, 14, 5.8, 3.4, 1.1),
    box(0, 0, -10, 14, 3.2, 1.1),
  ];
}

function box(x: number, y: number, z: number, sx: number, sy: number, sz: number): AABB {
  return {
    minX: x - sx / 2,
    maxX: x + sx / 2,
    minY: y,
    maxY: y + sy,
    minZ: z - sz / 2,
    maxZ: z + sz / 2,
    solid: true,
  };
}

function meshBox(
  group: THREE.Group,
  aabb: AABB,
  color: number,
  roughness = 0.82,
  metalness = 0.08,
  emissive = 0,
): void {
  const sx = aabb.maxX - aabb.minX;
  const sy = aabb.maxY - aabb.minY;
  const sz = aabb.maxZ - aabb.minZ;
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity: emissive ? 0.35 : 0,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set((aabb.minX + aabb.maxX) / 2, (aabb.minY + aabb.maxY) / 2, (aabb.minZ + aabb.maxZ) / 2);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
}

function floorTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3a3d3c";
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(220, 210, 180, 0.16)";
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < 80; i++) {
    g.fillRect(Math.random() * 512, Math.random() * 512, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18, 20);
  t.anisotropy = 8;
  return t;
}

/** Ashpier — original coastal freight yard. Not a Valve map. */
export function buildAshpier(): MapData {
  const solids: AABB[] = [];
  const visuals = new THREE.Group();
  const add = (aabb: AABB, color: number, extra?: { r?: number; m?: number; e?: number }) => {
    solids.push(aabb);
    meshBox(visuals, aabb, color, extra?.r, extra?.m, extra?.e);
  };

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 130),
    new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.95, metalness: 0.02, color: 0xc8c4b8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  visuals.add(floor);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 130),
    new THREE.MeshStandardMaterial({
      color: 0x1a4a55,
      roughness: 0.25,
      metalness: 0.4,
      emissive: 0x042028,
      emissiveIntensity: 0.25,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(48, -0.15, 0);
  visuals.add(water);

  // Perimeter — high-contrast concrete
  const wallH = 4.2;
  const concrete = 0xb9b2a4;
  const dark = 0x4a463e;
  const rust = 0xa45a32;
  const teal = 0x2d6f6a;
  const amber = 0xc9a227;
  const steel = 0x6e7680;

  add(box(0, 0, -48, 88, wallH, 1.2), concrete);
  add(box(0, 0, 50, 88, wallH, 1.2), concrete);
  add(box(-44, 0, 1, 1.2, wallH, 98), concrete);
  add(box(36, 0, 1, 1.2, wallH, 98), teal);

  // RAID spawn shed
  add(box(-14, 0, -40, 1, 3.2, 10), rust);
  add(box(14, 0, -40, 1, 3.2, 10), rust);
  add(box(0, 0, -45, 28, 3.2, 1), rust);
  add(box(-10, 0, -36, 4, 1.1, 2.2), dark);
  add(box(10, 0, -36, 4, 1.1, 2.2), dark);

  // LINE spawn hall
  add(box(-16, 0, 44, 1, 3.4, 10), teal);
  add(box(16, 0, 44, 1, 3.4, 10), teal);
  add(box(0, 0, 48, 32, 3.4, 1), teal);
  add(box(-8, 0, 40, 5, 1.2, 2.4), steel);
  add(box(8, 0, 40, 5, 1.2, 2.4), steel);

  // Mid — two-lane freight cut with a raised spine
  add(box(-6.5, 0, 2, 1.1, 3.6, 22), concrete);
  add(box(6.5, 0, 2, 1.1, 3.6, 22), concrete);
  add(box(-5.4, 0, 14, 5.2, 2.8, 1.1), dark);
  add(box(5.4, 0, 14, 5.2, 2.8, 1.1), dark);
  add(box(0, 0, 2, 3.2, 0.55, 8), amber);
  for (const cover of spawnCoverBoxes()) add(cover, cover.maxZ < 0 ? rust : cover.minZ > 20 ? teal : dark);

  // A Vault — warm warehouse, readable amber trim
  add(box(-32, 0, 18, 1.1, 4, 20), 0xc4b496);
  add(box(-14, 0, 18, 1.1, 4, 12), 0xc4b496);
  add(box(-23, 0, 28, 18, 4, 1.1), 0xc4b496);
  add(box(-30, 0, 8, 8, 4, 1.1), 0xc4b496);
  add(box(-16, 0, 8, 6, 4, 1.1), 0xc4b496);
  add(box(-26, 0, 20, 3.4, 1.4, 3.4), amber);
  add(box(-20, 0, 16, 2.4, 2.2, 2.4), rust);
  add(box(-34, 0, 22, 3, 2.6, 5), dark);
  // A window slit (low cover, not a full wall)
  add(box(-14, 0, 22, 0.5, 1.1, 4), steel);

  // B Quay — cool containers + crane foot
  add(box(22, 0, 10, 6.5, 2.8, 3.2), COLORS.siteB);
  add(box(28, 0, 18, 6.5, 2.8, 3.2), 0x1f6b74);
  add(box(18, 0, 22, 4.2, 2.8, 6.5), 0x245c62);
  add(box(30, 0, 28, 5, 1.2, 5), steel);
  add(box(14, 0, 12, 1.1, 3.4, 14), teal);
  add(box(24, 0, 32, 16, 3.4, 1.1), teal);
  add(box(32, 0, 8, 1.1, 3.2, 10), steel);

  // Yard crates — mid control
  add(box(-18, 0, -8, 3.2, 1.6, 3.2), rust);
  add(box(16, 0, -6, 3.2, 1.6, 3.2), teal);
  add(box(-10, 0, -20, 2.6, 1.3, 2.6), dark);
  add(box(10, 0, -20, 2.6, 1.3, 2.6), dark);
  add(box(0, 0, -26, 5, 1.15, 2.2), steel);
  add(box(-24, 0, -16, 4, 2.2, 2.2), rust);
  add(box(22, 0, -16, 4, 2.2, 2.2), 0x2a6a72);

  // Connector elbows
  add(box(-22, 0, -2, 10, 2.4, 1.1), concrete);
  add(box(20, 0, -2, 10, 2.4, 1.1), concrete);

  // Site pads (not solid to players — visual + bomb volume)
  const aPad = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.08, 28),
    new THREE.MeshStandardMaterial({
      color: 0xe6b422,
      emissive: 0x8a6a10,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    }),
  );
  aPad.position.set(-23, 0.05, 18);
  visuals.add(aPad);

  const bPad = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.08, 28),
    new THREE.MeshStandardMaterial({
      color: 0x2ec4d6,
      emissive: 0x0a5060,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    }),
  );
  bPad.position.set(24, 0.05, 16);
  visuals.add(bPad);

  // Floating site letters
  const makeLetter = (ch: string, x: number, z: number, color: number) => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, 256, 256);
    g.font = "900 180px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = ch === "A" ? "#f0c44a" : "#4ad4e2";
    g.fillText(ch, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.position.set(x, 3.6, z);
    spr.scale.set(2.4, 2.4, 1);
    visuals.add(spr);
    return { text: ch, x, y: 3.6, z, color };
  };

  const labels = [
    makeLetter("A", -23, 18, COLORS.siteA),
    makeLetter("B", 24, 16, COLORS.siteB),
  ];

  const waypoints = ashpierWaypoints();

  return {
    solids,
    visuals,
    sites: [
      { id: "A", x: -23, z: 18, r: 3.6 },
      { id: "B", x: 24, z: 16, r: 3.6 },
    ],
    raidSpawn: { x: 0, z: -38, yaw: 0 },
    lineSpawn: { x: 0, z: 40, yaw: Math.PI },
    waypoints,
    labels,
  };
}

/** Side lanes only — no hop through the RAID/LINE lips, mid plug, or yard gate. */
export function ashpierWaypoints(): Waypoint[] {
  return [
    { id: "raid", x: 0, z: -38, links: ["raidL", "raidR"], area: "spawn" },
    { id: "raidL", x: -9, z: -32, links: ["raid", "yard", "cutL", "aAlley"], area: "spawn" },
    { id: "raidR", x: 9, z: -32, links: ["raid", "yard", "cutR", "bAlley"], area: "spawn" },
    { id: "yard", x: 0, z: -22, links: ["raidL", "raidR", "cutL", "cutR", "aAlley", "bAlley"], area: "yard" },
    { id: "cutL", x: -9, z: -16, links: ["yard", "raidL", "aAlley", "midL"], area: "yard" },
    { id: "cutR", x: 9, z: -16, links: ["yard", "raidR", "bAlley", "midR"], area: "yard" },
    { id: "midIn", x: 0, z: -6, links: ["mid", "midL", "midR"], area: "mid" },
    { id: "mid", x: 0, z: 6, links: ["midIn", "midL", "midR"], area: "mid" },
    { id: "midL", x: -9, z: 14, links: ["mid", "midIn", "midOut", "cutL", "aDoor"], area: "mid" },
    { id: "midR", x: 9, z: 14, links: ["mid", "midIn", "midOut", "cutR", "bDoor"], area: "mid" },
    { id: "midOut", x: 0, z: 20, links: ["midL", "midR", "aDoor", "bDoor", "lineL", "lineR"], area: "mid" },
    { id: "aAlley", x: -22, z: -12, links: ["raidL", "yard", "cutL", "aSite"], area: "a" },
    { id: "aSite", x: -23, z: 18, links: ["aAlley", "aDoor"], area: "a" },
    { id: "aDoor", x: -12, z: 18, links: ["aSite", "midOut", "midL"], area: "a" },
    { id: "bAlley", x: 20, z: -12, links: ["raidR", "yard", "cutR", "bSite"], area: "b" },
    { id: "bSite", x: 24, z: 16, links: ["bAlley", "bDoor"], area: "b" },
    { id: "bDoor", x: 14, z: 20, links: ["bSite", "midOut", "midR"], area: "b" },
    { id: "lineL", x: -9, z: 32, links: ["line", "midOut", "aDoor"], area: "spawn" },
    { id: "lineR", x: 9, z: 32, links: ["line", "midOut", "bDoor"], area: "spawn" },
    { id: "line", x: 0, z: 40, links: ["lineL", "lineR"], area: "spawn" },
  ];
}

export function siteAt(sites: Site[], x: number, z: number): Site | null {
  for (const s of sites) {
    if (Math.hypot(x - s.x, z - s.z) <= s.r) return s;
  }
  return null;
}

export function nearestWaypoint(points: Waypoint[], x: number, z: number): Waypoint {
  let best = points[0];
  let d = Infinity;
  for (const p of points) {
    const n = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (n < d) {
      d = n;
      best = p;
    }
  }
  return best;
}

export function waypointById(points: Waypoint[], id: string): Waypoint {
  return points.find((p) => p.id === id) ?? points[0];
}

/** LINE hunters peek mid/A instead of pathing into the RAID box. */
export function huntPeekGoal(playerZ: number, botId: number): string | null {
  if (playerZ >= -18) return null;
  return botId % 3 === 0 ? "cutL" : botId % 3 === 1 ? "cutR" : "aAlley";
}

/** RAID / LINE pads behind the spawn lips. Side walk-arounds are outside. */
export function teamSpawnBounds(raid: boolean): { minX: number; maxX: number; minZ: number; maxZ: number } {
  if (raid) return { minX: -7.6, maxX: 7.6, minZ: -46, maxZ: -33.45 };
  return { minX: -7.6, maxX: 7.6, minZ: 33.45, maxZ: 48 };
}

export function inTeamSpawn(raid: boolean, x: number, z: number): boolean {
  const b = teamSpawnBounds(raid);
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

export function clampToTeamSpawn(raid: boolean, x: number, z: number): { x: number; z: number } {
  const b = teamSpawnBounds(raid);
  return {
    x: Math.max(b.minX, Math.min(b.maxX, x)),
    z: Math.max(b.minZ, Math.min(b.maxZ, z)),
  };
}

/** Extra lips on the side lanes so freeze cannot leak onto mid. */
export function freezeGateBoxes(): AABB[] {
  return [
    box(-8.6, 0, -33, 5.2, 3.6, 1.5),
    box(8.6, 0, -33, 5.2, 3.6, 1.5),
    box(-8.6, 0, 33, 5.2, 3.6, 1.5),
    box(8.6, 0, 33, 5.2, 3.6, 1.5),
  ];
}
