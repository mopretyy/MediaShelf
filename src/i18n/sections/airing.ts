// Copy for the personal episode feed on Home: fresh episodes and what airs soon.
// ru is the source of truth; en must provide exactly the same keys.

export const airingRu = {
  freshTitle: 'Новые серии',
  aired: 'Вышла {when}',
  more: {
    one: 'и ещё {count} серия',
    few: 'и ещё {count} серии',
    many: 'и ещё {count} серий',
    other: 'и ещё {count} серии',
  },
  watched: 'Посмотрел',
  upcomingTitle: 'Скоро выйдет',
  premiere: 'Премьера сезона',
  showAll: 'Показать всё',
  showLess: 'Свернуть',
  badge: {
    one: '{count} новая серия',
    few: '{count} новые серии',
    many: '{count} новых серий',
    other: '{count} новой серии',
  },
}

export const airingEn: typeof airingRu = {
  freshTitle: 'New episodes',
  aired: 'Aired {when}',
  more: {
    one: 'and {count} more episode',
    few: 'and {count} more episodes',
    many: 'and {count} more episodes',
    other: 'and {count} more episodes',
  },
  watched: 'Watched',
  upcomingTitle: 'Coming up',
  premiere: 'Season premiere',
  showAll: 'Show all',
  showLess: 'Show less',
  badge: {
    one: '{count} new episode',
    few: '{count} new episodes',
    many: '{count} new episodes',
    other: '{count} new episodes',
  },
}
