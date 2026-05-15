const { fetchHTML, cheerio, parseLdJson, parseThumbnail, parseParagraphs, ok, fail } = require('../utils')

/*
 * Berita terbaru Detik
 * @param {object} options - { channel: 'news', page: 1, limit: 20 }
 * channel: news | finance | hot | sport | inet | oto | health | travel | food
 */
const detik = async (options = {}) => {
  return new Promise(async (resolve) => {
    try {
      const { channel = 'news', page = 1, limit = 20 } = options
      const CHANNELS = {
        news: 'https://news.detik.com/indeks', finance: 'https://finance.detik.com/indeks',
        hot: 'https://hot.detik.com/indeks', sport: 'https://sport.detik.com/indeks',
        inet: 'https://inet.detik.com/indeks', oto: 'https://oto.detik.com/indeks',
        health: 'https://health.detik.com/indeks', travel: 'https://travel.detik.com/indeks',
        food: 'https://food.detik.com/indeks',
      }
      const url  = `${CHANNELS[channel] || CHANNELS.news}?page=${page}`
      const html = await fetchHTML(url)
      const $ = cheerio.load(html)
      const articles = []
      $('article.list-content__item').each((i, el) => {
        if (articles.length >= limit) return false
        const $el    = $(el)
        const linkEl = $el.find('a.media__link').first()
        const title  = linkEl.find('div').first().text().trim() || linkEl.text().trim()
        const href   = $el.attr('i-link') || linkEl.attr('href') || ''
        if (!title || !href || href === '#') return
        const imgBase = $el.attr('i-img') || null
        const imgQs   = $el.attr('i-img-qs') || ''
        const image   = imgBase ? `${imgBase}${imgQs}` : null
        const dateEl  = $el.find('.media__date span').first()
        articles.push({
          title,
          url: href,
          image,
          category: $el.find('.media__category').text().trim() || channel,
          date: dateEl.attr('title') || dateEl.text().trim() || null,
          source: 'detik',
        })
      })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Cari berita Detik
 * @param {string} query
 * @param {number} limit
 */
const detikSearch = async (query, limit = 10) => {
  return new Promise(async (resolve) => {
    try {
      const url  = `https://www.detik.com/search/searchall?query=${encodeURIComponent(query)}&sortby=time`
      const html = await fetchHTML(url)
      const $ = cheerio.load(html)
      const articles = []
      $('article.list-content__item').each((i, el) => {
        if (articles.length >= limit) return false
        const $el    = $(el)
        const linkEl = $el.find('a.media__link').first()
        const title  = linkEl.find('div').first().text().trim() || linkEl.text().trim()
        const href   = $el.attr('i-link') || linkEl.attr('href') || ''
        if (!title || !href) return
        const imgBase = $el.attr('i-img') || null
        const imgQs   = $el.attr('i-img-qs') || ''
        const dateEl  = $el.find('.media__date span').first()
        articles.push({
          title, url: href,
          image: imgBase ? `${imgBase}${imgQs}` : null,
          date: dateEl.attr('title') || dateEl.text().trim() || null,
          source: 'detik',
        })
      })
      if (!articles.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(articles))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Artikel lengkap Detik
 * @param {string} url
 */
const detikArticle = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const html = await fetchHTML(url)
      const $ = cheerio.load(html)
      const ld = parseLdJson($, html)
      const paragraphs = parseParagraphs($, '.detail__body p, .itp_bodycontent p')
      resolve(ok({
        title: ld?.headline || $('h1.detail__title').first().text().trim(),
        author: ld?.author?.name || $('.detail__author').first().text().trim(),
        date: ld?.datePublished || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[ 1] || '',
        category: $('.detail__label').first().text().trim() || ld?.articleSection || '',
        description: ld?.description || '',
        thumbnail: parseThumbnail(ld),
        content: paragraphs.join('\n\n'), paragraphs,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { detik, detikSearch, detikArticle }
