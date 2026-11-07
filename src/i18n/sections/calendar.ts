// Copy for the month calendar of episodes (/calendar).
// ru is the source of truth; every locale provides exactly the same keys (parity.test.ts).

export const calendarRu = {
  title: 'Календарь серий',
  previous: 'Предыдущий месяц',
  next: 'Следующий месяц',
  today: 'Сегодня',
  empty: 'В этом месяце серий нет',
  emptyHint: 'Здесь видны серии сериалов и аниме из вашей библиотеки — всё, кроме брошенного.',
  dayEmpty: 'В этот день ничего не выходит',
  episodes: {
    one: '{count} серия',
    few: '{count} серии',
    many: '{count} серий',
    other: '{count} серии',
  },
}

const p = (one: string, other: string) => ({ one, few: other, many: other, other })

export const calendarEn: typeof calendarRu = {
  title: 'Episode calendar',
  previous: 'Previous month',
  next: 'Next month',
  today: 'Today',
  empty: 'No episodes this month',
  emptyHint:
    'Episodes of the series and anime in your library show up here, all but the dropped ones.',
  dayEmpty: 'Nothing airs this day',
  episodes: p('{count} episode', '{count} episodes'),
}
