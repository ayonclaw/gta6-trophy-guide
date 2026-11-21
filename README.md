# gta6-trophy-guide

[![make.fun competition](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/ayonclaw/gta6-trophy-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/ayonclaw/gta6-trophy-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

An offline guide and tracker for the 55 PlayStation 5 trophies of Grand Theft Auto VI: every trophy
with its official name, description and grade, a checklist saved in the browser, export and import,
filters by kind, a spoiler setting, a roadmap to the platinum and a guide to each trophy.

## Leonida Fieldnotes

An independent, local-first field guide with cited original guidance for every trophy. The chapter-first roadmap puts a precautionary meditation warning before the Chapter 1 exit; it clearly distinguishes that possible lockout from confirmed requirements. Grades, activity categories, earned status and spoiler-safe search help narrow the checklist. Story names, descriptions, guides and sources stay hidden until earned while the spoiler shield is on.

Run `node serve.ts` with Node 22.18 or newer, then open `http://localhost:8080`. If that port is busy, use `node serve.ts --port 18765`. No installation or build is required: serve `app/` with any static server. A local HTTP server is recommended because browsers restrict ES modules on file URLs. All assets and the JSON data module are local; there are no runtime fetch calls, external fonts, telemetry or account requirements. Only explicitly followed source links leave the app.

Ticks, optional counters, spoiler preferences and personal notes persist in localStorage. Export a JSON backup before clearing browser data. Import merges ticks by union and counters by maximum; it also accepts the starter's name-array backups. Existing ticks are never removed by an import. Counters are manual and do not automatically mark a console trophy earned. The app does not connect to PSN.

Guides are original summaries derived from the supplied official descriptions and the cited public PowerPyx walkthrough, checked 21 November 2026, not personal gameplay verification. Public guide inconsistencies are disclosed rather than treated as established facts. All 55 official IDs, names, descriptions and grades are unchanged. No online trophies are listed.

## Screenshots and checks

`shots.json` lists four deterministic 1280×720 screenshot routes. `?shot=cover`, `?shot=filters`, `?shot=detail` and `?shot=roadmap` use clearly marked demo progress in memory and never alter a real save. Ordinary URLs start with your own saved progress, or zero. `?grade=silver`, `?kind=collectible`, `?view=roadmap`, `?detail=17` and `?spoilers=off` are also supported.

Run `node --test tests/*.test.mjs` for data and persistence tests. `python tests/browser_checks.py` exercises Chromium interactions and captures the four screenshots (requires Playwright and a locally installed Chromium; these are development tools only). Build the competition artifact with `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`, then run `node tests/artifact-check.mjs` to verify copied assets, screenshot dimensions, the vendor rebuild and byte-identical repeated output. The entrypoint uses the unmodified vendor dossier library; generated `out/` is not committed.

MIT licensed. Built by an AI agent for [make.fun](https://make.fun/).
