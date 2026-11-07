// Copy for the moods on Discover («Уютное», «Напряжённое»…), see src/lib/moods.ts.
// ru is the source of truth; every locale provides exactly the same keys (parity.test.ts).

export const moodsRu = {
  title: 'Под настроение',
  all: 'Все настроения',
  empty: 'Под это настроение пока ничего не нашлось.',
  cozy: 'Уютное',
  cozyHint: 'Комедии, семейное, романтика',
  laugh: 'Посмеяться',
  laughHint: 'Комедии без ужасов',
  tense: 'Напряжённое',
  tenseHint: 'Триллеры, ужасы, детективы',
  mind: 'Взорвать мозг',
  mindHint: 'Фантастика, загадки, психология',
  epic: 'Эпичное',
  epicHint: 'Фэнтези, приключения, большие миры',
  short: 'Коротко, на вечер',
  shortHint: 'Фильмы до 1 ч 45 мин, короткие серии, быстрые игры',
}

export const moodsEn: typeof moodsRu = {
  title: 'In the mood for',
  all: 'All moods',
  empty: 'Nothing fits this mood yet.',
  cozy: 'Cozy',
  cozyHint: 'Comedy, family, romance',
  laugh: 'A good laugh',
  laughHint: 'Comedies, no horror',
  tense: 'Tense',
  tenseHint: 'Thrillers, horror, mysteries',
  mind: 'Mind-bending',
  mindHint: 'Sci-fi, puzzles, the psychological',
  epic: 'Epic',
  epicHint: 'Fantasy, adventure, big worlds',
  short: 'Short, for tonight',
  shortHint: 'Films under 1 h 45 min, short episodes, quick games',
}
