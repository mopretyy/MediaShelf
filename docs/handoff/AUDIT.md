# MediaShell audit findings

Generated from the multi-agent audit (workflow `mediashell-audit`, run `wf_729d74b4-579`, started 2026-11-06 18:04 UTC) against `main` @ `49cbe1e`.
Every finding below was checked against the code by the auditor; "verified" means it was also reproduced in Chromium. Line numbers refer to commit `49cbe1e`.

## Status of each audit stream

| Stream                   | Status                                   |
| ------------------------ | ---------------------------------------- |
| `audit:bugs-client`      | done (below)                             |
| `verify:bugs-client`     | not started yet                          |
| `audit:bugs-server`      | was running when this file was generated |
| `verify:bugs-server`     | not started yet                          |
| `audit:ux-visual`        | was running when this file was generated |
| `audit:features`         | not started yet                          |
| `audit:perf`             | not started yet                          |
| `audit:a11y-i18n-mobile` | not started yet                          |

## audit:bugs-client

The client is generally well built: board drag and drop persists correctly, ru and en i18n keys match with no raw-key fallbacks, and the dates and stats charts handle time zones correctly. The serious problems come from cache freshness and component lifetime, not from rendering. The cached library entry is never refreshed after the server recomputes episode counters, so the series page says 'you've watched all aired episodes' for a series added a moment earlier. This is the root cause of (a), and (b) is the same mechanism made visible by a seed artifact. TitlePage is not keyed by id, so per-title state leaks between titles; most damaging, a note you are still typing can be saved into a different title. Several flows lose or corrupt user data or pick the wrong item: the command palette adds a stale search result on Enter; Undo after removing an entry drops episode marks, playthroughs and dates (and every field if you navigated away); the email-verification link lands on the login form. The library search box loses keystrokes and moves the caret to the end. The lead's (c) is a seed artifact on top of a server-side two-sources inconsistency. (d) is the cover picker deliberately probing an image URL that returns 404 when no cover was uploaded. All findings except the Ctrl+K layout one, which used synthetic key events, were reproduced in Chromium against my own fixtures server; the scripts and screenshots are in /workspace/tools/scratch/bugs-client/.

### Series page says 'Вы посмотрели все вышедшие серии' for unwatched series: cached entry misses server-side episode recompute (root cause of lead's a/b)

- **id:** `bugs-client-stale-next-episode` · **category:** bug · **impact:** 5/5 · **effort:** M · **confidence:** verified
- **files:** `src/pages/title/EpisodesSection.tsx:192`, `src/pages/title/EpisodesSection.tsx:200-238`, `src/lib/queries.ts:282-313`, `src/lib/queries.ts:599-611`, `src/pages/HomePage.tsx:77-99`, `src/lib/titles.ts:65-71`, `server/routes/library.ts:91-93`, `server/library/resolve.ts:107-110`

**Evidence.** EpisodesSection takes `next = entry?.nextEpisode` from the cached library entry (line 192). When it is null it shows 'allWatched' (line 236), or 'waiting' only if `list.ended === false`, and hides 'Отметить просмотренной'. The header 'Просмотрено X из Y' also comes from cached counters, while the checkboxes come from marks.

The server changes those counters behind the client's back in two places:

- POST /library answers first and warms the episode list afterwards (`void ensureEpisodeList`, routes/library.ts:93), so the response carries nextEpisode=null.
- Every first fetch or TTL refresh of GET /titles/:id/episodes runs `refreshEpisodeCountersForAll` (resolve.ts:109).
  Nothing on the client invalidates `keys.library` after either one; staleTime is 60 s and refetchOnWindowFocus is off.

Repro (/workspace/tools/scratch/bugs-client/repro-a.mjs, screenshot repro-a.png): add 'Шерлок' from the Add palette, then click it in the sidebar. The page shows 'Просмотрено 0 из 12' plus 'Вы посмотрели все вышедшие серии' and no mark-next button, while GET /api/library/series-tt1475582 already returns next S1E1. The Home ContinueCard has no '+1 серия' for the same reason (HomePage.tsx:79-82).

Lead's (a)/(b): the seed inserted series-tt0944947 with watched_episodes=48, progress 65 and no episode_marks (seed artifact). Opening the page fetched the list, and the server recomputed the entry to 0/73, next S1E1, progress 0 (confirmed via read-only GET on the demo). The open page kept the stale entry ('all watched' + 48/73). The sidebar flipped from '48/73' to 'S1 · E1' on a later refetch because entryProgressText switches format once nextEpisode is known.

**Proposal.** 1) In EpisodesSection, derive progress from data already on the page whenever list and marks are loaded:

- `regular` = season>0 episodes sorted by season then number.
- `localNext = regular.find(e => !watched(e))`.
- `caughtUp = regular.filter(aired).every(watched)`.
- Show 'allWatched' only when `caughtUp`, use `localNext` for the 'Следующая' block and the mark button, and compute 'Просмотрено X из Y' from `regular`.
- Fall back to `entry.nextEpisode` only while marks or list are loading.

2. Refresh the entry after the server may have recomputed it. When `useEpisodeList` resolves for a title that is in the library, GET /api/library/:id and `setEntry` (cheap), or have /titles/:id/episodes return the signed-in user's refreshed entry.
3. For series/anime, either make POST /library await `ensureEpisodeList` with a short timeout (2–3 s) before answering, or, in useAddEntry.onSuccess when `entry.nextEpisode === null`, schedule one GET /library/:id after the warm-up.
4. Use one progress format for cards: always 'S2 · E5' when known, otherwise watched/total.

### Notes autosave can overwrite another title's notes; all title-page state leaks between titles (page not keyed by id)

- **id:** `bugs-client-notes-autosave-wrong-title` · **category:** bug · **impact:** 5/5 · **effort:** S · **confidence:** verified
- **files:** `src/app/App.tsx:149`, `src/pages/TitlePage.tsx:240-351`, `src/pages/title/EntryPanel.tsx:78-141`, `src/pages/title/EpisodesSection.tsx:97-99`, `src/pages/title/EpisodesSection.tsx:116-123`

**Evidence.** The route `title/:id` renders the same TitlePage instance for every id. EntryPanel → NotesEditor, EpisodesSection, Description, DateField, HoursField and the rest are therefore reused, not remounted, when you move from title A to title B.

NotesEditor:

- does not resync while its state is 'dirty' or 'saving' (line 92);
- its 900 ms timer (line 113) saves `latest.current`, which by then points at the NEW entry (line 84 → 101).

Repro 1 (/workspace/tools/scratch/bugs-client/repro-notes.mjs):

- Interstellar's notes are 'B original note'. Open Inception, type 'Note for Inception', press browser Back (no blur; same as mobile swipe-back or a mouse back button) within 900 ms.
- Interstellar's textarea shows 'Note for Inception'.
- Server afterwards: Inception notes = '', Interstellar notes = 'Note for Inception'. The original note is overwritten and the new note is lost.

Repro 2 (repro-notes2.mjs, PATCH delayed 300 ms like a remote host): type on A, then click B in the sidebar. A is saved correctly, but B's textarea keeps showing A's text and hides B's real note. Any edit there then saves A's text into B.

Same root cause (repro-season.mjs): choosing 'Сезон 2' on Шерлок and clicking 'Во все тяжкие' keeps Season 2 selected, although that title's next episode is S1E1. `limit`, `noteFor`, Description `expanded` and Gallery `failed` leak the same way.

**Proposal.** Remount everything per title: split the body into `<TitleContent key={id} id={id} />` (or put `key={id}` on PageBody/content in TitlePage), so all per-title state and timers reset. In addition, make NotesEditor bind a draft to the title it was typed for:

- store `draftFor = entry.titleId` when typing starts;
- save with that titleId rather than `latest.current`;
- flush a pending draft in the effect cleanup on unmount or title change (patch the captured titleId);
- never apply a draft to an entry whose titleId differs.

### Command palette: Enter picks stale search results, so the Add palette adds the wrong title

- **id:** `bugs-client-palette-adds-stale-result` · **category:** bug · **impact:** 4/5 · **effort:** S · **confidence:** verified
- **files:** `src/app/CommandPalette.tsx:44-45`, `src/app/CommandPalette.tsx:76-89`, `src/lib/queries.ts:568-583`, `src/app/AppShell.tsx:140-147`

**Evidence.** The palette searches with `useSearch(debounced)` (220 ms debounce) and `placeholderData: keepPreviousData`. `catalogItems` is gated on the CURRENT `query.length >= 2` but filled with `search.data`, which belongs to the previous query. cmdk auto-selects the first row, so Enter during the debounce and fetch window acts on the old results.

Repro (/workspace/tools/scratch/bugs-client/repro-palette-stale.mjs):

- Search 'witcher' in the Add palette, then press Escape.
- Reopen Add, type 'Interstellar' and press Enter. While typing, the only row shown was 'Ведьмак 3: Дикая Охота [selected]'.
- GET /api/library then contains 'steam-292030 The Witcher 3: Wild Hunt'.
  In search mode the same thing navigates to the wrong title.

Related: closing with Ctrl+K toggles `open` directly (AppShell.tsx:144) and skips `close()`, so the old query is still in the input next time (repro-palette-toggle.mjs: 'witcher' persists; closing with Escape clears it).

**Proposal.** Show catalog rows only when they belong to the current input:

- `const fresh = !search.isPlaceholderData && normalise(debounced) === query`;
- while not fresh, render the 'Ищем…' row and no selectable catalog items (or render them with `disabled` and `data-stale`), so Enter cannot pick them;
- in add mode, also skip `pick` unless `fresh`.
  Route the Ctrl+K close through `close()` so the query and search state reset, e.g. `setPalette(s => s.open ? (close(), s) : {...})`, or reset `value` whenever `open` becomes false.

### 'Вернуть' after removing an entry silently drops episode marks, notes, playthroughs and dates; after navigating away it restores only the status

- **id:** `bugs-client-undo-remove-data-loss` · **category:** bug · **impact:** 4/5 · **effort:** M · **confidence:** verified
- **files:** `src/components/library-actions.tsx:165-204`, `server/db/migrations.ts:78`, `server/db/migrations.ts:91`, `server/library/entries.ts:609-619`, `node_modules/@tanstack/query-core/build/modern/mutationObserver.js:147`

**Evidence.** `remove()` says 'Snapshot everything the delete wipes so Undo can restore the entry as it was'. The snapshot has only status, rating, favorite, progress, platform, store, hours and notes. episode_marks (with per-episode notes and ratings) and playthroughs are ON DELETE CASCADE. startedAt, finishedAt and addedAt are not restored. A series' `progress` patch is ignored when total_episodes is known.

Repro 1 (/workspace/tools/scratch/bugs-client/repro-undo.mjs), series:

- Before: 4 marks including S1E2 note 'great twist' rated 9, startedAt 2025-01-05.
- After remove → Вернуть: 0 marks, progress 0, startedAt and addedAt = now.

The second step of Undo is a per-call callback, `add.mutate(..., { onSuccess: () => update.mutate(snapshot.patch) })`. TanStack only runs per-call callbacks while the observer has listeners (mutationObserver.js:147).

Repro 2 (repro-undo2.mjs), game: remove on the title page, open Library, then click 'Вернуть' in the toast, which persists across routes.

- Before: rating 9, favorite, notes 'Скеллиге', 120 h, 70 %, GOG.
- After: rating null, favorite false, notes '', hours null, progress 0, store null.

**Proposal.** Make Undo a real restore.

- Preferred: defer the DELETE. Hide the entry optimistically, send DELETE when the toast closes or times out, and cancel it on Undo. Alternatively, soft-delete on the server: DELETE returns a tombstone (entry, marks, playthroughs, dates) and POST /library/:id/restore puts it back.
- Client-only fallback: run the restore chain with `mutateAsync` in a function that does not depend on the component, include startedAt, finishedAt and addedAt, and re-POST the cached marks (`keys.marks(id)`) and playthroughs.

### One-click email verification link ends on the login form although the account is created and the cookie set

- **id:** `bugs-client-verify-link-not-signed-in` · **category:** bug · **impact:** 4/5 · **effort:** S · **confidence:** verified
- **files:** `src/pages/VerifyEmailPage.tsx:29-33`, `src/lib/queries.ts:136-152`, `src/app/App.tsx:72-84`

**Evidence.** `useRegisterVerify` documents that the caller must apply the session via the returned `signIn(user)`. AuthPage.submitCode does that; VerifyEmailPage only calls `navigate('/welcome')`. RequireAuth still sees the cached `user: null` (session staleTime 5 min) and redirects to /login?next=%2Fwelcome.

Repro (/workspace/tools/scratch/bugs-client/repro-verify.mjs, screenshot repro-verify.png):

- POST register/start, then open /verify-email?email=…&code=<devCode>.
- Final URL is /login?next=%2Fwelcome with the heading 'Вход в MediaShell'.
- fetch('/api/auth/session') returns the new user, so the server did sign them in.
  This is the default path for every installation with SMTP configured.

The page also hard-codes `theme: 'system'`, which overrides the theme picked during registration.

**Proposal.** Mirror AuthPage: `onSuccess: ({ user }) => setTimeout(() => { navigate('/welcome', { replace: true }); verify.signIn(user) }, 600)`, or call `client.invalidateQueries({ queryKey: keys.session })` before navigating. Don't send a theme from this page (or send the stored preference). Add an e2e test that opens the link in a fresh context.

### Library search box loses keystrokes and jumps the caret to the end (input bound directly to the URL)

- **id:** `bugs-client-library-search-caret` · **category:** bug · **impact:** 4/5 · **effort:** S · **confidence:** verified
- **files:** `src/pages/LibraryPage.tsx:53-62`, `src/pages/LibraryPage.tsx:195-202`

**Evidence.** The input's `value` is `params.get('q')` and every keystroke calls `setParams(next, { replace: true })`. The RouterProvider from 'react-router' applies navigations inside `React.startTransition`, so the controlled value is updated asynchronously and React writes stale values back into the DOM.

Repro (/workspace/tools/scratch/bugs-client/repro-libsearch.mjs and repro-libsearch2.mjs):

- Typing 'Interstellar Breaking' at 0 ms per key gives 'Intkng'; at 5 ms per key, 'Intetla Beaing'.
- With 6× CPU throttling (a phone) at 40 ms per key, 'Interstellar' becomes 'nstlr'.
- Inserting 'XYZ' after the first letter of 'Inception', even at 60 or 150 ms per key, gives 'IXnceptionYZ': the caret jumps to the end after every keystroke, so editing inside the query is impossible.

DiscoverPage avoids this with local state plus URL sync.

**Proposal.** Keep the text in local state (`const [text, setText] = useState(q)`), filter on it (or a 150 ms debounced copy), and write it to the URL in an effect with `replace: true`. Follow external URL changes the way DiscoverPage.tsx:300-306 does. Alternative: import RouterProvider from 'react-router/dom' and call `setParams(next, { replace: true, flushSync: true })` for this input.

### Adding or editing while the first /api/library request is in flight leaves the library cache empty: page still says 'Добавить', sidebar Continue disappears

- **id:** `bugs-client-mutation-during-initial-load` · **category:** reliability · **impact:** 3/5 · **effort:** S · **confidence:** verified
- **files:** `src/lib/queries.ts:212-221`, `src/lib/queries.ts:299-311`, `src/lib/queries.ts:320-347`, `src/lib/queries.ts:355-369`

**Evidence.** useAddEntry, useUpdateEntry and useRemoveEntry call `cancelQueries(keys.library)` in onMutate. If the library has never loaded, the cancel reverts the query to pending/idle with no data. `setEntry` and `patchEntry` are then no-ops (`if (!old) return old`). onSuccess only invalidates stats and activity, so nothing ever refetches the library.

Repro (/workspace/tools/scratch/bugs-client/repro-cancel.mjs, screenshot repro-cancel.png): delay GET /api/library by 2.5 s and click 'Добавить в библиотеку' on /title/movie-tt1375666 during the delay.

- The toast says 'Добавлено в библиотеку'.
- The server library contains both entries.
- The page still shows the add button and AddPanel, and the sidebar 'Продолжить' block is gone, until the user navigates.
  This is realistic on a slow host, a big library, or at app start while the Steam auto-sync request runs.

**Proposal.** In each onMutate, only `cancelQueries` when `client.getQueryData(keys.library)` exists. In onSettled, if the cache still has no data, call `client.invalidateQueries({ queryKey: keys.library })`. Or make `setEntry` and `patchEntry` trigger an invalidate when `old` is undefined.

### Discover search: genre/hide filters stick to new queries and kinds, producing a blank page with an empty genre picker and no message

- **id:** `bugs-client-discover-sticky-genre` · **category:** bug · **impact:** 3/5 · **effort:** S · **confidence:** verified
- **files:** `src/pages/DiscoverPage.tsx:318-321`, `src/pages/DiscoverPage.tsx:241-269`, `src/pages/DiscoverPage.tsx:56-76`

**Evidence.** `genre`, `sort` and `hide` live in the URL and are never reset when `q` or `kind` changes. The 'no results' state only checks `all.length`, so filtered-to-empty renders an empty grid. The Select receives a value that is not among its options and shows a blank trigger.

Repro (/workspace/tools/scratch/bugs-client/repro-discover.mjs, screenshot repro-discover.png):

- On /discover?q=witcher pick 'Ролевая'; the URL gets genre=RPG.
- Type 'Начало'; the URL becomes ?q=Начало&genre=RPG.
- The API returned movie-tt1375666, but the page shows only filter controls with an empty genre select, no cards and no explanation.

**Proposal.** Clear `genre` when the query or kind changes (`update({ q, genre: null })` in the URL-sync effect and in the kind Segmented). Also:

- drop a genre that is not in the current options;
- when `all.length && !items.length`, render EmptyState 'Ничего не подходит под фильтры' with a 'Сбросить фильтры' action;
- keep the active genre visible in the Select options, even with a 0 count.

### Ctrl+K or '/' on the year story opens an invisible palette under the overlay: clicks die, arrows change slides, Escape leaves the page

- **id:** `bugs-client-year-story-palette-trap` · **category:** bug · **impact:** 3/5 · **effort:** S · **confidence:** verified
- **files:** `src/pages/YearPage.tsx:311-324`, `src/pages/YearPage.tsx:336-341`, `src/app/AppShell.tsx:140-151`, `src/app/CommandPalette.tsx:182-184`

**Evidence.** YearPage is a custom `fixed z-[60]` dialog rendered inside the shell, so the shell's global hotkeys stay active. The palette is z-50, so it renders below the story. YearPage's window keydown handler ignores focus targets and `event.defaultPrevented`.

Repro (/workspace/tools/scratch/bugs-client/repro-year.mjs, repro-year2.mjs, repro-year3.mjs; screenshot repro-year-palette2.png): on /stats/year press Ctrl+K or '/'.

- The cmdk input is focused but not visible.
- `document.body.style.pointerEvents` is 'none' (Radix modal), so clicking 'Дальше' does nothing (1/6 stays 1/6).
- ArrowRight typed into the hidden input advances the story (1/6 → 2/6).
- Escape closes the palette AND navigates to /stats.

**Proposal.** Disable the shell hotkeys while the story is open: give `useHotkey` an `enabled` flag driven by a shell-context flag the YearPage sets, or render the palette above the story (z-[70]). In YearPage's handler, return early when `event.defaultPrevented`, when the target is an input or textarea, or when another `[role=dialog]` is open. Better still, build the story on Radix Dialog to get a focus trap and an inert background.

### Ctrl+K (and '/') shortcuts compare event.key only, so they don't fire with the Russian keyboard layout active

- **id:** `bugs-client-hotkeys-ru-layout` · **category:** i18n · **impact:** 3/5 · **effort:** S · **confidence:** likely
- **files:** `src/lib/hooks.ts:47-50`, `src/app/AppShell.tsx:140-151`

**Evidence.** `useHotkey` checks `event.key.toLowerCase() !== key`. With the ЙЦУКЕН layout active, Chrome and Edge on Windows/Linux report Ctrl+K as `key: 'л', code: 'KeyK'`, and the physical '/' key as '.'.

Repro (/workspace/tools/scratch/bugs-client/repro-hotkey.mjs): dispatching KeyboardEvent {key:'л', code:'KeyK', ctrlKey:true} leaves the palette closed; {key:'k', code:'KeyK'} opens it.

For a Russian-first app whose README and sidebar advertise 'Ctrl K', many users will have the RU layout active. This was simulated with a synthetic event, not with a physical keyboard.

**Proposal.** Let `useHotkey` accept a physical code: `if (event.key.toLowerCase() !== key && event.code !== code) return`. Use code 'KeyK' for the palette and 'Slash' for '/', keeping `event.key === '/'` for layouts that type '/' elsewhere. Add a unit test with key 'л' and code 'KeyK'.

### In-app back arrow navigates out of MediaShell when the page was opened from an external link

- **id:** `bugs-client-back-arrow-leaves-app` · **category:** ux · **impact:** 2/5 · **effort:** S · **confidence:** verified
- **files:** `src/app/PageHeader.tsx:44-52`

**Evidence.** The button calls `window.history.length > 1 ? navigate(-1) : navigate(parent?.to ?? '/')`. `history.length` counts entries from other sites in the same tab, so the parent fallback ('Обзор') is effectively never used.

Repro (/workspace/tools/scratch/bugs-client/repro-back.mjs): open an external page that links to /title/movie-tt1375666 and follow the link (history.length = 3). Clicking the header's 'Назад' arrow returns to the external data: URL, out of the app. This is typical for shared links from chats.

**Proposal.** Use React Router's own history index: `const canGoBack = (window.history.state?.idx ?? 0) > 0` (or `useLocation().key !== 'default'`). Call `navigate(-1)` only then; otherwise `navigate(parent?.to ?? '/', { replace: true })`.

### Rejected start/finish date stays in the input as if saved, with only a generic error

- **id:** `bugs-client-date-reject-stale` · **category:** bug · **impact:** 2/5 · **effort:** S · **confidence:** verified
- **files:** `src/pages/title/EntryPanel.tsx:25-59`, `src/pages/title/EntryPanel.tsx:186-201`, `src/lib/queries.ts:325-337`, `src/components/library-actions.tsx:139-142`

**Evidence.** The server rejects finishedAt < startedAt with VALIDATION and fields.finishedAt='before_start'. Because startedAt and finishedAt are not optimistic keys, the rollback leaves `value` unchanged, and DateField's `prev !== value` reset never runs. The client toasts `errors.VALIDATION` instead of the existing `errors.fields.before_start` ('Раньше даты начала').

Repro (/workspace/tools/scratch/bugs-client/repro-dates.mjs): on a completed movie with dates 2026-10-10 → 2026-10-20, enter finished 2026-10-01 and press Enter.

- Toast: 'Проверьте введённые данные.'
- The input keeps showing 2026-10-01.
- The server still has 2026-10-20.

**Proposal.** Give DateField an `onError` that resets `draft` to `toDateInput(value)`. Have `actions.patch` surface field codes (`errors.fields.${code}`). Constrain the inputs: the finished field gets `min={toDateInput(startedAt)}` and the started field gets `max={toDateInput(finishedAt)}`.

### Lead's (d): CoverPicker probes /api/users/<id>/cover with an <img>, so every Settings→Profile visit 404s for users without an uploaded cover

- **id:** `bugs-client-cover-probe-404` · **category:** bug · **impact:** 2/5 · **effort:** S · **confidence:** verified
- **files:** `src/components/CoverPicker.tsx:118-125`, `src/components/CoverPicker.tsx:283-301`, `server/routes/users.ts:40-43`, `server/routes/users.ts:104-108`

**Evidence.** `hasCover` starts as null and the 'Своя картинка' tile renders `<img src={/api/users/${id}/cover?v=${Date.now()}}>` while it is not false. The server answers 404 'No cover' when nothing was uploaded, and `onError` then sets hasCover=false.

The probe runs on every mount and is cache-busted by `stamp = Date.now()`. It produces a red console error each time, and a transient failure hides 'Заменить/Удалить' for users who do have a cover. CoverPicker is only used in ProfileSection, which is why the lead's /settings visit shows the 404. Pages without the picker don't request it, because UserPage uses the server-computed `bannerImage`.

**Proposal.** Let the client know whether a cover exists without probing: add `coverVersion: number | null` (or `hasCover`) to the session User or the /users/:id/profile payload (server already has `coverVersion()`). Render the tile and position editor from it, use `?v=${coverVersion}` for caching, and update it from the PUT /me/cover response. Remove the onError-based detection.

### Lead's (c): 'Серий просмотрено' and its '≈ N ч' caption come from two different sources

- **id:** `bugs-client-stats-episodes-vs-hours` · **category:** bug · **impact:** 2/5 · **effort:** S · **confidence:** verified
- **files:** `server/library/stats.ts:102-105`, `server/library/stats.ts:125-128`, `src/pages/stats/KpiGrid.tsx:74-81`, `server/scripts/seed-demo.ts:640-690`

**Evidence.** KpiGrid renders `stats.episodesWatched` as the value and `minutes.episodes` as the caption in the same tile. The server computes them differently:

- `episodesWatched` = COUNT of episode_marks with watched_at, including specials (season 0) and marks for episodes no longer in the list.
- `minutes.episodes` = Σ entries.watched_episodes × runtime, which counts only regular episodes present in the list.

The demo's '0 серий · ≈160 ч' is a seed artifact: seed-demo.ts writes watched_episodes for completed and in-progress series without any episode_marks. In the real app the numbers still diverge for anyone who marks specials, and the client has no way to reconcile them.

**Proposal.** Compute both numbers from one source on the server. Either count regular watched marks joined to each title's runtime for the minutes, or use SUM(watched_episodes) for the count. Keep specials out of both, or in both. Once fixed, no client change is needed; until then, consider hiding the caption when `episodesWatched === 0`.

### Continue lists don't move the title you just watched to the front; own profile and post-Steam-import stats stay stale

- **id:** `bugs-client-stale-derived-caches` · **category:** ux · **impact:** 2/5 · **effort:** S · **confidence:** verified
- **files:** `src/lib/queries.ts:212-229`, `src/lib/queries.ts:240-243`, `src/app/Sidebar.tsx:36-37`, `src/pages/HomePage.tsx:237`, `src/components/SteamAccount.tsx:266`

**Evidence.** Sidebar 'Продолжить' and Home 'Продолжить' rely on the array order of the library cache (server: updated_at DESC). `setEntry` and `patchEntry` replace entries in place without reordering.

Repro (/workspace/tools/scratch/bugs-client/repro-order.mjs): mark an episode of 'Шерлок' (2nd in Continue). The sidebar stays ['Во все тяжкие', 'Шерлок'] while the server order is ['Шерлок', 'Во все тяжкие'].

Also, `invalidateDerived` only invalidates stats and activity, never `['profile', ownId]`, so your own profile shows stale favourites and stats for up to 30 s. The Steam import (SteamAccount.tsx:266) invalidates only `keys.library`, not stats or activity.

**Proposal.** In `setEntry`/`patchEntry`, move the updated entry to the front of the array (matching the server's updated_at DESC order) for status, episode and progress changes; position-only patches can stay in place. Add `client.invalidateQueries({ queryKey: ['profile'] })` to `invalidateDerived`. After a Steam import, invalidate `keys.stats` and `keys.activity` as `useSteamAutoSync` already does.

### Palette 'Недавние' shows the previous account's opened titles after logout or login on a shared browser

- **id:** `bugs-client-recent-titles-cross-account` · **category:** bug · **impact:** 2/5 · **effort:** S · **confidence:** verified
- **files:** `src/lib/queries.ts:79-94`, `src/lib/recent.ts:3-37`, `src/app/CommandPalette.tsx:59-62`

**Evidence.** `resetUserData` runs on login, logout, registration and 401, and clears 'mediashelf:shuffle-history' because it is personal. It leaves 'mediashelf:recent-titles' untouched, which is written by `rememberTitle` on every title page. The next account (or a guest) opening Ctrl+K on the same browser sees the previous user's recently opened titles at the top. The app supports multiple accounts per instance, so this leaks what another person was browsing.

**Proposal.** Clear 'mediashelf:recent-titles' in `resetUserData` (and in DeleteAccount's cleanup), or key the storage by user id, e.g. `mediashelf:recent-titles:${userId}`, with guests getting their own key.
