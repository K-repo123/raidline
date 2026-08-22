import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ashpierWaypoints, clampToTeamSpawn, freezeGateBoxes, huntPeekGoal, inTeamSpawn, spawnCoverBoxes, waypointById } from "./map";
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

describe("fair freeze spawn", () => {
  it("keeps RAID spawn-exit and mid outside the RAID box", () => {
    assert.equal(inTeamSpawn(true, 0, -38), true);
    assert.equal(inTeamSpawn(true, 0, -31), false);
    assert.equal(inTeamSpawn(true, 0, 0), false);
    assert.equal(inTeamSpawn(false, 0, 40), true);
    assert.equal(inTeamSpawn(false, 0, 20), false);
  });

  it("clamps a mid run back into the spawn pad", () => {
    const raid = clampToTeamSpawn(true, 0, -20);
    assert.ok(raid.z <= -33.4);
    assert.equal(inTeamSpawn(true, raid.x, raid.z), true);
    const line = clampToTeamSpawn(false, 0, 10);
    assert.ok(line.z >= 33.4);
    assert.equal(inTeamSpawn(false, line.x, line.z), true);
  });

  it("closes the RAID side lane during freeze", () => {
    const t = segmentHitsBoxes(-9, 1.0, -38, -9, 1.0, -22, freezeGateBoxes());
    assert.ok(t < 0.99, `freeze lane still open t=${t}`);
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
