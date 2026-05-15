const { fetchHTML, cheerio, parseLdJson, parseThumbnail, parseParagraphs, ok, fail } = require('../utils')

const pickImg = ($, el) => {
  const attrs = ['data-src', 'data-original', 'data-lazy', 'data-image', 'src']
  for (const a of attrs) {
    const v = $(el).attr(a) || ''
    if (v && !v.startsWith('data:') && v.startsWith('http')) return v
  }
  const ss = $(el).attr('data-srcset') || $(el).attr('srcset') || ''
  if (ss) return ss.trim().split(/[\s,]+/).find(s => s.startsWith('http')) || null
  return null
}

const liputan6 = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const { channel = 'news', page = 1, limit = 20 } = options
      const url  = `https://www.liputan6.com/${channel}/indeks?page=${page}`
      const html = await fetchHTML(url, { Referer: 'https://www.liputan6.com' })
      const $ = cheerio.load(html)
      const articles = []
      $('.article-snippet').each((i, el) => {
        if (articles.length >= limit) return false
        const $el   = $(el)
        const href  = $el.find('.article-snippet__title-link').attr('href') || ''
        const title = $el.find('.article-snippet__title-text').text().trim()
        if (!title || !href) return
        const imgEl = $el.find('.article-snippet--media-figure__picture-img').first()
        const date  = $el.find('.article-snippet__date').text().trim() || null
        articles.push({
          title,
          url: href.startsWith('http') ? href : `https://www.liputan6.com${href}`,
          image: pickImg($, imgEl),
          category: channel,
          date,
          source: 'liputan6',
        })
      })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

const liputan6Article = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML(url, { Referer: 'https://www.liputan6.com' })
      const $ = cheerio.load(html)
      const ld = parseLdJson($, html)

      const title       = $('.articles-content__title').first().text().trim() || ld?.headline || ''
      const description = $('.articles-content__sinopsis').first().text().trim() || ld?.description || ''
      const author      = $('.editorial-articles__name').first().text().trim() || ld?.author?.name || ''
      const date        = $('time[datetime]').first().attr('datetime') || ''
      const category    = $('[data-channel]').first().attr('data-channel') || ld?.articleSection || ''
      const thumbnail   = pickImg($, $('.articles-content__image-container img').first()) || parseThumbnail(ld)
      const paragraphs  = parseParagraphs($, '.article-content-body__item p, .article-content-body p')

      resolve(ok({ title, author, date, category, description, thumbnail, content: paragraphs.join('\n\n'), paragraphs }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { liputan6, liputan6Article }
