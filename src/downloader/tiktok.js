const { axios, cheerio, ok, fail } = require('../utils')
const vm = require('vm')

// ── Helpers ────────────────────────────────────────────────────────────────

const SNAPTIK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9',
}

// Resolve short URL → dapatkan URL penuh + video ID
async function resolveUrl(url) {
  try {
    const res = await axios.get(url, {
      headers: SNAPTIK_HEADERS,
      maxRedirects: 10,
      timeout: 15000,
    })
    const finalUrl = res.request?.res?.responseUrl || res.config?.url || url
    const match = finalUrl.match(/video\/(\d+)/)
    return { url: finalUrl, id: match?.[1] || null }
  } catch (e) {
    const match = url.match(/video\/(\d+)/)
    return { url, id: match?.[1] || null }
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
 * @param {string} videoUrl - URL TikTok video
 * @param {string} videoId  - ID video (opsional, untuk scrape stats)
 */
async function getTiktokMeta(videoUrl, videoId = null) {
  let title = '', author = '', authorUrl = '', thumbnail = ''
  let likes = null, views = null, shares = null, comments = null

  // 1. oEmbed — dapat title, author, thumbnail
  try {
    const oe = await axios.get(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
    )
    title      = oe.data.title || ''
    author     = oe.data.author_name || ''
    authorUrl  = oe.data.author_url || ''
    thumbnail  = oe.data.thumbnail_url || ''
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

// ── TikTok Video Downloader ────────────────────────────────────────────────

/*
 * Download video TikTok dari snaptik + metadata dari TikTok embed
 * @param {string} url - URL TikTok video
 */
const tiktokDL = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('tiktok.com'))
        return resolve(fail('URL TikTok tidak valid'))

      // Resolve URL pendek → dapat video ID
      const { url: fullUrl, id: videoId } = await resolveUrl(url)

      // Fetch snaptik
      const rawData = await snaptikFetch(fullUrl)
      const decoded = decodeSnaptik(rawData)
      if (!decoded) return resolve(fail('Gagal decode respons snaptik'))

      // Parse download links
      const $ = cheerio.load(decoded)
      let video = null, video_hd = null, music = null

      const errEl = $('.error, .alert-danger').first().text().trim()
      if (errEl) return resolve(fail(errEl))

      $('a[href]').each((_, el) => {
        let href = $(el).attr('href') || ''
        if (href.startsWith('//')) href = 'https:' + href
        if (!href.startsWith('http')) return

        const txt = $(el).text().toLowerCase().trim()
        const cls = $(el).attr('class') || ''
        const dl  = $(el).attr('download') || ''

        const isHD    = txt.includes('hd') || cls.includes('hd') || dl.includes('hd')
        const isVideo = /\.mp4(\?|$)/i.test(href) || txt.includes('video') || dl.includes('mp4')
        const isMusic = /\.(mp3|m4a)(\?|$)/i.test(href) || txt.includes('music') || txt.includes('audio') || dl.includes('mp3')

        if (isMusic && !music) music = href
        else if (isHD && !video_hd) video_hd = href
        else if (isVideo && !video) video = href
      })

      // Ambil metadata TikTok
      const meta = await getTiktokMeta(fullUrl, videoId)

      if (!video && !video_hd) return resolve(fail('Tidak ditemukan link download — URL tidak valid atau private'))

      resolve(ok({
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
        video,
        video_hd,
        music,
      }))

    } catch (e) { console.log('[tiktokVideo]', e.message); resolve(fail(e)) }
  })
}

// ── TikTok Slide Downloader ────────────────────────────────────────────────

/*
 * Download TikTok slide — gambar + audio via ssstik.io
 * @param {string} url - URL TikTok video/slide
 */
const tiktokSlide = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('tiktok.com'))
        return resolve(fail('URL TikTok tidak valid'))

      const H = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9',
      }

      // Step 1: Ambil tt token dari halaman ssstik
      const pageRes = await axios.get('https://ssstik.io/id', { headers: H, timeout: 15000 })
      const $page  = cheerio.load(pageRes.data)
      const tt     = $page('input[name="tt"]').val() || ''

      // Step 2: Submit URL ke ssstik
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
      const slides = [], videos = []
      let music = null

      // Cek error
      const err = $r('.error, .alert, [class*="error"]').first().text().trim()
      if (err && err.length < 200) return resolve(fail(err))

      $r('a[href]').each((_, el) => {
        const href = $r(el).attr('href') || ''
        const txt  = $r(el).text().toLowerCase().trim()
        const cls  = $r(el).attr('class') || ''
        if (!href.startsWith('http')) return

        const isMusic = txt.includes('mp3') || txt.includes('musik') || txt.includes('music') || txt.includes('audio') || href.includes('/ssstik/m/')
        const isVideo = /\.mp4/i.test(href) || txt.includes('video') || txt.includes('mp4')
        const isSlide = href.includes('/ssstik/') && !isMusic && !isVideo

        if (isMusic && !music) music = href
        else if (isSlide && !slides.includes(href)) slides.push(href)
        else if (isVideo && !videos.includes(href)) videos.push(href)
      })

      if (!videos.length && !slides.length && !music)
        return resolve(fail('Tidak ditemukan link download — URL tidak valid atau private'))

      resolve(ok({
        type:         slides.length > 0 ? 'slide' : 'video',
        video:        videos[0] || null,
        video_hd:     videos[1] || null,
        slides,
        slides_count: slides.length,
        music,
      }))

    } catch (e) { console.log('[tiktokSlide]', e.message); resolve(fail(e)) }
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

module.exports = { tiktokDL, tiktokSlide, getRenderVideo, renderToVideo }