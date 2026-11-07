# ux-visual findings (audit:ux-visual)

Screenshots: /workspace/tools/scratch/ux-visual/{dark,light,en,empty,interact}/ ; DOM checks: */checks.json

## ux-visual-library-card-status-truncated — Library grid cards cut the status word to "П…" while store, "100 %" and rating stay

- category: bug (visual) · impact 3 · effort S · confidence verified
- files: src/pages/LibraryPage.tsx:295-345 (meta parts), src/components/TitleCard.tsx:85-100, src/components/TitleCard.tsx:150 (grid minmax 148px)
- evidence: dark/library-0.png at 1440x900: "Hollow Knight — П… · Steam · 100 % · ★ 9", "Disco Elysium — П.. · Steam · 100 % · ★ 10", "Hades — П.. · Steam …". DOM check (dark/checks.json, library): truncated spans «Пройдено» at 23px and 15px. On sm+ the status span is `min-w-0 truncate` while store/progress/rating are `shrink-0`, so the most important word is the one that gives way. "100 %" repeats what "Пройдено" says.
- proposal: order and prune by priority instead of truncating the status: (1) status `shrink-0` always; (2) progress only when status is in_progress/paused (drop "100 %" for completed); (3) rating `★ 9`; (4) Steam as icon only (`<BrandIcon id="steam" className="size-3" aria-label="Steam"/>`, no word) and give the store part `min-w-0 truncate` / hide it first (`max-[1600px]:hidden` is not needed if the word is dropped). Expected result: "Пройдено · ★ 9 ·[steam-icon]".

## ux-visual-title-duplicate-controls — Title page shows two status pickers, two favourite hearts and two rating controls at once

- category: ux · impact 3 · effort M · confidence verified
- files: src/pages/TitlePage.tsx:180-195 (hero LibraryButton, FavoriteButton, RatingButton), src/pages/title/EntryPanel.tsx:152-168 (panel FavoriteButton, StatusPicker, RatingScale)
- evidence: dark/title-movie-0.png, title-series-0.png, title-game-0.png: hero row "Просмотрено ▾ · ♥ · ★ 9/10 · Трейлер · …" and, 100 px lower, the "В библиотеке" card with its own ♥ in the header, "Статус: Просмотрено" (a ghost StatusPicker that reads as plain text) and a 1–10 RatingScale. Same state is editable in two places on one screen; the panel's status row has no affordance (no chevron/border) so it looks like a label.
- proposal: make the hero the single action bar (status, favourite, rating, trailer, more) and turn the rail card into "Ваша запись" with only what the hero cannot hold: progress (episodic), dates, notes, remove. Concretely: remove `<FavoriteButton>` from the EntryPanel header (EntryPanel.tsx:156), remove the Статус row (158-160) and the RatingScale row (161-168) on desktop (keep them only below `md`, where the hero buttons wrap), or keep RatingScale but drop the hero RatingButton — one of each, not both.

## ux-visual-shuffle-default-ignores-plans — Home promises "случайный тайтл из ваших планов", Shuffle opens on «Популярное» with 120 catalog titles

- category: ux · impact 3 · effort S · confidence verified
- files: src/pages/HomePage.tsx:370-382 (CTA → `<Link to="/shuffle">`), src/i18n/ru.ts:230-231 (home.shuffleText), src/pages/ShufflePage.tsx:97-101 (`const source = sourceChoice ?? 'catalog'`), src/pages/ShufflePage.tsx:250-258
- evidence: demo user (5 planned titles). Home card "Не можете выбрать? Пусть решит жребий: случайный тайтл из ваших планов." → /shuffle shows «Откуда выбирать: [Популярное] Моя библиотека», reel of Call of Duty/Dota 2/PUBG and "В жребии 120 тайтлов" (dark/shuffle-0.png, dark/home-0.png). The core flow in PRODUCT.md ("when undecided, letting Shuffle pick") needs an extra click on every first visit, and the copy on Home is simply wrong for that first visit.
- proposal: default to the library when it has something to pick: `const source = sourceChoice ?? (hasLibrary && plannedCount > 0 ? 'library' : 'catalog')` (statuses default = planned). Accept `?source=library|catalog` (useSearchParams) and make the Home CTA `<Link to="/shuffle?source=library">`. Put «Моя библиотека» first in the Segmented options when the user has a library. Keep the remembered choice (prefs.source) winning over the default.

## ux-visual-discover-ranked-rows-waste-space — Discover top-10 rows spend ~46% of each slot on a hollow numeral and cut almost every title to ~15 characters

- category: visual · impact 3 · effort S · confidence verified
- files: src/components/TitleCard.tsx:122-137 (rank numeral `w-[84px] sm:w-[104px] text-[80px]`), src/pages/DiscoverPage.tsx:119-128 (`Shelf itemClassName="w-[184px] sm:w-[224px]"`), src/components/TitleCard.tsx:85 (`truncate`)
- evidence: dark/discover-0.png at 1440: each slot 224 px, numeral 104 px, poster ~124 px, caption 120 px. DOM check found 26 ellipsised titles on /discover: «Call of Duty®: Mo…», «Тайный дневник …», «Декстер: Воскре…», «Монолог фарма…», «Свадьба светля…», «Токийские мсти…». Posters are smaller than on Home/Library (148+ px), and the numerals (stroke `--line-strong` on transparent) are barely visible, so the row reads as gaps rather than a ranking.
- proposal: tuck the poster over the numeral instead of placing them side by side: numeral `w-[56px] sm:w-[64px] -mr-5 text-[96px]` behind the poster (`relative z-0`, card `relative z-10`), shelf item `w-[200px] sm:w-[232px]` → poster ≈170 px. Give ranked captions `line-clamp-2` (min-h for 2 lines) instead of `truncate`, or let the caption start under the numeral (`-ml-[56px]`) so it gets the full slot width. Raise numeral stroke to `--fg-3` for legibility.

## ux-visual-profile-activity-double-time — Profile «Последние действия» repeats the time twice and truncates the titles instead

- category: visual · impact 2 · effort S · confidence verified
- files: src/pages/UserPage.tsx:455-470 (day headers, `uppercase`), src/components/ActivityRow.tsx:46-57 (`shrink-0` relative time), src/i18n/ru.ts:513-525 (activity.added 'Добавлено: {status}')
- evidence: dark/user-0.png (1440): every row sits under a day header («17 ОКТ. 2026 Г.», «19 ФЕВР. 2026 Г.») and still shows «3 недели назад» / «9 месяцев назад» in a fixed right column. The 340 px rail then truncates the actual content: «Провожающая в пос…», «Добавлено: Пройде…», «Добавлено: Просм…» (DOM check: 6 truncations). Upper-casing Russian abbreviations gives «ФЕВР. 2026 Г.», which reads as shouting and keeps the «г.».
- proposal: give ActivityRow a `time?: 'relative' | 'clock' | 'none'` prop; in the grouped profile list pass `'clock'` (fmt time "14:05") or `'none'`, keep `'relative'` on Home where rows are not grouped. Render day headers in sentence case without `uppercase` and without the year for the current year: `new Intl.DateTimeFormat(locale,{day:'numeric',month:'long'})` → «17 октября», previous years «19 февраля 2025». Shorten the line copy: 'Добавлено: {status}' → '{status}' with the status glyph (the glyph already says it is a status), e.g. «◔ Пройдено · 9/10».

## ux-visual-cover-favourite-wrong-hint — «Фон избранного» says "Отметьте тайтл избранным" to a user with 11 favourites (first favourite has no backdrop), and the banner then stays empty

- category: ux · impact 2 · effort S · confidence verified
- files: src/components/CoverPicker.tsx:125 (`favourite = profile.data?.favorites[0]?.title`), src/components/CoverPicker.tsx:250-265 (tile shows hint when `!favourite?.backdrop`), server/routes/users.ts:101 (`bannerImage = favourites[0]?.title?.backdrop ?? null`), src/components/CoverPicker.tsx:60-95 (Tile hint/caption)
- evidence: comp/cover-crop.png (Settings → Профиль, demo user): tile text «Отметьте тайтл избранным» directly above the caption «Фон избранного · Ведьмак 3: Дикая Охо…». Ведьмак 3 is favourite #1 and has `backdrop: null` (GET /api/titles/steam-292030), while Начало and Игра престолов (also favourites) have backdrops. Picking this preset gives an empty banner. Same card: «Своя картинка» repeats «JPG, PNG или WebP» inside the tile and again as caption, the 4th tile renders narrower/shorter than the other three, and captions are ellipsised («Собирается из вашей …»).
- proposal: on both client and server pick `favorites.find(f => f.title.backdrop)` (fallback: first favourite's poster, blurred like the title hero does). If none has a backdrop, hint «У избранного нет фоновой картинки» instead of the "mark a favourite" prompt. Drop the duplicate format hint inside the upload tile (keep icon + «Загрузить»), make all four tiles share the same `aspect-[16/9] w-full` wrapper, and let captions wrap to 2 lines (`line-clamp-2`) instead of `truncate`.

## ux-visual-settings-soon-placeholders — Settings → Игры spends a full screen on five «Скоро» store cards that do nothing

- category: ux · impact 2 · effort S · confidence verified
- files: src/components/SteamAccount.tsx:399-425 (AccountsList renders a card per STORES entry, non-connectable ones with `<Chip>{t('welcome.soon')}</Chip>`), src/pages/settings/GamesSection.tsx
- evidence: dark/settings-games-0.png: under «Подключённые аккаунты» the Steam card is followed by GOG, Epic Games Store, Microsoft Store, PlayStation Store, Nintendo eShop — five 56 px cards, each only a logo, a name and a «Скоро» chip (~330 px of dead UI, more than the working Steam card). It reads as an unfinished product and pushes nothing useful.
- proposal: render only connectable stores as cards; replace the rest with one muted line under the Steam card: «Скоро: GOG, Epic Games Store, Microsoft Store, PlayStation Store и Nintendo eShop» (`text-sm text-fg-3`, `fmt.list(...)`), or hide them entirely until they work. Same for the welcome screen, which uses the same `welcome.soon` chip.

## ux-visual-onboarding-never-shown — New accounts skip the welcome/onboarding: /register → /welcome → / within one tick

- category: bug · impact 4 · effort S · confidence verified
- files: src/pages/AuthPage.tsx:115-130 (navigate('/welcome') then verify.signIn(user)), src/app/App.tsx:86-95 (GuestOnly renders `<Navigate to={next ?? '/'}>` as soon as the user exists), src/pages/WelcomePage.tsx:97-128
- evidence: own fixtures server, registration through the UI (welcome-check.mjs): main-frame URLs `/register → /welcome → /`, final page is Home («Добрый вечер, Мария · Ваша библиотека пока пуста»); localStorage has no onboarded flag, and opening /welcome by hand afterwards shows the avatar step (interact/A2c-welcome-explicit.png). The navigation to /welcome runs in a router transition, while signIn() is an urgent update, so GuestOnly (still mounted on /register) wins and redirects to '/'. The comment "Navigate first, then sign in: the route change wins over the guest-only guard" is not true in practice. Every new user misses the avatar + stores/Steam step the app was designed around.
- proposal: make the guard aware of fresh accounts instead of racing it: in GuestOnly use `const fallback = location.pathname === '/register' && !isOnboarded(user.id) ? '/welcome' : '/'` and `<Navigate to={safeNext ?? fallback} replace />`; then AuthPage can just call `verify.signIn(user)` (or keep navigate but wrap the sign-in in `startTransition` too). Add an e2e assertion in tests/e2e/helpers.ts `register()` that the URL is /welcome (today the helper only checks the heading with the name, which Home also shows).

## ux-visual-shuffle-empty-overlaps-frame — Shuffle with an empty pool prints the message straight through the selection frame and still advertises «Пробел бросить ещё раз»

- category: visual · impact 2 · effort S · confidence verified
- files: src/pages/ShufflePage.tsx:325-352 (frame always rendered; empty message `absolute inset-0` on top), src/pages/ShufflePage.tsx:355-370 (button + hint), src/i18n/ru.ts (shuffle.emptyLibraryText, pool hint)
- evidence: comp/shuffle-empty-crop.png (new user, «Моя библиотека»): «В библиотеке пока нечего выбирать / Добавьте несколько тайтлов в планы или бросьте жребий по популярному.» is drawn across both vertical lines of the 184 px poster frame; below it a disabled grey «Бросить жребий» and «В жребии 0 тайтлов · [Пробел] бросить ещё раз». The text suggests the popular pool but offers no button for it.
- proposal: when `idle && !pool.length` hide the frame (`opacity-0`) and the reel, and render a real EmptyState (icon, title, text) with an action `<Button variant="secondary" onClick={() => setSource('catalog')}>Бросить по популярному</Button>` (or «Открыть обзор» when the user is a guest). Hide the «Пробел…» hint when the pool is empty, and say «бросить» (not «ещё раз») before the first spin.
