const { axios, cheerio, ok, fail } = require('../utils')

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9',
}

// Domain situs downloader lain yang kadang nyempil sebagai iklan/cross-promo
// di halaman hasil scraping — bukan link media asli, jadi harus diabaikan.
const NON_MEDIA_DOMAINS = ['snaptik.app', 'ssstik.io', 'musicaldown.com', 'pindown.io', 'savetik', 'ttsave', 'snapcdn.app', 'tikmate', 'downtik', 'sssnaptik']

function isNonMediaLink(href) {
  try { return NON_MEDIA_DOMAINS.some(d => new URL(href).hostname.toLowerCase().includes(d)) }
  catch (_) { return true } // href tidak valid → aman diabaikan
}

// Resolve short URL → dapatkan URL penuh + ID video
async function resolveUrl(url) {
  try {
    const res = await axios.get(url, { headers: HEADERS, maxRedirects: 10, timeout: 15000 })
    const finalUrl = res.request?.res?.responseUrl || res.config?.url || url
    return { url: finalUrl, id: finalUrl.match(/\/(?:video|photo)\/(\d+)/)?.[1] || null }
  } catch (_) {
    return { url, id: url.match(/\/(?:video|photo)\/(\d+)/)?.[1] || null }
  }
}

// Ambil stats (likes/views/comments/shares) + fallback metadata dari oEmbed & embed page TikTok.
// Musicaldown sendiri nggak nampilin stats sama sekali, jadi ini pelengkap wajib.
async function getTiktokMeta(videoUrl, videoId = null) {
  let title = '', author = '', authorUrl = '', thumbnail = '', avatar = ''
  let likes = null, views = null, shares = null, comments = null

  const fetchOembed = (u) => axios.get(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
  )

  // oEmbed kadang menolak URL /photo/, jadi kalau gagal dicoba lagi pakai varian /video/
  try {
    let data
    try {
      data = (await fetchOembed(videoUrl)).data
    } catch (_) {
      if (!videoUrl.includes('/photo/')) throw _
      data = (await fetchOembed(videoUrl.replace('/photo/', '/video/'))).data
    }
    title     = data.title || ''
    author    = data.author_name || ''
    authorUrl = data.author_url || ''
    thumbnail = data.thumbnail_url || ''
  } catch (_) {}

  // Embed page — dapat stats (likes, views, shares, comments)
  if (videoId) {
    try {
      const embedRes = await axios.get(
        `https://www.tiktok.com/embed/v2/${videoId}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
            'Referer': 'https://www.tiktok.com/',
          },
          timeout: 15000,
        }
      )
      // TikTok kadang double-encode JSON blob-nya (quote ke-escape jadi \"stats\":{...}),
      // biasanya kejadian di halaman embed video biasa tapi nggak di slide/photo.
      // Kalau nggak dinormalisasi dulu, regex "stats" di bawah gagal match diam-diam → semua stats null.
      const html = String(embedRes.data).replace(/\\"/g, '"')
      const jsonMatch = html.match(/"stats"\s*:\s*(\{[^}]+\})/) || html.match(/diggCount[^}]{0,200}/)

      if (jsonMatch) {
        const statsStr = jsonMatch[0]
        const dig  = statsStr.match(/diggCount['":\s]+(\d+)/)
        const play = statsStr.match(/playCount['":\s]+(\d+)/)
        const cmt  = statsStr.match(/commentCount['":\s]+(\d+)/)
        const shr  = statsStr.match(/shareCount['":\s]+(\d+)/)
        likes    = dig  ? parseInt(dig[1])  : null
        views    = play ? parseInt(play[1]) : null
        comments = cmt  ? parseInt(cmt[1])  : null
        shares   = shr  ? parseInt(shr[1])  : null
      }

      // Foto profil author — coba beberapa nama field yang umum dipakai TikTok
      const avatarMatch = html.match(/avatarLarger['":\s]+"([^"]+)"/)
                        || html.match(/avatarMedium['":\s]+"([^"]+)"/)
                        || html.match(/avatarThumb['":\s]+"([^"]+)"/)
      if (avatarMatch) avatar = avatarMatch[1].replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/')

      if (!likes || !avatar) {
        const nextData = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
        if (nextData) {
          try {
            const obj = JSON.parse(nextData[1])
            const itemStruct = obj?.props?.pageProps?.itemInfo?.itemStruct
            const stats  = itemStruct?.stats || obj?.props?.pageProps?.videoData?.stats
            const authorObj = itemStruct?.author
            if (stats && !likes) {
              likes    = stats.diggCount    || null
              views    = stats.playCount    || null
              comments = stats.commentCount || null
              shares   = stats.shareCount   || null
            }
            if (authorObj && !avatar) avatar = authorObj.avatarLarger || authorObj.avatarMedium || authorObj.avatarThumb || ''
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  return { title, author, authorUrl, thumbnail, avatar: avatar || null, likes, views, comments, shares }
}

// Ambil link download (video + slide) + metadata dari musicaldown.com
async function fetchViaMusicaldown(url) {
  try {
    // Step 1: ambil halaman utama → cookie session + nama field form
    // (nama field-nya acak per-load, mis. "_ZuT"/"_pCOSh", jadi harus dibaca dari HTML, bukan hardcode)
    const pageRes = await axios.get('https://musicaldown.com/id', { headers: HEADERS, timeout: 15000 })
    const cookies = (pageRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ')
    const $page   = cheerio.load(pageRes.data)
    const $form   = $page('form').first()

    const body = { verify: '1' }
    let linkField = null
    $form.find('input').each((_, el) => {
      const name = $page(el).attr('name')
      const type = ($page(el).attr('type') || 'text').toLowerCase()
      if (!name) return
      if (type === 'hidden') body[name] = $page(el).attr('value') || ''
      else if (!linkField) linkField = name // input teks/url pertama = kolom link
    })
    if (!linkField) linkField = '_ZuT' // fallback kalau parsing form gagal
    body[linkField] = url

    // Step 2: submit URL
    const formRes = await axios.post(
      'https://musicaldown.com/id/download',
      new URLSearchParams(body).toString(),
      {
        headers: {
          ...HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://musicaldown.com/id',
          'Origin': 'https://musicaldown.com',
          Cookie: cookies,
        },
        timeout: 30000,
      }
    )

    const $ = cheerio.load(formRes.data)
    if ($('.alert, .error, [class*="error"]').first().text().trim()) return null

    const slides = [], videos = []
    let music = null

    // Tombol download video/HD/MP3 asli musicaldown selalu punya class "download" + data-event unik
    // (mp4_download_click, hd_download_click, watermark_download_click, mp3_download_click).
    // Link nav biasa (mis. "Download Video Lain" balik ke /id) tidak punya keduanya.
    $('a.download[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (!href.startsWith('http') || isNonMediaLink(href)) return

      const event = ($(el).attr('data-event') || '').toLowerCase()
      const txt   = $(el).text().toLowerCase().trim()

      const isMp3       = event.includes('mp3') || txt.includes('mp3')
      const isHD        = event.includes('hd') || txt.includes('[hd]')
      const isWatermark = event.includes('watermark')

      if (isMp3 && !music) music = href
      else if (isHD && !videos[1]) videos[1] = href
      else if (isWatermark && !videos[2]) videos[2] = href // link "Download MP4 [Watermark]" — sebelumnya kebuang, tidak pernah ditampung
      else if (!videos[0]) videos[0] = href // "Download MP4" polos = versi utama non-watermark
    })

    // Post slide/foto: tombol "Convert Video Now" (<button>, bukan <a>) menyimpan payload
    // JSON ter-base64 (author, images[], music, id) di dalam body fetch — ini sumber paling
    // bersih buat dapetin seluruh array foto, ketimbang scraping tiap <div class="card"> satu-satu.
    const sliderMatch = formRes.data.match(/data:\s*"(eyJ[A-Za-z0-9+/=]+)"/)
    if (sliderMatch) {
      try {
        const payload = JSON.parse(Buffer.from(sliderMatch[1], 'base64').toString('utf8'))
        if (Array.isArray(payload.images))
          payload.images.forEach(img => { if (img && !slides.includes(img)) slides.push(img) })
        if (payload.music && !music) music = payload.music
      } catch (_) {}
    }

    // Fallback kalau format inline script berubah: scrape tombol "Download" di tiap kartu foto
    if (!slides.length) {
      $('.card-action a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        if (href.startsWith('http') && !isNonMediaLink(href) && !slides.includes(href)) slides.push(href)
      })
    }

    // Metadata langsung dari halaman hasil. Post video: author, caption, cover, avatar semua tersedia.
    // Post slide: cuma author (dari payload JSON di atas) — sisanya dilengkapi getTiktokMeta di musically.
    let author = $('.video-author').text().trim().replace(/^@/, '') || null
    const title = $('.video-desc').text().trim() || null

    let thumbnail = null // cover video/foto (.bg-overlay)
    const bgMatch = ($('.bg-overlay').attr('style') || '').match(/url\((.*?)\)/)
    if (bgMatch) thumbnail = bgMatch[1].replace(/^['"]|['"]$/g, '')

    // Halaman hasil slide/foto nggak selalu render .bg-overlay, jadi thumbnail sering kosong.
    // Fallback: coba og:image dulu, kalau masih kosong pakai foto slide pertama sebagai cover.
    if (!thumbnail) thumbnail = $('meta[property="og:image"]').attr('content') || null
    if (!thumbnail && slides.length) thumbnail = slides[0]

    // Halaman hasil slide kemungkinan pakai markup avatar yang beda dari .img-area (khusus post video),
    // jadi dicoba beberapa selector umum lain sebelum nyerah ke null.
    const avatar = $('.img-area img').attr('src')
                || $('.author-avatar img, .avatar img, .card-avatar img, [class*="avatar"] img').first().attr('src')
                || null

    if (!author && sliderMatch) {
      try { author = JSON.parse(Buffer.from(sliderMatch[1], 'base64').toString('utf8')).author || null }
      catch (_) {}
    }

    return {
      slides, video: videos[0] || null, video_hd: videos[1] || null, video_watermark: videos[2] || null, music,
      meta: { title, author, thumbnail, avatar },
    }
  } catch (e) { console.log('[fetchViaMusicaldown]', e.message); return null }
}

// Cek apakah hasil provider ({ slides, video, video_hd, music }) punya isi
const hasDlResult = (r) => r && (r.slides.length || r.video || r.video_hd || r.music)

// Gabungkan metadata + hasil provider jadi satu response ok()
const buildDlResult = (metaFields, r) => ok({
  ...metaFields,
  type:            r.slides.length ? 'photo' : 'video',
  slides:          r.slides,
  slides_count:    r.slides.length,
  video:           r.video,
  video_hd:        r.video_hd,
  video_watermark: r.video_watermark,
  music:           r.music,
})

/*
 * Download TikTok via musicaldown.com — auto-detect video/foto dari satu URL.
 * Metadata utama (title/author/thumbnail/avatar) dari halaman musicaldown sendiri;
 * stats (likes/views/comments/shares) + fallback field kosong dilengkapi via getTiktokMeta.
 * @param {string} url - URL TikTok (video/photo, boleh short link)
 */
const musically = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('tiktok.com'))
        return resolve(fail('URL TikTok tidak valid'))

      const { url: fullUrl, id: videoId } = await resolveUrl(url)
      const [m, meta] = await Promise.all([
        fetchViaMusicaldown(url),
        getTiktokMeta(fullUrl, videoId),
      ])
      if (!hasDlResult(m)) return resolve(fail('Tidak ditemukan link download — URL tidak valid atau private'))

      const metaFields = {
        id:        videoId,
        title:     m.meta.title || meta.title || null,
        author:    m.meta.author || meta.author || null,
        authorUrl: meta.authorUrl || (m.meta.author ? `https://www.tiktok.com/@${m.meta.author}` : null),
        thumbnail: m.meta.thumbnail || meta.thumbnail || null,
        avatar:    m.meta.avatar || meta.avatar || null,
        stats: {
          likes:    meta.likes,
          views:    meta.views,
          comments: meta.comments,
          shares:   meta.shares,
        },
      }

      resolve(buildDlResult(metaFields, m))
    } catch (e) { console.log('[musically]', e.message); resolve(fail(e)) }
  })
}

module.exports = { musically }
