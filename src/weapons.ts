export type FireMode = "semi" | "auto" | "bolt";

export type WeaponDef = {
  id: string;
  name: string;
  slot: 1 | 2 | 3;
  price: number;
  category: "pistol" | "smg" | "rifle" | "heavy";
  damage: number;
  armorPen: number;
  headMul: number;
  rpm: number;
  mag: number;
  reserve: number;
  reload: number;
  moveScale: number;
  spreadStand: number;
  spreadMove: number;
  recoilY: number;
  recoilX: number;
  recovery: number;
  range: number;
  falloff: number;
  pellets: number;
  mode: FireMode;
  killAward: number;
  sound: "dart" | "anvil" | "stitch" | "ridge" | "quarrel" | "longline" | "hatch";
};

export const WEAPONS: Record<string, WeaponDef> = {
  dart: {
    id: "dart",
    name: "Dart",
    slot: 2,
    price: 200,
    category: "pistol",
    damage: 34,
    armorPen: 0.52,
    headMul: 4,
    rpm: 400,
    mag: 12,
    reserve: 24,
    reload: 1.8,
    moveScale: 1,
    spreadStand: 0.003,
    spreadMove: 0.012,
    recoilY: 0.012,
    recoilX: 0.004,
    recovery: 8,
    range: 40,
    falloff: 0.35,
    pellets: 1,
    mode: "semi",
    killAward: 300,
    sound: "dart",
  },
  anvil: {
    id: "anvil",
    name: "Anvil",
    slot: 2,
    price: 700,
    category: "pistol",
    damage: 52,
    armorPen: 0.72,
    headMul: 3.6,
    rpm: 220,
    mag: 7,
    reserve: 21,
    reload: 2.1,
    moveScale: 1,
    spreadStand: 0.004,
    spreadMove: 0.02,
    recoilY: 0.028,
    recoilX: 0.01,
    recovery: 6,
    range: 45,
    falloff: 0.28,
    pellets: 1,
    mode: "semi",
    killAward: 300,
    sound: "anvil",
  },
  stitch: {
    id: "stitch",
    name: "Stitch",
    slot: 1,
    price: 1250,
    category: "smg",
    damage: 26,
    armorPen: 0.48,
    headMul: 3.2,
    rpm: 780,
    mag: 30,
    reserve: 90,
    reload: 2.0,
    moveScale: 1.08,
    spreadStand: 0.008,
    spreadMove: 0.01,
    recoilY: 0.008,
    recoilX: 0.009,
    recovery: 10,
    range: 28,
    falloff: 0.55,
    pellets: 1,
    mode: "auto",
    killAward: 600,
    sound: "stitch",
  },
  ridge: {
    id: "ridge",
    name: "Ridge-15",
    slot: 1,
    price: 2700,
    category: "rifle",
    damage: 31,
    armorPen: 0.68,
    headMul: 4,
    rpm: 600,
    mag: 30,
    reserve: 90,
    reload: 2.3,
    moveScale: 0.92,
    spreadStand: 0.0018,
    spreadMove: 0.028,
    recoilY: 0.014,
    recoilX: 0.007,
    recovery: 7.2,
    range: 55,
    falloff: 0.22,
    pellets: 1,
    mode: "auto",
    killAward: 300,
    sound: "ridge",
  },
  quarrel: {
    id: "quarrel",
    name: "Quarrel-4",
    slot: 1,
    price: 3100,
    category: "rifle",
    damage: 35,
    armorPen: 0.78,
    headMul: 4,
    rpm: 545,
    mag: 25,
    reserve: 75,
    reload: 2.5,
    moveScale: 0.9,
    spreadStand: 0.0012,
    spreadMove: 0.032,
    recoilY: 0.016,
    recoilX: 0.005,
    recovery: 6.4,
    range: 62,
    falloff: 0.18,
    pellets: 1,
    mode: "auto",
    killAward: 300,
    sound: "quarrel",
  },
  longline: {
    id: "longline",
    name: "Longline",
    slot: 1,
    price: 4700,
    category: "heavy",
    damage: 88,
    armorPen: 0.85,
    headMul: 2.2,
    rpm: 48,
    mag: 5,
    reserve: 15,
    reload: 3.2,
    moveScale: 0.72,
    spreadStand: 0.0004,
    spreadMove: 0.08,
    recoilY: 0.04,
    recoilX: 0.006,
    recovery: 3.2,
    range: 90,
    falloff: 0.05,
    pellets: 1,
    mode: "bolt",
    killAward: 100,
    sound: "longline",
  },
  hatch: {
    id: "hatch",
    name: "Hatch",
    slot: 1,
    price: 1800,
    category: "heavy",
    damage: 18,
    armorPen: 0.5,
    headMul: 1.6,
    rpm: 75,
    mag: 6,
    reserve: 24,
    reload: 2.6,
    moveScale: 0.88,
    spreadStand: 0.04,
    spreadMove: 0.07,
    recoilY: 0.03,
    recoilX: 0.012,
    recovery: 5,
    range: 14,
    falloff: 0.85,
    pellets: 8,
    mode: "semi",
    killAward: 900,
    sound: "hatch",
  },
};

export const GEAR = {
  kevlar: { id: "kevlar", name: "Vest", price: 650 },
  full: { id: "full", name: "Vest + Helm", price: 1000 },
  kit: { id: "kit", name: "Breach kit", price: 400 },
  flash: { id: "flash", name: "Flare", price: 200 },
  smoke: { id: "smoke", name: "Veil", price: 300 },
  frag: { id: "frag", name: "Burst", price: 300 },
} as const;

export type WeaponState = {
  def: WeaponDef;
  mag: number;
  reserve: number;
  cooldown: number;
  reloading: number;
  recoil: number;
  shots: number;
};

export function makeWeapon(id: string): WeaponState {
  const def = WEAPONS[id];
  return {
    def,
    mag: def.mag,
    reserve: def.reserve,
    cooldown: 0,
    reloading: 0,
    recoil: 0,
    shots: 0,
  };
}

export function cycleTime(def: WeaponDef): number {
  return 60 / def.rpm;
}

export function applyRecoil(w: WeaponState, dt: number): void {
  w.recoil = Math.max(0, w.recoil - w.def.recovery * dt);
  if (w.recoil < 0.002) w.shots = 0;
}

export function sprayOffset(w: WeaponState): { x: number; y: number } {
  const i = w.shots;
  const climb = Math.min(i, 8) * w.def.recoilY;
  const sway = Math.sin(i * 1.7) * w.def.recoilX * Math.min(i, 10);
  return { x: sway, y: climb + w.recoil * 0.35 };
}

export function hitDamage(
  def: WeaponDef,
  dist: number,
  head: boolean,
  armored: boolean,
  helm: boolean,
): number {
  const fall = 1 - Math.min(1, Math.max(0, dist - 8) / def.range) * def.falloff;
  let dmg = def.damage * fall;
  if (head) {
    dmg *= def.headMul;
    if (helm) dmg *= 0.72;
  } else if (armored) {
    dmg *= 0.45 + def.armorPen * 0.55;
  }
  return dmg;
}
