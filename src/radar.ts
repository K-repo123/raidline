/** Ashpier world bounds projected onto the square radar. +Z (look yaw 0) is up. */
export const RADAR_WORLD = { minX: -44, maxX: 46, minZ: -48, maxZ: 52 };

export function radarWorldToCanvas(
  x: number,
  z: number,
  size: number,
  world = RADAR_WORLD,
): { x: number; y: number } {
  const nx = (x - world.minX) / (world.maxX - world.minX);
  const nz = (z - world.minZ) / (world.maxZ - world.minZ);
  return { x: nx * size, y: (1 - nz) * size };
}

/** Tip of the look-yaw notch in canvas space. */
export function radarYawTip(
  px: number,
  pz: number,
  yaw: number,
  length: number,
  size: number,
  world = RADAR_WORLD,
): { x: number; y: number } {
  return radarWorldToCanvas(px + Math.sin(yaw) * length, pz + Math.cos(yaw) * length, size, world);
}
