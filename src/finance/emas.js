const { fetchHTML, cheerio, ok, fail } = require('../utils')

/* Harga emas Antam dari logammulia.com */
const emasAntam = async () => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML('https://www.logammulia.com/id/harga-emas-hari-ini')
      const $ = cheerio.load(html)
      const data = []
      const tanggal = $("h2.ngc-title:contains('Harga Emas')").first().text().trim()
      $('table').first().find('tbody tr').each((_, el) => {
        const cols = $(el).find('td')
        if (cols.length < 3) return
        const berat       = $(cols[0]).text().trim()
        const harga_dasar = $(cols[1]).text().trim()
        const harga_pajak = $(cols[2]).text().trim()
        if (berat && harga_dasar) data.push({ berat, harga_dasar, harga_termasuk_pajak: harga_pajak })
      })
      if (!data.length) return resolve(fail('Data emas tidak ditemukan'))
      resolve(ok({ tanggal, data }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/* Harga emas dunia dari harga-emas.org */
const emasHarga = async () => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML('https://harga-emas.org/')
      const $ = cheerio.load(html)
      const data = []
      const tanggal = $('div.UbsGoldTable_updateNote__4gXTx').first().text().trim()
      $('table tbody tr').each((_, el) => {
        const cols = $(el).find('td')
        if (cols.length < 2) return
        const jenis = $(cols[0]).text().trim()
        const harga = $(cols[1]).text().trim()
        if (jenis && harga) data.push({ jenis, harga })
      })
      if (!data.length) return resolve(fail('Data emas tidak ditemukan'))
      resolve(ok({ tanggal, data }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { emasAntam, emasHarga }
