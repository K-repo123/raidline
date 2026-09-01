import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { VIEWMODEL_REST } from "./config";
import { ashpierWallSpecs, ashpierWaypoints, huntPeekGoal, spawnCoverBoxes, waypointById } from "./map";
import { segmentHitsBoxes } from "./physics";

describe("spawn cover", () => {
  it("blocks eye-height LOS from RAID spawn to LINE spawn", () => {
    const t = segmentHitsBoxes(0, 1.58, -38, 0, 1.58, 40, spawnCoverBoxes());
    assert.ok(t < 0.99, `LOS t=${t}`);
  });

  it("leaves a walk-around lane at the RAID lip", () => {
    const t = segmentHitsBoxes(-9, 1.0, -38, -9, 1.0, -22, spawnCoverBoxes());
    assert.ok(t >= 0.99, `side lane blocked t=${t}`);
  });

  it("blocks offset LINE lane to RAID spawn", () => {
    const t = segmentHitsBoxes(3.7, 1.58, 37.6, 0, 1.58, -38, spawnCoverBoxes());
    assert.ok(t < 0.99, `offset LOS t=${t}`);
  });

  it("lets a peek from cutL see spawn-exit but not the RAID box", () => {
    const cover = spawnCoverBoxes();
    const exit = segmentHitsBoxes(-9, 1.58, -16, 0, 1.58, -31, cover);
    const box = segmentHitsBoxes(-9, 1.58, -16, 0, 1.58, -38, cover);
    assert.ok(exit >= 0.99, `spawn-exit blocked t=${exit}`);
    assert.ok(box < 0.99, `RAID box open t=${box}`);
  });

  it("keeps the LINE-to-RAID hunt path off the cover boxes", () => {
    const pts = ashpierWaypoints();
    const cover = spawnCoverBoxes();
    const q = ["line"];
    const prev = new Map<string, string>([["line", "line"]]);
    while (q.length) {
      const id = q.shift()!;
      if (id === "raid") break;
      for (const n of waypointById(pts, id).links) {
        if (!prev.has(n)) {
          prev.set(n, id);
          q.push(n);
        }
      }
    }
    assert.ok(prev.has("raid"), "no path from line to raid");
    const hops: string[] = ["raid"];
    while (hops[0] !== "line") hops.unshift(prev.get(hops[0])!);
    for (let i = 0; i < hops.length - 1; i++) {
      const a = waypointById(pts, hops[i]);
      const b = waypointById(pts, hops[i + 1]);
      const t = segmentHitsBoxes(a.x, 1.0, a.z, b.x, 1.0, b.z, cover);
      assert.ok(t >= 0.99, `${a.id}→${b.id} hits cover t=${t}`);
    }
  });
});

describe("hunt peek", () => {
  it("sends hunters to mid cuts instead of the RAID box", () => {
    assert.equal(huntPeekGoal(-31, 6), "cutL");
    assert.equal(huntPeekGoal(-31, 7), "cutR");
    assert.equal(huntPeekGoal(-31, 8), "aAlley");
    assert.equal(huntPeekGoal(-38, 6), "cutL");
    assert.equal(huntPeekGoal(0, 6), null);
    assert.notEqual(huntPeekGoal(-31, 6), "raid");
  });

  it("keeps the LINE side lane to midL off cover", () => {
    const t = segmentHitsBoxes(-9, 1.0, 32, -9, 1.0, 14, spawnCoverBoxes());
    assert.ok(t >= 0.99, `lineL→midL hits cover t=${t}`);
  });

  it("keeps the LINE-to-cutL peek path off cover", () => {
    const pts = ashpierWaypoints();
    const cover = spawnCoverBoxes();
    const q = ["line"];
    const prev = new Map<string, string>([["line", "line"]]);
    while (q.length) {
      const id = q.shift()!;
      if (id === "cutL") break;
      for (const n of waypointById(pts, id).links) {
        if (!prev.has(n)) {
          prev.set(n, id);
          q.push(n);
        }
      }
    }
    assert.ok(prev.has("cutL"), "no path from line to cutL");
    const hops: string[] = ["cutL"];
    while (hops[0] !== "line") hops.unshift(prev.get(hops[0])!);
    for (let i = 0; i < hops.length - 1; i++) {
      const a = waypointById(pts, hops[i]);
      const b = waypointById(pts, hops[i + 1]);
      const t = segmentHitsBoxes(a.x, 1.0, a.z, b.x, 1.0, b.z, cover);
      assert.ok(t >= 0.99, `${a.id}→${b.id} hits cover t=${t}`);
    }
  });
});

describe("ashpier collision lock", () => {
  it("keeps the same AABB count and spawn-cover solids", () => {
    const walls = ashpierWallSpecs();
    assert.equal(walls.length, 48);
    for (const cover of spawnCoverBoxes()) {
      const hit = walls.some(
        (w) =>
          w.aabb.minX === cover.minX &&
          w.aabb.maxX === cover.maxX &&
          w.aabb.minY === cover.minY &&
          w.aabb.maxY === cover.maxY &&
          w.aabb.minZ === cover.minZ &&
          w.aabb.maxZ === cover.maxZ &&
          w.aabb.solid,
      );
      assert.ok(hit, `missing cover ${cover.minX},${cover.minZ}`);
    }
  });

  it("keeps RAID warehouse boxes and does not add a shed AABB", () => {
    const walls = ashpierWallSpecs();
    assert.ok(walls.some((w) => w.aabb.minX === -14.5 && w.aabb.maxX === -13.5 && w.aabb.minZ === -45 && w.aabb.maxZ === -35));
    assert.ok(walls.some((w) => w.aabb.minX === 13.5 && w.aabb.maxX === 14.5 && w.aabb.minZ === -45 && w.aabb.maxZ === -35));
    assert.ok(walls.some((w) => w.aabb.minX === -14 && w.aabb.maxX === 14 && w.aabb.minZ === -45.5 && w.aabb.maxZ === -44.5));
    assert.equal(
      walls.filter((w) => w.aabb.minX === -14.51 || w.aabb.maxX === 14.51).length,
      0,
    );
  });
});

describe("viewmodel rest", () => {
  it("tucks Ridge-15 to the CS-style lower-right rest pose", () => {
    assert.deepEqual(
      { x: VIEWMODEL_REST.x, y: VIEWMODEL_REST.y, z: VIEWMODEL_REST.z },
      { x: 0.22, y: -0.26, z: 0.06 },
    );
    assert.deepEqual(
      { rx: VIEWMODEL_REST.rx, ry: VIEWMODEL_REST.ry, rz: VIEWMODEL_REST.rz },
      { rx: 0.22, ry: -0.18, rz: -0.28 },
    );
  });
});
