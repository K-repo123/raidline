/** B always closes an open Supply panel; it only opens when buying is allowed. */
export function nextBuyOpen(open: boolean, canBuy: boolean, pressedB: boolean): boolean {
  if (!pressedB) return open;
  if (open) return false;
  return canBuy;
}

/** First look events after pointer lock are absolute cursor jumps, not deltas. */
export function shouldDiscardLook(ignoreCount: number, movementX: number, movementY: number): boolean {
  if (ignoreCount > 0) return true;
  return Math.abs(movementX) > 48 || Math.abs(movementY) > 48;
}

export function isMatchPhase(phase: string): boolean {
  return phase === "freeze" || phase === "live" || phase === "planted" || phase === "end";
}

/** CS does not shoot on the click that captures the mouse. */
export function shouldIgnoreLockShot(locked: boolean, ignoreUntilUp: boolean): boolean {
  return !locked || ignoreUntilUp;
}

/** Once locked, leftover ignore must not be treated as another lock-acquire click. */
export function isLockAcquireClick(locked: boolean): boolean {
  return !locked;
}

export type SiteUse = {
  progressPlant: boolean;
  progressDefuse: boolean;
  showBar: boolean;
  offSiteHint: boolean;
};

/** E only arms/cuts inside a site trigger. Off-site E is a hint. */
export function siteUseState(opts: {
  holdingE: boolean;
  onSite: boolean;
  nearBomb: boolean;
  hasBomb: boolean;
  bombArmed: boolean;
  defending: boolean;
}): SiteUse {
  const progressPlant = opts.holdingE && opts.hasBomb && opts.onSite && !opts.bombArmed;
  const progressDefuse = opts.holdingE && opts.bombArmed && opts.defending && opts.nearBomb;
  const offSiteHint =
    opts.holdingE && !progressPlant && !progressDefuse && (opts.hasBomb || (opts.bombArmed && opts.defending));
  return {
    progressPlant,
    progressDefuse,
    showBar: progressPlant || progressDefuse,
    offSiteHint,
  };
}
