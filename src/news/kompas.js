const { fetchHTML, cheerio, parseLdJson, parseThumbnail, ok, fail } = require('../utils')

/*
 * Berita terbaru Kompas
 * @param {object} options - { channel: 'news', page: 1, limit: 20, date: '11/05/2026' }
 * channel: news | regional | megapolitan | money | sport | tekno | sains | travel | food | health
 */
const kompas = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const { channel = 'news', page = 1, limit = 20, date = null } = options
      let url = `https://indeks.kompas.com/?site=${channel}&page=${page}`
      if (date) url += `&date=${date}`
      const html = await fetchHTML(url, { Referer: 'https://www.kompas.com/' })
      const $ = cheerio.load(html)
      const articles = []
      $('div.hlItem').each((i, el) => {
        if (articles.length >= limit) return false
        const $el    = $(el)
        const linkEl = $el.find('a.hlItem-link').first()
        const title  = $el.find('.hlTitle').first().text().trim() || linkEl.attr('title') || ''
        const href   = linkEl.attr('href') || ''
        if (!title || !href) return
        const imgEl  = $el.find('img').first()
        const dateEl = $el.find('.hlTime').first()
        articles.push({
          title, url: href,
          image: imgEl.attr('data-src') || imgEl.attr('src') || null,
          category: $el.find('.hlChannel').text().trim() || channel,
          date: dateEl.attr('datetime') || dateEl.text().trim() || null,
          source: 'kompas',
        })
      })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Artikel lengkap Kompas
 * @param {string} url
 */
const kompasArticle = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML(url, { Referer: 'https://indeks.kompas.com/' })
      const $ = cheerio.load(html)
      const ld = parseLdJson($, html)
      const SKIP  = /^(baca juga|simak juga|artikel terkait|advertisement|iklan)/i
      const STRIP = /baca juga\s*:.*?(?=\n|$)/gi
      const paragraphs = []
      $('.read__content p, .article__body p').each((_, el) => {
        let text = $(el).text().trim().replace(STRIP, '').trim()
        if (text.length > 30 && !SKIP.test(text)) paragraphs.push(text)
      })
      resolve(ok({
        title: ld?.headline || $('h1.read__title').first().text().trim(),
        author: ld?.author?.name || '',
        date: ld?.datePublished || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || '',
        category: ld?.articleSection || '',
        description: ld?.description || '',
        thumbnail: parseThumbnail(ld),
        content: paragraphs.join('\n\n'), paragraphs,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { kompas, kompasArticle }
