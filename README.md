# Draw Steel - Encounter Builder

A Foundry VTT module for the [Draw Steel](https://mcdmproductions.com) system that provides Directors with an interactive tool to build balanced encounters using the official encounter building rules from *Draw Steel: Monsters*.

## Summary

Encounter Builder gives Directors a dedicated two-panel interface for composing encounters. Browse monsters from any loaded compendium, drag them into your encounter, organize them into squads, and instantly see whether you're within budget — all without opening a spreadsheet.

## Features

### Encounter Math
- **Automatic budget calculation** using the official formulas: Party ES = Hero ES × effective heroes, with Victories factored in (every 2 Victories = +1 effective hero)
- **Five difficulty tiers:** Trivial, Easy, Standard, Hard, and Extreme with computed EV budget ranges
- **Live EV progress bar** with color-coded zones (orange for under-budget, green for on-budget, red overflow)
- **Suggested monster level range** based on hero level and victories, with solo-specific caps
- **Level danger warnings** — monsters above the recommended range are flagged with a ☠️ icon and red left border

### Monster Browser (Left Panel)
- **Full compendium indexing** of all loaded NPC packs with lazy-loading
- **Search** by name with debounced input
- **Filter by:** role (multi-select chips), organization (dropdown), level (all / suggested / specific 1–11), and source pack (multi-select chips)
- **Sort** by EV (default) or name
- **Infinite scroll pagination** — loads 50 at a time with DOM append (no re-render) for smooth performance
- **Click to add** or **drag to canvas** to spawn tokens (auto-imports into an "Encounter Builder" folder, reuses already-imported actors)
- **Preview button** — hover over a monster's portrait to open its full sheet

### Selected Monsters (Right Panel)
- **Drag from browser** directly into the selected list or into a specific squad group
- **Increment/decrement** monster counts per entry (minions add/remove in groups of 4)
- **Squad groups** — create named groups, drag monsters between them, and designate a squad captain (non-minion, non-mount)
- **Preview on hover** — same sheet-preview overlay as the browser
- **Drag to reorder** between groups, or drag out to ungrouped
- **Drag to canvas** to place tokens from the selected list

### Journal Export
- **Save to Journal** creates a JournalEntry with a full encounter summary:
  - Target vs. actual difficulty, total EV, budget range, party ES
  - Creature list with `@UUID` links (clickable in Foundry)
  - Squad groupings with captain designation
  - Adjustment suggestions for ±1 hero (how much EV to add or remove)
- Journals are auto-organized into an "Encounter Builder" folder

### Smart Token Placement
- Dragging a compendium monster to the canvas checks for an existing world actor (by `sourceId` flag) before importing
- New imports go into an auto-created "Encounter Builder" Actor folder to keep the sidebar clean
- Works from both the browser panel and the selected monsters panel

### Quality of Life
- **Persistent hero count** — number of heroes is saved per-client and restored on next open
- **Default suggested level filter** — opens pre-filtered to monsters in the recommended range
- **Stepper controls** for heroes (+1) and victories (+2 step, since only even values matter)
- **Light and dark mode support** — all colors use theme-neutral patterns
- **GM-only** — the sidebar button only appears for Directors

## Installation

Install via Foundry VTT's module browser by searching for **"Draw Steel - Encounter Builder"**, or paste the manifest URL into the Install Module dialog:

```
https://github.com/OmerCora/draw-steel-encounter-builder/releases/latest/download/module.json
```

## Compatibility

| | Version |
|---|---|
| **Foundry VTT** | v13+ (verified 13.351) |
| **Draw Steel System** | v0.9.0+ (verified 0.11.1) |

## License

Module code is licensed under [MIT](LICENSE).

This module uses content from *Draw Steel: Heroes* (ISBN: 978-1-7375124-7-9) under the [DRAW STEEL Creator License](https://mcdm.gg/DS-license).

## Support

If you find this module useful, consider supporting development:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/G2G263V03)

---

*Draw Steel - Encounter Builder is an independent product published under the DRAW STEEL Creator License and is not affiliated with MCDM Productions, LLC. DRAW STEEL © 2024 MCDM Productions, LLC.*
