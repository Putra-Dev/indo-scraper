const { fetchJSON, ok, fail } = require('../utils')

/* Gempa terbaru (1 data) */
const bmkgGempa = async () => {
  return new Promise(async (resolve) => {
    try {
      const json = await fetchJSON('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json')
      const g = json.Infogempa.gempa
      resolve(ok({
        tanggal: g.Tanggal, jam: g.Jam, datetime: g.DateTime,
        koordinat: g.Coordinates, lintang: g.Lintang, bujur: g.Bujur,
        magnitude: g.Magnitude, kedalaman: g.Kedalaman,
        wilayah: g.Wilayah, potensi: g.Potensi, dirasakan: g.Dirasakan,
        shakemap: `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}`,
      }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/* 15 gempa terkini */
const bmkgGempaTerkini = async () => {
  return new Promise(async (resolve) => {
    try {
      const json = await fetchJSON('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json')
      const list = json.Infogempa.gempa
      if (!list?.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(list.map(g => ({
        tanggal: g.Tanggal, jam: g.Jam, datetime: g.DateTime,
        koordinat: g.Coordinates, lintang: g.Lintang, bujur: g.Bujur,
        magnitude: g.Magnitude, kedalaman: g.Kedalaman,
        wilayah: g.Wilayah, potensi: g.Potensi,
        shakemap: `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}`,
      }))))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

/* Gempa yang dirasakan */
const bmkgGempaDirasakan = async () => {
  return new Promise(async (resolve) => {
    try {
      const json = await fetchJSON('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json')
      const list = json.Infogempa.gempa
      if (!list?.length) return resolve(fail('Data tidak ditemukan'))
      resolve(ok(list.map(g => ({
        tanggal: g.Tanggal, jam: g.Jam, datetime: g.DateTime,
        koordinat: g.Coordinates, lintang: g.Lintang, bujur: g.Bujur,
        magnitude: g.Magnitude, kedalaman: g.Kedalaman,
        wilayah: g.Wilayah, dirasakan: g.Dirasakan, potensi: g.Potensi,
        shakemap: `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}`,
      }))))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { bmkgGempa, bmkgGempaTerkini, bmkgGempaDirasakan }
