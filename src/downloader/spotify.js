const { axios, fetchHTML, ok, fail } = require('../utils')

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9',
}

const _id = (url, type) => url.match(new RegExp(`spotify\\.com\\/${type}\\/([a-zA-Z0-9]+)`))?.[1] || null

const _state = (html) => {
  try {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (m) return JSON.parse(m[1])
  } catch (_) {}
  return null
}

const _cover = (entity) => {
  const imgs = entity?.visualIdentity?.image || entity?.coverArt?.sources || entity?.images || []
  if (!imgs.length) return null
  return imgs.sort((a, b) => (b.maxWidth || b.width || 0) - (a.maxWidth || a.width || 0))[0]?.url || null
}

const _duration = (ms) => {
  if (!ms || isNaN(ms)) return null
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0')
  return `${m}:${s}`
}

// Ambil anonymous access token dari Spotify web player
const _getToken = async () => {
  const res = await axios.get('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
    headers: { ...HEADERS, 'Referer': 'https://open.spotify.com/' },
    timeout: 10000,
  })
  return res.data?.accessToken || null
}

// Cari video YouTube pertama dari query
const _ytSearch = async (query) => {
  const html = await fetchHTML(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    { 'User-Agent': HEADERS['User-Agent'], 'Accept-Language': 'en-US,en;q=0.9' }
  )
  const m = html.match(/var ytInitialData\s*=\s*({[\s\S]*?});<\/script>/)
  if (!m) return null
  try {
    const data     = JSON.parse(m[1])
    const sections = data?.contents?.twoColumnSearchResultsRenderer
                       ?.primaryContents?.sectionListRenderer?.contents || []
    for (const sec of sections) {
      for (const item of sec?.itemSectionRenderer?.contents || []) {
        if (item?.videoRenderer?.videoId) return item.videoRenderer.videoId
      }
    }
  } catch (_) {}
  return null
}

// Download audio via cobalt → fallback yt1s
const _ytDownload = async (videoId) => {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`
  // Cobalt
  try {
    const res = await axios.post('https://co.wuk.sh/api/json',
      { url: ytUrl, isAudioOnly: true, aFormat: 'mp3', filenamePattern: 'basic' },
      { headers: { ...HEADERS, 'Accept': 'application/json', 'Content-Type': 'application/json' }, timeout: 20000 }
    )
    if (res.data?.url) return { url: res.data.url, source: 'cobalt' }
  } catch (_) {}
  // yt1s fallback
  try {
    const page = await axios.post('https://yt1s.com/api/ajaxSearch',
      new URLSearchParams({ q: ytUrl, vt: 'home' }).toString(),
      { headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://yt1s.com/' }, timeout: 15000 }
    )
    const kId = page.data?.kId
    const bid  = Object.keys(page.data?.links?.mp3 || {})[0]
    if (kId && bid) {
      const conv = await axios.post('https://yt1s.com/api/ajaxConvert',
        new URLSearchParams({ vid: videoId, k: bid }).toString(),
        { headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://yt1s.com/' }, timeout: 20000 }
      )
      if (conv.data?.dlink) return { url: conv.data.dlink, source: 'yt1s' }
    }
  } catch (_) {}
  return null
}

/*
 * Spotify Search Track
 * @param {string} query
 * @param {number} limit
 */
const spotifySearch = async (query, limit = 10) => {
  return new Promise(async (resolve) => {
    try {
      if (!query) return resolve(fail('Query tidak boleh kosong'))

      const token = await _getToken()
      if (!token) return resolve(fail('Gagal mendapatkan token Spotify'))

      const res = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
        headers: { ...HEADERS, 'Authorization': `Bearer ${token}` },
        timeout: 15000,
      })

      const items = res.data?.tracks?.items || []
      if (!items.length) return resolve(fail('Tidak ada hasil'))

      resolve(ok(items.map(t => ({
        id:       t.id,
        title:    t.name,
        artist:   t.artists?.map(a => a.name).join(', ') || null,
        album:    t.album?.name || null,
        release:  t.album?.release_date || null,
        duration: _duration(t.duration_ms),
        cover:    t.album?.images?.[0]?.url || null,
        preview:  t.preview_url || null,
        url:      t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
      }))))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Spotify Track Info + Preview URL (30 detik)
 * @param {string} url - URL track Spotify
 */
const spotifyTrack = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('spotify.com'))
        return resolve(fail('URL Spotify tidak valid'))

      const id = _id(url, 'track')
      if (!id) return resolve(fail('Track ID tidak ditemukan'))

      const html   = await fetchHTML(`https://open.spotify.com/embed/track/${id}`, HEADERS)
      const entity = _state(html)?.props?.pageProps?.state?.data?.entity
      if (!entity) return resolve(fail('Data track tidak ditemukan'))

      resolve(ok({
        id,
        title:    entity.name || entity.title || null,
        artist:   (entity.artists || []).map(a => a.name).join(', ') || null,
        release:  entity.releaseDate?.isoString?.slice(0, 10) || null,
        duration: _duration(entity.duration),
        cover:    _cover(entity),
        preview:  entity.audioPreview?.url || null,
        url:      `https://open.spotify.com/track/${id}`,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Spotify Download — cari di YouTube lalu download audio
 * @param {string} url - URL track Spotify
 */
const spotifyDownload = async (url) => {
  return new Promise(async (resolve) => {
    try {
      const track = await spotifyTrack(url)
      if (!track.status) return resolve(track)

      const { title, artist } = track.data
      const query = `${title} ${artist} audio`

      const ytId = await _ytSearch(query)
      if (!ytId) return resolve(fail('Video YouTube tidak ditemukan'))

      const dl = await _ytDownload(ytId)

      resolve(ok({
        ...track.data,
        youtube_id:  ytId,
        youtube_url: `https://www.youtube.com/watch?v=${ytId}`,
        download:    dl?.url    || null,
        dl_source:   dl?.source || null,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Spotify Album Info + list track (ringan)
 * @param {string} url - URL album Spotify
 */
const spotifyAlbum = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('spotify.com'))
        return resolve(fail('URL Spotify tidak valid'))

      const id = _id(url, 'album')
      if (!id) return resolve(fail('Album ID tidak ditemukan'))

      const html   = await fetchHTML(`https://open.spotify.com/embed/album/${id}`, HEADERS)
      const entity = _state(html)?.props?.pageProps?.state?.data?.entity
      if (!entity) return resolve(fail('Data album tidak ditemukan'))

      const tracks = (entity.tracks?.items || []).map(t => ({
        id:       t.track?.id   || t.uid  || null,
        title:    t.track?.name || t.name || null,
        artist:   (t.track?.artists || t.artists || []).map(a => a.name).join(', '),
        duration: _duration(t.track?.duration?.totalMilliseconds || t.track?.duration || t.duration),
      }))

      resolve(ok({
        id,
        title:       entity.name || null,
        artist:      (entity.artists || []).map(a => a.name).join(', ') || null,
        release:     entity.date?.isoString?.slice(0, 10) || entity.releaseDate?.isoString?.slice(0, 10) || null,
        total_track: entity.tracks?.totalCount || tracks.length,
        cover:       _cover(entity),
        tracks,
        url: `https://open.spotify.com/album/${id}`,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Spotify Playlist Info + list track (ringan)
 * @param {string} url - URL playlist Spotify
 */
const spotifyPlaylist = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('spotify.com'))
        return resolve(fail('URL Spotify tidak valid'))

      const id = _id(url, 'playlist')
      if (!id) return resolve(fail('Playlist ID tidak ditemukan'))

      const html   = await fetchHTML(`https://open.spotify.com/embed/playlist/${id}`, HEADERS)
      const entity = _state(html)?.props?.pageProps?.state?.data?.entity
      if (!entity) return resolve(fail('Data playlist tidak ditemukan'))

      const tracks = (entity.trackList || entity.tracks?.items || []).map(t => ({
        id:     t.uid || t.track?.id || null,
        title:  t.track?.name || t.name || null,
        artist: (t.track?.artists || t.artists || []).map(a => a.name).join(', '),
      }))

      resolve(ok({
        id,
        title:       entity.name || null,
        owner:       entity.ownerV2?.data?.name || null,
        description: entity.description || null,
        total_track: entity.tracks?.totalCount || tracks.length,
        cover:       _cover(entity),
        tracks,
        url: `https://open.spotify.com/playlist/${id}`,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { spotifySearch, spotifyTrack, spotifyDownload, spotifyAlbum, spotifyPlaylist }
