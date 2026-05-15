const { fetchHTML, cheerio, parseLdJson, parseThumbnail, parseParagraphs, ok, fail } = require('../utils')

// Coba ambil URL gambar dari berbagai atribut lazy-load
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

/*
 * Berita terbaru Tribunnews
 * @param {object} options - { channel: 'nasional', page: 1, limit: 20 }
 * channel: nasional | regional | internasional | sport | bisnis | seleb | lifestyle | techno | otomotif
 */
const tribun = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const { channel = 'nasional', page = 1, limit = 20 } = options
      const url  = `https://www.tribunnews.com/${channel}?page=${page}`
      const html = await fetchHTML(url, { Referer: 'https://www.tribunnews.com' })
      const $ = cheerio.load(html)
      const articles = []
      $("h3 a[href*='tribunnews.com']").each((i, el) => {
        if (articles.length >= limit) return false
        const $el  = $(el)
        const title = $el.attr('title') || $el.text().trim()
        const href  = $el.attr('href') || ''
        if (!title || !href) return

        // Naik ke container terluas: coba li/article dulu, fallback ke parent div
        let container = $el.closest('li, article')
        if (!container.length) container = $el.closest('div').parent()

        // Cari img di seluruh container — coba semua atribut lazy-load
        let image = null
        container.find('img').each((_, img) => {
          if (image) return false
          image = pickImg($, img) || null
        })

        articles.push({
          title, url: href, image,
          category: container.find('h4 a.tsa-2').text().trim() || channel,
          date: container.find('time span').text().trim() || null,
          source: 'tribunnews',
        })
      })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Artikel lengkap Tribunnews
 * @param {string} url
 */
const tribunArticle = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML(url, { Referer: 'https://www.tribunnews.com' })
      const $ = cheerio.load(html)
      const ld = parseLdJson($, html)
      let author = ''
      if (ld?.author) author = Array.isArray(ld.author) ? ld.author[0]?.name || '' : ld.author.name || ''
      if (!author) author = html.match(/'penulis'\s*:\s*'([^']+)'/)?.[1] || ''

      // 1) ld+json  2) og:image (server-side, tidak lazy-load)  3) DOM fallback
      let thumbnail = parseThumbnail(ld)
      if (!thumbnail) thumbnail = $('meta[property="og:image"]').attr('content') || null
      if (!thumbnail) {
        const imgEl = $('.img-holder img, .wrap_img img, figure img, #article-body img, .photo img').first()
        if (imgEl.length) thumbnail = pickImg($, imgEl) || null
      }

      const paragraphs = parseParagraphs($, 'div#article-body p, div.txt-article p')
      resolve(ok({
        title: ld?.headline || $('h1').first().text().trim(),
        author,
        date: ld?.datePublished || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || '',
        category: ld?.articleSection || $('.breadcrumb a').eq(1).text().trim(),
        description: ld?.description || html.match(/"description"\s*:\s*"([^"]+)"/)?.[1] || '',
        thumbnail,
        content: paragraphs.join('\n\n'), paragraphs,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { tribun, tribunArticle }
