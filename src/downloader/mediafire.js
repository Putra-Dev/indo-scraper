const { fetchHTML, cheerio, ok, fail } = require('../utils')

/*
 * MediaFire Downloader
 * @param {string} url - URL MediaFire
 */
const mediafire = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('mediafire.com'))
        return resolve(fail('URL MediaFire tidak valid'))

      const html = await fetchHTML(url, { Referer: 'https://www.mediafire.com/' })
      const $ = cheerio.load(html)

      const download = $('#downloadButton').attr('href')
      if (!download) return resolve(fail('Link download tidak ditemukan'))

      const filename = $('.dl-btn-label').attr('title') ||
                       $('meta[property="og:title"]').attr('content') ||
                       download.split('/').pop()
      const filesize = $('#downloadButton').text().replace(/Download/i, '').replace(/\s+/g, ' ').trim()
      const filetype = filename.split('.').pop() || 'unknown'

      resolve(ok({ url, filename, filesize, filetype, download }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { mediafire }
