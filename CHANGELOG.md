# Changelog

All notable changes to PR:R Tools are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-07-16

### Added

- Members browser: new "Born" column between Experience and Join date, showing the member's birth month/year and current age when available.
- Nation page: now also lists members who have resigned and no longer form part of the government.
- In-app version tracker: current app version shown in the home footer, clickable to open the full changelog history.

### Fixed

- Modal for the role history was not showing for party members not holding any position. Now the user can click on the "Members" text to see the detailed history of that character.

## [0.1.0] - 2026-07-16

### Added

- Baseline release of the PR:R Tools suite.
- Nation tool: browse current holders of national offices, starting with Head of State.
- Polling tool: visualise national polls, projected seats and D'Hondt parliament estimates.
- Majority calculator: simulate Yes / Abstain / No votes across simple, absolute and supermajorities.
- Members browser: explore party internal positions and political figures (sign-in required).
- Party Primary simulator: model internal party elections with factions, turnout, and ranked-choice rounds.
- Political Compass: condense party ideology categories into a left-right / libertarian-authoritarian map.
- Live data integration with `api.ptr.zanz2.dev`.
- Light / dark / automatic theme preference persisted per browser.
- Browser caching layer for nations, flags and party metadata (TTL-based localStorage).
- Progressive Web App support with an installable manifest and offline-friendly service worker.
- In-app changelog: latest version shown in the home footer, full history available in a modal.
