// Applies the saved theme and language before first paint (no flash). Kept tiny and CSP-safe.
;(function () {
  var root = document.documentElement
  try {
    var theme = localStorage.getItem('mediashelf:theme') || 'system'
    var dark =
      theme === 'dark' ||
      (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('dark', dark)
    root.dataset.theme = dark ? 'dark' : 'light'
    // A first visit takes the first browser language the interface has (all seven are complete),
    // English otherwise.
    var known = ['ru', 'en', 'uk', 'de', 'es', 'fr', 'ro']
    var locale = localStorage.getItem('mediashelf:locale')
    if (known.indexOf(locale) < 0) {
      locale = 'en'
      var wanted =
        navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language || '']
      for (var i = 0; i < wanted.length; i++) {
        var code = String(wanted[i]).toLowerCase().split('-')[0]
        if (known.indexOf(code) >= 0) {
          locale = code
          break
        }
      }
    }
    root.lang = locale
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#0a0a0a' : '#f5f5f5')
  } catch (error) {
    /* storage unavailable: keep defaults */
  }
})()
