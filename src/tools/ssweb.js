const { ok, fail } = require('../utils')

const DEVICES = {
  mobile:  { width: 390,  height: 844,  mobile: true  },
  tablet:  { width: 768,  height: 1024, mobile: true  },
  desktop: { width: 1920, height: 1080, mobile: false },
  hd:      { width: 2560, height: 1440, mobile: false },
  '4k':    { width: 3840, height: 2160, mobile: false },
}

/*
 * Website Screenshot via Microlink API
 * @param {string} url
 * @param {string} device - mobile | tablet | desktop | hd | 4k
 */
const ssweb = async (url, device = 'desktop') => {
  return new Promise(async (resolve) => {
    try {
      if (!url) return resolve(fail('URL tidak boleh kosong'))
      if (!/^https?:\/\//.test(url)) url = 'https://' + url

      const { width, height, mobile } = DEVICES[device.toLowerCase()] || DEVICES.desktop

      const screenshot = 'https://api.microlink.io/?' + new URLSearchParams({
        url, screenshot: 'true', meta: 'false', embed: 'screenshot.url',
        viewport: `${width}x${height}`, deviceScaleFactor: '1',
        mobile: String(mobile), fullPage: 'true',
      })

      resolve(ok({ url, device, resolution: `${width}x${height}`, screenshot }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { ssweb }
