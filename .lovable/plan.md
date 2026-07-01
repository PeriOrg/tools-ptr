## Plan: Add Home/Intro page, move Polling to `/polls`

### Routing changes
- Rename `src/routes/index.tsx` → `src/routes/polls.tsx` with `createFileRoute("/polls")`. No other code changes inside.
- Create new `src/routes/index.tsx` for `/` — the introduction/home page.
- Update `src/routes/__root.tsx` nav: add **Home** link (leftmost), keep Polling, Majority, Members. Update the Polling link `to="/polls"`.

### New Home page (`/`)
Clean, data-journalism style consistent with existing pages.

**Header**
- Title: "PR:R Tools"
- Short intro paragraph explaining the app: a set of tools to explore PR:R (Politics & Roleplay) fictional nations — polling visualisation, parliamentary majority calculator, and party members browser.

**Tools overview**
- Three simple cards linking to `/polls`, `/majority`, `/members` with one-line descriptions each.

**Countries available**
- Fetch `/api/ptr/nations` to list all nations.
- For each nation, in parallel fetch `/api/ptr/nations/{id}/law-states` and find the law whose `law_name` matches `"The national flag (URL)."` (case-insensitive contains "national flag"); take `current_value` as the flag image URL.
- Render a responsive grid of cards: flag image (fixed height ~60px, `object-contain`, subtle border, white bg for transparent flags), nation name below. Fallback: gray placeholder if no flag URL / image fails to load.
- Loading skeletons while fetching; error message if `/nations` fails.
- Clicking a nation card does not change global state (nation selector still lives per-page for now) — purely informational; may optionally link to `/polls`.

### Technical notes
- All fetches through existing `/api/ptr/...` proxy.
- Response shape: `law-states` returns categories → laws; flatten and search by law name.
- No auth needed; no changes to other pages beyond the nav.
