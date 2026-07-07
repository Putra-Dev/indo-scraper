const scrap = new (require('.'))() 

scrap.musically('https://vt.tiktok.com/ZSx1jr9kj/').then(async(data) => {
  console.log(data)
})