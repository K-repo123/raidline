import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MATCH } from "./config";
import { GEAR, PLAYER_HURT_PER_TICK, WEAPONS, botChipDamage, hitDamage, makeWeapon, soakArmor, sprayOffset, takePlayerHurt, viewKick } from "./weapons";

describe("economy and weapons", () => {
  it("bot-vs-bot wipes cannot decide a round before 45s", () => {
    assert.equal(MATCH.minWipeTime, 45);
  });

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

  it("vest soaks HP instead of passing the full chunk", () => {
    const raw = hitDamage(WEAPONS.ridge, 10, false, false, false);
    const soaked = soakArmor(100, false, raw, false);
    assert.ok(soaked.hp < raw * 0.6);
    assert.ok(soaked.armor < 100);
    assert.ok(soaked.hp > 8);
  });

  it("bot chips do not delete 100 HP in one bullet", () => {
    const hs = hitDamage(WEAPONS.ridge, 8, true, true, true);
    const chip = botChipDamage(soakArmor(100, true, hs, true).hp, true);
    assert.ok(chip <= 14);
    assert.ok(chip + 80 < 100);
  });

  it("five simultaneous bot chips cannot zero the player in one tick", () => {
    let hp = 100;
    let budget = PLAYER_HURT_PER_TICK;
    for (let i = 0; i < 5; i++) {
      const chip = botChipDamage(20, false);
      const step = takePlayerHurt(budget, chip);
      budget = step.budget;
      hp -= step.take;
    }
    assert.ok(hp >= 100 - PLAYER_HURT_PER_TICK);
    assert.ok(hp > 50);
  });

  it("names stay original", () => {
    const banned = /ak-?47|m4a1|awp|desert eagle|glock|usp|mp9|dust2|inferno|mirage|counter-?strike/i;
    for (const w of Object.values(WEAPONS)) {
      assert.equal(banned.test(w.name), false, w.name);
    }
  });
});
