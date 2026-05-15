const { ok, fail } = require('../utils')

/*
 * Cek provider nomor HP Indonesia
 * @param {string} nomor - contoh: 08123456789 atau +628123456789
 */
const cekNomor = async (nomor) => {
  return new Promise((resolve) => {
    try {
      const PREFIX = {
        '0811': 'Telkomsel', '0812': 'Telkomsel', '0813': 'Telkomsel',
        '0821': 'Telkomsel', '0822': 'Telkomsel', '0823': 'Telkomsel',
        '0851': 'Telkomsel', '0852': 'Telkomsel', '0853': 'Telkomsel',
        '0814': 'Indosat',   '0815': 'Indosat',   '0816': 'Indosat',
        '0855': 'Indosat',   '0856': 'Indosat',   '0857': 'Indosat',
        '0858': 'Indosat',   '0828': 'Indosat',
        '0817': 'XL',        '0818': 'XL',        '0819': 'XL',
        '0859': 'XL',        '0877': 'XL',        '0878': 'XL',
        '0831': 'AXIS',      '0832': 'AXIS',      '0833': 'AXIS',      '0838': 'AXIS',
        '0881': 'Smartfren', '0882': 'Smartfren', '0883': 'Smartfren',
        '0884': 'Smartfren', '0885': 'Smartfren', '0886': 'Smartfren',
        '0887': 'Smartfren', '0888': 'Smartfren', '0889': 'Smartfren',
        '0895': 'Three',     '0896': 'Three',     '0897': 'Three',
        '0898': 'Three',     '0899': 'Three',
      }
      let no = nomor.replace(/\s|-|\./g, '')
      if (no.startsWith('+62')) no = '0' + no.slice(3)
      if (no.startsWith('62'))  no = '0' + no.slice(2)
      if (!no.startsWith('0'))  no = '0' + no
      if (no.length < 10 || no.length > 13) return resolve(fail('Nomor tidak valid (10-13 digit)'))
      const prefix   = no.slice(0, 4)
      const provider = PREFIX[prefix]
      if (!provider) return resolve(fail(`Prefix ${prefix} tidak dikenali`))
      resolve(ok({ nomor_asli: nomor, nomor: no, prefix, provider, panjang: no.length }))
    } catch (e) { console.log(e); resolve(fail(e)) }
  })
}

module.exports = { cekNomor }
