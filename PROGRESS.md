# MediaShell — progress

Branch `tembo/make-it-better` (from `main` @ `49cbe1e`). Finding ids refer to `docs/handoff/AUDIT.md`. When you finish an item, move it to COMPLETED with the commit hash and the checks you ran.

## COMPLETED

- [x] Baseline verified on `49cbe1e` with Node 24.11.1: typecheck, lint, prettier, 216 unit/API tests, 13 e2e tests (desktop + mobile) all pass.
- [x] Screenshots of every page (desktop dark/light, mobile dark, guest and signed-in) reviewed by the lead. Observations are recorded in `HANDOFF.md` → Findings.
- [x] Client-bug audit: 16 findings, 14 reproduced in Chromium. Recorded in `docs/handoff/AUDIT.md`.
- [x] Handoff system: `HANDOFF.md`, `PROGRESS.md`, `docs/handoff/AUDIT.md`.
- [x] Item 4, `bugs-client-undo-remove-data-loss`: Undo is now a real restore. `DELETE /api/library/:id` returns a full snapshot in export format (marks, playthroughs, notes, dates); `POST /api/library/restore` re-imports it through the shared import code, which now also recomputes episode counters, so «next episode» comes back. The client restore is a plain function on the QueryClient, so Undo works even after leaving the page. (wave 1, package `wp-data`, commit: see `git log`; checks: typecheck, lint, prettier, 219 unit/API tests incl. 3 new, 13/13 e2e).
- [x] Item 5, `bugs-client-verify-link-not-signed-in`: VerifyEmailPage now navigates and then applies the session, like the code form, and sends the stored theme instead of `system`. (wave 1, package `wp-data`, commit: see `git log`; checks: typecheck, lint, prettier, 219 unit/API tests incl. 3 new, 13/13 e2e).
- [x] Item 7, `bugs-client-mutation-during-initial-load`: optimistic mutations only cancel the library query when it already has data, and they refetch it after settling when it didn't. (wave 1, package `wp-data`, commit: see `git log`; checks: typecheck, lint, prettier, 219 unit/API tests incl. 3 new, 13/13 e2e).
- [x] Item 13, `bugs-client-cover-probe-404`: the profile API returns `coverVersion`; `CoverPicker` no longer probes the image URL, so there is no 404 on every visit. (wave 1, package `wp-data`, commit: see `git log`; checks: typecheck, lint, prettier, 219 unit/API tests incl. 3 new, 13/13 e2e).
- [x] Item 14, `bugs-client-stats-episodes-vs-hours`: «Серий просмотрено» and its hours caption now come from one source (regular episodes per entry). (wave 1, package `wp-data`, commit: see `git log`; checks: typecheck, lint, prettier, 219 unit/API tests incl. 3 new, 13/13 e2e).
- [x] Item 15, `bugs-client-stale-derived-caches`: updated entries move to the front of the cached list (Continue order matches the server), profile queries are invalidated with stats and activity, and a Steam import refreshes stats and activity. (wave 1, package `wp-data`, commit: see `git log`; checks: typecheck, lint, prettier, 219 unit/API tests incl. 3 new, 13/13 e2e).

## IN PROGRESS

- [ ] Wave 1 bug fixes (workflow `wf_a0829402-001`, two agents in worktrees, uncommitted until merged): `wp-title` covers TODO items 1, 2, 11 and 12; `wp-nav` covers items 3, 6, 8, 9, 10 and 16.
- [ ] Audit workflow `wf_729d74b4-579` (read-only, changes no files): server bugs, UX/visual, features, performance, a11y/i18n/mobile, plus adversarial verification of the bug findings. Results are appended to `docs/handoff/AUDIT.md` as they arrive.

## TODO (ordered by priority)

### P0: user data and correctness

1. [ ] `bugs-client-notes-autosave-wrong-title`: key the title page content by id (`<TitleContent key={id} />`) and bind the NotesEditor draft to the title it was typed for. Flush pending drafts on unmount. Add an e2e test.
2. [ ] `bugs-client-stale-next-episode`: derive watched/next/caught-up in `EpisodesSection` from the loaded list and marks. Refresh the library entry after the episode list loads (or return the refreshed entry from `/titles/:id/episodes`). Use one progress format for cards.

### P1: broken flows

3. [ ] `bugs-client-palette-adds-stale-result`: Ctrl K only shows and selects results that belong to the current query; closing with Ctrl K resets it.
4. [x] ~~done~~ (see COMPLETED)
5. [x] ~~done~~ (see COMPLETED)
6. [ ] `bugs-client-library-search-caret`: local state for the library search input, synced to the URL.

### P2

7. [x] ~~done~~ (see COMPLETED)
8. [ ] `bugs-client-discover-sticky-genre`: reset the genre filter on query or kind change; add an empty state with «Сбросить фильтры».
9. [ ] `bugs-client-year-story-palette-trap`: disable shell hotkeys while the year story is open, or layer it correctly.
10. [ ] `bugs-client-hotkeys-ru-layout`: match `event.code` (`KeyK`, `Slash`) in `useHotkey`; add a unit test.

### P3

11. [ ] `bugs-client-back-arrow-leaves-app`: use the router history index for the back button.
12. [ ] `bugs-client-date-reject-stale`: reset the date on error, show the field error, and add min/max on the date inputs.
13. [x] ~~done~~ (see COMPLETED)
14. [x] ~~done~~ (see COMPLETED)
15. [x] ~~done~~ (see COMPLETED)
16. [ ] `bugs-client-recent-titles-cross-account`: clear or key the recent titles by user.
17. [ ] Make the demo seed consistent (episode marks that match progress; no IMDb rating on games).

### After the bugs: quality and features (to be refined with the remaining audit streams)

18. [ ] Server bug fixes from the server audit stream.
19. [ ] UX and visual polish from the UX audit stream (empty states, loading states, microcopy, consistency, mobile).
20. [ ] Performance: split the 295 KB / 365 KB chunks, image loading, caching headers, query tuning.
21. [ ] Accessibility, i18n parity and mobile fixes from the a11y stream.
22. [ ] New features ranked by value × feasibility from the features stream (for example an upcoming-episodes calendar, custom lists, imports from other services, recommendations).
23. [ ] Final regression pass: full checks, e2e, before/after screenshots, update the README feature list.
