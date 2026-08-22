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
