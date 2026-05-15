global.creator = 'Angga Putra'

module.exports = class Scraper {
  constructor() {
    Object.assign(this,
      // ── News ──────────────────────────────────────────────────────────────
      require('./src/news/kompas'),
      require('./src/news/detik'),
      require('./src/news/cnn'),
      require('./src/news/tribun'),
      require('./src/news/liputan6'),
      require('./src/news/okezone'),
      require('./src/news/antara'),
      require('./src/news/republika'),
      // ── BMKG ──────────────────────────────────────────────────────────────
      require('./src/bmkg/gempa'),
      require('./src/bmkg/cuaca'),
      // ── Finance ───────────────────────────────────────────────────────────
      require('./src/finance/saham'),
      require('./src/finance/kurs'),
      require('./src/finance/emas'),
      require('./src/finance/bbm'),
      // ── Info ──────────────────────────────────────────────────────────────
      require('./src/info/cekno'),
      require('./src/info/resi'),
      // ── Downloader ────────────────────────────────────────────────────────
      require('./src/downloader/instagram'),
      require('./src/downloader/tiktok'),
      require('./src/downloader/mediafire'),
      require('./src/downloader/facebook'),
      require('./src/downloader/spotify'),
      //require('./src/downloader/tiktokSlide'),
      // ── Tools ────────────────────────────────────────────────────────
      require('./src/tools/ssweb'),
      require('./src/tools/simsimi'),
    )
  }
}
