const { fetchHTML, cheerio, parseLdJson, parseThumbnail, parseParagraphs, ok, fail } = require('../utils')

/*
 * Berita terbaru Okezone
 * @param {object} options - { channel: 'nasional', page: 1, limit: 20 }
 * channel: nasional | economy | sports | techno | celebrity | lifestyle | otomotif | health
 */
const okezone = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const { channel = 'nasional', page = 1, limit = 20 } = options
      const CHANNELS = {
        nasional: 'nasional', economy: 'economy', sports: 'sports',
        techno: 'techno', celebrity: 'celebrity', lifestyle: 'lifestyle',
        otomotif: 'otomotif', health: 'health',
      }
      const sub  = CHANNELS[channel] || 'nasional'
      const url  = `https://${sub}.okezone.com/indeks?page=${page}`
      const html = await fetchHTML(url, { Referer: 'https://www.okezone.com' })
      const $ = cheerio.load(html)
      const articles = []

      // Container: parent div yang berisi .box-text
      $('div.box-text').each((i, el) => {
        if (articles.length >= limit) return false
        const $el    = $(el)
        const linkEl = $el.find('a.title').first()
        const title  = linkEl.text().trim()
        const href   = linkEl.attr('href') || ''
        if (!title || !href) return
        const container = $el.parent()
        const imgEl  = container.find('img').first()
        articles.push({
          title,
          url: href.startsWith('http') ? href : `https://${sub}.okezone.com${href}`,
          image: imgEl.attr('data-src') || imgEl.attr('src') || null,
          category: $el.find('a.kanal').text().trim() || channel,
          date: $el.find('div.timego').text().trim() || null,
          source: 'okezone',
        })
      })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Artikel lengkap Okezone
 * @param {string} url
 */
const okenewsArticle = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML(url, { Referer: 'https://www.okezone.com' })
      const $ = cheerio.load(html)
      const ld = parseLdJson($, html)
      const paragraphs = parseParagraphs($, '.description.read p')
      resolve(ok({
        title: ld?.headline || $('h1.title-content').first().text().trim(),
        author: ld?.author?.name || $('.author, .nm-reporter').first().text().trim(),
        date: ld?.datePublished || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[ 1] || '',
        category: $('.category').first().text().trim() || ld?.articleSection || '',
        description: ld?.description || html.match(/"description"\s*:\s*"([^"]+)"/)?.[ 1] || '',
        thumbnail: parseThumbnail(ld),
        content: paragraphs.join('\n\n'), paragraphs,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { okezone, okenewsArticle }
