const { axios, ok, fail } = require('../utils')

/*
 * SimSimi / AI Chat
 * Source: widipe.com
 * @param {string} text
 */

const simsimi = async (text) => {
  return new Promise(async (resolve) => {
    try {

      if (!text)
        return resolve(
          fail('Text tidak boleh kosong')
        )

      const res = await axios.get(
        'https://widipe.com/simi',
        {
          params: {
            text
          },
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Linux; Android 13; Pixel 7)',

            'Accept':
              'application/json'
          },
          timeout: 15000
        }
      )

      const data = res.data

      /*
       * parse response
       */

      const answer =
        data.result ||
        data.message ||
        data.response

      if (!answer)
        return resolve(
          fail('Tidak ada respon')
        )

      resolve(ok({
        question: text,
        answer
      }))

    } catch (e) {

      console.log(e)

      resolve(fail(
        e?.response?.data ||
        e?.response?.status ||
        e.message
      ))
    }
  })
}

module.exports = { simsimi }