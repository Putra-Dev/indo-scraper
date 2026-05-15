const { fetchJSON, ok, fail } = require('../utils')

/*
 * Prakiraan cuaca kota populer
 * @param {string} kota - jakarta | bandung | surabaya | medan | semarang | makassar | yogyakarta | palembang | denpasar | balikpapan
 */
const bmkgCuaca = async (kota = 'jakarta') => {
  return new Promise(async (resolve) => {
    try {
      const KOTA = {
        jakarta: '31.71.05.1001', bandung: '32.73.04.1002', surabaya: '35.78.27.1001',
        medan: '12.71.01.1001', semarang: '33.74.01.1001', makassar: '73.71.01.1001',
        yogyakarta: '34.71.01.1001', palembang: '16.71.01.1001',
        denpasar: '51.71.01.1001', balikpapan: '64.72.01.1001',
      }
      const adm4 = KOTA[kota.toLowerCase()]
      if (!adm4) return resolve(fail(`Kota tidak tersedia. Pilihan: ${Object.keys(KOTA).join(', ')}`))
      const json   = await fetchJSON(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`)
      const lokasi = json.data?.[0]?.lokasi || {}
      const cuaca  = (json.data?.[0]?.cuaca || []).flat().map(i => ({
        datetime: i.local_datetime, cuaca: i.weather_desc,
        suhu: i.t, suhu_min: i.tmin, suhu_max: i.tmax,
        kelembaban: i.hu, angin: i.ws, arah_angin: i.wd, icon: i.image,
      }))
      if (!cuaca.length) return resolve(fail('Data cuaca tidak ditemukan'))
      resolve(ok({
        lokasi: { kecamatan: lokasi.kecamatan, kotkab: lokasi.kotkab, provinsi: lokasi.provinsi },
        prakiraan: cuaca,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { bmkgCuaca }
