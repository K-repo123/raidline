export const TEAM = {
  RAID: 0,
  LINE: 1,
} as const;

export type Team = (typeof TEAM)[keyof typeof TEAM];

export const MATCH = {
  firstTo: 8,
  swapAt: 8,
  freezeTime: 15,
  roundTime: 105,
  bombTime: 35,
  plantTime: 3.2,
  defuseTime: 5,
  defuseNoKit: 10,
  winMoney: 3250,
  lossBase: 1400,
  lossBonus: 500,
  lossBonusMax: 4,
  plantMoney: 300,
  killMoney: 300,
  startMoney: 800,
  maxMoney: 16000,
  buyWindow: 20,
} as const;

export const MOVE = {
  run: 5.45,
  walk: 2.55,
  crouch: 1.65,
  accel: 13.4,
  airAccel: 0.82,
  friction: 7.4,
  stopSpeed: 2.5,
  gravity: 24,
  jump: 6.15,
  radius: 0.38,
  standHeight: 1.72,
  crouchHeight: 1.18,
  eyeStand: 1.58,
  eyeCrouch: 1.05,
  stepInterval: 0.36,
} as const;

export const COLORS = {
  raid: 0xc45a2a,
  line: 0x2a8f8a,
  raidBright: "#e07a3a",
  lineBright: "#3ec8c0",
  siteA: 0xd4a017,
  siteB: 0x2aa8d4,
} as const;
