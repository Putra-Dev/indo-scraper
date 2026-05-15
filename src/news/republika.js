const { fetchHTML, cheerio, parseLdJson, parseThumbnail, parseParagraphs, ok, fail } = require('../utils')

/*
 * Berita terbaru Republika
 * @param {object} options - { channel: 'nasional', page: 1, limit: 20 }
 * channel: nasional | internasional | ekonomi | olahraga | hiburan | tekno | gaya_hidup
 */
const republika = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const { channel = 'nasional', page = 1, limit = 20 } = options
      const ch  = channel === 'gaya_hidup' ? 'gaya-hidup' : channel
      const url = `https://republika.co.id/berita/${ch}?page=${page}`
      const html = await fetchHTML(url, { Referer: 'https://republika.co.id' })
      const $ = cheerio.load(html)
      const articles = []
      $('.link-mobile-headline').each((i, el) => {
        if (articles.length >= limit) return false
        const $el   = $(el)
        const href  = $el.attr('href') || ''
        const title = $el.find('h1.card-text, h2.card-text, .card-text').first().text().trim()
        if (!title || !href) return
        const image    = $el.find('img.lazy').first().attr('data-original') || null
        const smalls   = $el.find('small')
        const category = smalls.filter('.text-primary').first().text().trim() || channel
        const date     = smalls.not('.text-primary').first().text().replace(/^-\s*/, '').trim() || null
        articles.push({
          title,
          url: href.startsWith('http') ? href : `https://republika.co.id${href}`,
          image, category, date,
          source: 'republika',
        })
      })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Artikel lengkap Republika
 * @param {string} url
 */
const republikaArticle = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML(url, { Referer: 'https://republika.co.id' })
      const $ = cheerio.load(html)
      const ld = parseLdJson($, html)

      // Ekstrak kategori dari subdomain URL (misal khazanah.republika.co.id → 'khazanah')
      let category = ''
      try {
        const sub = new URL(url).hostname.split('.')[0]
        if (sub !== 'republika' && sub !== 'www') category = sub
      } catch (_) {}
      category = category || ld?.articleSection || ''

      const paragraphs = parseParagraphs($, 'p.paragraphx')
      resolve(ok({
        title: ld?.headline || $('h1').first().text().trim(),
        author: ld?.author?.name || $('.write-by').first().text().replace(/^Oleh:\s*/i, '').trim(),
        date: ld?.datePublished || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[ 1] || '',
        category,
        description: ld?.description || html.match(/"description"\s*:\s*"([^"]+)"/)?.[ 1] || '',
        thumbnail: parseThumbnail(ld),
        content: paragraphs.join('\n\n'), paragraphs,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { republika, republikaArticle }
