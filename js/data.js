/* Grok Spooks - static data: areas, rooms, enemies, bosses, upgrades */
(function () {
'use strict';
const SP = window.SP = window.SP || {};

/* ---- areas (floors) ---- */
SP.AREAS = [
  { id: 'foyer', n: 'Grand Foyer', icon: '\uD83D\uDD6F\uFE0F', floor: 'Floor 1', hub: 'foyer',
    pal: { floor: '#5b2a4a', floor2: '#7a3a5e', wall: '#3b2a5c', trim: '#d4a017', lit: '#ffd9a0', fog: '#1a1030' }, props: ['chair', 'table', 'vase', 'clock', 'sofa', 'plant', 'piano', 'bench', 'statue', 'cabinet'] },
  { id: 'library', n: 'Library', icon: '\uD83D\uDCDA', floor: 'Floor 2', hub: 'reading',
    pal: { floor: '#3a2a1a', floor2: '#4f3a22', wall: '#2b3a2a', trim: '#c08a3a', lit: '#ffe0a8', fog: '#121a10' }, props: ['shelf', 'shelf', 'desk', 'chair', 'globe', 'books', 'lamp', 'sofa', 'cabinet', 'vase'] },
  { id: 'kitchen', n: 'Haunted Kitchen', icon: '\uD83C\uDF73', floor: 'Basement', hub: 'pantry',
    pal: { floor: '#3c4650', floor2: '#55606b', wall: '#2c4a4a', trim: '#e0e0e0', lit: '#e8fbff', fog: '#0c1a1e' }, props: ['stove', 'fridge', 'counter', 'barrel', 'crate', 'pots', 'table', 'chair', 'sacks', 'cabinet'] },
  { id: 'garden', n: 'Greenhouse', icon: '\uD83C\uDF3F', floor: 'Floor 3', hub: 'shed',
    pal: { floor: '#2c4a2a', floor2: '#3c6038', wall: '#1f3f3a', trim: '#8fd18f', lit: '#e8ffd0', fog: '#0b1d12' }, props: ['plant', 'plant', 'pot', 'bench', 'barrel', 'statue', 'cactus', 'crate', 'fern', 'sacks'] },
  { id: 'crypt', n: 'Museum & Crypt', icon: '\u26B1\uFE0F', floor: 'Floor 4', hub: 'egypt',
    pal: { floor: '#4a3f2a', floor2: '#61553a', wall: '#3a3428', trim: '#e2b84a', lit: '#fff0c0', fog: '#1a160c' }, props: ['statue', 'sarco', 'urn', 'pillar', 'case', 'coffin', 'urn', 'crate', 'bench', 'vase'] },
  { id: 'tower', n: 'Clock Tower', icon: '\uD83D\uDD70\uFE0F', floor: 'Top Floor', hub: 'gears',
    pal: { floor: '#3a2f45', floor2: '#4d3f5c', wall: '#2a2340', trim: '#b4b4d8', lit: '#e6e0ff', fog: '#120d20' }, props: ['gear', 'clock', 'crate', 'trunk', 'chair', 'barrel', 'mirror', 'cabinet', 'sacks', 'trunk'] }
];

/* ---- rooms ----
   a: area index, gx/gy map cell (gy 0 = north), w/d size (x/z),
   waves: enemy kinds per wave, puz: puzzle type, key: puzzle/clear gives area key,
   gems: hide spots for this area's gems, boo: area Boo hides here, boss: boss id, hub: elevator */
SP.ROOMS = [
  // 1 Grand Foyer
  { id: 'porch', n: 'Front Porch', a: 0, gx: 1, gy: 2, w: 16, d: 12, tut: true, waves: [], gems: [] },
  { id: 'foyer', n: 'Grand Foyer', a: 0, gx: 1, gy: 1, w: 20, d: 14, hub: true, waves: [['goob', 'goob']], gems: ['web'] },
  { id: 'coat', n: 'Coat Room', a: 0, gx: 0, gy: 1, w: 16, d: 13, waves: [['bat', 'bat', 'bat']], puz: 'plates', key: true, gems: ['furn'], hint: 'Two plates! Stand on one, and put a friend or your Goo clone (SWAP) on the other.' },
  { id: 'gallery', n: 'Portrait Gallery', a: 0, gx: 2, gy: 1, w: 18, d: 13, waves: [['goob', 'slammer']], puz: 'paint', boo: true, gems: ['chest', 'curtain'], hint: 'The painting shows a colour order. FLASH the candles in that order!' },
  { id: 'dining', n: 'Dining Hall', a: 0, gx: 1, gy: 0, w: 20, d: 14, waves: [['goob', 'hider'], ['slammer', 'goob']], gems: ['clear', 'dark'], hint: 'A blue ghost is hiding in the furniture. VAC furniture to flush it out!' },
  { id: 'ballroom', n: 'Ballroom', a: 0, gx: 2, gy: 0, w: 22, d: 16, boss: 'waltzy', gems: [] },
  // 2 Library
  { id: 'reading', n: 'Reading Room', a: 1, gx: 1, gy: 2, w: 20, d: 14, hub: true, waves: [['polter']], gems: ['furn'], hint: 'Poltergeists throw things! Hold VAC to catch a book, then BLOW to fire it back.' },
  { id: 'stacks', n: 'The Stacks', a: 1, gx: 0, gy: 2, w: 18, d: 14, waves: [['shades', 'goob']], puz: 'beam', gems: ['chest'], hint: 'Sunglasses ghosts ignore FLASH. Use the PLUNGER to yank their shades off! BLOW the mirrors to turn them.' },
  { id: 'study', n: 'Study', a: 1, gx: 2, gy: 2, w: 16, d: 13, waves: [['invis', 'invis']], puz: 'dark', gems: ['web'], hint: 'Invisible ghosts! Hold DARK to reveal them, then FLASH.' },
  { id: 'maproom', n: 'Map Room', a: 1, gx: 1, gy: 1, w: 18, d: 14, waves: [['swarm']], puz: 'levers', key: true, gems: ['curtain'], hint: 'Tiny ghosts need no FLASH. Just VAC them! Pull both levers with the PLUNGER at the same time.' },
  { id: 'archive', n: 'Secret Archive', a: 1, gx: 2, gy: 1, w: 16, d: 12, waves: [['shades', 'polter']], boo: true, gems: ['clear', 'dark'], hint: 'You found a secret room!' },
  { id: 'readhall', n: 'Grand Reading Hall', a: 1, gx: 1, gy: 0, w: 22, d: 16, boss: 'pagewhirl', gems: [] },
  // 3 Kitchen
  { id: 'pantry', n: 'Pantry', a: 2, gx: 1, gy: 2, w: 18, d: 13, hub: true, waves: [['goob', 'hider', 'goob']], gems: ['furn'] },
  { id: 'kitchen', n: 'Main Kitchen', a: 2, gx: 1, gy: 1, w: 20, d: 14, waves: [['shieldy', 'shieldy']], puz: 'crate', gems: ['chest'], hint: 'Shield ghosts block your FLASH. VAC their shield away first! BLOW the crate onto the plate.' },
  { id: 'bakery', n: 'Bakery', a: 2, gx: 0, gy: 1, w: 16, d: 13, waves: [['swarm'], ['swarm']], puz: 'plates', gems: ['web', 'dark'] },
  { id: 'cold', n: 'Cold Storage', a: 2, gx: 2, gy: 1, w: 18, d: 14, waves: [['brute']], key: true, gems: ['clear'], hint: 'A big Brute! FLASH it when it gets tired after a slam. Two vacuums (or your Goo clone) pull faster!' },
  { id: 'scullery', n: 'Scullery', a: 2, gx: 0, gy: 0, w: 16, d: 13, waves: [['polter', 'shieldy']], puz: 'paint', boo: true, gems: ['curtain'] },
  { id: 'banquet', n: 'Banquet Hall', a: 2, gx: 1, gy: 0, w: 22, d: 16, boss: 'souffle', gems: [] },
  // 4 Greenhouse
  { id: 'shed', n: 'Potting Shed', a: 3, gx: 1, gy: 2, w: 18, d: 13, hub: true, waves: [['bat', 'bat', 'goob']], gems: ['furn'] },
  { id: 'fern', n: 'Fern House', a: 3, gx: 0, gy: 2, w: 18, d: 14, waves: [['invis', 'hider']], puz: 'fan', gems: ['chest'], hint: 'BLOW both pinwheels until they are full at the same time!' },
  { id: 'pond', n: 'Lily Pond', a: 3, gx: 2, gy: 2, w: 18, d: 14, waves: [['witch']], puz: 'beam', gems: ['web'], hint: 'Witches cast purple orbs. BLOW an orb back at her, or FLASH her while she chants!' },
  { id: 'cactus', n: 'Cactus Hall', a: 3, gx: 0, gy: 1, w: 18, d: 14, waves: [['swarm', 'slammer']], puz: 'levers', key: true, gems: ['curtain'] },
  { id: 'orchid', n: 'Orchid Room', a: 3, gx: 2, gy: 1, w: 16, d: 13, waves: [['invis', 'witch']], puz: 'dark', boo: true, gems: ['clear', 'dark'] },
  { id: 'dome', n: 'Vine Dome', a: 3, gx: 1, gy: 1, w: 22, d: 16, boss: 'mandrake', gems: [] },
  // 5 Museum & Crypt
  { id: 'egypt', n: 'Egypt Hall', a: 4, gx: 1, gy: 2, w: 20, d: 14, hub: true, waves: [['mummy', 'mummy']], gems: ['furn'], hint: 'Mummies shrug off FLASH. Hold VAC to unwrap them first!' },
  { id: 'armory', n: 'Armor Gallery', a: 4, gx: 2, gy: 2, w: 18, d: 14, waves: [['armor', 'armor']], puz: 'plates', gems: ['chest'], hint: 'Haunted armor! Watch for the red swing, then PLUNGER the helmet off.' },
  { id: 'bones', n: 'Bone Room', a: 4, gx: 0, gy: 2, w: 18, d: 14, waves: [['skeleton', 'skeleton', 'skeleton']], puz: 'paint', gems: ['web'], hint: 'FLASH a skeleton to make it fall apart, then VAC the glowing skull before it gets back up!' },
  { id: 'cryptst', n: 'Crypt Steps', a: 4, gx: 1, gy: 1, w: 18, d: 14, waves: [['bat', 'invis']], puz: 'crate', gems: ['curtain', 'dark'] },
  { id: 'tomb', n: 'Hidden Tomb', a: 4, gx: 0, gy: 1, w: 16, d: 13, waves: [['mummy', 'skeleton']], key: true, boo: true, gems: ['clear'], hint: 'You found the hidden tomb!' },
  { id: 'pharaoh', n: 'Pharaoh\u2019s Vault', a: 4, gx: 1, gy: 0, w: 22, d: 16, boss: 'mumbles', gems: [] },
  // 6 Clock Tower
  { id: 'gears', n: 'Gear Room', a: 5, gx: 1, gy: 2, w: 20, d: 14, hub: true, waves: [['armor', 'witch']], gems: ['furn', 'clear'] },
  { id: 'attic', n: 'Attic', a: 5, gx: 0, gy: 2, w: 18, d: 14, waves: [['invis', 'swarm'], ['bat', 'bat']], puz: 'dark', boo: true, gems: ['web'] },
  { id: 'bells', n: 'Bell Loft', a: 5, gx: 2, gy: 2, w: 18, d: 14, waves: [['skeleton', 'shades']], puz: 'levers', gems: ['chest'] },
  { id: 'clockface', n: 'Clock Face', a: 5, gx: 1, gy: 1, w: 20, d: 14, waves: [['brute', 'polter']], puz: 'beam', key: true, gems: ['curtain', 'dark'] },
  { id: 'belfry', n: 'Tower Top', a: 5, gx: 1, gy: 0, w: 22, d: 16, boss: 'grumbleton', gems: [] }
];
/* connections; lock 'key' = needs area key, 'dark' = invisible door (reveal with DARK) */
SP.LINKS = [
  ['porch', 'foyer'], ['foyer', 'coat'], ['foyer', 'gallery'], ['foyer', 'dining'], ['dining', 'ballroom', 'key'],
  ['reading', 'stacks'], ['reading', 'study'], ['reading', 'maproom'], ['study', 'archive', 'dark'], ['maproom', 'readhall', 'key'],
  ['pantry', 'kitchen'], ['kitchen', 'bakery'], ['kitchen', 'cold'], ['bakery', 'scullery'], ['kitchen', 'banquet', 'key'],
  ['shed', 'fern'], ['shed', 'pond'], ['fern', 'cactus'], ['pond', 'orchid'], ['shed', 'dome', 'key'],
  ['egypt', 'armory'], ['egypt', 'bones'], ['egypt', 'cryptst'], ['cryptst', 'tomb', 'dark'], ['cryptst', 'pharaoh', 'key'],
  ['gears', 'attic'], ['gears', 'bells'], ['gears', 'clockface'], ['clockface', 'belfry', 'key']
];
SP.room = (id) => SP.ROOMS.find((r) => r.id === id);
SP.areaRooms = (a) => SP.ROOMS.filter((r) => r.a === a);
SP.GEMS_PER_AREA = 6;
SP.GEM_COLORS = ['#ff4d6d', '#3ff0ff', '#ffe14d', '#4ade80', '#c084fc', '#ff9f43'];
(function assignGems() { // gem index per area in room order
  for (let a = 0; a < SP.AREAS.length; a++) { let i = 0; SP.areaRooms(a).forEach((r) => { r.gemIdx = r.gems.map(() => i++); }); SP.AREAS[a].gemN = i; }
})();
// doors derived from grid adjacency
SP.doorsOf = function (rid) {
  const r = SP.room(rid), out = [];
  SP.LINKS.forEach((L) => {
    let o = null; if (L[0] === rid) o = SP.room(L[1]); else if (L[1] === rid) o = SP.room(L[0]); if (!o) return;
    const dx = o.gx - r.gx, dy = o.gy - r.gy; const side = dy < 0 ? 'N' : dy > 0 ? 'S' : dx > 0 ? 'E' : 'W';
    out.push({ to: o.id, side, lock: L[2] || null, darkSide: L[2] === 'dark' && L[0] === rid });
  });
  return out;
};

/* ---- enemies ----
   hp: tug hp, sp: speed, col: glow colour, flash: stunned by flash, how: counter tip */
SP.EN = {
  goob: { n: 'Goob', hp: 30, sp: 1.7, col: '#5dff8a', r: 0.55, coins: 15, how: 'FLASH to stun, then hold VAC.' },
  slammer: { n: 'Slammer', hp: 40, sp: 1.6, col: '#ff5a5a', r: 0.6, coins: 20, how: 'It charges in a straight line. Step aside, then FLASH!' },
  hider: { n: 'Hider', hp: 35, sp: 1.8, col: '#4fa8ff', r: 0.55, coins: 20, how: 'Hides in furniture. VAC or BLOW furniture to flush it out.' },
  bat: { n: 'Bat', hp: 6, sp: 3.2, col: '#ff7ad9', r: 0.4, coins: 5, fly: 1, how: 'One FLASH stuns every bat in the light.' },
  shades: { n: 'Shades', hp: 40, sp: 1.6, col: '#ffd23f', r: 0.6, coins: 25, how: 'PLUNGER the sunglasses off, then FLASH.' },
  shieldy: { n: 'Shieldy', hp: 40, sp: 1.5, col: '#ff9f43', r: 0.6, coins: 25, how: 'VAC the shield away (or FLASH from behind).' },
  polter: { n: 'Poltergeist', hp: 45, sp: 1.4, col: '#c084fc', r: 0.6, coins: 30, how: 'VAC a thrown object, then BLOW it back to stun.' },
  mummy: { n: 'Mummy', hp: 50, sp: 1.1, col: '#f5e6b8', r: 0.6, coins: 30, walk: 1, how: 'Hold VAC to unwrap it, then it is stunned.' },
  skeleton: { n: 'Skeleton', hp: 25, sp: 1.5, col: '#e8f0ff', r: 0.55, coins: 25, walk: 1, how: 'FLASH to break it, then VAC the skull before it rebuilds.' },
  armor: { n: 'Haunted Armor', hp: 45, sp: 1.2, col: '#9fb4ff', r: 0.65, coins: 35, walk: 1, how: 'Dodge the red swing, then PLUNGER the helmet off.' },
  witch: { n: 'Witch', hp: 55, sp: 1.3, col: '#b46bff', r: 0.6, coins: 40, how: 'BLOW her orbs back, or FLASH her while she chants.' },
  invis: { n: 'Vanisher', hp: 35, sp: 1.8, col: '#7fe8ff', r: 0.55, coins: 25, how: 'Hold DARK to reveal it, then FLASH.' },
  swarm: { n: 'Ghoulie', hp: 4, sp: 2.4, col: '#a3ff5d', r: 0.32, coins: 3, how: 'No FLASH needed. Just VAC them!' },
  brute: { n: 'Brute', hp: 140, sp: 1.2, col: '#ff8a3d', r: 0.95, coins: 60, big: 1, how: 'FLASH it while it is tired after a slam. Pull together!' },
  boo: { n: 'Boo', hp: 40, sp: 2.3, col: '#ffffff', r: 0.55, coins: 50, how: 'Find it in furniture, FLASH it when it faces you.' }
};
SP.EN_ORDER = ['goob', 'slammer', 'hider', 'bat', 'shades', 'shieldy', 'polter', 'invis', 'swarm', 'brute', 'witch', 'mummy', 'skeleton', 'armor', 'boo'];
SP.AREA_POOL = [['goob', 'slammer', 'hider', 'bat'], ['goob', 'polter', 'shades', 'invis', 'swarm'], ['goob', 'shieldy', 'swarm', 'hider', 'polter'], ['bat', 'invis', 'witch', 'hider', 'slammer'], ['mummy', 'skeleton', 'armor', 'bat'], ['armor', 'witch', 'skeleton', 'shades', 'invis']];

/* ---- bosses ---- */
SP.BOSS = {
  waltzy: { n: 'Countess Waltzy', hp: 150, col: '#ff6bd6', tip: 'She dashes along the glowing lines. After 3 dashes she gets dizzy: FLASH her, then VAC!' },
  pagewhirl: { n: 'Professor Pagewhirl', hp: 170, col: '#c084fc', tip: 'Catch a flying book with VAC and BLOW it back at him!' },
  souffle: { n: 'Chef Souffl\u00e9', hp: 180, col: '#ffd0a0', tip: 'After his big belly-slam his hat gets stuck: PLUNGER it off!' },
  mandrake: { n: 'Mama Mandrake', hp: 190, col: '#7dff6b', tip: 'Three bulbs pop up. Use DARK to find the glowing real one, then FLASH it!' },
  mumbles: { n: 'King Mumbles', hp: 200, col: '#ffe08a', tip: 'When he rests after a sand beam, VAC his bandages off, then FLASH!' },
  grumbleton: { n: 'Ghost King Grumbleton', hp: 260, col: '#8affff', tip: 'BLOW his orbs back to stun him, or FLASH him when he gets dizzy after dashing!' }
};

/* ---- heroes & upgrades ---- */
SP.HEROES = [
  { id: 'grok', n: 'Grok', hat: 'cap', desc: 'Brave ghost hunter' },
  { id: 'penny', n: 'Penny', hat: 'bow', desc: 'Puzzle pro with pigtails' },
  { id: 'max', n: 'Max', hat: 'beanie', desc: 'Cozy beanie, big vacuum' }
];
SP.UPG = [
  { id: 'vac', n: 'Vac Power', icon: '\uD83C\uDF00', desc: 'Drain ghost HP faster and reach farther', cost: [[250, 0], [700, 2], [1400, 5]] },
  { id: 'flash', n: 'Flashlight', icon: '\uD83D\uDD26', desc: 'Bigger, longer flashlight beam', cost: [[200, 0], [600, 2], [1200, 5]] },
  { id: 'heart', n: 'Extra Heart', icon: '\u2764\uFE0F', desc: '+1 max heart', cost: [[300, 0], [800, 3], [1500, 6]] },
  { id: 'magnet', n: 'Coin Magnet', icon: '\uD83E\uDDF2', desc: 'Coins fly to you from farther away', cost: [[150, 0], [500, 1]] }
];
SP.PAINT_COLS = [['#ff4d6d', 'RED'], ['#3fa8ff', 'BLUE'], ['#ffe14d', 'YELLOW'], ['#4ade80', 'GREEN']];
})();
