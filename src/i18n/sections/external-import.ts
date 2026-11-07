// Copy for importing lists from other services (Settings → Data).
// ru is the source of truth; en must provide exactly the same keys.

export const externalImportRu = {
  title: 'Импорт из других сервисов',
  text: 'Список аниме из MyAnimeList или Шикимори и оценки или «Буду смотреть» из IMDb. То, что уже есть в библиотеке, останется как было.',
  action: 'Загрузить список',
  howTo: 'Где взять файл',
  malHow: 'MyAnimeList: профиль → Export → Anime List. Подойдёт и архив .xml.gz.',
  shikimoriHow: 'Шикимори: экспорт списка аниме в XML (формат MyAnimeList).',
  imdbHow: 'IMDb: «Ваши оценки» или «Список для просмотра» → «Экспорт» (CSV).',
  unknownFile: 'Не похоже на экспорт MyAnimeList, Шикимори или IMDb.',
  nothing: 'В файле нет фильмов, сериалов или аниме.',
  done: 'Добавлено: {imported}',
  doneDetails:
    'Уже были в библиотеке: {existing}. Пропущено: {skipped}. Названия, описания и фоны подтянутся за пару минут.',
}

export const externalImportEn: typeof externalImportRu = {
  title: 'Import from other services',
  text: 'Your anime list from MyAnimeList or Shikimori, and ratings or the watchlist from IMDb. Anything already in your library stays as it is.',
  action: 'Upload a list',
  howTo: 'Where to get the file',
  malHow: 'MyAnimeList: profile → Export → Anime List. The .xml.gz archive works too.',
  shikimoriHow: 'Shikimori: export the anime list as XML (MyAnimeList format).',
  imdbHow: 'IMDb: Your ratings or Watchlist → Export (CSV).',
  unknownFile: 'This does not look like a MyAnimeList, Shikimori or IMDb export.',
  nothing: 'The file has no movies, series or anime.',
  done: 'Added: {imported}',
  doneDetails:
    'Already in your library: {existing}. Skipped: {skipped}. Names, descriptions and backdrops fill in within a couple of minutes.',
}
