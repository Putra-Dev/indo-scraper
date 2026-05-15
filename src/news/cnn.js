const { fetchHTML, cheerio, parseParagraphs, parseThumbnail, ok, fail } = require('../utils')

/*
 * Berita terbaru CNN Indonesia
 * @param {object} options - { category: 'nasional', limit: 20 }
 * category: nasional | internasional | ekonomi | olahraga | teknologi | hiburan | gaya_hidup
 */
const cnn = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const { category = 'nasional', limit = 20 } = options
      const CATEGORIES = {
        nasional: 'nasional', internasional: 'internasional', ekonomi: 'ekonomi',
        olahraga: 'olahraga', teknologi: 'teknologi', hiburan: 'hiburan', gaya_hidup: 'gaya-hidup',
      }
      const url  = `https://www.cnnindonesia.com/${CATEGORIES[category] || category}`
      const html = await fetchHTML(url)
      const $ = cheerio.load(html)
      const articles = []
      $('article').each((i, el) => {
        if (articles.length >= limit) return false
        const $el    = $(el)
        const linkEl = $el.find('a[href*="cnnindonesia.com"]').first()
        const href   = linkEl.attr('href') || ''
        if (!href.match(/\/\d{8}\d+-\d+-\d+\//)) return
        const title  = linkEl.text().replace(/\s+/g, ' ').trim()
        if (!title || title.length < 10) return
        const dateMatch = href.match(/\/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-/)
        articles.push({
          title, url: href,
          image: $el.find('img').first().attr('src') || null,
          category,
          date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}+07:00` : null,
          source: 'cnnindonesia',
        })
      })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Artikel lengkap CNN Indonesia
 * @param {string} url
 */
const cnnArticle = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML(url)
      const $ = cheerio.load(html)
      let ld = null
      $('script[type="application/ld+json"]').each((_, el) => {
        try { const j = JSON.parse($(el).html()); if (j['@type'] === 'NewsArticle') ld = j } catch (_) {}
      })
      const categoryMatch = url.match(/cnnindonesia\.com\/([^/]+)\//)
      const paragraphs = parseParagraphs($, '.detail-text p, .artikel-content p')
      resolve(ok({
        title: ld?.headline || $('h1').first().text().trim(),
        author: 'CNN Indonesia',
        date: ld?.datePublished || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || '',
        category: categoryMatch?.[1] || '',
        description: ld?.description || '',
        thumbnail: parseThumbnail(ld),
        content: paragraphs.join('\n\n'), paragraphs,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { cnn, cnnArticle }
