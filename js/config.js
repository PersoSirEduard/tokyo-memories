// Everything personal lives here. Swap photos, captions, colours and the ending note
// without touching any game code.

export const TITLE = {
  jp: '東京',
  en: 'Tokyo Memories',
};

// Colours are hex. "player" is her, "companion" is you.
export const PEOPLE = {
  player: {
    skin: 0xf3d6c2,
    hair: 0x141215,
    top: 0xf6f4f0, // white cropped tee
    trim: 0x18181c, // black sleeve stripes and collar
    bottom: 0x1b1b1f, // black midi skirt
    legs: 0xf3d6c2,
    shoes: 0xf4f1ea,
    camera: 0xa9dccd,
  },
  companion: {
    skin: 0xf2d0b8,
    hair: 0x7a4a2e, // auburn, wavy
    top: 0xf4f2ee, // white tee
    bottom: 0x8a8479, // grey-khaki trousers
    shoes: 0x8e939b,
    backpack: 0x2f4b3c,
    glasses: 0x2a2624,
    camera: 0x1c1c1f,
    height: 1.16, // relative to her
  },
};

// Trip order. The last stop ends at home instead of returning to the station.
// layout: station = [blockX, blockZ, side the entrance faces], plaza = [blockX, blockZ]
// Blocks are a 3x3 grid, 0..2 on each axis (z = 0 is the top of the screen).
export const STOPS = [
  {
    id: 'shibuya',
    landmark: 'hachiko',
    spotName: 'Hachikō',
    station: { jp: '渋谷', en: 'Shibuya', badge: 'G01', line: 'Ginza Line', color: '#f39700', exit: 'Hachikō Exit' },
    photo: 'assets/photos/01-shibuya.jpg',
    caption: 'Tired, but saying hi to Hachikō, the goodest boy in Tokyo',
    day: 'Day 1',
    layout: { station: [2, 2, 'w'], plaza: [0, 1] },
    city: { heights: [7, 20], palette: ['#ece4d4', '#d8d0c2', '#c9d3da', '#e8d4ca', '#c3c8d2', '#e2dccb'], neon: 0.8, screens: true, scramble: true, wires: true },
  },
  {
    id: 'disneysea',
    landmark: 'aquasphere',
    spotName: 'DisneySea',
    station: { jp: '東京ディズニーシー・ステーション', short: 'ディズニーシー', en: 'Tokyo DisneySea Sta.', badge: 'DRL', line: 'Disney Resort Line', color: '#2a9fd8', exit: 'via JR Maihama' },
    photo: 'assets/photos/02-disneysea.jpg',
    caption: 'It feels like it was just yesterday, a whole day of being kids again',
    day: 'Day 2',
    train: { windows: 'round', sea: true }, // Disney Resort Line rides, to and from here
    layout: { station: [0, 0, 'e'], plaza: [2, 2] },
    city: { heights: [3, 7], palette: ['#f6d7b8', '#f3c9c0', '#f7e6b5', '#d9e6d0', '#f0d0a6', '#e8c2b0'], roofs: ['#c8643c', '#b5552f', '#d27a4a'], neon: 0, lagoon: true, volcano: true, warm: true },
  },
  {
    id: 'tower',
    landmark: 'tokyotower',
    spotName: 'Tokyo Tower',
    station: { jp: '赤羽橋', en: 'Akabanebashi', badge: 'E21', line: 'Toei Ōedo Line', color: '#ce045b', exit: 'Akabanebashi Exit' },
    photo: 'assets/photos/03-tokyo-tower.jpg',
    caption: 'Our calm walk back home, passing Tokyo Tower glowing just for us (and the baby we bought at the Familymart)',
    day: 'Day 2',
    layout: { station: [0, 2, 'e'], plaza: [1, 0] },
    city: { heights: [5, 14], palette: ['#eadfd0', '#d9cfc4', '#e6e0d6', '#cfd4d8', '#e8d9cc'], neon: 0.5, wires: true },
  },
  {
    id: 'nihombashi',
    landmark: 'foodstalls',
    spotName: 'Nihombashi eats',
    station: { jp: '日本橋', en: 'Nihombashi', badge: 'G11', line: 'Ginza Line', color: '#f39700', exit: 'Exit B' },
    photo: 'assets/photos/04-nihombashi.jpg',
    caption: 'The best bowl of ramen of the whole trip',
    day: 'Day 3',
    layout: { station: [2, 0, 's'], plaza: [0, 2] },
    city: { heights: [6, 16], palette: ['#e6dccb', '#d4cbbd', '#ddd5c8', '#c8ccd2', '#eadfce'], neon: 0.6, lanterns: true, expressway: true },
  },
  {
    id: 'teamlab',
    landmark: 'teamlab',
    spotName: 'teamLab Borderless',
    station: { jp: '神谷町', en: 'Kamiyachō', badge: 'H05', line: 'Hibiya Line', color: '#9caeb7', exit: 'Azabudai Hills' },
    photo: 'assets/photos/05-teamlab.jpg',
    caption: 'Lost in a universe of lights, yet you were the shiniest of all',
    day: 'Day 3',
    layout: { station: [0, 2, 'n'], plaza: [2, 0] },
    city: { heights: [12, 32], palette: ['#d5dde6', '#c4cfdc', '#e3e6ea', '#b8c4d2', '#dfe4dc'], neon: 0.25, cool: true, mori: true },
  },
  {
    id: 'asakusa',
    landmark: 'sensoji',
    spotName: 'Sensō-ji',
    station: { jp: '浅草', en: 'Asakusa', badge: 'G19', line: 'Ginza Line', color: '#f39700', exit: 'Exit 1' },
    photo: 'assets/photos/06-asakusa.jpg',
    caption: 'One last look at the city lights, then home. I\'m glad we did this together',
    day: 'Day 3',
    layout: { station: [2, 2, 'n'], plaza: [0, 0], home: [0, 2, 'e'] },
    city: { heights: [3, 8], palette: ['#eadccb', '#d9c9b6', '#e4d8c8', '#cdbfae', '#efe4d2'], neon: 0.45, lanterns: true, skytree: true, wires: true },
  },
];

// One ride between each pair of stops (so STOPS.length - 1 of them). A stop's `train`
// settings (window shape, sea view) apply to rides arriving at or leaving that stop.
// couple: reels | hands | shoulder | sleepBoth | phoneShoulder
// shiba:  sleep | eat | poop | zoomies | sit
export const TRAIN_RIDES = [
  { couple: 'reels', shiba: 'sleep' },
  { couple: 'hands', shiba: 'eat' },
  { couple: 'shoulder', shiba: 'poop' },
  { couple: 'sleepBoth', shiba: 'zoomies' },
  { couple: 'phoneShoulder', shiba: 'sit' },
];

export const ENDING = {
  jp: 'ただいま',
  en: "We're home",
  note: 'Three days I\'ll never forget.\nThank you Yulia!.',
};
