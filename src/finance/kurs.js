const { fetchHTML, cheerio, ok, fail } = require('../utils')

/*
 * Kurs satu mata uang ke IDR dari Kemenkeu
 * @param {string} kode - usd | eur | gbp | jpy | sgd | myr | aud | cny | sar | dll
 */
const kurs = async (kode = 'usd') => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML('https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak')
      const $ = cheerio.load(html)
      const target = kode.toUpperCase()
      let result = null

      $('table tbody tr').each((_, el) => {
        const cols = $(el).find('td')
        if (cols.length < 3) return
        const fullText  = $(cols[1]).text().trim()
        const kodeMatch = fullText.match(/\b([A-Z]{3})\b/)
        const kodeM     = kodeMatch ? kodeMatch[1] : ''
        if (kodeM !== target) return
        const nama = fullText.split('\n')[0].trim()
        result = {
          mata_uang: nama,
          kode: kodeM,
          nilai: $(cols[2]).text().trim(),
          perubahan: $(cols[3]).text().trim() || null,
          sumber: 'Kemenkeu',
        }
      })

      if (!result) return resolve(fail(`Kurs ${target} tidak ditemukan`))
      resolve(ok(result))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/* Semua kurs dari Kemenkeu */
const kursAll = async () => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML('https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak')
      const $ = cheerio.load(html)
      const data = []

      $('table tbody tr').each((_, el) => {
        const cols = $(el).find('td')
        if (cols.length < 3) return
        const fullText  = $(cols[1]).text().trim()
        const kodeMatch = fullText.match(/\b([A-Z]{3})\b/)
        const kode      = kodeMatch ? kodeMatch[1] : ''
        const nama      = fullText.split('\n')[0].trim()
        const nilai     = $(cols[2]).text().trim()
        const perubahan = $(cols[3]).text().trim() || null
        if (nama && kode) data.push({ mata_uang: nama, kode, nilai, perubahan })
      })

      if (!data.length) return resolve(fail('Data kurs tidak ditemukan'))
      resolve(ok({ sumber: 'Kemenkeu', data }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { kurs, kursAll }
