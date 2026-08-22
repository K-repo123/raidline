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

  it("moves the player pip when the player strafes +X", () => {
    const a = radarWorldToCanvas(0, -38, 168);
    const b = radarWorldToCanvas(8, -38, 168);
    assert.ok(b.x > a.x + 8);
    assert.ok(Math.abs(a.y - b.y) < 1e-6);
  });

  it("points the yaw notch up when looking +Z", () => {
    const pip = radarWorldToCanvas(0, -38, 168);
    const tip = radarYawTip(0, -38, 0, 6, 168);
    assert.ok(tip.y < pip.y);
    assert.ok(Math.abs(tip.x - pip.x) < 1e-6);
  });
});
