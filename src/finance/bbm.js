const { fetchHTML, cheerio, ok, fail } = require('../utils')

/* Harga BBM Pertamina — sumber: oto.com/en/harga-bbm */
const bbm = async () => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML('https://www.oto.com/en/harga-bbm', {
        Referer: 'https://www.oto.com/'
      })
      const $ = cheerio.load(html)

      // Tanggal update
      const updateText = $('p,span,div').filter((_,el) =>
        /last updated|update/i.test($(el).text())
      ).first().text().trim().replace(/\s+/g, ' ')

      // Tabel 1 & 2 — harga per jenis BBM (bensin & diesel)
      const harga = []
      ;[1, 2].forEach(idx => {
        $('table').eq(idx).find('tbody tr').each((_, el) => {
          const cols = $(el).find('td')
          const jenis = $(cols[0]).text().trim()
          const hargaLiter = $(cols[1]).text().trim().replace(/\s+/g, ' ')
          if (jenis && hargaLiter && /Rp/i.test(hargaLiter)) {
            harga.push({ jenis, harga: hargaLiter })
          }
        })
      })

      // Tabel 3 — harga per kota/provinsi
      const headers = $('table').eq(3).find('th').map((_,el) => $(el).text().trim()).get()
      const provinsi = []
      $('table').eq(3).find('tbody tr').each((_, el) => {
        const cols = $(el).find('td')
        if (!cols.length) return
        const row = {}
        cols.each((i, td) => {
          if (headers[i]) row[headers[i]] = $(td).text().trim()
        })
        if (row[headers[0]]) provinsi.push(row)
      })

      if (!harga.length && !provinsi.length)
        return resolve(fail('Data BBM tidak ditemukan'))

      resolve(ok({ update: updateText, harga, provinsi }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { bbm }
