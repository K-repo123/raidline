import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTitleStartKey } from "./titleStart";

describe("title start keys", () => {
  it("accepts Enter and NumpadEnter", () => {
    assert.equal(isTitleStartKey("Enter"), true);
    assert.equal(isTitleStartKey("NumpadEnter"), true);
    assert.equal(isTitleStartKey("", "Enter"), true);
  });

  it("ignores movement and fire keys", () => {
    assert.equal(isTitleStartKey("KeyW"), false);
    assert.equal(isTitleStartKey("Space"), false);
    assert.equal(isTitleStartKey("Escape"), false);
  });
});
