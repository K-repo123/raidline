import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnCoverBoxes } from "./map";
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
});
