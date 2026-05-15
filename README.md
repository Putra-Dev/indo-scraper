# indo-scraper

Scraper Indonesia untuk Node.js. Mengambil data dari berbagai sumber publik tanpa API key.

[![npm](https://img.shields.io/npm/v/indo-scraper)](https://www.npmjs.com/package/indo-scraper)
[![npm downloads](https://img.shields.io/npm/dm/indo-scraper)](https://www.npmjs.com/package/indo-scraper)
[![license](https://img.shields.io/npm/l/indo-scraper)](LICENSE)

## Install

```bash
npm install indo-scraper
```

## Usage

```js
const Scraper = require('indo-scraper')
const s = new Scraper()

const result = await s.kompas({ channel: 'news', limit: 5 })
```

Semua method mengembalikan format yang sama:

```js
// sukses
{ creator: 'Angga Putra', status: true, data: { ... } }

// gagal
{ creator: 'Angga Putra', status: false, msg: 'error message' }
```

---

## API Reference

### News

#### `kompas(options)`

```js
await s.kompas({ channel: 'news', page: 1, limit: 20, date: '15/05/2026' })
```

| Option | Default | Values |
|--------|---------|--------|
| `channel` | `'news'` | `news` `regional` `megapolitan` `money` `sport` `tekno` `sains` `travel` `food` `health` |
| `page` | `1` | number |
| `limit` | `20` | number |
| `date` | `null` | `dd/mm/yyyy` |

```js
// response
{
  creator: 'Angga Putra',
  status: true,
  data: [
    {
      title: 'Pemerintah Umumkan Kebijakan Baru Energi Terbarukan',
      url: 'https://nasional.kompas.com/read/2026/05/15/...',
      image: 'https://asset.kompas.com/crops/...',
      category: 'News',
      date: '2026-05-15T08:30:00+07:00',
      source: 'kompas'
    },
    // ...
  ]
}
```

```js
await s.kompasArticle(url)
```

```js
// response
{
  creator: 'Angga Putra',
  status: true,
  data: {
    title: 'Pemerintah Umumkan Kebijakan Baru Energi Terbarukan',
    author: 'Ardito Ramadhan',
    date: '2026-05-15T08:30:00+07:00',
    category: 'Nasional',
    description: 'Pemerintah resmi mengumumkan...',
    thumbnail: 'https://asset.kompas.com/crops/...',
    content: 'Paragraf 1...\n\nParagraf 2...',
    paragraphs: ['Paragraf 1...', 'Paragraf 2...']
  }
}
```

---

#### `detik(options)`

```js
await s.detik({ channel: 'news', page: 1, limit: 20 })
```

| Option | Default | Values |
|--------|---------|--------|
| `channel` | `'news'` | `news` `finance` `hot` `sport` `inet` `oto` `health` `travel` `food` |

```js
await s.detikSearch(query, limit)   // search articles
await s.detikArticle(url)           // full article content
```

---

#### `cnn(options)`

```js
await s.cnn({ category: 'nasional', limit: 20 })
```

| Option | Default | Values |
|--------|---------|--------|
| `category` | `'nasional'` | `nasional` `internasional` `ekonomi` `olahraga` `teknologi` `hiburan` `gaya_hidup` |

```js
await s.cnnArticle(url)
```

---

#### `tribun(options)`

```js
await s.tribun({ channel: 'nasional', page: 1, limit: 20 })
```

| Option | Default | Values |
|--------|---------|--------|
| `channel` | `'nasional'` | `nasional` `regional` `internasional` `sport` `bisnis` `seleb` `lifestyle` `techno` `otomotif` |

```js
await s.tribunArticle(url)
```

---

#### `liputan6(options)`

```js
await s.liputan6({ channel: 'news', page: 1, limit: 20 })
```

| Option | Default | Values |
|--------|---------|--------|
| `channel` | `'news'` | `news` `bisnis` `bola` `tekno` `showbiz` `otomotif` `health` `lifestyle` `global` |

```js
await s.liputan6Article(url)
```

---

#### `okezone(options)`

```js
await s.okezone({ channel: 'nasional', page: 1, limit: 20 })
```

| Option | Default | Values |
|--------|---------|--------|
| `channel` | `'nasional'` | `nasional` `economy` `sports` `techno` `celebrity` `lifestyle` `otomotif` `health` |

```js
await s.okenewsArticle(url)
```

---

#### `antara(options)`

```js
await s.antara({ channel: 'nasional', page: 1, limit: 20 })
```

| Option | Default | Values |
|--------|---------|--------|
| `channel` | `'nasional'` | `nasional` `hukum` `ekonomi` `olahraga` `hiburan` `internasional` `tekno` `otomotif` |

```js
await s.antaraArticle(url)
```

---

#### `republika(options)`

```js
await s.republika({ channel: 'nasional', page: 1, limit: 20 })
```

| Option | Default | Values |
|--------|---------|--------|
| `channel` | `'nasional'` | `nasional` `internasional` `ekonomi` `olahraga` `hiburan` `tekno` `gaya_hidup` |

```js
await s.republikaArticle(url)
```

> Semua scraper news (detik, cnn, tribun, liputan6, okezone, antara, republika) mengembalikan struktur yang sama dengan `kompas` — array of articles dan `Article()` mengembalikan object artikel lengkap dengan `title`, `author`, `date`, `content`, `paragraphs`, dll.

---

### BMKG

#### `bmkgGempa()` / `bmkgGempaTerkini()` / `bmkgGempaDirasakan()`

```js
await s.bmkgGempa()           // gempa terbaru (1 data)
await s.bmkgGempaTerkini()    // 15 gempa terkini — returns array
await s.bmkgGempaDirasakan()  // gempa yang dirasakan masyarakat — returns array
```

```js
// response bmkgGempa()
{
  creator: 'Angga Putra',
  status: true,
  data: {
    tanggal: '15 Mei 2026',
    jam: '09:47:30 WIB',
    datetime: '2026-05-15T02:47:30+00:00',
    koordinat: '-2.34,128.12',
    lintang: '2.34 LS',
    bujur: '128.12 BT',
    magnitude: '4.5',
    kedalaman: '10 km',
    wilayah: 'Pusat gempa berada di darat 23 km BaratLaut Ternate',
    potensi: 'Gempa ini dirasakan untuk diwaspadai',
    dirasakan: 'II-III MMI',
    shakemap: 'https://data.bmkg.go.id/DataMKG/TEWS/20260515094730.mmi.jpg'
  }
}
```

---

#### `bmkgCuaca(kota)`

```js
await s.bmkgCuaca('jakarta')
```

Available: `jakarta` `bandung` `surabaya` `medan` `semarang` `makassar` `yogyakarta` `palembang` `denpasar` `balikpapan`

```js
// response
{
  creator: 'Angga Putra',
  status: true,
  data: {
    lokasi: {
      kecamatan: 'Gambir',
      kotkab: 'Kota Jakarta Pusat',
      provinsi: 'DKI Jakarta'
    },
    prakiraan: [
      {
        datetime: '2026-05-15 06:00:00',
        cuaca: 'Berawan',
        suhu: 28,
        suhu_min: 25,
        suhu_max: 32,
        kelembaban: 80,
        angin: 10,
        arah_angin: 'S',
        icon: 'https://api.bmkg.go.id/asset/cuaca/3.svg'
      },
      // per 3 jam, total ~16 item
    ]
  }
}
```

---

### Finance

#### `saham(kode)`

```js
await s.saham('ihsg')   // IHSG
await s.saham('bbca')   // saham BCA
await s.saham('GOTO')   // kode IDX langsung
```

Kode bawaan: `ihsg` `bbca` `bbri` `bmri` `tlkm` `asii` `goto` `unvr` `hmsp` `antm` `indf` `klbf`

```js
// response saham('bbca')
{
  creator: 'Angga Putra',
  status: true,
  data: {
    kode: 'BBCA',
    nama: 'Bank Central Asia Tbk',
    close: 9850,
    open: 9800,
    high: 9900,
    low: 9750,
    volume: 12540000,
    perubahan_pct: 0.51,
    perubahan_abs: 50,
    performa: {
      '1W': 1.23,
      '1M': -2.45,
      '3M': 5.67,
      '6M': 8.12,
      '1Y': 12.34,
      'YTD': 3.21
    },
    sumber: 'TradingView'
  }
}
```

```js
// response saham('ihsg')
{
  creator: 'Angga Putra',
  status: true,
  data: {
    kode: 'IHSG',
    symbol: 'IDX:COMPOSITE',
    open: 7102.34,
    high: 7145.67,
    low: 7089.12,
    close: 7130.45,
    volume: 18750000000,
    update: '2026-05-15T09:00:00.000Z',
    sumber: 'TradingView'
  }
}
```

```js
await s.sahamList(50)   // daftar saham by market cap, default 50, max 906
```

```js
// response sahamList()
{
  creator: 'Angga Putra',
  status: true,
  data: {
    total: 906,
    tampil: 50,
    data: [
      {
        kode: 'BBCA',
        nama: 'Bank Central Asia Tbk',
        close: 9850,
        perubahan_pct: 0.51,
        perubahan_abs: 50,
        volume: 12540000,
        market_cap: 241350000000000,
        performa: { '1W': 1.23, '1M': -2.45, '1Y': 12.34, 'YTD': 3.21 }
      },
      // ...
    ]
  }
}
```

---

#### `kurs(kode)` / `kursAll()`

```js
await s.kurs('usd')
await s.kursAll()
```

Mendukung semua kode ISO 4217. Sumber: fiskal.kemenkeu.go.id.

```js
// response kurs('usd')
{
  creator: 'Angga Putra',
  status: true,
  data: {
    mata_uang: 'Dolar Amerika Serikat',
    kode: 'USD',
    nilai: '16.285',
    perubahan: '+25',
    sumber: 'Kemenkeu'
  }
}

// response kursAll()
{
  creator: 'Angga Putra',
  status: true,
  data: {
    sumber: 'Kemenkeu',
    data: [
      { mata_uang: 'Dolar Amerika Serikat', kode: 'USD', nilai: '16.285', perubahan: '+25' },
      { mata_uang: 'Euro',                  kode: 'EUR', nilai: '17.842', perubahan: '-10' },
      // ...
    ]
  }
}
```

---

#### `emasAntam()` / `emasHarga()`

```js
await s.emasAntam()   // harga emas Antam per gram (logammulia.com)
await s.emasHarga()   // harga emas dunia dalam IDR, Ounce & Gram
```

```js
// response emasAntam()
{
  creator: 'Angga Putra',
  status: true,
  data: {
    tanggal: 'Harga Emas 15 Mei 2026',
    data: [
      { berat: '0.5 gr',  harga_dasar: 'Rp 875.000',    harga_termasuk_pajak: 'Rp 913.000' },
      { berat: '1 gr',    harga_dasar: 'Rp 1.650.000',  harga_termasuk_pajak: 'Rp 1.722.000' },
      { berat: '2 gr',    harga_dasar: 'Rp 3.280.000',  harga_termasuk_pajak: 'Rp 3.424.000' },
      { berat: '5 gr',    harga_dasar: 'Rp 8.150.000',  harga_termasuk_pajak: 'Rp 8.517.000' },
      // ...
    ]
  }
}
```

---

#### `bbm()`

```js
await s.bbm()
```

```js
// response
{
  creator: 'Angga Putra',
  status: true,
  data: {
    update: 'Last Updated: 15 Mei 2026',
    harga: [
      { jenis: 'Pertalite',  harga: 'Rp 10.000/Liter' },
      { jenis: 'Pertamax',   harga: 'Rp 12.500/Liter' },
      { jenis: 'Dexlite',    harga: 'Rp 13.950/Liter' },
      { jenis: 'Pertamina Dex', harga: 'Rp 14.550/Liter' }
    ],
    provinsi: [
      { Provinsi: 'DKI Jakarta', Pertalite: 'Rp 10.000', Pertamax: 'Rp 12.500' },
      // ...
    ]
  }
}
```

---

### Info

#### `cekNomor(nomor)`

Cek provider nomor HP Indonesia. Bekerja offline, tanpa network request.

```js
await s.cekNomor('08123456789')
await s.cekNomor('+628123456789')
await s.cekNomor('628123456789')
```

```js
// response (semua format input menghasilkan output yang sama)
{
  creator: 'Angga Putra',
  status: true,
  data: {
    nomor_asli: '08123456789',
    nomor: '08123456789',
    prefix: '0812',
    provider: 'Telkomsel',
    panjang: 11
  }
}
```

Provider yang dikenali: Telkomsel, Indosat, XL, AXIS, Smartfren, Three.

---

#### `cekResi(kurir, noResi)`

```js
await s.cekResi('jne', 'JNEX12345678')
```

Kurir: `jne` `jnt` `j&t` `sicepat` `pos` `anteraja` `wahana` `tiki` `ninja` `lion`

```js
// response
{
  creator: 'Angga Putra',
  status: true,
  data: {
    kurir: 'jne',
    noResi: 'JNEX12345678',
    status: 'DELIVERED',
    history: [
      { tanggal: '15/05/2026 10:30', keterangan: 'DELIVERED',    lokasi: 'Jakarta Selatan' },
      { tanggal: '15/05/2026 07:00', keterangan: 'WITH COURIER', lokasi: 'Jakarta' },
      { tanggal: '14/05/2026 20:00', keterangan: 'RECEIVED AT ORIGIN GATEWAY', lokasi: 'Surabaya' }
    ]
  }
}
```

---

### Downloader

#### `instagram(url)`

```js
await s.instagram('https://www.instagram.com/p/...')
```

```js
// response (foto / video / reels)
{
  creator: 'Angga Putra',
  status: true,
  data: {
    url: 'https://www.instagram.com/p/...',
    medias: [
      {
        type: 'video',
        url: 'https://cdn.rapidcdn.app/...',
        thumbnail: 'https://...'
      }
    ]
  }
}

// carousel — medias berisi lebih dari 1 item
{
  creator: 'Angga Putra',
  status: true,
  data: {
    url: 'https://www.instagram.com/p/...',
    medias: [
      { type: 'image', url: 'https://...', thumbnail: 'https://...' },
      { type: 'image', url: 'https://...', thumbnail: 'https://...' },
      { type: 'video', url: 'https://...', thumbnail: 'https://...' }
    ]
  }
}
```

```js
await s.tiktok(url)      // video TikTok tanpa watermark
await s.spotify(url)     // track atau playlist Spotify
await s.facebook(url)    // video Facebook
await s.mediafire(url)   // direct link Mediafire
await s.gdrive(url)      // direct link Google Drive
```

---

### Tools

#### `ssweb(url, device)`

Screenshot website via Microlink API.

```js
await s.ssweb('https://example.com')
await s.ssweb('https://example.com', 'mobile')
```

Device: `desktop` (default) `mobile` `tablet` `hd` `4k`

---

#### `simsimi(text)`

```js
await s.simsimi('halo, apa kabar?')
```

---

## Extending

Untuk menambah scraper baru:

**1. Buat file di folder yang sesuai**, contoh `src/news/bisnis.js`:

```js
const { fetchHTML, cheerio, ok, fail } = require('../utils')

const bisnis = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML('https://bisnis.com/...')
      const $ = cheerio.load(html)
      // parse data ...
      resolve(ok(data))
    } catch (e) {
      resolve(fail(e))
    }
  })
}

module.exports = { bisnis }
```

**2. Daftarkan di `index.js`:**

```js
require('./src/news/bisnis'),
```

Utils yang tersedia: `fetchHTML` `fetchJSON` `cheerio` `parseLdJson` `parseThumbnail` `parseParagraphs` `ok` `fail`

---

## Notes

- Scraper berbasis HTML parsing. Jika `status: false` dan pesan "Data tidak ditemukan", kemungkinan selector CSS perlu diperbarui karena situs mengubah struktur HTML-nya.
- BMKG Gempa menggunakan mirror Google Storage agar tidak terkena rate limit endpoint utama BMKG.
- Data saham dan IHSG dari TradingView Scanner — tanpa API key, tanpa rate limit.
- Kurs dari Kemenkeu (fiskal.kemenkeu.go.id) — data resmi pemerintah.

## License

MIT © Angga Putra
