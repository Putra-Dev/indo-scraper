const cloudscraper = require('cloudscraper')
const { cheerio, ok, fail } = require('../utils')

const KURIR_MAP = {
  jne:      'jne',
  jnt:      'jnt',
  'j&t':    'jnt',
  sicepat:  'sicepat',
  anteraja: 'anteraja',
  pos:      'pos',
  wahana:   'wahana',
  tiki:     'tiki',
  ninja:    'ninja',
  lion:     'lion',
  sap:      'sap',
  id:       'id-express',
}

/*
 * Cek resi pengiriman via cek-resi.net (bypass Cloudflare)
 * @param {string} kurir  - jne | jnt | sicepat | anteraja | pos | wahana | tiki | dll
 * @param {string} noResi - nomor resi
 */
const cekResi = async (kurir, noResi) => {
  return new Promise(async (resolve) => {
    try {
      const code = KURIR_MAP[kurir.toLowerCase()] || kurir.toLowerCase()
      const url  = `https://cek-resi.net/kurir/${code}`

      // Bypass Cloudflare dengan cloudscraper
      const pageHtml = await cloudscraper.get(url)
      const $page = cheerio.load(pageHtml)

      // Cari token/csrf
      const token = $page('input[name="_token"]').val()
               || $page('meta[name="csrf-token"]').attr('content')
               || ''

      // Submit form tracking
      const formHtml = await cloudscraper({
        method: 'POST',
        uri: url,
        form: { resi: noResi, _token: token },
        headers: {
          'Referer': url,
          'Origin': 'https://cek-resi.net',
        },
      })

      const $ = cheerio.load(formHtml)
      const history = []

      // Parse hasil tracking
      $('table tbody tr, .tracking-result tr, .result-tracking tr').each((_, el) => {
        const cols = $(el).find('td')
        if (cols.length < 2) return
        const tanggal    = $(cols[0]).text().trim()
        const keterangan = $(cols[1]).text().trim()
        const lokasi     = cols.length > 2 ? $(cols[2]).text().trim() : ''
        if (tanggal && keterangan) history.push({ tanggal, keterangan, lokasi })
      })

      if (!history.length) {
        // Debug: print HTML hasil untuk lihat struktur
        const preview = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 300)
        return resolve(fail(`Resi tidak ditemukan. Preview: ${preview}`))
      }

      resolve(ok({
        kurir: code,
        noResi,
        status: history[0]?.keterangan || '',
        history,
      }))
    } catch (e) {
      console.log('[cekResi]', e.message)
      resolve(fail(e))
    }
  })
}

module.exports = { cekResi, KURIR_MAP }