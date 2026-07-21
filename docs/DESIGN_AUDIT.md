# MONO//WARD design and mechanics audit

This document records the research behind the prototype, what was borrowed at the pattern level, what was intentionally simplified, and where the combat rules differ from Warcraft III. It is a design audit, not a claim that all referenced games share identical systems.

## 1. Comparative tower-defense audit

| Reference | Useful, proven pattern | Prototype decision |
|---|---|---|
| [Bloons TD 6](https://store.steampowered.com/app/960090/Bloons_TD/) | Free placement, immediate range feedback, selected-tower upgrades, and multiple target priorities | Use free tile placement, a real range ghost, and First/Strong/Last. Keep one linear upgrade path for prototype scope. |
| [Kingdom Rush](https://www.kingdomrushgame.com/) and its [campaign design analysis](https://www.gamedeveloper.com/design/kingdom-rush---the-wonderful-campaign-level-design) | Very legible tower roles and paced wave calls | Keep six roles with one-sentence jobs and a large, forecast-driven wave button. Fixed tower pads were rejected because the requested fantasy is Warcraft-style tile building. |
| [Element TD 2](https://www.eletd.com/) | Explicit damage families, tower tables, target control, and speed controls | Expose armor matchups in the shop/manual and provide 1×/2×/3× controls, without importing its very large tower catalog. |
| [Plants vs. Zombies](https://www.ea.com/en/games/plants-vs-zombies/plants-vs-zombies) | Cost-readable cards, unmistakable grid placement, and clear wave state | Keep prices permanently visible and reveal the tile grid while placing. Invalid cells use an X, dashed geometry, and a reason—not colour. |
| [Green TD](https://wc3maps.com/map/207973) | Recognisable Poison, Frost, Siege, aura, and specialist families across long upgrade trees | Preserve Poison/Slow/Siege identities, but use eight waves and three tiers so the first prototype can be balanced and understood. |
| [HinaTech browser TD source](https://hinata-ya.tech/games/en/games/tower-defense/source/) | A practical Canvas battlefield surrounded by a DOM life/gold/wave HUD, card shop, sell control, and speed switch | Use the same high-level architecture, written independently. The source page discourages republishing its code, so no code was copied. |

### Resulting interaction model

1. The game opens in a paused level-select/build state.
2. The player sees money, integrity, wave count, the entire path, and the first incoming armor class before spending.
3. Selecting a tower reveals a faint grid, a snapped tower ghost, its real attack radius, and an explicit `PLACE`, `PATH`, `OCCUPIED`, or `NEED $N` result.
4. The shop stays visible during combat. Building during a wave is allowed.
5. Selecting a built tower centralises stats, targeting, upgrade, damage dealt, kills, and sell value.
6. A cleared wave pays a fixed bonus; kills pay unit bounties. There is no opaque passive-income timer.

This gives the player a short, readable decision loop: **forecast armor → buy a counter → choose coverage → observe leaks/damage → upgrade, sell, or diversify**.

## 2. Warcraft III combat audit

Warcraft III internally separates concepts that players often call “damage types”:

- **Attack type** chooses the multiplier against the target's armor class: Normal, Piercing, Siege, Magic, Chaos, Hero, or Spell.
- **Armor type** is the target category: Unarmored, Light, Medium, Heavy, Fortified, Hero, and some special cases.
- **Engine damage type** is separate metadata used for physical/magic/universal behavior, immunities, ethereal targets, poison/disease, and related interactions.

The archived [official Blizzard armor and weapon guide](https://classic.battle.net/war3/basics/armorandweapontypes.shtml) documents the Frozen Throne table and numerical armor formulas. Blizzard's [Warcraft III 2.0.3/2.0.4 notes](https://us.forums.blizzard.com/en/warcraft3/t/warcraft-iii-reforged-patch-notes-version-204/36567) changed Piercing damage against Heavy armor from 100% to 90%. Custom maps can override gameplay constants, and Reign of Chaos used a materially different table; therefore this prototype is labelled **Frozen Throne/Reforged-inspired**, not universally “the WC3 table.”

### Implemented class matrix

| Attack ↓ / Armor → | Unarmored | Light | Medium | Heavy | Fortified |
|---|---:|---:|---:|---:|---:|
| Normal | 100% | 100% | 150% | 100% | 70% |
| Pierce | 150% | 200% | 75% | 90% | 35% |
| Siege | 150% | 100% | 50% | 100% | 150% |
| Magic | 100% | 125% | 75% | 200% | 35% |
| Chaos | 100% | 100% | 100% | 100% | 100% |

Hero attack/armor and Spell attack are omitted from the playable matrix because the prototype has one circular ground-monster family and no hero units. They can be added later without changing the combat architecture.

### Numerical armor

Attack-class multiplication and numerical armor are separate stages:

```text
positive armor reduction = (armor × 0.06) / (1 + 0.06 × armor)
positive armor factor    = 1 / (1 + 0.06 × armor)
negative armor factor    = 2 - 0.94 ^ (-armor)
```

Examples: +1 armor takes about 94.34% attack damage, +10 takes 62.5%, +20 takes 45.45%, and −10 takes about 146.14%. All direct tower attacks, including the Magic attack class, use the numerical armor factor. This mirrors the useful design distinction that a caster projectile's **attack class** is not automatically the same thing as spell/ability damage.

### Poison and slow

The [official Blizzard spell guide](https://classic.battle.net/war3/basics/spellbasics.shtml) says poison from the same source does not add DPS while poison from different attackers can stack. Warcraft poison has extra edge rules—such as physical/passive interactions and, in the classic rules, not delivering a killing blow. Unit examples include the [Dryad's Slow Poison](https://classic.battle.net/war3/nightelf/units/dryad.shtml) and the [Wind Rider's Envenomed Spears](https://classic.battle.net/war3/orc/units/windrider.shtml).

MONO//WARD adapts those ideas:

- A Toxin Post refreshes its own 6 DPS, 4.5-second effect.
- Different posts stack, capped at three readable orbit dashes.
- Poison ignores armor class/rating and can kill. Automatic tower retargeting makes a nonlethal two-HP floor feel like a bug in a TD.
- Arcanum slow uses “strongest slow wins, duration refreshes.” It cannot reduce speed below its authored factor.

The in-game manual calls out the adaptation so players are not taught a false exact-WC3 rule.

## 3. Economy and roster reasoning

The starting $420 deliberately buys several viable openings:

- four Sentries;
- three Needle Arrays;
- Mortar + Arcanum with $85 reserve;
- one specialist plus multiple generalists;
- or a Weathered Oak plus one lower-cost unit after early bounties.

Kill bounties provide moment-to-moment reinforcement opportunities; clear bonuses create a predictable rebuild window. A 72% sell return is high enough to let the player answer the deliberately severe 200%/35% counter table without making every purchase reversible for free.

The six towers form three layers:

- **Core counters:** Sentry, Needle, Mortar, Arcanum.
- **Status economy:** Toxin converts coverage time into damage; Arcanum slow increases every nearby tower's coverage time.
- **Expensive insurance:** Weathered Oak is neutral against all armor but less cost-efficient than the right specialist.

## 4. Level and wave learning curve

- **Mossy Crossing:** long path and generous build space; teaches counters.
- **Sunpetal Grove:** folds through the centre; teaches range efficiency and contested premium tiles.
- **Elderwood Heart:** shorter correction window; teaches selling, forecast reading, and mixed composition.

The eight-wave sequence introduces Unarmored → Light → Medium → Heavy → mixed → Fortified → compressed mixed → all-class finale. Enemy art stays a circle as requested; armor is communicated through an internal dot, ring, X, square, or hex plus a letter in the forecast.

## 5. Browser and accessibility audit

GitHub Pages is static hosting, which fits a local single-player simulation. Records and mute preference are browser/device-local; accounts, cloud saves, and shared leaderboards would need a separate service. GitHub's [Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) and Vite's [static deployment guide](https://vite.dev/guide/static-deploy.html) support the included build-and-deploy workflow.

Key browser decisions:

- Canvas renders only the battlefield. All controls are real HTML buttons with focus states and labels.
- Canvas resolution follows `devicePixelRatio`, capped at 2 to control memory.
- A fixed 60 Hz simulation step preserves consistent 1×/2×/3× behavior.
- The Page Visibility API pauses combat when a background tab is throttled.
- `prefers-reduced-motion` suppresses interface motion.
- Text contrast targets WCAG AA; gameplay state also uses text, silhouettes, hatches, and border styles. See [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- Sound is generated locally after the first user gesture and has a persistent mute control, respecting browser [autoplay restrictions](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).
- Assets are bundled; the deployed game does not depend on remote image/font hosts.

## 6. Scope boundaries and next prototype questions

Intentionally deferred:

- multiple monster silhouettes, flying paths, stealth, or magic immunity;
- branching tower upgrades, a tech tree, auras, and active abilities;
- an in-browser level editor;
- touch-specific two-step placement confirmation;
- cloud persistence, leaderboards, analytics, or monetisation;
- production balance beyond the tested opening and deterministic mechanics.

The next useful playtest should answer: Can a new player predict counters from the shop alone? Does 72% selling feel permissive enough? Is the Weathered Oak a safety valve or an always-buy? Do mixed waves produce composition changes rather than frantic selling? Those answers should drive the next balance pass.
