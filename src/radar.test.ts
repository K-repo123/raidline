import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { radarWorldToCanvas, radarYawTip } from "./radar";

describe("radar", () => {
  it("moves the player pip when the player walks +Z", () => {
    const a = radarWorldToCanvas(0, -38, 168);
    const b = radarWorldToCanvas(0, -20, 168);
    assert.ok(Math.abs(a.x - b.x) < 1e-6);
    assert.ok(b.y < a.y - 8);
  });

  it("moves the player pip left when the player strafes +X (camera-left)", () => {
    const a = radarWorldToCanvas(0, -38, 168);
    const b = radarWorldToCanvas(8, -38, 168);
    assert.ok(b.x < a.x - 8);
    assert.ok(Math.abs(a.y - b.y) < 1e-6);
  });

  it("walks the pip toward A Vault when the player walks to A", () => {
    const spawn = radarWorldToCanvas(0, -38, 168);
    const mid = radarWorldToCanvas(-12, -10, 168);
    const site = radarWorldToCanvas(-23, 18, 168);
    assert.ok(site.x > spawn.x + 8, "A is view-right / radar-right from RAID spawn");
    assert.ok(site.y < spawn.y - 8, "A is forward / radar-up from RAID spawn");
    assert.ok(Math.abs(mid.x - spawn.x) > 4);
    assert.ok((mid.x - spawn.x) * (site.x - spawn.x) > 0);
    assert.ok((mid.y - spawn.y) * (site.y - spawn.y) > 0);
  });

  it("points the yaw notch up when looking +Z", () => {
    const pip = radarWorldToCanvas(0, -38, 168);
    const tip = radarYawTip(0, -38, 0, 6, 168);
    assert.ok(tip.y < pip.y);
    assert.ok(Math.abs(tip.x - pip.x) < 1e-6);
  });

  it("rotates the yaw notch left when yaw increases (turn left)", () => {
    const pip = radarWorldToCanvas(0, -38, 168);
    const tip = radarYawTip(0, -38, 0.45, 6, 168);
    assert.ok(tip.x < pip.x - 4);
  });
});
