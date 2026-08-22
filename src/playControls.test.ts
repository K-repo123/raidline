import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLockAcquireClick, isMatchPhase, nextBuyOpen, shouldDiscardLook, shouldIgnoreLockShot, siteUseState } from "./playControls";

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

describe("site use", () => {
  it("only progresses plant/defuse inside the trigger", () => {
    const off = siteUseState({
      holdingE: true,
      onSite: false,
      nearBomb: false,
      hasBomb: true,
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
});
