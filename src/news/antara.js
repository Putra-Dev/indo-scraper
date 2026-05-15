const { fetchHTML, cheerio, parseLdJson, parseThumbnail, parseParagraphs, ok, fail } = require('../utils')

/*
 * Berita terbaru Antara News
 * @param {object} options - { channel: 'nasional', page: 1, limit: 20 }
 * channel: nasional | hukum | ekonomi | olahraga | hiburan | internasional | tekno | otomotif
 */
const antara = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const { channel = 'nasional', page = 1, limit = 20 } = options
      const url  = `https://www.antaranews.com/${channel}?page=${page}`
      const html = await fetchHTML(url, { Referer: 'https://www.antaranews.com' })
      const $ = cheerio.load(html)
      const articles = []
      $('.title-card').each((i, el) => {
      if (articles.length >= limit) return false
      const $el    = $(el)
      const linkEl = $el.find('a').first()
      const href   = linkEl.attr('href') || ''
      const title  = linkEl.text().trim()
      if (!title || !href) return
      const container = $el.closest('div, article, li')
      const imgEl  = container.find('img').first()
      const dateEl = container.find('time, .timeago, .date').first()
      articles.push({
        title,
        url: href.startsWith('http') ? href : `https://www.antaranews.com${href}`,
        image: imgEl.attr('data-src') || imgEl.attr('src') || null,
        category: channel,
        date: dateEl.attr('datetime') || dateEl.text().trim() || null,
        source: 'antaranews',
      })
    })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Artikel lengkap Antara News
 * @param {string} url
 */
const antaraArticle = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML(url, { Referer: 'https://www.antaranews.com' })
      const $ = cheerio.load(html)
      const ld = parseLdJson($, html)
      console.log(ld)
      const paragraphs = parseParagraphs($, 'div.post-content p, .article-body p')
      resolve(ok({
        title: ld?.headline || $('h1.post-title').first().text().trim(),
        author: ld?.author?.name || $('.reporter-name, .author').first().text().trim(),
        date: ld?.datePublished || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || '',
        category: ld?.articleSection || '',
        description: ld?.description || html.match(/"description"\s*:\s*"([^"]+)"/)?.[1] || '',
        thumbnail: parseThumbnail(ld),
        content: paragraphs.join('\n\n'), paragraphs,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { antara, antaraArticle }
