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
- [x] Item 17, demo seed: titles are stored as import stubs (no fake IMDb rating on games, real details, backdrops and descriptions load on first view); series and anime get real episode marks that match their counters (Game of Thrones 48/73 → next S5 · E9), so the demo no longer shows «all watched» or «0 episodes ≈ 160 h».
- [x] **New feature: «Новые серии» and «Скоро выйдет» on Home.** `GET /api/library/airing?today=YYYY-MM-DD` (`server/library/airing.ts`) returns fresh episodes of shows you had caught up on (unwatched aired episodes that all came out in the last 21 days; an older backlog stays in Continue) and a 30-day calendar of upcoming episodes for followed shows (planned included, dropped excluded). Stale lists refresh in the background and the client asks again once or twice. UI: `src/pages/home/AiringSections.tsx`: cards with a one-tap «Посмотрел», and a day-grouped list with relative dates and a «Премьера сезона» badge. Strings in `src/i18n/sections/airing.ts`. Tests: `server/library/airing.test.ts` (4), `src/lib/airing-days.test.ts` (3).
- [x] **New feature: import from MyAnimeList, Shikimori and IMDb** (Settings → Data → «Импорт из других сервисов»). Pure converters in `src/lib/external-import.ts` turn MAL/Shikimori anime XML (gzipped too) and IMDb ratings/watchlist CSV into the regular export format, matched by exact ids with no name guessing. Entries already in the library are never overwritten. The existing transactional `/api/me/import` stores stubs with posters right away, and `server/library/enrich.ts` replaces them with full catalog records in the background (verified live: 5 titles with Russian names in about 5 s). Tests: converters (5), server import plus enrichment (1).
- [x] Item 3, `bugs-client-palette-adds-stale-result`: the palette only shows and selects catalog rows that belong to the current input. It reopens empty however it was closed, and has no vim bindings, so Ctrl K can't move the selection. (wave 1, package `wp-nav`; checks: typecheck, lint, prettier, 249 unit tests, 19/19 e2e incl. new `tests/e2e/navigation.spec.ts`).
- [x] Item 6, `bugs-client-library-search-caret`: new `useSearchParamText` hook (local text, debounced URL sync with replace, follows Back/Forward) used by Library and Discover search. (wave 1, package `wp-nav`; checks: typecheck, lint, prettier, 249 unit tests, 19/19 e2e incl. new `tests/e2e/navigation.spec.ts`).
- [x] Item 8, `bugs-client-discover-sticky-genre`: genre resets with the query or kind; unknown genres are dropped; an empty state «Ничего не подходит под фильтры» comes with «Сбросить фильтры». (wave 1, package `wp-nav`; checks: typecheck, lint, prettier, 249 unit tests, 19/19 e2e incl. new `tests/e2e/navigation.spec.ts`).
- [x] Item 9, `bugs-client-year-story-palette-trap`: the year story suspends shell hotkeys (`useSuspendShellHotkeys`) and ignores keys that belong to other layers. (wave 1, package `wp-nav`; checks: typecheck, lint, prettier, 249 unit tests, 19/19 e2e incl. new `tests/e2e/navigation.spec.ts`).
- [x] Item 10, `bugs-client-hotkeys-ru-layout`: `matchesHotkey` uses the physical key as a fallback (ЙЦУКЕН works; Dvorak and Colemak letters win), ignores IME composition and Alt chords, with unit tests. (wave 1, package `wp-nav`; checks: typecheck, lint, prettier, 249 unit tests, 19/19 e2e incl. new `tests/e2e/navigation.spec.ts`).
- [x] Item 16, `bugs-client-recent-titles-cross-account`: recent titles are stored per account (`mediashelf:recent-titles:<user|guest>`); the guest list is cleared on sign-in or out, and the legacy shared key is removed. (wave 1, package `wp-nav`; checks: typecheck, lint, prettier, 249 unit tests, 19/19 e2e incl. new `tests/e2e/navigation.spec.ts`).
- [x] **Wave 2** (was `docs/handoff/pending/wave2-palette-mobile-shuffle.patch`, applied 2026-11-06 19:45 UTC): closing the command palette returns focus to whatever opened it (`mobile-a11y-i18n-palette-focus-loss`); toasts, the back-to-top button and the page bottom padding sit above the mobile tab bar via `--tabbar-h` (home indicator included, 0 from `md` up; toasts also on 601–767 px, where Sonner already uses its desktop offset) (`mobile-a11y-i18n-toast-over-tabbar`); `SectionHeader` wraps instead of widening the page (`mobile-a11y-i18n-sectionheader-nowrap`); Shuffle defaults to your plans when there are any and Home links to `/shuffle?source=library` (`ux-visual-shuffle-default-ignores-plans`). Checks: typecheck, lint, prettier, 249 unit tests, 22/22 e2e incl. 3 new (palette focus return, Shuffle from plans, toasts above the tab bar at 412 and 700 px; the toast test fails without the fix).
- [x] Item 1, `bugs-client-notes-autosave-wrong-title` (P0, was `docs/handoff/pending/wp-title-unfinished.patch`, finished 2026-11-06 ~20:55 UTC): the title page content is keyed by id (`<TitleContent key={id}>`; the header stays outside, so focus on the back arrow survives title-to-title Back), NotesEditor is keyed by title and saves by `titleId`, a dirty draft is flushed on unmount and sent with a `keepalive` request on `pagehide` (tab closed or reloaded, Back to another site), and `actions.patch` uses `mutateAsync` so a save started on the way out still reports errors. A library refetch that was read before a write can no longer put the old entry back: `invalidateDerived` restarts an in-flight `GET /library` after every write.
- [x] Item 2, `bugs-client-stale-next-episode` (P0): EpisodesSection derives watched / total / percent / next from the loaded list and marks (`src/pages/title/episode-progress.ts`, same rules as the server's `recomputeEpisodes`); the saved entry is re-read after an episode list arrives (`refreshEntry`), a series added without "next episode" prefetches its list, adding a series as watched refetches its marks, and the airing feed and the library refresh each other after a server-side recount (`src/lib/airing.ts`, `refreshEntry`). Card progress keeps two formats on purpose: «S2 · E5» for a series in progress with a known next episode, «48/73» otherwise.
- [x] Item 11, `bugs-client-back-arrow-leaves-app` (P3): the header back arrow uses the router's `history.state.idx`; on the first app page it replaces with the parent page, which now opens at the top (scroll memory only keeps the position for same-page replaces), and the skip link moves focus without adding a `#main` history entry.
- [x] Item 12, `bugs-client-date-reject-stale` (P3): `parseDateDraft` (`src/pages/title/dates.ts`) refuses impossible days, days after today, a finish before the start and a start after the finish, with the reason in a toast; the inputs carry matching `min`/`max`; a refused date rolls back. The server names the edited field (`startedAt: after_finish` / `finishedAt: before_start`), checks the order only when dates or the status change (old out-of-order data no longer blocks notes or ratings), and completing an entry whose start is in the future moves the start back to the finish.
- [x] Review of the patch before committing (3 reviewers + a verifier per finding, workflow `review-step3-title-fixes`): 9 findings, all fixed with tests (add-as-watched marks, airing ↔ library recount, refetch-after-write race, unload flush, scroll after replace, skip-link history entry, back-arrow focus, future dates, field-specific server error). Checks: typecheck, lint, prettier, 264 unit/API tests (new: `episode-progress.test.ts`, `dates.test.ts`, server date tests in `server/review-fixes.test.ts`), 32/32 e2e incl. `tests/e2e/title.spec.ts` (10 tests; the new ones were confirmed to fail without their fix).
- [x] Review of the rest of the branch before merging to `main` (2026-11-06; two independent reviewers: imports + undo + data fixes, airing feed + nav). 9 findings fixed, each with a test that fails without it: IMDb watchlist in the current export format (with an empty «Your Rating» column) imported as watched, now decided per row; MAL/Shikimori file aborted by an out-of-range `&#x…;`, impossible dates (2024-02-30) rolled over; Undo snapshot over 1 MB refused (restore now uses the 25 MB limit); Undo overwrote a title added again meanwhile (now 409 `ENTRY_EXISTS`, the toast says so); Undo lost the `auto` flag of marks set by «completed»; the airing feed retried shows without any episode list on every request and starved the others (`pickRefreshes`, 30 min per title); feed polling worked once per session; «Посмотрел» on a fresh-episode card could mark an earlier undated episode (now marks the card's episode); another user could see that an unused cover picture exists and fetch it. Checks: typecheck, lint, prettier, 272 unit/API tests, 32/32 e2e.
- [x] `wp-title2` (step 4, title page on phones), applied on `main` after #23 and finished (2026-11-07): one action bar in the hero (status, favourite, rating, trailer, more) that fits 320 px in two rows, the rail card keeps progress, dates, notes and removal; rating scale as a 5×2 grid of 44 px targets on phones, re-picking keeps the score, arrows select (Right/Down next, Left/Up previous); whole episode row toggles the mark, menu named «Ещё: S1 · E3»; short «Добавить» for playthroughs; panel and episode list share `use-episode-progress.ts`. Independent review: 2 findings fixed (an arrow-key score was lost when Back unmounted the open popover; Up/Down were reversed). Checks: typecheck, lint, prettier, 277 unit/API tests, 38/38 e2e; no horizontal overflow at 320 px on series, game, anime and movie pages.
- [x] `wp-lists` (step 4), applied on `main` after #24 and finished (2026-11-07): library cards keep the status whole (progress only while under way, store as an icon, also in the list view); Discover top-10 with the poster over the numeral and names on two lines; the quick-add «+» is not tappable while invisible and always visible on touch; profile activity without a second time and with two-line names; «Фон избранного» picks the first favourite with a backdrop on client and server (`shared/banner.ts`); one «Скоро: …» line in game settings; empty Shuffle with an EmptyState and «Бросить по популярному». Review: 2 unfinished items done (activity names still truncated, list view still wrote «Steam»), each with an e2e check that fails without it. Checks: typecheck, lint, prettier, 282 unit/API tests, 47/47 e2e.
- [x] `wp-shell` (step 4), applied on `main` after #25 and finished (2026-11-07): accounts created on the sign-up form go through onboarding (a per-tab «just registered» mark, so an existing account opening /register on a new device does not), «Пропустить» on the first step; the year story is a real modal (focus inside, inert shell, returns to the trigger); the toast region is named in the interface language; inputs, selects and the slider get the buttons' focus outline; light `--fg-3` at #666 (≥4.5:1, `contrast.test.ts`); 40–44 px touch targets on coarse pointers (xs, sm and icon-xs buttons, segments, «Где взять файл»). Review: touch sizes were left at 32–36 px and the onboarding redirect keyed on the URL alone; fixed, with tests. A flaky focus-outline e2e (the outline lands a frame after focus) now polls. Checks: typecheck, lint, prettier, 308 unit/API tests, 56/56 e2e.

## IN PROGRESS

See «ГДЕ ОСТАНОВИЛИСЬ» in `HANDOFF.md`.

- [ ] Step 4 (UX, mobile, a11y, i18n from `docs/handoff/audit-*-partial.md`): stopped mid-work at the owner's request (2026-11-06 20:40 UTC) and saved as unfinished, unverified patches on top of `b2a4e3f` (`wp-title2`, `wp-lists` and `wp-shell` are done, see above): `docs/handoff/pending/wp-i18n.patch` (formal gender-neutral Russian, language picker in the palette, parity test; the uk/de/es/fr/ro translations were not started). Each applies cleanly with `git apply --3way`, and all four in a row as well. Apply, run every check and e2e, finish, review, commit.
- [ ] Audit: UX and mobile/a11y/i18n are partial (`docs/handoff/audit-*-partial.md`); server bugs, performance and features were never run.

## TODO (ordered by priority)

### P0: user data and correctness

1. [x] ~~done~~ (see COMPLETED)
2. [x] ~~done~~ (see COMPLETED)

### P1: broken flows

3. [x] ~~done~~ (see COMPLETED)
4. [x] ~~done~~ (see COMPLETED)
5. [x] ~~done~~ (see COMPLETED)
6. [x] ~~done~~ (see COMPLETED)

### P2

7. [x] ~~done~~ (see COMPLETED)
8. [x] ~~done~~ (see COMPLETED)
9. [x] ~~done~~ (see COMPLETED)
10. [x] ~~done~~ (see COMPLETED)

### P3

11. [x] ~~done~~ (see COMPLETED)
12. [x] ~~done~~ (see COMPLETED)
13. [x] ~~done~~ (see COMPLETED)
14. [x] ~~done~~ (see COMPLETED)
15. [x] ~~done~~ (see COMPLETED)
16. [x] ~~done~~ (see COMPLETED)
17. [x] ~~done~~ (see COMPLETED)

### After the bugs: quality and features (to be refined with the remaining audit streams)

18. [ ] Server bug fixes from the server audit stream.
19. [ ] UX and visual polish from the UX audit stream (empty states, loading states, microcopy, consistency, mobile).
20. [ ] Performance: split the 295 KB / 365 KB chunks, image loading, caching headers, query tuning.
21. [ ] Accessibility, i18n parity and mobile fixes from the a11y stream.
22. [ ] New features ranked by value × feasibility from the features stream (for example an upcoming-episodes calendar, custom lists, imports from other services, recommendations).
23. [ ] Final regression pass: full checks, e2e, before/after screenshots, update the README feature list.
