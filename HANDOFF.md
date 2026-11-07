# MediaShell — handoff

## ДИЗАЙН (2026-11-07) — сначала прочитать `docs/design/ROADMAP.md`

Новая задача владельца: «улучши дизайн сайта в разы». Аудит, принципы, список идей со статусами и спецификации лежат в `docs/design/ROADMAP.md`; скриншоты всех страниц снимает `docs/design/tour.mjs`. Продолжать с первого пункта со статусом «не начато».

Сделано и слито (PR #30–#36): кино-герой на Главной, витрина в Обзоре, живые постеры, кадр тайтла ярче, баннер итогов года в Статистике, проявление страниц, веер постеров в пустых состояниях, новые скриншоты в README, переход постер → герой.

### Ветка `tembo/design-continued` (продолжение, 2026-11-07) — не слита в `main`

Владелец: «продолжи улучшение, сделай всё красивее, не останавливайся, пока я не скажу, каждое действие записывай на GitHub, чтобы другой ИИ понял». Одна ветка, каждый пункт — отдельный коммит с подробным сообщением и записью в журнале `docs/design/ROADMAP.md`. PR не открывался (владелец не просил), поэтому CI на ветке не запускался — все проверки локальные (typecheck, lint, prettier, unit, e2e через системный Chromium). На ПК владельца (`C:\Users\mopre\projects\MediaShelf`) эта ветка собрана и запущена на `http://localhost:4173`.

Сделано на ветке (по порядку коммитов): №11 превью в палитре; исправление Steam (игры, не продающиеся в регионе, теряли кадр и описание); №10 полка «Отложено»; №17 окно «Сочетания клавиш» и переходы «G, затем …»; №18 «Сейчас» крупной карточкой в профиле; №16 календарь серий (`/calendar`); №15 картинка «Мой год» и прокси картинок `/api/images`; №19 «Под настроение» в Обзоре; №20 свайпы; №21 звук и вибрация в Жребии; №14 свои подборки (миграция БД v7, `/api/collections`, экспорт/импорт); словари uk/de/es/fr/ro по требованию (−60 КБ gzip на старте); группировка серий в клетке календаря; README со свежими скриншотами. Первая волна идей роадмапа закрыта целиком, кроме №5 и №22 (отложены сознательно, см. таблицу). **Дальше:** вторая волна идей (№23+) в `docs/design/ROADMAP.md`. Чтобы влить: открыть PR из `tembo/design-continued` в `main`, дождаться зелёного CI (на ветке CI не запускался, все проверки локальные: последний полный e2e — 79/79 до подборок, затем по затронутым наборам).

## ГДЕ ОСТАНОВИЛИСЬ (2026-11-07) — читать первым

Вся работа из плана слита в `main` через PR #22–#28, CI на `main` зелёный. Незаконченных патчей больше нет: `docs/handoff/pending/` пуст.

### Что сделано

- **#22:** лента «Новые серии» и «Скоро выйдет», импорт из MyAnimeList, Шикимори и IMDb, полный Undo, исправления страницы тайтла и палитры. Плюс 9 исправлений по ревью: импорт списка IMDb «Хочу посмотреть», безопасность Undo, очередь обновления списков серий, приватность обложки.
- **#23:** новые экраны входа и регистрации, перенесены из локальной копии владельца.
- **#24 (`wp-title2`):** страница тайтла на телефонах: одна панель действий, сетка оценок 5×2, отметка серии всей строкой.
- **#25 (`wp-lists`):** карточки библиотеки, топ-10 в Обзоре, «+» на сенсорных экранах, «Последние действия», «Фон избранного», пустой Жребий.
- **#26 (`wp-shell`):** приветствие для новых аккаунтов, итоги года как модальное окно, видимый фокус, контраст `--fg-3`, кнопки 40–44 px на сенсорных экранах.
- **#27 (`wp-i18n`):** тон русских текстов, выбор языка в Ctrl+K, `parity.test.ts`.
- **#28:** полные переводы uk/de/es/fr/ro, все семь языков в `COMPLETE_LOCALES`; первый визит открывается на языке браузера.

Каждый пакет перед слиянием прошёл независимое ревью, на каждое исправление есть тест. Подробности в `PROGRESS.md`.

### Что осталось (по желанию владельца)

1. Аудиты, которые ни разу не проводились: серверные ошибки, производительность (LCP и т. п.), предложения новых функций.
2. Демо-данные (`server/scripts/seed-demo.ts`) местами несогласованны, см. «Known errors».
3. Носителям языков стоит посмотреть подобранные названия пунктов меню Steam и IMDb и название «Жребия» в uk/de/es/fr/ro.
4. Скриншоты в `docs/screenshots/` сделаны до этих изменений.

### Важно

- Если работаете в песочнице Tembo: `tembo commit` после коммита делает `git reset --hard origin/<branch>`. Перед ним всегда `git add -A`.
- CI (`.github/workflows/ci.yml`) запускается на push в `main` и на pull request.
- На NixOS встроенный Chromium Playwright не запускается. Для локального e2e подставьте системный через временный конфиг с `launchOptions.executablePath`, в репозиторий его не коммитьте.

## INSTRUCTIONS FOR THE NEXT AI AGENT

You are continuing a large "make the whole site dramatically better" effort on this repository. Do **not** repeat the initial audit and do **not** start from scratch.

1. **Branch.** All work lives on `tembo/make-it-better` (based on `main` @ `49cbe1e`). Check it out: `git fetch origin && git checkout tembo/make-it-better`. Never force-push. Never rewrite pushed history.
2. **Read, in this order:** `PROGRESS.md` (what is done, in progress and next), then the findings in `docs/handoff/AUDIT.md` (bugs already root-caused, with file:line evidence, repro steps and fix proposals), then `DESIGN.md` and `PRODUCT.md` (the design system you must respect).
3. **Install once:** Node.js **24** (CI uses 24; `package.json` allows ≥ 22.18). Run `npm ci`. Do not reinstall if `node_modules` already exists and `package-lock.json` is unchanged.
4. **Next concrete action:** take the first unchecked item in the `TODO` section of `PROGRESS.md` (P0 bugs first), implement it, run the checks listed below, commit, push, tick it in `PROGRESS.md` (move it to `COMPLETED` with the commit hash) and update the "Current status" section of this file.
5. **Before every commit:** `npm run typecheck && npm run lint && npm run format:check && npm test`. Before pushing anything that touches the UI flows, also run the e2e suite (`npm run test:e2e`, see below). CI (`.github/workflows/ci.yml`) runs the same steps, but **only on pushes to `main` and on pull requests** — a push to this branch does not trigger CI, so run the checks locally.
6. **Keep the handoff alive:** after each meaningful milestone, update `PROGRESS.md` and the "Current status" section below, run `npx prettier --write HANDOFF.md PROGRESS.md docs/handoff`, and commit them together with the code.

## Original goal

The owner asked (in Russian): «короче улучши сайт как только хочешь вообще прям что бы в 100000000 лучше было» — "improve the site however you like, make it 100,000,000× better". They later restated it: dramatically improve the entire website — design, responsiveness, UX, performance, functionality and overall quality — and **prioritise a polished, working product over endless analysis**. No PR has been requested; work is pushed to the branch.

## Current status (update this section at every milestone)

- **Last updated:** 2026-11-07. Everything planned is merged to `main` (#22–#28); see «ГДЕ ОСТАНОВИЛИСЬ» above. The notes below this line describe the state before that and are kept for history.
- **Committed:** `wp-data`, the airing feed, external imports, `wp-nav`, wave 2 (palette focus return, tab-bar offsets, header wrap, Shuffle default) and the title-page P0/P3 fixes (PROGRESS items 1, 2, 11, 12) with their review fixes. Checks green on the latest commit: typecheck, lint, prettier, 264 unit/API tests, 32/32 e2e.
- **Next step:** apply, verify and finish the four unfinished step-4 patches in `docs/handoff/pending/` (UX, mobile, a11y, i18n), then decide on the server/performance/features audits, then the final regression.
- **Audit:** the client-bug audit is complete (`docs/handoff/AUDIT.md`); UX/visual and mobile/a11y/i18n are partial lists (`docs/handoff/audit-*-partial.md`); server bugs, performance and features were never audited.

## Baseline (verified on `49cbe1e`, Node 24.11.1)

| Check                                             | Result                                                       |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `npm run typecheck`                               | pass                                                         |
| `npm run lint`                                    | pass                                                         |
| `npm run format:check`                            | pass                                                         |
| `npm test` (vitest, 29 files)                     | 216 / 216 pass                                               |
| `npm run test:e2e` (Playwright, desktop + mobile) | 13 / 13 pass (≈ 58 s)                                        |
| `vite build`                                      | ok; `cn-*.js` 295 KB, `index-*.js` 365 KB (gzip 94 / 118 KB) |

## Commands

```sh
npm ci                      # install (once)
npm run dev                 # UI on http://127.0.0.1:5173, API on :4174 (hot reload)
npm run build && npm start  # production build, http://localhost:4173
npm run check               # typecheck + lint + unit/API tests
npm run format:check        # prettier (CI fails on unformatted files, including .md)
npx playwright install chromium && npm run test:e2e   # build + e2e (offline fixture catalog, in-memory DB)
npm run seed:demo           # demo user demo@mediashell.local / password123 with 24 entries
```

Handy for manual QA (offline catalog, throwaway DB, no rate limits):

```sh
PORT=4300 HOST=127.0.0.1 CATALOG_MODE=fixtures DB_FILE=:memory: DISABLE_RATE_LIMITS=1 node server/main.ts
```

Registration is two-step (email code). Without SMTP the `/api/auth/register/start` response contains `devCode`; post it to `/api/auth/register/verify` (see `tests/e2e/helpers.ts`). For a realistic library run `DATA_DIR=/tmp/demo node server/scripts/seed-demo.ts` and start the server with the same `DATA_DIR` and `CATALOG_MODE=live` (internet needed).

### Sandbox-specific notes (only if you are on NixOS without system Chromium for Playwright)

- Node 24: `export PATH=$(nix shell nixpkgs#nodejs_24 -c sh -c 'dirname $(which node)'):$PATH`.
- Playwright's bundled Chromium does not run on NixOS. A git-ignored `playwright.local.config.ts` (listed in `.git/info/exclude`) spreads `playwright.config.ts` and sets `use.launchOptions.executablePath` to the Nix Chromium; run `npx vite build && npx playwright test -c playwright.local.config.ts`. Set `E2E_PORT` to a unique port when several suites run at once.

### Tembo-specific gotcha (only if you run inside a Tembo sandbox)

`tembo commit` makes a local commit, has Tembo create a verified commit with the same tree on the remote, then runs `git fetch` and **`git reset --hard origin/<branch>`**. Any tracked-file changes that were not part of the commit are wiped. Always stage the complete working tree (`git add -A`) or save a patch (`git diff --binary HEAD > backup.patch`) before running it. Untracked files survive.

## Findings so far

Full details with evidence and fix proposals: `docs/handoff/AUDIT.md`. Headline items:

### Observed by the lead in screenshots (demo user, live catalog)

1. Series page says «Вы посмотрели все вышедшие серии» while the header says 48 of 73. Root cause: a stale cached library entry (the server recomputes episode counters after the episode list loads, and the client never refetches the entry). **P0.**
2. The sidebar "Continue" for the same series flips from «48/73» to «S1 · E1» after opening the page. Same root cause, plus two different progress formats.
3. Stats shows «Серий просмотрено 0» with «≈ 160 ч». The count and the hours come from two different sources on the server (`server/library/stats.ts`). The demo seed makes it extreme, but real data diverges too (specials).
4. `GET /api/users/<id>/cover?v=…` returns 404 on Settings → Profile: `CoverPicker` probes for a cover with an `<img>`. The fix is to expose `coverVersion` in the API.
5. Bundle: `cn-*.js` ≈ 295 KB and `index-*.js` ≈ 365 KB. The performance audit stream investigates the chunking.
6. A Steam game (Witcher 3) shows an «IMDb 9,0» chip and has no backdrop or description. This is a seed artifact: `seed-demo.ts` writes that rating.

### Client bugs (audit complete, reproduced)

| Priority | Finding id                                 | Summary                                                                                                                               |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | `bugs-client-notes-autosave-wrong-title`   | `TitlePage` is not keyed by id. A note being typed can be saved into a **different** title; all per-title state leaks between titles. |
| P0       | `bugs-client-stale-next-episode`           | Series page claims "all watched" for unwatched series; no «+1 серия»; stale counters.                                                 |
| P1       | `bugs-client-palette-adds-stale-result`    | Ctrl K: Enter during debounce acts on the previous query's results, so the wrong title gets added. Ctrl K close keeps the old query.  |
| P1       | `bugs-client-undo-remove-data-loss`        | «Вернуть» after removal loses episode marks, playthroughs and dates; after navigation it restores only the status.                    |
| P1       | `bugs-client-verify-link-not-signed-in`    | The email verification link lands on the login form although the account was created.                                                 |
| P1       | `bugs-client-library-search-caret`         | Library search loses keystrokes and the caret jumps to the end (input bound to the URL inside a transition).                          |
| P2       | `bugs-client-mutation-during-initial-load` | Editing while the first `/api/library` request is in flight leaves the library cache empty.                                           |
| P2       | `bugs-client-discover-sticky-genre`        | The Discover genre filter sticks to new queries, giving a blank page with no message.                                                 |
| P2       | `bugs-client-year-story-palette-trap`      | Ctrl K on the year story opens an invisible palette that traps clicks.                                                                |
| P2       | `bugs-client-hotkeys-ru-layout`            | Ctrl K and `/` don't work with the Russian keyboard layout (compare `event.code`).                                                    |
| P3       | `bugs-client-back-arrow-leaves-app`        | The header back arrow can leave the app for an external site.                                                                         |
| P3       | `bugs-client-date-reject-stale`            | A rejected date stays in the input; generic error instead of «Раньше даты начала».                                                    |
| P3       | `bugs-client-cover-probe-404`              | Item 4 above.                                                                                                                         |
| P3       | `bugs-client-stats-episodes-vs-hours`      | Item 3 above.                                                                                                                         |
| P3       | `bugs-client-stale-derived-caches`         | Continue order doesn't update; own profile and post-Steam-import stats stay stale.                                                    |
| P3       | `bugs-client-recent-titles-cross-account`  | Ctrl K "Recent" leaks the previous account's titles on a shared browser.                                                              |

## Files created, modified or deleted

| File                    | Change                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| `HANDOFF.md`            | new: this document                                                    |
| `PROGRESS.md`           | new: COMPLETED / IN PROGRESS / TODO tracker                           |
| `docs/handoff/AUDIT.md` | new: full audit findings (generated from the audit run, then curated) |

| `server/library/transfer.ts` | `exportEntry` and `importEntries` extracted; import recomputes episode counters |
| `server/routes/library.ts` | `DELETE` returns `snapshot`; new `POST /api/library/restore` |
| `server/routes/users.ts`, `shared/types.ts` | `UserProfile.coverVersion` |
| `server/library/stats.ts` | `episodesWatched` = Σ regular watched episodes (same source as hours) |
| `src/lib/queries.ts` | `restoreRemovedEntry`, `holdLibrary`/`refreshIfMissing`, `setEntry` moves updated entries to the front, profile invalidation |
| `src/components/library-actions.tsx` | Undo uses `restoreRemovedEntry` |
| `src/components/CoverPicker.tsx` | uses `coverVersion` instead of probing the image |
| `src/components/SteamAccount.tsx` | invalidates stats and activity after an import |
| `src/pages/VerifyEmailPage.tsx` | signs in after verification; keeps the theme |
| `server/api.test.ts`, `server/cover.test.ts` | new tests for undo/restore and `coverVersion` |

| `server/scripts/seed-demo.ts` | consistent demo data (episode marks, import-stub titles) |
| `server/library/airing.ts`, `server/library/airing.test.ts` | new: personal episode feed (fresh and upcoming) |
| `src/lib/airing.ts`, `src/lib/airing-days.ts` (+ test) | new: `useAiring` hook and pure date helpers |
| `src/pages/home/AiringSections.tsx` | new: «Новые серии» and «Скоро выйдет» sections on Home |
| `src/i18n/sections/airing.ts` | new: feed strings (ru + en), registered in `ru.ts` and `en.ts` |

| `src/lib/external-import.ts` (+ test) | new: MAL/Shikimori XML and IMDb CSV → export-format converters |
| `src/pages/settings/ExternalImport.tsx`, `src/pages/settings/DataSection.tsx` | new «Импорт из других сервисов» row with a how-to |
| `src/i18n/sections/external-import.ts` | new: strings (ru + en) |
| `server/library/enrich.ts` (+ test), `server/routes/me.ts` | background enrichment of imported stubs after `/me/import` |

| wave 1 `wp-nav`: `src/lib/hotkeys.ts` (+ test), `src/lib/hooks.ts`, `src/app/AppShell.tsx`, `src/app/shell-context.tsx`, `src/app/CommandPalette.tsx`, `src/lib/recent.ts` (+ test), `src/pages/DiscoverPage.tsx`, `src/pages/LibraryPage.tsx`, `src/pages/YearPage.tsx`, `src/pages/TitlePage.tsx`, `src/pages/settings/DataSection.tsx`, `tests/e2e/navigation.spec.ts` | palette freshness, RU-layout hotkeys, year-story hotkey lock, URL-synced search fields, Discover filter reset and empty state, per-account recent titles |

| wave 2: `src/app/App.tsx`, `src/app/AppShell.tsx`, `src/app/CommandPalette.tsx`, `src/app/PageHeader.tsx`, `src/components/ui/misc.tsx`, `src/pages/HomePage.tsx`, `src/pages/ShufflePage.tsx`, `src/styles/index.css`, `tests/e2e/{navigation,library,mobile}.spec.ts` | palette focus return, `--tabbar-h` offsets for toasts / back-to-top / page padding, wrapping `SectionHeader`, Shuffle defaults to your plans; e2e for all three |
| title page P0/P3: `src/pages/TitlePage.tsx`, `src/pages/title/{EntryPanel,EpisodesSection}.tsx`, `src/pages/title/{dates,episode-progress}.ts` (+ tests), `src/app/{PageHeader,AppShell}.tsx`, `src/components/library-actions.tsx`, `src/lib/{queries,airing}.ts`, `server/library/entries.ts`, `server/review-fixes.test.ts`, `src/i18n/{ru,en}.ts`, `tests/e2e/title.spec.ts` | notes keyed to their title (unmount and `pagehide` flush), episode progress from list + marks, entry re-read after a list or a recount, refetch-after-write race, back arrow by router index, scroll after replace, skip link without history entry, date validation on client and server |
| `docs/handoff/audit-ux-visual-partial.md`, `docs/handoff/audit-mobile-a11y-i18n-partial.md` | partial findings of the interrupted second audit |

Keep this table current.

## Git

- **Remote:** `origin` = `https://github.com/mopretyy/MediaShelf`; default branch `main`.
- **Working branch:** `tembo/make-it-better`, created from `main` @ `49cbe1e` (#21, Steam achievement progress).
- **Commits on the branch:** see `git log main..tembo/make-it-better`; the first one adds these handoff files.
- **Worktrees:** `/workspace/wt/wp-title` and `/workspace/wt/wp-nav` (detached at `5863ec7`, wave 1, agents still working; their patches land in `/workspace/tools/patches/`), and `/workspace/wt/audit` (detached at `4c02da3`, a read-only snapshot for the auditors, safe to remove afterwards). `wp-data` is already merged and removed. The plan uses one worktree per parallel work package (`git worktree add --detach /workspace/wt/<name> HEAD`, then symlink `node_modules` from the main checkout). Each package is delivered as a patch or commit and merged into the branch. List them with `git worktree list` and record any that are left behind here.
- **Uncommitted changes:** none besides what the latest commit contains; check with `git status`.
- Other remote branches (`sauna/*`, `gumball/*`, `hoplite/*`, `feat/promo-video`, `codespaces-preview`, `backup/before-bug-fixes`) are older feature branches, already merged or abandoned. Leave them alone.

## Parallel agents

| Agent / run                                                                         | Assignment                                                                                                                                                                                              | State when last updated                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit workflow `mediashell-audit` (`wf_729d74b4-579`)                               | Six read-only auditors                                                                                                                                                                                  | **Dead.** The session interrupt at 18:28 UTC killed it. Only the client-bug stream finished (in `AUDIT.md`); the server-bug and UX streams died mid-run, and the rest never started.                            |
| Audit workflow `mediashell-audit-2` (`wf_5d0dc241-5ed`)                             | Lean re-run: UX/visual, mobile+a11y+i18n, performance, server bugs, features. Reads the snapshot worktree `/workspace/wt/audit` (at `4c02da3`) and the demo server on :4180                             | **Stopped** at 19:25 UTC. Partial results were saved as `docs/handoff/audit-ux-visual-partial.md` and `docs/handoff/audit-mobile-a11y-i18n-partial.md`; performance, server bugs and features produced nothing. |
| Fix workflow `mediashell-fix-wave1` (`wf_a0829402-001`), agent `implement:wp-title` | Worktree `/workspace/wt/wp-title`: notes autosave to the wrong title (key the page by id), stale next-episode state, date rejection, back arrow; plus e2e regression tests                              | **Stopped.** Unfinished work saved as `docs/handoff/pending/wp-title-unfinished.patch`.                                                                                                                         |
| Same workflow, agent `implement:wp-nav`                                             | Worktree `/workspace/wt/wp-nav`: stale command palette results, Ctrl K on the RU layout, year-story hotkey trap, library search caret, sticky Discover genre, recent titles across accounts; plus tests | **Done**, committed in `6c19a84`.                                                                                                                                                                               |

If you cannot reach these agents (different account or machine), do not wait for them. The client-bug list alone is enough to start. Re-run only the dimensions that are missing from `AUDIT.md`, and only if you need them; for the UX work you can screenshot the app yourself.

## Architecture and design decisions

- **Stack:** React 19 + Vite 8 + Tailwind 4 + Radix + TanStack Query (`src/`); Node 24 + Hono + `node:sqlite` (`server/`); shared zod schemas and types (`shared/`). No native modules; the TypeScript server runs without a build step (type stripping).
- **Respect `DESIGN.md`:** strict black and white, colour only from posters, backdrops and avatars. Glass only on floating layers, hairlines instead of shadows, Inter display tracking −0.022 em, and the stated radii and motion timings. Improvements should make the app more polished inside this system, not repaint it.
- **i18n:** Russian is the source of truth. All seven locales are complete and listed in `COMPLETE_LOCALES` (`src/i18n/languages.ts`); `parity.test.ts` fails on any missing key, placeholder or plural form, so a new string needs all seven. Put new strings for a feature in `src/i18n/sections/<feature>.ts` (export `<feature>Ru` and `<feature>En`, as `steam-connect.ts` does) and register them with one line in `ru.ts` and `en.ts`; uk/de/es/fr/ro hold their sections inline, so add the same keys there. This keeps parallel work from conflicting.
- **Data safety first:** user data bugs (notes saved to the wrong title, Undo losing marks) outrank everything else.
- **Optimistic UI** is a product principle (`PRODUCT.md`). Fixes must keep actions instant and reversible.
- **Tests:** add a unit or e2e test for every bug fix where practical (the existing e2e suite runs offline against fixtures).

## Known errors, blockers, unresolved issues

- No blockers. The baseline is green.
- CI runs on pushes to `main` and on pull requests, not on other branch pushes.
- The demo seed (`server/scripts/seed-demo.ts`) writes inconsistent data: series progress without episode marks, and an IMDb rating on a Steam game. Don't mistake these artifacts for app bugs; fixing the seed itself is a TODO.
