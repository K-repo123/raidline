import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accelerate, applyFriction, collideCircleBoxes, moveInaccuracy, shotCone, stillForFirstShot, stepMovement, wishDirection } from "./physics";

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

  it("strafe right matches Three.js camera-right (not world +X)", () => {
    const out = { x: 0, z: 0 };
    wishDirection(0, 0, 1, out);
    assert.ok(Math.abs(out.x - -1) < 1e-9, "D at yaw 0 must move -X (view right)");
    assert.ok(Math.abs(out.z) < 1e-9);
    wishDirection(0, 0, -1, out);
    assert.ok(Math.abs(out.x - 1) < 1e-9, "A at yaw 0 must move +X (view left)");
    assert.ok(Math.abs(out.z) < 1e-9);
  });

  it("opposite-key counter-strafe dumps speed in one tick", () => {
    const next = stepMovement(5.2, 0, 0, {
      forward: 0,
      right: 1,
      jump: false,
      walk: false,
      crouch: false,
      onGround: true,
    }, 0, 0.016);
    assert.ok(Math.hypot(next.vx, next.vz) < 2.2, `speed ${Math.hypot(next.vx, next.vz)}`);
  });

  it("walk is tighter than a full run", () => {
    assert.ok(moveInaccuracy(2.5, false, false, true) < 0.003);
    assert.ok(moveInaccuracy(5.4, false, false, false) > 0.04);
  });

  it("WASD bloom opens the cone and a still first shot stays tight", () => {
    const stand = 0.003;
    const moveSpread = 0.012;
    const still = shotCone(stand, moveSpread, moveInaccuracy(0.4, false, false, false), stillForFirstShot(0.4));
    const run = shotCone(stand, moveSpread, moveInaccuracy(5.4, false, false, false), stillForFirstShot(5.4));
    assert.ok(still <= stand + 1e-6);
    assert.ok(run > still * 6);
    const dumped = stepMovement(5.2, 0, 0, {
      forward: 0,
      right: 1,
      jump: false,
      walk: false,
      crouch: false,
      onGround: true,
    }, 0, 0.016);
    assert.ok(stillForFirstShot(Math.hypot(dumped.vx, dumped.vz)));
  });

  it("circle resolves out of an AABB", () => {
    const boxes = [{ minX: -1, maxX: 1, minY: 0, maxY: 2, minZ: -1, maxZ: 1, solid: true }];
    const p = collideCircleBoxes(0.9, 0, 0.4, boxes);
    assert.ok(p.x >= 1.4 - 1e-6 || p.x <= -1.4 + 1e-6 || Math.abs(p.z) >= 1.4 - 1e-6);
  });
});
