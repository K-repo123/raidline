# Raidline

Original tactical FPS. Play in the browser — no localhost.

**Live:** https://k-repo123.github.io/raidline/

Ashpier is a coastal freight yard. **Raid** arms a charge at **A Vault** or **B Quay**. **Line** cuts it or holds the clock. First side to 8 rounds takes the match.

This is original IP. The name is Raidline. There are no Valve maps, gun names, or branding.

## CS-feel

- **Movement:** ground accelerate / friction, counter-strafe stops, walk, crouch, jump. Rifles punish running.
- **Gunplay:** first-shot tightness, spray climb + sway, armor, headshots, pellet hatch, bolt Longline zoom.
- **Buy:** freeze + spawn window. Economy with win/loss streak. Vest, helm, breach kit, flare / veil / burst.
- **Rounds:** freeze, live, plant clock, defuse, elimination, time. Side swap after 8.
- **HUD:** health, armor, ammo, money, clock, radar, kill feed, progress bar, scoreboard.
- **Map:** high-contrast concrete, rust Raid side, teal Line side, lit site pads.
- **Audio:** procedural gun, steps, plant, defuse, round stingers.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Shift / Ctrl / Space | Walk / crouch / jump |
| Mouse1 / Mouse2 | Fire / Longline zoom |
| R / E / B / Tab | Reload / arm-cut / buy / score |
| F / C / V | Flare / veil / burst |
| 1–2 | Primary / sidearm |

Kit: Dart, Anvil, Stitch, Ridge-15, Quarrel-4, Longline, Hatch.

## Pages

Vite `base` is `/raidline/` for `https://k-repo123.github.io/raidline/`. GitHub Actions builds and deploys on push.

```bash
npm install
npm test
npm run build
```
