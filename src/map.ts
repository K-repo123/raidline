import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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

export type WallVisual = { aabb: AABB; color: number };

const FLOOR_W = 120;
const FLOOR_D = 130;
const FLOOR_TILE = 4;

function modelUrl(name: string): string {
  return `${import.meta.env.BASE_URL}models/${name}`;
}

function loadGltf(name: string, onLoad: (root: THREE.Group) => void): void {
  new GLTFLoader().load(modelUrl(name), (gltf) => onLoad(gltf.scene), undefined, () => {
    /* file late or missing — keep collision and play without the visual */
  });
}

function eachMesh(root: THREE.Object3D, fn: (mesh: THREE.Mesh) => void): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) fn(mesh);
  });
}

function placeFloorTiles(group: THREE.Group, proto: THREE.Object3D): void {
  const nx = Math.ceil(FLOOR_W / FLOOR_TILE);
  const nz = Math.ceil(FLOOR_D / FLOOR_TILE);
  const x0 = -((nx * FLOOR_TILE) / 2) + FLOOR_TILE / 2;
  const z0 = -((nz * FLOOR_TILE) / 2) + FLOOR_TILE / 2;
  const count = nx * nz;
  proto.updateMatrixWorld(true);
  eachMesh(proto, (src) => {
    const inst = new THREE.InstancedMesh(src.geometry, src.material, count);
    inst.receiveShadow = true;
    inst.castShadow = false;
    inst.frustumCulled = false;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        dummy.position.set(x0 + ix * FLOOR_TILE, 0, z0 + iz * FLOOR_TILE);
        dummy.quaternion.identity();
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(i++, dummy.matrix.clone().multiply(src.matrixWorld));
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  });
}

function placeWallPanels(group: THREE.Group, proto: THREE.Object3D, walls: WallVisual[]): void {
  proto.updateMatrixWorld(true);
  eachMesh(proto, (src) => {
    const mat = (src.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
    if (mat.color) mat.color.setHex(0xffffff);
    const inst = new THREE.InstancedMesh(src.geometry, mat, walls.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    const dummy = new THREE.Object3D();
    walls.forEach((wall, i) => {
      dummy.position.set(
        (wall.aabb.minX + wall.aabb.maxX) / 2,
        (wall.aabb.minY + wall.aabb.maxY) / 2,
        (wall.aabb.minZ + wall.aabb.maxZ) / 2,
      );
      dummy.scale.set(wall.aabb.maxX - wall.aabb.minX, wall.aabb.maxY - wall.aabb.minY, wall.aabb.maxZ - wall.aabb.minZ);
      dummy.quaternion.identity();
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix.clone().multiply(src.matrixWorld));
      inst.setColorAt(i, new THREE.Color(wall.color));
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  });
}

function mountAshpierVisuals(group: THREE.Group, walls: WallVisual[]): void {
  loadGltf("ashpier-floor.glb", (root) => placeFloorTiles(group, root));
  loadGltf("ashpier-wall.glb", (root) => placeWallPanels(group, root, walls));
  loadGltf("ashpier-shed.glb", (root) => {
    root.position.set(0, 0, -40);
    eachMesh(root, (mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    group.add(root);
  });
}

/** Collision AABBs + the hex each wall panel is tinted with. Visual load does not change this list. */
export function ashpierWallSpecs(): WallVisual[] {
  const walls: WallVisual[] = [];
  const add = (aabb: AABB, color: number) => {
    walls.push({ aabb, color });
  };

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

  add(box(-14, 0, -40, 1, 3.2, 10), rust);
  add(box(14, 0, -40, 1, 3.2, 10), rust);
  add(box(0, 0, -45, 28, 3.2, 1), rust);
  add(box(-10, 0, -36, 4, 1.1, 2.2), dark);
  add(box(10, 0, -36, 4, 1.1, 2.2), dark);

  add(box(-16, 0, 44, 1, 3.4, 10), teal);
  add(box(16, 0, 44, 1, 3.4, 10), teal);
  add(box(0, 0, 48, 32, 3.4, 1), teal);
  add(box(-8, 0, 40, 5, 1.2, 2.4), steel);
  add(box(8, 0, 40, 5, 1.2, 2.4), steel);

  add(box(-6.5, 0, 2, 1.1, 3.6, 22), concrete);
  add(box(6.5, 0, 2, 1.1, 3.6, 22), concrete);
  add(box(-5.4, 0, 14, 5.2, 2.8, 1.1), dark);
  add(box(5.4, 0, 14, 5.2, 2.8, 1.1), dark);
  add(box(0, 0, 2, 3.2, 0.55, 8), amber);
  for (const cover of spawnCoverBoxes()) add(cover, cover.maxZ < 0 ? rust : cover.minZ > 20 ? teal : dark);

  add(box(-32, 0, 18, 1.1, 4, 20), 0xc4b496);
  add(box(-14, 0, 18, 1.1, 4, 12), 0xc4b496);
  add(box(-23, 0, 28, 18, 4, 1.1), 0xc4b496);
  add(box(-30, 0, 8, 8, 4, 1.1), 0xc4b496);
  add(box(-16, 0, 8, 6, 4, 1.1), 0xc4b496);
  add(box(-26, 0, 20, 3.4, 1.4, 3.4), amber);
  add(box(-20, 0, 16, 2.4, 2.2, 2.4), rust);
  add(box(-34, 0, 22, 3, 2.6, 5), dark);
  add(box(-14, 0, 22, 0.5, 1.1, 4), steel);

  add(box(22, 0, 10, 6.5, 2.8, 3.2), COLORS.siteB);
  add(box(28, 0, 18, 6.5, 2.8, 3.2), 0x1f6b74);
  add(box(18, 0, 22, 4.2, 2.8, 6.5), 0x245c62);
  add(box(30, 0, 28, 5, 1.2, 5), steel);
  add(box(14, 0, 12, 1.1, 3.4, 14), teal);
  add(box(24, 0, 32, 16, 3.4, 1.1), teal);
  add(box(32, 0, 8, 1.1, 3.2, 10), steel);

  add(box(-18, 0, -8, 3.2, 1.6, 3.2), rust);
  add(box(16, 0, -6, 3.2, 1.6, 3.2), teal);
  add(box(-10, 0, -20, 2.6, 1.3, 2.6), dark);
  add(box(10, 0, -20, 2.6, 1.3, 2.6), dark);
  add(box(0, 0, -26, 5, 1.15, 2.2), steel);
  add(box(-24, 0, -16, 4, 2.2, 2.2), rust);
  add(box(22, 0, -16, 4, 2.2, 2.2), 0x2a6a72);

  add(box(-22, 0, -2, 10, 2.4, 1.1), concrete);
  add(box(20, 0, -2, 10, 2.4, 1.1), concrete);

  return walls;
}

/** Ashpier — original coastal freight yard. Not a Valve map. */
export function buildAshpier(): MapData {
  const walls = ashpierWallSpecs();
  const visuals = new THREE.Group();

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
  const solids = walls.map((w) => w.aabb);
  mountAshpierVisuals(visuals, walls);

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
    { id: "midL", x: -9, z: 14, links: ["mid", "midIn", "midOut", "cutL", "aDoor", "lineL"], area: "mid" },
    { id: "midR", x: 9, z: 14, links: ["mid", "midIn", "midOut", "cutR", "bDoor", "lineR"], area: "mid" },
    { id: "midOut", x: 0, z: 20, links: ["midL", "midR", "aDoor", "bDoor", "lineL", "lineR"], area: "mid" },
    { id: "aAlley", x: -22, z: -12, links: ["raidL", "yard", "cutL", "aSite"], area: "a" },
    { id: "aSite", x: -23, z: 18, links: ["aAlley", "aDoor"], area: "a" },
    { id: "aDoor", x: -12, z: 18, links: ["aSite", "midOut", "midL"], area: "a" },
    { id: "bAlley", x: 20, z: -12, links: ["raidR", "yard", "cutR", "bSite"], area: "b" },
    { id: "bSite", x: 24, z: 16, links: ["bAlley", "bDoor"], area: "b" },
    { id: "bDoor", x: 14, z: 20, links: ["bSite", "midOut", "midR"], area: "b" },
    { id: "lineL", x: -9, z: 32, links: ["line", "midOut", "aDoor", "midL"], area: "spawn" },
    { id: "lineR", x: 9, z: 32, links: ["line", "midOut", "bDoor", "midR"], area: "spawn" },
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
