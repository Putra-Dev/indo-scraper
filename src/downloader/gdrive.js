const { axios, ok, fail } = require('../utils')

const _formatBytes = (bytes) => {
  if (!bytes) return null
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
}

/*
 * Google Drive Downloader
 * @param {string} url
 */
const gdrive = async (url) => {
  return new Promise(async (resolve) => {
    try {
      if (!url || !url.includes('drive.google.com'))
        return resolve(fail('URL Google Drive tidak valid'))

      const id = url.match(/\/d\/(.*?)\//)?.[1] || url.match(/[?&]id=([^&]+)/)?.[1] || null
      if (!id) return resolve(fail('File ID tidak ditemukan'))

      const preview = `https://drive.google.com/file/d/${id}/view`
      const direct  = `https://drive.google.com/uc?export=download&id=${id}`

      const page = await axios.get(preview, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 })
      const filename = page.data.match(/<title>(.*?) - Google Drive<\/title>/)?.[1] || 'unknown'

      const head = await axios({ url: direct, method: 'GET', maxRedirects: 5, responseType: 'stream', headers: { 'User-Agent': 'Mozilla/5.0' } })
      const filesize = _formatBytes(Number(head.headers['content-length']) || 0)
      const mimetype = head.headers['content-type'] || 'unknown'

      resolve(ok({ id, filename, filesize, mimetype, direct, preview }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { gdrive }
