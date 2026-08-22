import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accelerate, applyFriction, collideCircleBoxes, wishDirection } from "./physics";

describe("movement", () => {
  it("counter-strafe wish opposes velocity so accelerate does not add speed", () => {
    const after = accelerate(5, 0, -1, 0, 5.45, 10.2, 0.016);
    assert.ok(after.vx <= 5);
  });

  it("friction bleeds speed on the ground", () => {
    const after = applyFriction(5.45, 0, 0.05);
    assert.ok(after.vx < 5.45);
    assert.equal(after.vz, 0);
  });

  it("wish direction follows yaw", () => {
    const out = { x: 0, z: 0 };
    wishDirection(0, 1, 0, out);
    assert.ok(Math.abs(out.x) < 1e-9);
    assert.ok(Math.abs(out.z - 1) < 1e-9);
  });

  it("circle resolves out of an AABB", () => {
    const boxes = [{ minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -1, maxZ: 1, solid: true }];
    const p = collideCircleBoxes(0.9, 0, 0.4, boxes);
    assert.ok(p.x >= 1.4 - 1e-6 || p.x <= -1.4 + 1e-6 || Math.abs(p.z) >= 1.4 - 1e-6);
  });
});
