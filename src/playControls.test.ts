import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMatchPhase, nextBuyOpen, shouldDiscardLook } from "./playControls";

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
