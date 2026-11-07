# mobile-a11y-i18n findings (audit of /workspace/wt/audit against live demo at :4180)

## mobile-a11y-i18n-hero-actions-overflow — Title hero action row does not wrap: «Трейлер» and «…» are clipped at 320–360 px and the series page widens to 358 px

- category: mobile · impact 4 · effort S · confidence verified
- files: src/pages/TitlePage.tsx:179-200 (inner `<div className="flex items-center gap-2">` at line 186)
- evidence: Playwright, isMobile, DPR 2 (overflow.mjs). Inner row = Favourite 44 + «Оценить» 110 + «Трейлер» ~120 + «…» 44 + gaps = 349 px, available width 288 px at 320 and 328 px at 360. At 320 the series page's layout viewport grows to 358 px (`innerWidth` 358 vs `clientWidth` 320), so the whole page gets zoomed out or pans sideways, and the description text is cut at the right edge. On anime/movie the hero clips the row: «Трейлер» is cut and the «…» menu (remove from library, external links) can't be reached. At 360 px the row still ends at x=385 (anime, series). Screenshot: ovf-320-series.png.
- proposal: Make the inner row wrap (`flex flex-wrap items-center gap-2`). Better: on phones, show the trailer as an icon button (`size="icon-lg"`, `aria-label={t('title.trailer')}`, label `max-sm:sr-only`) so heart / rate / trailer / … fit on one 44 px row (4×44 + 3×8 = 200 px). Add a 320 px Playwright check that asserts `scrollWidth <= clientWidth` on every title kind.

## mobile-a11y-i18n-sectionheader-nowrap — SectionHeader can't wrap: the game page's «Прохождения» header widens the page to 363 px at 320 px (and 3 px at 360)

- category: mobile · impact 3 · effort S · confidence verified
- files: src/components/ui/misc.tsx:177-181 (SectionHeader), used at src/pages/title/PlaythroughsSection.tsx:290-310 (action «Добавить прохождение», 198 px)
- evidence: at 320 px on /title/steam-292030: h2 «Прохождения» (min-content ~125 px) + gap 16 + button 198 px > 288 px. The section measures 347 px, `documentElement.scrollWidth` is 363 and the layout viewport grows to 363 (fullPage screenshot m-320-dark-game.png is 363 CSS px wide). At 360 the page is still 3 px too wide (scrollWidth 363). Every SectionHeader with a wide action has the same risk.
- proposal: In SectionHeader use `flex flex-wrap items-end justify-between gap-x-4 gap-y-2` and give the h2 `min-w-0 break-words`. For the playthroughs action, use the short label «Добавить» on phones (`<span className="max-sm:sr-only">…</span>`, or a `playthroughs.addShort` key).

## mobile-a11y-i18n-partial-locales — uk/de/es/fr/ro are 39.5 % translated, but both language pickers list them as equals; the title page, palette and year story come out in English under `lang="uk"`

- category: i18n · impact 4 · effort M · confidence verified
- files: src/i18n/index.tsx:33-34 (falls back to `en`), src/i18n/uk.ts, de.ts, es.ts, fr.ts, ro.ts (365 lines each vs 777 in en.ts), src/pages/settings/AppearanceSection.tsx:11-20, src/app/UserMenu.tsx:114-121, src/app/CommandPalette.tsx:123-127, src/i18n/en.ts:715
- evidence: script i18n-parity.mjs: ru/en have 768 leaves each, identical key sets and {var} sets. Each partial locale has 303/768 (39.5 %). Sections with zero translations: title(61), episodes(22), playthroughs(16), palette(17), year(25), welcome(26), steamConnect(42), profileLook(35), externalImport(11), airing(8), offers(9), activity(7), count(8), achievements(5), verify(4). Own server, user registered with locale uk (own.mjs): /title/series-tt0944947 shows «Серіал · 2 seasons … Дивлюся · Rate · Description · Episodes · 0 of 12 watched · Up next · Mark as watched · Season 1», /stats shows «Статистика · 0 favorites · 0 rated · Your 2026 in MediaShell · У бібліотеці · +4 this year». `document.documentElement.lang` is `uk` throughout, so screen readers read the English strings with Ukrainian pronunciation rules. The palette's only language command for a uk/de user is «Переключить на русский», because en.ts holds the Russian text; it switches to ru (`locale === 'ru' ? 'en' : 'ru'`). Screenshots: loc-uk-series.png, loc-uk-game.png, loc-uk-stats.png, loc-uk-palette.png. Both pickers (Settings → Appearance and the account menu) show all seven languages with no hint that five are partial.
- proposal: (1) Present the partial locales honestly: in LANGUAGE_OPTIONS and the UserMenu radio list add a «Beta · 40 %» suffix (computed at build time from leaf counts), or hide them behind a «More languages (partial)» group. Better still, finish the five missing sections first. (2) Choose the fallback per locale: `uk → ru` is not acceptable for everyone, so keep en but wrap fallback strings in `<span lang="en">`: have `translate()` return a marker when it fell back, and let a `<T>` helper apply the lang attribute. At minimum, set `lang` to the language that actually dominates the page. (3) Replace the palette toggle with «Язык…/Language…», which opens the picker, or label it in the target language («Русский») and add a «Back to <current>» item. (4) Add the parity script to CI: fail if ru/en differ, and print the coverage of the partial locales.

## mobile-a11y-i18n-toast-over-tabbar — Toasts (with the «Вернуть» Undo action) overlap the bottom tab bar on phones with a home indicator

- category: mobile · impact 3 · effort S · confidence verified
- files: src/app/App.tsx:195-200 (`mobileOffset={{ bottom: 76 }}`), src/app/Sidebar.tsx:222-224 (tab bar `h-14` + `pb-[env(safe-area-inset-bottom)]`)
- evidence: the tab bar is 56 px + env(safe-area-inset-bottom), which is 34 px on Face-ID iPhones in a standalone PWA, so it is 90 px tall. Toasts sit a fixed 76 px from the bottom. With a 34 px inset simulated on the tab bar at 390×844 (own.mjs), the toast's bottom edge is y=768 and the tab bar's top is y=753: a 15 px overlap that covers the tab icons (screenshot toast-tabbar-390.png). The undo toast's «Вернуть» button and the tab bar then compete for the same taps.
- proposal: `mobileOffset={{ bottom: 'calc(56px + 12px + env(safe-area-inset-bottom))' }}` (sonner passes strings through as CSS). Better: define `--tabbar-h: calc(3.5rem + env(safe-area-inset-bottom))` once, use it for the tab bar, the toast offset, BackToTop's `bottom-20` (Sidebar/AppShell) and PageBody's `pb-24`, so all four stay in sync.

## mobile-a11y-i18n-palette-focus-loss — Closing the command palette drops keyboard focus to <body> (every entry point)

- category: a11y · impact 3 · effort S · confidence verified
- files: src/app/CommandPalette.tsx:52-55, 180-186; src/app/AppShell.tsx:136-151, 176-180
- evidence: focusret.mjs on own server, 1280 px. Sidebar «Поиск Ctrl K» → Enter → Escape: activeElement = BODY. Sidebar «Добавить» → Escape: BODY. Ctrl+K from the focused library search box → Escape: BODY. For comparison, the account menu, status menu, rating popover, title «Ещё» menu and the library Sort select all return focus to their trigger. Keyboard and screen-reader users lose their place, and the next Tab starts again at the skip link (about 15 stops before main on a title page).
- proposal: remember the opener in AppShell: `const opener = useRef<HTMLElement|null>(null)` and `openPalette = (mode) => { opener.current = document.activeElement as HTMLElement; setPalette(...) }`, the same for the Ctrl+K and '/' hotkeys. Pass it to CommandPalette and set `onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.isConnected ? opener.current.focus() : document.getElementById('main')?.focus() }}` on `D.Content` (give `<main>` `tabIndex={-1}`). Add an e2e assertion next to the existing palette tests.

## mobile-a11y-i18n-tablet-invisible-quick-add — On touch tablets the poster's quick-add «+» is invisible but tappable, so tapping a poster corner silently adds the title

- category: mobile · impact 3 · effort S · confidence verified
- files: src/components/TitleCard.tsx:107-118 (className at line 114: `opacity-0 … group-hover/card:opacity-100 max-md:hidden`)
- evidence: tablet.mjs, own server, 1024×768, isMobile + hasTouch. The «Добавить в библиотеку: Cyberpunk 2077» button has opacity 0, pointer-events auto, and `matchMedia('(hover: none)')` is true. `elementFromPoint` at the poster's top-right corner returns the button. One tap there changed the library from 4 to 5 entries and stayed on /discover instead of opening the title. Screenshot: tablet-invisible-add.png. iPad and Android tablets are ≥768 px, so `max-md:hidden` doesn't protect them.
- proposal: show the button on touch devices instead of relying on hover: `[@media(hover:none)]:opacity-100` (or Tailwind 4 `pointer-coarse:opacity-100`). Also make it non-interactive while invisible: `pointer-events-none group-hover/card:pointer-events-auto group-focus-within/card:pointer-events-auto [@media(hover:none)]:pointer-events-auto`. Give it a 44 px hit area on coarse pointers (`pointer-coarse:size-9` plus a transparent `before:-inset-1.5`).

## mobile-a11y-i18n-rating-scale-targets — The 1–10 rating scale gives 22×28 px targets at 320 px (28×28 at 360–430), and tapping the current score silently clears the rating

- category: mobile · impact 3 · effort S · confidence verified
- files: src/components/StatusControls.tsx:159-225 (radiogroup `flex items-center gap-1`, buttons `size-7`, `onClick={() => onChange(value === score ? null : score)}`)
- evidence: mobile.mjs. At 320 px every «N из 10» radio measures 22×28 on movie, series, game and anime pages: 10 targets below the WCAG 2.5.8 24 px minimum, with 4 px gaps. At 360/390/430 they are 28×28, far below the 44 px touch guideline. Light screenshot l-360-series.png shows the cramped row in «В библиотеке». A mis-tap on the selected number clears the rating with no confirmation.
- proposal: on phones render a 5×2 grid (`grid grid-cols-5 gap-1.5 sm:flex sm:gap-1`, buttons `h-11 w-full sm:size-7`). Don't toggle to null on re-tap: add an explicit «Сбросить оценку» ghost button, or clear only via Backspace/Delete. For the APG radio pattern, make arrow keys select as well as move focus (call `onChange(target)` in onKeyDown), or switch to `role="toolbar"` with `aria-pressed` buttons.

## mobile-a11y-i18n-episode-row-targets — Episode rows: the mark target is a 24 px circle, the row isn't tappable, and every row's menu is called just «Ещё»

- category: a11y · impact 3 · effort S · confidence verified
- files: src/pages/title/EpisodesSection.tsx:324-375 (checkbox `size-6` at line 339, menu trigger `size="icon-xs"` + `aria-label={t('common.more')}` at lines 368-373)
- evidence: mobile.mjs at 390: each episode checkbox is 24×24 and each «Ещё» trigger 28×28 (opacity 60 %). On /title/anime-16498 there are 73 targets under 44 px and dozens of buttons with the identical name «Ещё», so in a screen-reader element list they're indistinguishable. Marking episodes is the most frequent action on series and anime pages.
- proposal: make the whole row the toggle: `<label>` wrapping a visually hidden `<input type=checkbox>`, or a full-width `<button role="checkbox">` holding the number, name and date, with the «…» menu outside it. Alternatively enlarge the hit area with `relative before:absolute before:-inset-2.5 before:content-['']`. Name the menu per episode: `aria-label={t('episodes.moreFor', { code })}` → «Ещё: S1 · E3» / «More: S1 · E3». Make the «…» trigger `size-9` on coarse pointers.

## mobile-a11y-i18n-light-fg3-contrast — Light theme tertiary text (#737373) is below 4.5:1 on the page, sidebar, cards and inputs

- category: a11y · impact 3 · effort S · confidence verified
- files: src/styles/index.css:34 (`--fg-3: #737373`), DESIGN.md token table, src/components/ui/input.tsx:14 (`placeholder:text-fg-3` on `bg-raised`), src/app/Sidebar.tsx:229-236 (tab bar inactive labels `text-[10px] … text-fg-3`)
- evidence: contrast.mjs computed from the tokens. Light fg-3 is 4.35:1 on bg #f5f5f5 (sidebar and mobile page background), 4.31:1 on raised #f4f4f4 (cards, inputs, episode rows; 4.46 on raised/60) and 3.87:1 on a hovered raised row. It passes only on pure white (4.74). There are 144 `text-fg-3` usages in TSX, many at 11–12 px (episode dates, card meta, captions, 10 px tab bar labels). Dark passes everywhere (5.1–6.1:1). fg-2 is fine (≥7.7).
- proposal: light `--fg-3: #666666`: 5.2:1 on raised, 5.3 on bg, 5.7 on white, still clearly lighter than fg-2 #4d4d4d. Raise the tab bar labels to 11 px (`text-2xs`) and `font-medium`. Update the DESIGN.md table and add a unit test that recomputes these ratios from index.css.

## mobile-a11y-i18n-focus-ring-controls — Keyboard focus on inputs, selects, the slider and search fields is a 1.2–1.9:1 halo (fails WCAG 1.4.11)

- category: a11y · impact 3 · effort S · confidence verified
- files: src/components/ui/input.tsx:13-18 (fieldBase: `outline-none … focus:ring-line-strong focus:shadow-[0_0_0_4px_var(--active)]`), src/components/ui/select.tsx:41, src/components/ui/slider.tsx:41, src/pages/LibraryPage.tsx:201, src/pages/DiscoverPage.tsx:337; compare src/components/ui/button.tsx:57
- evidence: buttons and links get a solid 2 px `--fg` outline. Form controls remove the outline and show only a 20 % alpha ring plus a 4 px halo of `--active` (9–10 % alpha). contrast.mjs: the ring is 1.60:1 against the panel in light and 1.86–1.89:1 in dark; the halo is 1.22–1.35:1. WCAG 1.4.11 needs 3:1 for focus indicators. kbd.mjs tab walk on /title/movie-tt1375666: stops 25–33 (date fields, hours, notes textarea) showed only this faint shadow, while every button stop had an OUTLINE.
- proposal: add the Button focus treatment to fieldBase, the Select trigger, the slider thumb and both search inputs: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg` (or `focus:ring-2 focus:ring-fg` for text fields, which match `:focus-visible` on any focus). Keep the halo as decoration.

## mobile-a11y-i18n-year-story-focus — The year story says `aria-modal` but never takes focus: Tab walks into the page behind it, and there are no headings

- category: a11y · impact 3 · effort S · confidence verified
- files: src/pages/YearPage.tsx:336-380 (`role="dialog" aria-modal="true" aria-label=…`, close button at line 357, slide `aria-live` at lines 377-378)
- evidence: kbd.mjs on /stats/year: after load `document.activeElement` is BODY. After 4×Tab focus is on the sidebar's «Поиск Ctrl K» button, outside the story and hidden under the full-screen overlay. The story contains no h1–h3 at all. Screen-reader users are told the page is a modal they can't operate, and keyboard users tab through invisible controls. The known AUDIT item bugs-client-year-story-palette-trap only covers the Ctrl+K/'/' hotkeys.
- proposal: build the story on Radix Dialog: `<D.Root open onOpenChange={(o) => !o && navigate('/stats')}>` with `D.Content onOpenAutoFocus` focusing «Дальше». That brings a focus trap, `inert` on the background and focus return. Without Radix: focus the next/close button on mount, set `inert` on the shell's `<main>`, sidebar and tab bar while open, and return focus to the «Итоги года» link on close. Render each slide's headline as `<h2>` (the slide counter is already announced via aria-live).

## mobile-a11y-i18n-mobile-header-targets — Phone navigation and primary card actions are 28–36 px tall

- category: mobile · impact 2 · effort S · confidence verified
- files: src/app/PageHeader.tsx:54 (home logo link 28×28), :88-98 (search and account 32×32); src/pages/LibraryPage.tsx (view Segmented in the header, 36×28; filter chips 32 px); src/pages/HomePage.tsx («+1 серия» 89×28); src/pages/home/AiringSections.tsx:70-72 («Посмотрел», `size="xs"` = h-7); src/pages/settings/ExternalImport.tsx:96-105 («Где взять файл», 115×18); src/components/ui/button.tsx:15-21 (xs h-7, icon-xs size-7, icon-sm size-8)
- evidence: mobile.mjs smallList at 390 px: «Назад» 32×32, «Поиск» 32×32, «Аккаунт» 32×32, «Главная» 28×28, «Сетка/Список/Доска» 36×28, category chips 32 px tall, «+1 серия» 89×28, «Где взять файл» 115×18. These are the main navigation and the main one-tap actions on phones; the bottom tab bar is the only 44 px+ control set.
- proposal: on coarse pointers give header icon buttons a 44 px box (`pointer-coarse:size-11`, or keep the 32 px visual with `-m-1.5 p-1.5`). Make chips and segmented controls `pointer-coarse:h-10`. Render `xs`/`icon-xs` buttons inside cards as `sm`/`icon` on touch: add a `pointer-coarse:` override in the size map of button.tsx, so every call site benefits.

## mobile-a11y-i18n-sonner-english-label — The toast region is announced in English («Notifications alt+T») in the Russian UI

- category: i18n · impact 2 · effort S · confidence verified
- files: src/app/App.tsx:195-200
- evidence: kbd.mjs: the only live region in the shell is `<section aria-label="Notifications alt+T" aria-live="polite">`, sonner's default `containerAriaLabel`. Every page in RU (and the other locales) exposes this English landmark name. Sonner prefixes the hotkey hint itself.
- proposal: `<Toaster containerAriaLabel={t('common.notifications')} … />` with the new keys ru «Уведомления», en «Notifications». If `closeButton` is ever enabled, also pass `toastOptions={{ closeButtonAriaLabel: t('common.close') }}`.

## mobile-a11y-i18n-gendered-copy — Russian copy addresses the user in the masculine and switches to informal «ты» in places

- category: i18n · impact 2 · effort S · confidence verified
- files: src/i18n/sections/airing.ts:13 (`watched: 'Посмотрел'`, the button on the «Новые серии» cards), src/i18n/ru.ts:682-686 (profile empty state: «Собери свою полку», «Найди игру…», «Отметь, что смотришь или прошёл», «Лучшее отметь сердцем»), src/i18n/ru.ts:626-627 (`welcome.importPartial`: «Добавили {imported} недавние игры» as a plain string with a count)
- evidence: the rest of the UI uses the formal, gender-neutral «Вы»; the line right after the empty-state block (ru.ts:690) reads «Выделите ссылку и скопируйте её». «Посмотрел» and «прошёл» assume a male user. A plain-string count gives «Добавили 1 недавние игры» and «Добавили 5 недавние игры». That key currently has no TSX caller, but it ships in the dictionary.
- proposal: airing button → «Просмотрено» (or «Отметить»); en already says «Watched». Empty state → «Соберите свою полку», «Найдите игру, фильм или сериал», «Отметьте, что смотрите или уже прошли», «Лучшее отметьте сердцем — это Топ-4». Turn `importPartial` into a plural object («{count} недавнюю игру / недавние игры / недавних игр») or delete it. Add a short tone note (formal, gender-neutral) to the header of ru.ts.
