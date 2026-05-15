const { axios, fetchHTML, ok, fail } = require('../utils')

const TV_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
  'Content-Type': 'application/x-www-form-urlencoded',
  'Origin': 'https://id.tradingview.com',
  'Referer': 'https://id.tradingview.com/',
}

/*
 * Harga saham Indonesia dari TradingView
 * @param {string} kode - ihsg | bbca | bbri | bmri | tlkm | atau kode saham IDX lainnya
 */
const saham = async (kode = 'ihsg') => {
  return new Promise(async (resolve) => {
    try {
      const isIHSG = kode.toLowerCase() === 'ihsg'

      if (isIHSG) {
        const html = await fetchHTML('https://id.tradingview.com/symbols/IDX-COMPOSITE/', {
          Referer: 'https://id.tradingview.com/',
        })
        const match = html.match(/\{"close":"([\d.]+)","data_update_time":"([\d.]+)","high":"([\d.]+)","low":"([\d.]+)","open":"([\d.]+)","time":"(\d+)"[^}]*"volume":"([\d.]+)"/)
        if (!match) return resolve(fail('Data IHSG tidak ditemukan'))
        return resolve(ok({
          kode: 'IHSG', symbol: 'IDX:COMPOSITE',
          open: parseFloat(match[5]), high: parseFloat(match[3]),
          low: parseFloat(match[4]), close: parseFloat(match[1]),
          volume: parseFloat(match[7]),
          update: new Date(parseInt(match[2]) * 1000).toISOString(),
          sumber: 'TradingView',
        }))
      }

      const ticker = kode.toUpperCase()
      const res = await axios.post(
        'https://scanner.tradingview.com/indonesia/scan',
        JSON.stringify({
          symbols: { tickers: [`IDX:${ticker}`] },
          columns: [
            'name', 'description', 'close', 'open', 'high', 'low', 'volume',
            'change', 'change_abs',
            'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.Y', 'Perf.YTD'
          ],
        }),
        { headers: TV_HEADERS, timeout: 10000 }
      )

      if (!res.data?.data?.length) return resolve(fail(`Saham ${ticker} tidak ditemukan`))
      const d = res.data.data[0].d
      resolve(ok({
        kode:          d[0],
        nama:          d[1],
        close:         d[2],
        open:          d[3],
        high:          d[4],
        low:           d[5],
        volume:        d[6],
        perubahan_pct: d[7]  ? +d[7].toFixed(2)  : null,
        perubahan_abs: d[8]  ? +d[8].toFixed(2)  : null,
        performa: {
          '1W':  d[9]  ? +d[9].toFixed(2)  : null,
          '1M':  d[10] ? +d[10].toFixed(2) : null,
          '3M':  d[11] ? +d[11].toFixed(2) : null,
          '6M':  d[12] ? +d[12].toFixed(2) : null,
          '1Y':  d[13] ? +d[13].toFixed(2) : null,
          'YTD': d[14] ? +d[14].toFixed(2) : null,
        },
        sumber: 'TradingView',
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/*
 * Daftar saham Indonesia (top by market cap)
 * @param {number} limit - jumlah saham (max 906, default 50)
 */
const sahamList = async (limit = 50) => {
  return new Promise(async (resolve) => {
    try {
      const res = await axios.post(
        'https://scanner.tradingview.com/indonesia/scan',
        JSON.stringify({
          columns: [
            'name', 'description', 'close', 'change', 'change_abs',
            'volume', 'market_cap_basic',
            'Perf.W', 'Perf.1M', 'Perf.Y', 'Perf.YTD'
          ],
          sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' },
          range: [0, limit],
        }),
        { headers: TV_HEADERS, timeout: 10000 }
      )

      if (!res.data?.data?.length) return resolve(fail('Data tidak ditemukan'))
      const data = res.data.data.map(item => ({
        kode:          item.d[0],
        nama:          item.d[1],
        close:         item.d[2],
        perubahan_pct: item.d[3] ? +item.d[3].toFixed(2) : null,
        perubahan_abs: item.d[4] ? +item.d[4].toFixed(2) : null,
        volume:        item.d[5],
        market_cap:    item.d[6],
        performa: {
          '1W':  item.d[7]  ? +item.d[7].toFixed(2)  : null,
          '1M':  item.d[8]  ? +item.d[8].toFixed(2)  : null,
          '1Y':  item.d[9]  ? +item.d[9].toFixed(2)  : null,
          'YTD': item.d[10] ? +item.d[10].toFixed(2) : null,
        },
      }))
      resolve(ok({ total: res.data.totalCount, tampil: data.length, data }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { saham, sahamList }
