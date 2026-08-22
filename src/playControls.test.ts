import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buyAffordable, isLockAcquireClick, isMatchPhase, nextBuyOpen, playerSpawnProtected, shouldDiscardLook, shouldIgnoreLockShot, siteUseState, teamFragScore } from "./playControls";

describe("buy toggle", () => {
  it("B closes Supply even when the buy window has ended", () => {
    assert.equal(nextBuyOpen(true, false, true), false);
  });

  it("B opens only when buying is allowed", () => {
    assert.equal(nextBuyOpen(false, true, true), true);
    assert.equal(nextBuyOpen(false, false, true), false);
  });
});

describe("pointer-lock look", () => {
  it("discards the first event after lock and huge jumps", () => {
    assert.equal(shouldDiscardLook(2, 1, 1), true);
    assert.equal(shouldDiscardLook(0, 0, -400), true);
    assert.equal(shouldDiscardLook(0, 3, -2), false);
  });
});

describe("match phases", () => {
  it("treats freeze and live as in-match", () => {
    assert.equal(isMatchPhase("live"), true);
    assert.equal(isMatchPhase("menu"), false);
  });
});

describe("pointer-lock fire", () => {
  it("ignores the click that acquires lock", () => {
    assert.equal(shouldIgnoreLockShot(false, false), true);
    assert.equal(shouldIgnoreLockShot(true, true), true);
    assert.equal(shouldIgnoreLockShot(true, false), false);
  });

  it("does not treat a later locked click as another lock-acquire", () => {
    assert.equal(isLockAcquireClick(false), true);
    assert.equal(isLockAcquireClick(true), false);
  });
});

describe("spawn protection", () => {
  it("covers freeze and the first 3s of live, not 3.0 exactly", () => {
    assert.equal(playerSpawnProtected("freeze", 0, 3), true);
    assert.equal(playerSpawnProtected("live", 0, 3), true);
    assert.equal(playerSpawnProtected("live", 2.99, 3), true);
    assert.equal(playerSpawnProtected("live", 3, 3), false);
    assert.equal(playerSpawnProtected("planted", 1, 3), false);
  });
});

describe("site use", () => {
  it("only progresses plant/defuse inside the trigger", () => {
    const off = siteUseState({
      holdingE: true,
      onSite: false,
      nearBomb: false,
      hasBomb: false,
      bombArmed: false,
      defending: false,
    });
    assert.equal(off.progressPlant, false);
    assert.equal(off.showBar, false);
    assert.equal(off.offSiteHint, true);

    const on = siteUseState({
      holdingE: true,
      onSite: true,
      nearBomb: false,
      hasBomb: true,
      bombArmed: false,
      defending: false,
    });
    assert.equal(on.progressPlant, true);
    assert.equal(on.showBar, true);
    assert.equal(on.offSiteHint, false);
  });

  it("treats a tap of E off-site as a hint even without the charge", () => {
    const tap = siteUseState({
      holdingE: true,
      onSite: false,
      nearBomb: false,
      hasBomb: false,
      bombArmed: false,
      defending: true,
    });
    assert.equal(tap.offSiteHint, true);
  });
});

describe("buy affordability", () => {
  it("greys rifles on an $800 open and keeps Anvil affordable", () => {
    assert.equal(buyAffordable("anvil", 800), true);
    assert.equal(buyAffordable("ridge", 800), false);
    assert.equal(buyAffordable("full", 800), false);
    assert.equal(buyAffordable("flash", 800), true);
  });
});

describe("frag score", () => {
  it("moves the RAID/LINE totals when someone gets a kill", () => {
    const actors = [
      { team: 0, kills: 0 },
      { team: 1, kills: 0 },
    ];
    assert.equal(teamFragScore(actors, 0), 0);
    actors[0].kills = 1;
    assert.equal(teamFragScore(actors, 0), 1);
    assert.equal(teamFragScore(actors, 1), 0);
  });
});
