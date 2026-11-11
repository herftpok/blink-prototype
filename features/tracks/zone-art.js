// Resolve place artwork relative to this catalog on both the map and replay pages.
const zoneArt = (() => {
  const image = path => new URL(path, document.currentScript.src).href;
  return {
    home: ['дом', image('../../assets/overnights/home.webp')],
    study: ['учёба', image('art/school.png')],
    airport: ['аэропорт', image('art/airport-44.png')],
    overnight: ['ночёвка', image('art/nighthouse-44.png')],
    metro: ['метро', image('art/metro.png')],
    work: ['работа', image('art/office-44.png')],
    gym: ['спортзал', image('../../assets/plans/buildings/gym.webp')],
    bar: ['бар', image('../../assets/plans/buildings/bar.webp')],
    coffee: ['кафе', image('../../assets/plans/buildings/coffee.webp')]
  };
})();
