const { cheerio, ok, fail } = require('../utils')
const vm = require('vm')

/*
 * Instagram Downloader — foto, video, reels, carousel
 * Sumber: snapsave.app
 * @param {string} url - URL post/reel Instagram
 */
const instagram = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('instagram.com'))
        return resolve(fail('URL Instagram tidak valid'))

      const axios = require('axios')
      const res = await axios.post(
        'https://snapsave.app/action.php?lang=id',
        'url=' + encodeURIComponent(url),
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
            'Referer': 'https://snapsave.app/id/download-video-instagram',
            'Origin': 'https://snapsave.app',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        }
      )

      // Decode obfuscated JS
      let decoded = ''
      const sandbox = {
        decodeURIComponent, escape, unescape, String, Math,
        window: { location: { hostname: 'snapsave.app' } },
        document: { getElementById: () => ({ set innerHTML(v) { decoded = v } }) },
        eval: (s) => { decoded = s; return s },
      }
      try { vm.runInNewContext(res.data, sandbox) } catch (_) {}

      if (!decoded) return resolve(fail('Gagal decode response'))

      // Unescape escaped quotes dari dalam JS string
      decoded = decoded.replace(/\\"/g, '"').replace(/\\'/g, "'")

      const $ = cheerio.load(decoded)
      const medias = []

      $('.download-items').each((_, el) => {
        const thumb  = $(el).find('img').attr('src') || null
        const dlUrl  = $(el).find('a[href*="rapidcdn"]').attr('href') || null
        const isVideo = $(el).find('i[class*="dlvideo"]').length > 0
        if (dlUrl) medias.push({ type: isVideo ? 'video' : 'image', url: dlUrl, thumbnail: thumb })
      })

      if (!medias.length) return resolve(fail('Media tidak ditemukan'))

      resolve(ok({ url, medias }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { instagram }
