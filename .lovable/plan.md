## Goal
Add a second tool to the app — a **Majority Calculator** — on its own page, and add top-level navigation between the two tools. Also rename the app to "PR:R Tools".

## Changes

### 1. Branding
- Update `src/routes/__root.tsx`: change `title`, `og:title`, `twitter:title` from "PTR Tools" to "PR:R Tools" (description stays "Set of tools for PT:R" since that's the game name — happy to change too if you want).

### 2. Shared nav (top of every page)
- Add a small top nav bar inside `RootComponent` (above `<Outlet />`) with two `<Link>`s:
  - "Polling" → `/`
  - "Majority calculator" → `/majority`
- Active link highlighted via `activeProps`.
- Keep the data-journalism style: white bg, thin border-bottom, sans-serif, no color.

### 3. New route `src/routes/majority.tsx`
- Own `head()` with title "Majority Calculator — PR:R Tools".
- Reuses the existing nation selector pattern from `index.tsx` (fetch `/api/nations` via the `/api/ptr/*` proxy, dropdown).
- On nation selected, fetch `/api/nations/{id}/elections/dashboard` (already used in index for defaults) and read:
  - `total_seats`
  - `party_results[]` → `{ party_id, party_name, color, seats }`
- Display the **current parliament composition** as a compact list/table: color swatch (with the white-color border fix already in place), party abbreviation/name, current seats, % of chamber.
- **Coalition builder UI**: each party row has a checkbox to "include in coalition". As parties are toggled:
  - Running total of seats in the coalition.
  - Visual progress bar (stacked, colored by party) showing the coalition vs the chamber.
  - Three threshold indicators:
    - **Simple majority** — more seats than any other single bloc (coalition seats > largest non-coalition party's seats). Shown with the exact gap.
    - **Absolute majority** — `> total_seats / 2` (i.e. ≥ `floor(total/2) + 1`).
    - **Supermajority (⅔)** — `≥ ceil(total_seats * 2 / 3)`.
  - Each threshold shows: required seats, current seats, deficit/surplus, and a ✓ / ✗ pill.
- A small "Clear" button to reset selection; a "Select largest party" shortcut as a starting point (optional polish).
- Loading/error states matching the existing app patterns.
- No persistence needed (in-memory state only).

### 4. Technical notes
- Abbreviation isn't on `party_results`; either show full `party_name` truncated, or fetch `/api/parties?nation_id={id}&active_only=true` in parallel to get abbreviations. I'll do the parallel fetch so the UI matches the polling page's look (abbreviation + swatch).
- Reuse `safeColor` / `isNearWhite` / `borderForColor` styling helpers — I'll lift them to `src/lib/colors.ts` so both pages share them (small refactor of `index.tsx` to import from there).
- "Simple majority" definition: I'm interpreting it as **plurality** (largest bloc) since that's the standard parliamentary meaning. If you instead meant "majority of those voting" or something else, tell me.

## Open questions (answer inline or I'll go with the defaults above)
1. Plurality definition for "simple majority" OK?
2. Keep description text "Set of tools for PT:R" or also rename to PR:R?