const { axios, cheerio, ok, fail } = require('../utils')

const _getTitle = async (url) => {
  try {
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13)', 'Accept-Language': 'id-ID,id;q=0.9' }, timeout: 15000 })
    const $ = cheerio.load(res.data)
    return ($('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            $('meta[property="og:title"]').attr('content') ||
            $('title').text() || '')
      .replace(/\| Facebook.*$/i, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  } catch (_) { return '' }
}

/*
 * Facebook Video Downloader
 * Source: fdown.net
 * @param {string} url
 */
const facebook = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url) return resolve(fail('URL tidak boleh kosong'))
      if (!url.includes('facebook.com') && !url.includes('fb.watch'))
        return resolve(fail('URL Facebook tidak valid'))

      const title = await _getTitle(url) || 'Facebook Video'

      const res = await axios.post(
        'https://fdown.net/download.php',
        new URLSearchParams({ URLz: url }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 (Linux; Android 13)', 'Origin': 'https://fdown.net', 'Referer': 'https://fdown.net/' }, timeout: 20000 }
      )

      const $ = cheerio.load(res.data)
      const thumbnail = $('.lib-item img').attr('src') || $('img').first().attr('src') || null
      let sd = null, hd = null

      $('a').each((_, el) => {
        const href = $(el).attr('href')
        const text = $(el).text().trim()
        if (!href) return
        if (text.includes('Download Video in HD Quality')) hd = href
        if (text.includes('Download Video in Normal Quality')) sd = href
      })

      if (!sd) sd = res.data.match(/Download Video in Normal Quality.*?href="(.*?)"/s)?.[1] || null
      if (!hd) hd = res.data.match(/Download Video in HD Quality.*?href="(.*?)"/s)?.[1] || null
      if (!sd && !hd) return resolve(fail('Video tidak ditemukan atau private'))

      resolve(ok({ title, thumbnail, sd, hd: hd || sd }))
    } catch (e) { console.log(e); resolve(fail(e?.response?.status || e.message)) }
  })
}

/*
 * Facebook Photo Downloader
 * Support: post photo, album, carousel, share link
 * @param {string} url
 */
const facebookPhoto = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url) return resolve(fail('URL tidak boleh kosong'))
      if (!url.includes('facebook.com') && !url.includes('fb.watch'))
        return resolve(fail('URL Facebook tidak valid'))

      const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13)', 'Accept-Language': 'id-ID,id;q=0.9' }, timeout: 20000 })
      const $ = cheerio.load(res.data)

      const title = ($('meta[property="og:description"]').attr('content') ||
                    $('meta[name="description"]').attr('content') ||
                    $('meta[property="og:title"]').attr('content') || 'Facebook Photo')
        .replace(/\| Facebook.*$/i, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

      const medias = []
      const og = $('meta[property="og:image"]').attr('content')
      if (og) medias.push(og)

      const matches = res.data.match(/https:\/\/scontent.*?\.(jpg|png|jpeg).*?(?=")/g) || []
      for (let img of matches) {
        img = img.replace(/\\\//g, '/').replace(/\\u0025/g, '%')
        medias.push(img)
      }

      const clean = [...new Set(medias)]
      if (!clean.length) return resolve(fail('Foto tidak ditemukan'))

      resolve(ok({ title, total: clean.length, medias: clean.map(v => ({ type: 'image', url: v })) }))
    } catch (e) { console.log(e); resolve(fail(e?.response?.status || e.message)) }
  })
}

module.exports = { facebook, facebookPhoto }
