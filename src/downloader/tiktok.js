const { axios, cheerio, ok, fail } = require('../utils')
const vm = require('vm')

// ── Helpers ────────────────────────────────────────────────────────────────

const SNAPTIK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9',
}

// Resolve short URL → dapatkan URL penuh + ID + tipe (video/photo)
async function resolveUrl(url) {
  try {
    const res = await axios.get(url, {
      headers: SNAPTIK_HEADERS,
      maxRedirects: 10,
      timeout: 15000,
    })
    const finalUrl = res.request?.res?.responseUrl || res.config?.url || url
    const match = finalUrl.match(/\/(video|photo)\/(\d+)/)
    return { url: finalUrl, id: match?.[2] || null, isPhoto: match?.[1] === 'photo' }
  } catch (e) {
    const match = url.match(/\/(video|photo)\/(\d+)/)
    return { url, id: match?.[2] || null, isPhoto: match?.[1] === 'photo' }
  }
}

// Submit URL ke snaptik dan kembalikan HTML response
async function snaptikFetch(url) {
  const pageRes = await axios.get('https://snaptik.app/ID2', {
    headers: SNAPTIK_HEADERS,
    timeout: 15000,
  })
  const $page = cheerio.load(pageRes.data)
  const token = $page('input[name="token"]').val()
               || $page('form input[type="hidden"]').first().val()

  if (!token) throw new Error('Gagal mendapatkan token snaptik')

  const formRes = await axios.post(
    'https://snaptik.app/abc2.php',
    new URLSearchParams({ url, token }).toString(),
    {
      headers: {
        ...SNAPTIK_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': 'https://snaptik.app/ID2',
        'Origin': 'https://snaptik.app',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 30000,
    }
  )
  return formRes.data
}

// Decode multi-level eval obfuscation
function decodeSnaptik(rawData) {
  if (typeof rawData !== 'string') return null
  if (rawData.includes('<a ') && rawData.includes('http')) return rawData

  const capturedHtmls = {}
  let foundHtml = null

  const runInSandbox = (code, depth = 0) => {
    if (depth > 4 || foundHtml) return
    const sandbox = {
      decodeURIComponent, encodeURIComponent, escape, unescape,
      String, Math, parseInt, parseFloat, JSON, Array, Object,
      RegExp, Boolean, Number, isNaN, isFinite,
      window: { location: { hostname: 'snaptik.app', href: 'https://snaptik.app/ID2' } },
      location: { hostname: 'snaptik.app' },
      navigator: { userAgent: 'Mozilla/5.0' },
      document: {
        getElementById: (id) => ({
          set innerHTML(v) { capturedHtmls[id] = v; if (v.includes('<a ') && v.includes('http')) foundHtml = v },
          get innerHTML() { return capturedHtmls[id] || '' },
          style: {},
        }),
        querySelector: (sel) => ({
          set innerHTML(v) { capturedHtmls[sel] = v; if (v.includes('<a ') && v.includes('http')) foundHtml = v },
          get innerHTML() { return capturedHtmls[sel] || '' },
          style: {},
        }),
        createElement: () => ({ innerHTML: '', style: {}, setAttribute: () => {}, appendChild: () => {} }),
        body: { appendChild: () => {}, innerHTML: '' },
      },
      eval: (s) => {
        if (s && typeof s === 'string' && s.length > 50) {
          if (s.includes('<a ') && s.includes('http')) { foundHtml = s; return s }
          runInSandbox(s, depth + 1)
        }
        return s
      },
      console: { log: () => {}, error: () => {} },
      setTimeout: () => 0, clearTimeout: () => {},
    }
    try { vm.runInNewContext(code, sandbox, { timeout: 8000 }) } catch (_) {}
  }

  runInSandbox(rawData)
  if (!foundHtml)
    foundHtml = Object.values(capturedHtmls).find(h => h.includes('<a ') && h.includes('http')) || null

  return foundHtml
    ? foundHtml.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\n/g, '\n')
    : null
}

// ── TikTok Metadata ────────────────────────────────────────────────────────

/*
 * Ambil metadata TikTok (title, author, stats) dari oEmbed + embed page
 * @param {string} videoUrl - URL TikTok (video atau photo/slide)
 * @param {string} videoId  - ID video (opsional, untuk scrape stats)
 */
async function getTiktokMeta(videoUrl, videoId = null) {
  let title = '', author = '', authorUrl = '', thumbnail = ''
  let likes = null, views = null, shares = null, comments = null

  const fetchOembed = (u) => axios.get(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
  )

  // 1. oEmbed — dapat title, author, thumbnail
  // Endpoint oEmbed TikTok kadang menolak URL /photo/, jadi kalau gagal
  // dicoba lagi pakai varian /video/ (ID-nya tetap sama).
  try {
    let data
    try {
      data = (await fetchOembed(videoUrl)).data
    } catch (_) {
      if (!videoUrl.includes('/photo/')) throw _
      data = (await fetchOembed(videoUrl.replace('/photo/', '/video/'))).data
    }
    title      = data.title || ''
    author     = data.author_name || ''
    authorUrl  = data.author_url || ''
    thumbnail  = data.thumbnail_url || ''
  } catch (_) {}

  // 2. Embed page — dapat stats (likes, views, shares, comments)
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
      const html = embedRes.data

      // Stats ada di JSON __DEFAULT_SCOPE__ atau NEXT_DATA
      const jsonMatch = html.match(/"stats"\s*:\s*(\{[^}]+\})/)
               || html.match(/diggCount[^}]{0,200}/)

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

      // Fallback: cari di window.__NEXT_DATA__ atau __DEFAULT_SCOPE__
      if (!likes) {
        const nextData = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
        if (nextData) {
          try {
            const obj = JSON.parse(nextData[1])
            const stats = obj?.props?.pageProps?.itemInfo?.itemStruct?.stats
                       || obj?.props?.pageProps?.videoData?.stats
            if (stats) {
              likes    = stats.diggCount    || null
              views    = stats.playCount    || null
              comments = stats.commentCount || null
              shares   = stats.shareCount   || null
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  return { title, author, authorUrl, thumbnail, likes, views, comments, shares }
}

// ── TikTok Downloader (video + slide, auto-detect) ─────────────────────────

// Domain situs downloader lain yang kadang nyempil sebagai iklan/cross-promo
// di halaman hasil scraping — bukan link media asli, jadi harus diabaikan.
const NON_MEDIA_DOMAINS = ['snaptik.app', 'ssstik.io', 'musicaldown.com', 'pindown.io', 'savetik', 'ttsave', 'snapcdn.app', 'tikmate', 'downtik', 'sssnaptik']

function isNonMediaLink(href) {
  try { return NON_MEDIA_DOMAINS.some(d => new URL(href).hostname.toLowerCase().includes(d)) }
  catch (_) { return true } // href tidak valid → aman diabaikan
}

// Provider 1: snaptik — kuat untuk video (ada HD + audio asli)
async function fetchViaSnaptik(fullUrl) {
  try {
    const rawData = await snaptikFetch(fullUrl)
    const decoded = decodeSnaptik(rawData)
    if (!decoded) return null

    const $ = cheerio.load(decoded)
    if ($('.error, .alert-danger').first().text().trim()) return null

    let video = null, video_hd = null, music = null
    $('a[href]').each((_, el) => {
      let href = $(el).attr('href') || ''
      if (href.startsWith('//')) href = 'https:' + href
      if (!href.startsWith('http') || isNonMediaLink(href)) return

      const cls = $(el).attr('class') || ''
      const dl  = $(el).attr('download')
      const isMp4Ext = /\.mp4(\?|$)/i.test(href)
      const isMp3Ext = /\.(mp3|m4a)(\?|$)/i.test(href)

      // Hanya anggap link download valid kalau ada atribut download ATAU ekstensi file eksplisit —
      // teks anchor ("download video" dsb) gampang salah tangkap link promosi/iklan.
      if (dl === undefined && !isMp4Ext && !isMp3Ext) return

      const txt   = $(el).text().toLowerCase().trim()
      const dlAttr = (dl || '').toLowerCase()
      const isHD  = txt.includes('hd') || cls.includes('hd') || dlAttr.includes('hd')

      if (isMp3Ext && !music) music = href
      else if (isHD && !video_hd) video_hd = href
      else if (!video) video = href
    })

    return { slides: [], video, video_hd, music }
  } catch (e) { console.log('[fetchViaSnaptik]', e.message); return null }
}

// Provider 2: ssstik — bisa deteksi slide (foto) sekaligus video
async function fetchViaSsstik(url) {
  try {
    const H = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
      'Accept-Language': 'id-ID,id;q=0.9',
    }

    const pageRes = await axios.get('https://ssstik.io/id', { headers: H, timeout: 15000 })
    const $page  = cheerio.load(pageRes.data)
    const tt     = $page('input[name="tt"]').val() || ''

    const formRes = await axios.post(
      'https://ssstik.io/abc?url=dl',
      new URLSearchParams({ id: url, locale: 'id', tt }).toString(),
      {
        headers: {
          ...H,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://ssstik.io/id',
          'Origin': 'https://ssstik.io',
          'HX-Request': 'true',
          'HX-Target': 'target',
        },
        timeout: 30000,
      }
    )

    const $r = cheerio.load(formRes.data)
    if ($r('.error, .alert, [class*="error"]').first().text().trim()) return null

    const slides = [], videos = []
    let music = null
    $r('a[href]').each((_, el) => {
      const href = $r(el).attr('href') || ''
      if (!href.startsWith('http') || isNonMediaLink(href)) return
      const txt  = $r(el).text().toLowerCase().trim()

      const isMusic = txt.includes('mp3') || txt.includes('musik') || txt.includes('music') || txt.includes('audio') || href.includes('/ssstik/m/')
      const isVideo = /\.mp4/i.test(href) || txt.includes('video') || txt.includes('mp4')
      const isSlide = href.includes('/ssstik/') && !isMusic && !isVideo

      if (isMusic && !music) music = href
      else if (isSlide && !slides.includes(href)) slides.push(href)
      else if (isVideo && !videos.includes(href)) videos.push(href)
    })

    return { slides, video: videos[0] || null, video_hd: videos[1] || null, music }
  } catch (e) { console.log('[fetchViaSsstik]', e.message); return null }
}

// Provider 3: musicaldown.com — fallback tambahan (video + slide)
async function fetchViaMusicaldown(url) {
  try {
    const H = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'id-ID,id;q=0.9',
    }

    // Step 1: ambil halaman utama → cookie session + nama field form
    // (nama field-nya acak per-load, mis. "_ZuT"/"_pCOSh", jadi harus dibaca dari HTML, bukan hardcode)
    const pageRes = await axios.get('https://musicaldown.com/id', { headers: H, timeout: 15000 })
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
          ...H,
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
      else if (!isWatermark && !videos[0]) videos[0] = href // "Download MP4" polos = versi utama non-watermark
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

    return { slides, video: videos[0] || null, video_hd: videos[1] || null, music }
  } catch (e) { console.log('[fetchViaMusicaldown]', e.message); return null }
}


// Susun metadata dasar yang dipakai semua fungsi downloader
async function buildMetaFields(fullUrl, videoId) {
  const meta = await getTiktokMeta(fullUrl, videoId)
  return {
    id:        videoId,
    title:     meta.title,
    author:    meta.author,
    authorUrl: meta.authorUrl,
    thumbnail: meta.thumbnail,
    stats: {
      likes:    meta.likes,
      views:    meta.views,
      comments: meta.comments,
      shares:   meta.shares,
    },
  }
}

// Cek apakah hasil provider ({ slides, video, video_hd, music }) punya isi
const hasDlResult = (r) => r && (r.slides.length || r.video || r.video_hd || r.music)

// Gabungkan metadata + hasil provider jadi satu response ok()
const buildDlResult = (metaFields, r) => ok({
  ...metaFields,
  type:         r.slides.length ? 'photo' : 'video',
  slides:       r.slides,
  slides_count: r.slides.length,
  video:        r.video,
  video_hd:     r.video_hd,
  music:        r.music,
})

/*
 * Download TikTok — auto-detect video atau slide/foto dari satu URL.
 * Urutan provider: snaptik (video) → ssstik (slide + fallback)
 * @param {string} url - URL TikTok (video/photo, boleh short link)
 */
const tiktok = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('tiktok.com'))
        return resolve(fail('URL TikTok tidak valid'))

      const { url: fullUrl, id: videoId, isPhoto } = await resolveUrl(url)
      const metaFields = await buildMetaFields(fullUrl, videoId)

      // Rute cepat: URL sudah teridentifikasi sebagai foto/slide
      if (isPhoto) {
        const s = await fetchViaSsstik(url)
        if (hasDlResult(s)) return resolve(buildDlResult(metaFields, s))
        return resolve(fail('Tidak ditemukan link download — URL tidak valid atau private'))
      }

      // Rute utama: coba sebagai video via snaptik
      const v = await fetchViaSnaptik(fullUrl)
      if (hasDlResult(v)) return resolve(buildDlResult(metaFields, v))

      // Fallback: mungkin sebenarnya slide/foto — cek ulang via ssstik
      const s = await fetchViaSsstik(url)
      if (hasDlResult(s)) return resolve(buildDlResult(metaFields, s))

      resolve(fail('Tidak ditemukan link download — URL tidak valid atau private'))
    } catch (e) { console.log('[tiktok]', e.message); resolve(fail(e)) }
  })
}

/*
 * Download TikTok via musicaldown.com — provider terpisah dari tiktok, auto-detect video/foto.
 * @param {string} url - URL TikTok (video/photo, boleh short link)
 */
const musically = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('tiktok.com'))
        return resolve(fail('URL TikTok tidak valid'))

      const { url: fullUrl, id: videoId } = await resolveUrl(url)
      const metaFields = await buildMetaFields(fullUrl, videoId)

      const m = await fetchViaMusicaldown(url)
      if (hasDlResult(m)) return resolve(buildDlResult(metaFields, m))

      resolve(fail('Tidak ditemukan link download — URL tidak valid atau private'))
    } catch (e) { console.log('[musically]', e.message); resolve(fail(e)) }
  })
}

// Decode render_token JWT
const getRenderVideo = (renderToken, fallbackAudio = null) => {
  try {
    const payload = JSON.parse(Buffer.from(renderToken.split('.')[1], 'base64').toString())
    const { image_urls, audio_url, filename, id } = payload
    if (!image_urls?.length) return fail('render_token tidak mengandung image_urls')
    return ok({ image_urls, audio_url: audio_url || fallbackAudio || null, filename: filename || ('SnapTik_' + (id || Date.now()) + '.mp4'), id: id || null })
  } catch (e) { return fail('Gagal decode render_token: ' + e.message) }
}

/*
 * Render slide menjadi video MP4 menggunakan ffmpeg
 * Butuh: ffmpeg terinstall (pkg install ffmpeg)
 * @param {object} param - { image_urls, audio_url, filename }
 */
const renderToVideo = async ({ image_urls, audio_url, filename }) => {
  const fs   = require('fs')
  const path = require('path')
  const { execSync } = require('child_process')

  // Buat folder temp jika belum ada
  const tempBase = path.join('.', 'temp')
  if (!fs.existsSync(tempBase)) fs.mkdirSync(tempBase, { recursive: true })

  const tmpDir   = fs.mkdtempSync(path.join(tempBase, 'snaptik-'))
  const dirName  = path.basename(tmpDir)                          // snaptik-Zg40tu
  const outName  = filename || `${dirName}.mp4`                   // fallback: snaptik-Zg40tu.mp4
  const outFile  = path.join(tmpDir, outName)
  
  try {
    const imgHeaders = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
      'Referer': 'https://ssstik.io/',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    }

    // Download semua foto
    const imgPaths = []
    for (let i = 0; i < image_urls.length; i++) {
      const imgPath = path.join(tmpDir, `img_${i}.jpg`)
      const res = await axios.get(image_urls[i], { headers: imgHeaders, responseType: 'arraybuffer', timeout: 30000 })
      fs.writeFileSync(imgPath, res.data)
      imgPaths.push(imgPath)
    }

    // Download audio — validasi magic bytes
    let audioPath = null
    if (audio_url) {
      const audioAttempts = [
        { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0', 'Referer': 'https://ssstik.io/' },
        { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15', 'Referer': 'https://www.tiktok.com/' },
        { 'User-Agent': 'Mozilla/5.0' },
      ]
      for (const h of audioAttempts) {
        try {
          const audioRes = await axios.get(audio_url, { headers: h, responseType: 'arraybuffer', timeout: 30000 })
          const buf   = Buffer.from(audioRes.data)
          if (buf.length < 1000) continue
          const magic = buf.slice(0, 4).toString('hex')
          const valid = magic.startsWith('fff') || magic.startsWith('4944') || buf.slice(4,8).toString() === 'ftyp' || magic === '4f676753'
          if (valid) { audioPath = path.join(tmpDir, 'audio.mp3'); fs.writeFileSync(audioPath, buf); break }
        } catch (_) {}
      }
    }

    const scale = 'scale=trunc(iw/2)*2:trunc(ih/2)*2'
    let ffmpegCmd
    
    if (imgPaths.length === 1) {
      // Single image
      ffmpegCmd = audioPath
        ? `ffmpeg -y -loop 1 -i "${imgPaths[0]}" -i "${audioPath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -shortest -pix_fmt yuv420p -vf "${scale}" "${outFile}"`
        : `ffmpeg -y -loop 1 -i "${imgPaths[0]}" -f lavfi -i anullsrc=r=44100:cl=stereo -c:v libx264 -tune stillimage -c:a aac -b:a 64k -t 30 -pix_fmt yuv420p -vf "${scale}" "${outFile}"`
    
    } else {
      // Multiple images — setiap foto tampil perImg detik
      let audioDur = 30
      if (audioPath) {
        try {
          const probe = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${audioPath}"`, { timeout: 10000 }).toString().trim()
          audioDur = parseFloat(probe) || 30
        } catch (_) {}
      }
      const perImg = Math.max(1, audioDur / imgPaths.length)
    
      // Step 1: Buat slide video (gambar bergantian, tanpa audio)
      // Pakai -loop 1 -t per gambar + concat filter (bukan concat demuxer)
      const slideVideo  = path.join(tmpDir, 'slides.mp4')
      const inputs      = imgPaths.map(p => `-loop 1 -t ${perImg.toFixed(3)} -i "${p}"`).join(' ')
      // Setelah download semua foto, ambil dimensi referensi dari img pertama
      let refW = 0, refH = 0
      try {
        const probeOut = execSync(
          `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${imgPaths[0]}"`,
          { timeout: 10000 }
        ).toString().trim()
        const [w, h] = probeOut.split(',').map(Number)
        refW = w % 2 === 0 ? w : w - 1
        refH = h % 2 === 0 ? h : h - 1
      } catch (_) {}
      
      const filterParts = imgPaths.map((_, i) =>
        refW && refH
          ? `[${i}:v]scale=${refW}:${refH}:force_original_aspect_ratio=decrease,pad=${refW}:${refH}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
          : `[${i}:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1[v${i}]`
      ).join(';')
      const concatIn    = imgPaths.map((_, i) => `[v${i}]`).join('')
      const filter      = `${filterParts};${concatIn}concat=n=${imgPaths.length}:v=1:a=0[vout]`
    
      const slideCmd = `ffmpeg -y ${inputs} -filter_complex "${filter}" -map "[vout]" -c:v libx264 -pix_fmt yuv420p -r 25 "${slideVideo}"`
      execSync(slideCmd, { timeout: 120000, stdio: 'pipe' })
    
      // Step 2: Gabungkan slide video + audio
      ffmpegCmd = audioPath
        ? `ffmpeg -y -i "${slideVideo}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -shortest "${outFile}"`
        : `ffmpeg -y -i "${slideVideo}" -f lavfi -i anullsrc=r=44100:cl=stereo -c:v copy -c:a aac -b:a 64k -shortest "${outFile}"`
    }
    
    execSync(ffmpegCmd, { timeout: 120000, stdio: 'pipe' })
    const videoBuffer = fs.readFileSync(outFile)
    const sizeMB = (videoBuffer.length / 1024 / 1024).toFixed(2)
    return ok({
      buffer:    videoBuffer,
      path:      outFile,
      tmpDir,
      filename:  outName,
      size:      videoBuffer.length,
      size_mb:   parseFloat(sizeMB),
      has_audio: !!audioPath,
    })
  } catch (e) {
    try { require('fs').rmSync(tmpDir, { recursive: true }) } catch (_) {}
    return fail('renderToVideo error: ' + e.message)
  }
}

module.exports = { tiktok, musically, getRenderVideo, renderToVideo }