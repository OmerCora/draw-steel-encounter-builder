# Draw Steel - Encounter Builder

A Foundry VTT module for the [Draw Steel](https://mcdmproductions.com) system that provides Directors with an interactive tool to build balanced encounters using the official encounter building rules from *Draw Steel: Monsters*.

## Summary

Encounter Builder gives Directors a dedicated two-panel interface for composing encounters. Browse monsters from any loaded compendium, drag them into your encounter, organize them into squads, and instantly see whether you're within budget, export the encounter into a journal or deploy them directly into the scene and create the combat encounter.

## Overview

<img width="1100" height="822" alt="Screenshot 2026-03-31 135950" src="https://github.com/user-attachments/assets/75b62682-7c96-4703-bf6a-0ea5e110ba70" />


### Encounter Math

- **Automatic budget calculation** using the official formulas: Party ES = Hero ES × effective heroes, with Victories factored in
- **Five difficulty tiers:** Trivial, Easy, Standard, Hard, and Extreme with computed EV budget ranges
- **Live EV progress bar** with color-coded zones (orange for under-budget, green for on-budget, red overflow)
- **Suggested monster level range** based on hero level and victories, with solo-specific caps
- **Level danger warnings** monsters above the recommended range are flagged with a ☠️ icon and red left border

### Monster Browser (Left Panel)
- **Full compendium indexing** of all loaded NPC packs with search bar
- **Filter by:** role (multi-select chips), organization (dropdown), level (all / suggested / specific 1–11), and source pack (multi-select chips)
- **Sort** by EV (default) or name
- **Click to add** or **drag to canvas** to spawn tokens
- **Preview button** hover over a monster's portrait to open its full sheet

### Selected Monsters (Right Panel)
- **Drag from browser** directly into the selected list or into a specific squad group
- **Increment/decrement** monster counts per entry (minions add/remove in groups of 4)
- **Squad groups** create named groups, drag monsters between them, and designate a squad captain
- **Drag to reorder** between groups, or drag out to ungrouped
- **Drag to canvas** to place tokens from the selected list

<img width="967" height="832" alt="Screenshot 2026-03-31 140402" src="https://github.com/user-attachments/assets/dd2b2fd0-e801-4df0-94a7-c80a3aa67e23" />

### Deploy to Scene
- **One-click deployment** places all selected monsters onto the active scene in an organized grid layout
- Monsters are **grouped spatially** matching your squad groupings, with 1-cell gaps between groups
- **Combat encounter** is created automatically with all tokens added as combatants
- **Draw Steel combatant groups** are configured with proper type (squad/base), stamina pools, and captain assignments

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
