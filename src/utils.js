const axios   = require('axios')
const cheerio = require('cheerio')

// ── Headers ───────────────────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

async function fetchHTML(url, headers = {}) {
  let last
  for (let i = 0; i <= 2; i++) {
    try {
      const res = await axios.get(url, { headers: { ...HEADERS, ...headers }, timeout: 10000, responseType: 'text' })
      return res.data
    } catch (e) {
      last = e
      await new Promise(r => setTimeout(r, 500 * (i + 1)))
    }
  }
  throw new Error(`Gagal fetch ${url}: ${last.message}`)
}

async function fetchJSON(url, headers = {}) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'id-ID,id;q=0.9',
      'Referer': 'https://www.bmkg.go.id/',
      'Origin': 'https://www.bmkg.go.id',
      ...headers
    },
    timeout: 10000
  })
  return res.data
}

function parseLdJson($, html) {
  let ld = null
  $('script[type="application/ld+json"]').each((_, el) => {
    try { const j = JSON.parse($(el).html()); if (j.datePublished) ld = j } catch (_) {}
  })
  return ld
}

function parseThumbnail(ld) {
  if (!ld?.image) return null
  if (typeof ld.image === 'string') return ld.image
  if (ld.image.url) return ld.image.url
  if (Array.isArray(ld.image)) return ld.image[0]?.url || ld.image[0] || null
  return null
}

function parseParagraphs($, selector) {
  const SKIP  = /^(baca juga|simak juga|artikel terkait|lihat juga|advertisement|iklan)/i
  const STRIP = /baca juga\s*:.*?(?=\n|$)/gi
  const result = []
  $(selector).each((_, el) => {
    let text = $(el).text().trim().replace(STRIP, '').trim()
    if (text.length > 30 && !SKIP.test(text)) result.push(text)
  })
  return result
}

// ── Responses ─────────────────────────────────────────────────────────────────

const ok   = (data) => ({ creator: global.creator, status: true,  data })
const fail = (e)    => ({ creator: global.creator, status: false, msg: e instanceof Error ? e.message : String(e) })

module.exports = { axios, cheerio, HEADERS, fetchHTML, fetchJSON, parseLdJson, parseThumbnail, parseParagraphs, ok, fail }
