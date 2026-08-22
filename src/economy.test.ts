import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MATCH } from "./config";
import { GEAR, WEAPONS, hitDamage, makeWeapon, sprayOffset, viewKick } from "./weapons";

describe("economy and weapons", () => {
  it("opening buy cannot afford a rifle", () => {
    assert.ok(MATCH.startMoney < WEAPONS.ridge.price);
    assert.ok(MATCH.startMoney >= GEAR.kevlar.price);
    assert.ok(MATCH.startMoney >= WEAPONS.anvil.price);
  });

  it("loss streak payout stays under a full-buy rifle until stacked", () => {
    const one = MATCH.lossBase + MATCH.lossBonus;
    assert.ok(one < WEAPONS.ridge.price);
    const four = MATCH.lossBase + MATCH.lossBonusMax * MATCH.lossBonus;
    assert.ok(four + MATCH.startMoney >= WEAPONS.ridge.price);
  });

  it("headshots deal more than chest against armor", () => {
    const w = makeWeapon("ridge");
    const chest = hitDamage(w.def, 12, false, true, true);
    const head = hitDamage(w.def, 12, true, true, true);
    assert.ok(head > chest * 2);
  });

  it("first shot is on the crosshair", () => {
    const w = makeWeapon("anvil");
    const s = sprayOffset(w);
    assert.equal(s.x, 0);
    assert.equal(s.y, 0);
  });

  it("Anvil kicks harder than Stitch on the first shot", () => {
    const anvil = viewKick(WEAPONS.anvil, 0);
    const stitch = viewKick(WEAPONS.stitch, 0);
    assert.ok(anvil.pitch > stitch.pitch * 3);
    assert.ok(viewKick(WEAPONS.stitch, 8).pitch > stitch.pitch);
  });

  it("names stay original", () => {
    const banned = /ak-?47|m4a1|awp|desert eagle|glock|usp|mp9|dust2|inferno|mirage|counter-?strike/i;
    for (const w of Object.values(WEAPONS)) {
      assert.equal(banned.test(w.name), false, w.name);
    }
  });
});
