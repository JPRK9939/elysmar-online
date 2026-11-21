/* Shared game data — used by both the browser client and the Node server.
   World: "Elysmar" — an original isekai magic world swallowed by the Veil of Dusk. */
(function (root) {
  const D = {};
  D.VERSION = '0.1.0';

  // ---------- Game servers (channels) ----------
  D.SERVERS = [
    { id: 'aurelia', name: 'Aurelia', desc: 'เซิร์ฟ 1 · สำหรับมือใหม่', cap: 150, mul: 1 },
    { id: 'verdant', name: 'Verdant', desc: 'เซิร์ฟ 2 · ปกติ', cap: 150, mul: 1 },
    { id: 'nocturne', name: 'Nocturne', desc: 'เซิร์ฟ 3 · มอนสเตอร์แข็งแกร่ง x1.6 / EXP x1.5', cap: 100, mul: 1.6, expMul: 1.5 }
  ];

  // ---------- Weapon types: no class restriction — anyone can equip anything ----------
  D.WTYPES = {
    none:   { name: 'มือเปล่า', cat: 'melee',  range: 2.0, speed: 0.6, mul: 0.6 },
    sword:  { name: 'ดาบ',      cat: 'melee',  range: 2.7, speed: 0.7, mul: 1.0 },
    axe:    { name: 'ขวาน',     cat: 'melee',  range: 2.9, speed: 1.05, mul: 1.4 },
    dagger: { name: 'มีดสั้น',   cat: 'melee',  range: 2.2, speed: 0.42, mul: 0.7 },
    staff:  { name: 'ไม้เท้า',   cat: 'magic',  range: 16,  speed: 0.95, mul: 1.1 },
    wand:   { name: 'คทา',      cat: 'magic',  range: 14,  speed: 0.55, mul: 0.75 },
    bow:    { name: 'ธนู',      cat: 'ranged', range: 20,  speed: 0.75, mul: 1.0 }
  };

  // ---------- Items ----------
  // type: mat | consume | weapon | armor | helm | acc | special | gift
  D.ITEMS = {
    // materials
    herb:        { name: 'สมุนไพรแสงจันทร์', type: 'mat', icon: '🌿', price: 6, desc: 'สมุนไพรที่เรืองแสงจาง ๆ ใต้แสงจันทร์' },
    ore:         { name: 'แร่เหล็ก', type: 'mat', icon: '🪨', price: 8 },
    wood:        { name: 'ไม้โอ๊คเก่า', type: 'mat', icon: '🪵', price: 5 },
    crystal:     { name: 'ผลึกมานา', type: 'mat', icon: '💎', price: 30, rarity: 1 },
    jelly:       { name: 'เจลพัฟฟลิ่ง', type: 'mat', icon: '🫧', price: 3 },
    ember:       { name: 'ประกายตะเกียง', type: 'mat', icon: '🔥', price: 7 },
    spore:       { name: 'สปอร์เห็ด', type: 'mat', icon: '🍄', price: 9 },
    bone:        { name: 'กระดูกเก่า', type: 'mat', icon: '🦴', price: 12 },
    pelt:        { name: 'หนังสัตว์', type: 'mat', icon: '🟫', price: 14 },
    moss:        { name: 'มอสหินโบราณ', type: 'mat', icon: '🟩', price: 18 },
    shade_ess:   { name: 'แก่นเงามืด', type: 'mat', icon: '🌑', price: 40, rarity: 1 },
    wraith_steel:{ name: 'เหล็กวิญญาณ', type: 'mat', icon: '⚙️', price: 70, rarity: 2 },
    warden_core: { name: 'แกนผู้พิทักษ์', type: 'mat', icon: '🔮', price: 400, rarity: 3 },
    flower:      { name: 'ดอกไม้ทุ่ง', type: 'mat', icon: '🌼', price: 4, gift: true },
    // consumables
    hp_potion:   { name: 'ยาฟื้นพลัง', type: 'consume', icon: '🧪', price: 25, heal: 70 },
    hi_potion:   { name: 'ยาฟื้นพลังชั้นสูง', type: 'consume', icon: '⚗️', price: 90, heal: 240 },
    mp_potion:   { name: 'น้ำมานา', type: 'consume', icon: '💧', price: 30, mana: 50 },
    elixir:      { name: 'อีลิกเซอร์', type: 'consume', icon: '🍷', price: 300, heal: 600, mana: 300, rarity: 2 },
    herbal_tea:  { name: 'ชาสมุนไพร', type: 'consume', icon: '🍵', price: 20, heal: 40, gift: true },
    sweet_bun:   { name: 'ขนมปังหวาน', type: 'consume', icon: '🥐', price: 15, heal: 30, gift: true },
    // special
    enh_stone:   { name: 'หินตีบวก', type: 'special', icon: '💠', price: 120, desc: 'ใช้ตีบวกอุปกรณ์ที่ช่างตีเหล็ก' },
    protect_scroll: { name: 'สกรอลป้องกันการแตก', type: 'special', icon: '📜', price: 1500, rarity: 2, desc: 'ป้องกันอุปกรณ์แตกเมื่อตีบวกล้มเหลว' },
    shiny_pebble:{ name: 'ก้อนหินแวววาว', type: 'gift', icon: '🪙', price: 10, gift: true },
    bouquet:     { name: 'ช่อดอกไม้', type: 'gift', icon: '💐', price: 40, gift: true },
    flower_spell:{ name: 'ม้วนเวท: เรียกทุ่งดอกไม้', type: 'gift', icon: '✨', price: 200, rarity: 1, gift: true, desc: 'เวทมนตร์ที่ไม่มีประโยชน์อะไรเลย นอกจากทำให้ดอกไม้บาน' },
    grimoire_page:{ name: 'หน้ากริมัวร์โบราณ', type: 'gift', icon: '📖', price: 150, rarity: 1, gift: true },
    old_coin:    { name: 'เหรียญยุคก่อนรัตติกาล', type: 'gift', icon: '🥇', price: 80, rarity: 1, gift: true },

    // weapons — swords
    wooden_sword: { name: 'ดาบไม้ฝึกหัด', type: 'weapon', wtype: 'sword', icon: '🗡️', atk: 6, price: 40 },
    iron_sword:   { name: 'ดาบเหล็ก', type: 'weapon', wtype: 'sword', icon: '🗡️', atk: 15, price: 220 },
    knight_blade: { name: 'ดาบอัศวินรัตติกาล', type: 'weapon', wtype: 'sword', icon: '⚔️', atk: 34, price: 1800, rarity: 2 },
    dawn_sword:   { name: 'ดาบรุ่งอรุณของเฟนน์', type: 'weapon', wtype: 'sword', icon: '🌅', atk: 58, price: 6000, rarity: 3, unique: true },
    // axes
    hand_axe:     { name: 'ขวานมือ', type: 'weapon', wtype: 'axe', icon: '🪓', atk: 10, price: 80 },
    steel_axe:    { name: 'ขวานเหล็กกล้า', type: 'weapon', wtype: 'axe', icon: '🪓', atk: 24, price: 600 },
    // daggers
    rusty_dagger: { name: 'มีดสั้นขึ้นสนิม', type: 'weapon', wtype: 'dagger', icon: '🔪', atk: 5, price: 30 },
    shadow_dagger:{ name: 'มีดสั้นเงา', type: 'weapon', wtype: 'dagger', icon: '🔪', atk: 26, price: 1100, rarity: 1 },
    // staves
    apprentice_staff: { name: 'ไม้เท้าผู้ฝึกเวท', type: 'weapon', wtype: 'staff', icon: '🪄', matk: 7, price: 50 },
    oak_staff:    { name: 'ไม้เท้าโอ๊ค', type: 'weapon', wtype: 'staff', icon: '🪄', matk: 16, price: 260 },
    sage_staff:   { name: 'ไม้เท้าปราชญ์', type: 'weapon', wtype: 'staff', icon: '🪄', matk: 36, price: 2000, rarity: 2 },
    bloom_staff:  { name: 'ไม้เท้าบุปผาของจอมเวทโบราณ', type: 'weapon', wtype: 'staff', icon: '🌸', matk: 60, price: 6000, rarity: 3, unique: true },
    // wands
    twig_wand:    { name: 'คทากิ่งไม้', type: 'weapon', wtype: 'wand', icon: '🥢', matk: 5, price: 35 },
    crystal_wand: { name: 'คทาผลึก', type: 'weapon', wtype: 'wand', icon: '🔹', matk: 19, price: 500, rarity: 1 },
    // bows
    short_bow:    { name: 'ธนูสั้น', type: 'weapon', wtype: 'bow', icon: '🏹', atk: 7, price: 45 },
    hunter_bow:   { name: 'ธนูนักล่า', type: 'weapon', wtype: 'bow', icon: '🏹', atk: 17, price: 280 },
    wind_bow:     { name: 'ธนูสายลม', type: 'weapon', wtype: 'bow', icon: '🏹', atk: 33, price: 1900, rarity: 2 },
    // armor
    cloth_robe:   { name: 'เสื้อคลุมผ้า', type: 'armor', icon: '👘', def: 3, mp: 20, price: 40 },
    leather_armor:{ name: 'เกราะหนัง', type: 'armor', icon: '🦺', def: 9, price: 200 },
    iron_armor:   { name: 'เกราะเหล็ก', type: 'armor', icon: '🛡️', def: 17, price: 650 },
    priest_vest:  { name: 'อาภรณ์นักบวชของลิร่า', type: 'armor', icon: '🤍', def: 14, mp: 120, heal: 0.25, price: 4000, rarity: 3, unique: true },
    warden_plate: { name: 'เกราะผู้พิทักษ์', type: 'armor', icon: '🛡️', def: 30, hp: 150, price: 3000, rarity: 2 },
    // helms
    straw_hat:    { name: 'หมวกฟาง', type: 'helm', icon: '👒', def: 1, price: 20 },
    mage_hat:     { name: 'หมวกจอมเวท', type: 'helm', icon: '🎩', def: 3, mp: 40, price: 300 },
    iron_helm:    { name: 'หมวกเหล็ก', type: 'helm', icon: '⛑️', def: 7, price: 320 },
    // accessories
    luck_charm:   { name: 'เครื่องรางนำโชค', type: 'acc', icon: '🍀', luk: 4, price: 250 },
    mana_ring:    { name: 'แหวนมานา', type: 'acc', icon: '💍', mp: 50, price: 400 },
    heart_pendant:{ name: 'จี้หัวใจของคิป', type: 'acc', icon: '💗', hp: 120, price: 3000, rarity: 3, unique: true },
    merchant_badge:{ name: 'เข็มกลัดพ่อค้าของโทบิ', type: 'acc', icon: '🏅', luk: 8, sell: 0.2, price: 3000, rarity: 3, unique: true },
    guard_crest:  { name: 'ตราผู้พิทักษ์หมู่บ้าน', type: 'acc', icon: '🎖️', hp: 80, def: 5, price: 2500, rarity: 3, unique: true },
    elder_amulet: { name: 'เครื่องรางแห่งความทรงจำ', type: 'acc', icon: '📿', mp: 100, luk: 5, price: 5000, rarity: 3, unique: true }
  };
  D.RARITY = ['#e8e8e8', '#7fd6ff', '#c58cff', '#ffcc4d'];
  D.STACKABLE = t => t === 'mat' || t === 'consume' || t === 'special' || t === 'gift';

  // ---------- Monsters (original designs, cute-spooky style) ----------
  // shape is used by the client's procedural model builder
  D.MONSTERS = {
    puff:   { name: 'พัฟฟลิ่ง', shape: 'slime', lv: 1, hp: 32, atk: 4, def: 0, spd: 2.2, exp: 9, aggro: false, range: 1.6, color: '#9fe0ff', size: 0.9,
              drops: [['jelly', .6, 1, 2], ['herb', .2, 1, 1], ['hp_potion', .07, 1, 1]], gold: [1, 4] },
    lanternimp: { name: 'อิมป์ตะเกียง', shape: 'imp', lv: 3, hp: 58, atk: 7, def: 1, spd: 3.0, exp: 16, aggro: true, range: 1.8, color: '#ffb347', size: 0.9,
              drops: [['ember', .55, 1, 2], ['shiny_pebble', .1, 1, 1], ['hp_potion', .08, 1, 1]], gold: [3, 8] },
    mushcap: { name: 'มัชแคป', shape: 'mushroom', lv: 5, hp: 95, atk: 10, def: 3, spd: 2.0, exp: 25, aggro: false, range: 1.8, color: '#e2725b', size: 1.1,
              drops: [['spore', .6, 1, 2], ['flower', .25, 1, 2], ['herb', .2, 1, 2]], gold: [5, 12] },
    bonepup: { name: 'โบนพัพ', shape: 'dog', lv: 8, hp: 150, atk: 15, def: 5, spd: 4.2, exp: 40, aggro: true, range: 1.9, color: '#e9e4d4', size: 1.0,
              drops: [['bone', .6, 1, 2], ['pelt', .35, 1, 1], ['mp_potion', .06, 1, 1]], gold: [8, 18] },
    mossgolem: { name: 'มอสโกเล็ม', shape: 'golem', lv: 12, hp: 340, atk: 22, def: 12, spd: 1.8, exp: 85, aggro: false, range: 2.6, color: '#6f8f5a', size: 1.6,
              drops: [['moss', .6, 1, 2], ['ore', .45, 1, 3], ['crystal', .15, 1, 1], ['enh_stone', .03, 1, 1]], gold: [15, 35] },
    shade:  { name: 'เงาสลัว', shape: 'wraith', lv: 15, hp: 280, atk: 28, def: 8, spd: 3.4, exp: 115, aggro: true, range: 2.0, color: '#5b3f8c', size: 1.2,
              drops: [['shade_ess', .5, 1, 1], ['crystal', .2, 1, 1], ['grimoire_page', .03, 1, 1], ['old_coin', .05, 1, 1]], gold: [20, 45] },
    wraithknight: { name: 'อัศวินวิญญาณ', shape: 'knight', lv: 20, hp: 640, atk: 40, def: 18, spd: 3.0, exp: 230, aggro: true, range: 2.6, color: '#3a2d5c', size: 1.5,
              drops: [['wraith_steel', .4, 1, 1], ['shade_ess', .4, 1, 2], ['protect_scroll', .02, 1, 1], ['enh_stone', .08, 1, 1]], gold: [40, 90] },
    cryptghoul: { name: 'กูลสุสาน', shape: 'imp', lv: 18, hp: 380, atk: 30, def: 10, spd: 3.3, exp: 120, aggro: true, range: 1.9, color: '#7a9a8a', size: 1.2,
              drops: [['bone', .5, 1, 3], ['shade_ess', .25, 1, 1], ['enh_stone', .06, 1, 1]], gold: [20, 40] },
    warden: { name: 'ผู้พิทักษ์แห่งเสียงสะท้อน', shape: 'boss', lv: 22, hp: 7000, atk: 52, def: 20, spd: 2.6, exp: 2200, aggro: true, range: 4.0, color: '#24183f', size: 3.2, boss: true,
              drops: [['warden_core', 1, 1, 1], ['knight_blade', .25, 1, 1], ['sage_staff', .25, 1, 1], ['wind_bow', .25, 1, 1], ['warden_plate', .25, 1, 1], ['enh_stone', .8, 1, 3]], gold: [400, 800] }
  };

  // ---------- World layout ----------
  D.WORLD_SIZE = 1200;
  D.VILLAGE = { x: 0, z: 0, r: 48, name: 'หมู่บ้านลูเมนฮอลโลว์' };
  D.ZONES = [
    { id: 'meadow_e', name: 'ทุ่งกระซิบ (ตะวันออก)', cx: 115, cz: 70, r: 70, lv: '1-4', spawns: [['puff', 14], ['lanternimp', 6]] },
    { id: 'meadow_w', name: 'ทุ่งกระซิบ (ตะวันตก)', cx: -115, cz: 50, r: 70, lv: '1-5', spawns: [['puff', 10], ['lanternimp', 8], ['mushcap', 4]] },
    { id: 'mistwood', name: 'ป่าหมอกจันทรา', cx: 0, cz: -240, r: 115, lv: '5-10', spawns: [['mushcap', 14], ['bonepup', 12], ['lanternimp', 4]] },
    { id: 'ruins', name: 'ซากปรักหักพังเถ้าถ่าน', cx: 270, cz: -40, r: 105, lv: '10-16', spawns: [['mossgolem', 12], ['bonepup', 6], ['shade', 4]] },
    { id: 'rift', name: 'รอยแยกรัตติกาล', cx: -250, cz: 240, r: 115, lv: '15-22', spawns: [['shade', 14], ['wraithknight', 8]], dark: true },
    { id: 'lake', name: 'ทะเลสาบผลึก', cx: -240, cz: -160, r: 90, lv: '-', spawns: [['puff', 4]] }
  ];
  D.DUNGEON = {
    id: 'crypt', name: 'สุสานเสียงสะท้อน (ดันเจี้ยนปาร์ตี้)', entrance: { x: 320, z: -10 },
    origin: { x: 3000, z: 0 }, minLv: 10,
    waves: [
      [['cryptghoul', 6]],
      [['cryptghoul', 5], ['shade', 4]],
      [['wraithknight', 3], ['cryptghoul', 4]],
      [['warden', 1]]
    ],
    reward: { exp: 1500, gold: 600, items: [['enh_stone', 2], ['elixir', 1]] }
  };

  // ---------- Gathering nodes ----------
  D.GATHER = {
    herb:  { name: 'กอสมุนไพร', item: 'herb', time: 1.3, respawn: 45, zones: ['meadow_e', 'meadow_w', 'mistwood', 'lake'], count: 26 },
    flower:{ name: 'ดอกไม้ป่า', item: 'flower', time: 1.0, respawn: 40, zones: ['meadow_e', 'meadow_w', 'lake'], count: 20 },
    ore:   { name: 'สายแร่', item: 'ore', time: 2.0, respawn: 60, zones: ['mistwood', 'ruins', 'rift'], count: 22 },
    wood:  { name: 'ขอนไม้', item: 'wood', time: 1.6, respawn: 50, zones: ['meadow_e', 'mistwood', 'meadow_w'], count: 22 },
    crystal:{ name: 'ผลึกมานา', item: 'crystal', time: 2.6, respawn: 120, zones: ['lake', 'rift', 'ruins'], count: 10 }
  };

  // ---------- Skills (not fixed: unlocked by usage, any weapon) ----------
  // cat drives which behaviour counter/stat it trains
  D.SKILLS = {
    slash_wave: { name: 'คลื่นดาบ', icon: '🌙', cat: 'melee', mp: 8, cd: 4, kind: 'cone', power: 1.8, radius: 5, stat: 'str', unlock: null, desc: 'ฟันคลื่นพลังรูปพระจันทร์เสี้ยวไปข้างหน้า' },
    fire_bolt:  { name: 'ลูกไฟ', icon: '🔥', cat: 'magic', mp: 10, cd: 3, kind: 'proj', power: 2.0, radius: 2.5, stat: 'int', unlock: null, desc: 'ยิงลูกไฟระเบิดเป้าหมาย' },
    heal:       { name: 'แสงเยียวยา', icon: '💚', cat: 'heal', mp: 14, cd: 6, kind: 'heal', power: 1.0, radius: 12, stat: 'wis', unlock: null, desc: 'ฟื้นฟู HP ตัวเองและสมาชิกปาร์ตี้รอบตัว' },
    dash:       { name: 'ก้าวพริบตา', icon: '💨', cat: 'move', mp: 5, cd: 5, kind: 'dash', power: 0, radius: 0, stat: 'dex', unlock: null, desc: 'พุ่งไปข้างหน้าอย่างรวดเร็ว' },
    whirlwind:  { name: 'พายุหมุนใบมีด', icon: '🌀', cat: 'melee', mp: 18, cd: 8, kind: 'aoe', power: 2.6, radius: 5.5, stat: 'str', unlock: { act: 'melee', n: 120 }, desc: 'หมุนตัวโจมตีศัตรูรอบด้าน' },
    frost_nova: { name: 'โนวาน้ำแข็ง', icon: '❄️', cat: 'magic', mp: 22, cd: 10, kind: 'aoe', power: 2.2, radius: 7, stat: 'int', unlock: { act: 'magic', n: 100 }, slow: true, desc: 'ระเบิดน้ำแข็งรอบตัว ทำให้ศัตรูช้าลง' },
    arrow_rain: { name: 'ห่าธนู', icon: '🎯', cat: 'ranged', mp: 20, cd: 9, kind: 'ground', power: 3.0, radius: 6, stat: 'dex', unlock: { act: 'ranged', n: 100 }, desc: 'ลูกธนูโปรยลงใส่พื้นที่เป้าหมาย' },
    holy_barrier: { name: 'ม่านศักดิ์สิทธิ์', icon: '🛡️', cat: 'heal', mp: 25, cd: 20, kind: 'buff', power: 0.4, radius: 12, stat: 'wis', unlock: { act: 'heal', n: 60 }, desc: 'ลดความเสียหายที่ได้รับ 40% ทั้งปาร์ตี้ 8 วินาที' },
    meteor:     { name: 'อุกกาบาตรัตติกาล', icon: '☄️', cat: 'magic', mp: 45, cd: 18, kind: 'ground', power: 5.5, radius: 7, stat: 'int', unlock: { act: 'magic', n: 500 }, desc: 'เรียกอุกกาบาตลงจากฟ้า' },
    berserk:    { name: 'คลั่งศึก', icon: '😤', cat: 'melee', mp: 20, cd: 25, kind: 'selfbuff', power: 0.5, radius: 0, stat: 'str', unlock: { act: 'melee', n: 500 }, desc: 'เพิ่มพลังโจมตี 50% เป็นเวลา 10 วินาที' },
    piercing_ray: { name: 'ลำแสงทะลวงมาร', icon: '✴️', cat: 'magic', mp: 35, cd: 7, kind: 'beam', power: 4.2, radius: 1.5, stat: 'int', unlock: { npc: 'seren', hearts: 6 }, desc: 'ลำแสงเวทที่ทะลวงทุกสิ่ง เคยเป็นเวทชั่วร้ายที่มนุษย์วิเคราะห์จนกลายเป็นเวทพื้นฐาน' },
    bloom:      { name: 'เวทเรียกทุ่งดอกไม้', icon: '🌸', cat: 'social', mp: 5, cd: 3, kind: 'flowers', power: 0, radius: 6, stat: 'cha', unlock: { npc: 'seren', hearts: 3 }, desc: 'เวทที่ไม่มีประโยชน์ในการต่อสู้... แต่สวยงามมาก' }
  };

  // ---------- Behaviour-driven classes ----------
  // score = decayed counter of actions; highest becomes your class
  D.CLASSES = {
    novice:   { name: 'ผู้หลงทาง', en: 'Wanderer', icon: '🧭', color: '#cfcfcf', bonus: {} },
    warrior:  { name: 'นักรบ', en: 'Warrior', icon: '⚔️', color: '#ff6b5b', act: ['melee'], t2: ['อัศวินรุ่งอรุณ', 'นักรบโลหิต'], bonus: { melee: 0.12, hp: 0.12 } },
    mage:     { name: 'จอมเวท', en: 'Mage', icon: '🔮', color: '#8f7bff', act: ['magic'], t2: ['ปราชญ์แห่งแสงดาว', 'จอมเวทรัตติกาล'], bonus: { magic: 0.15, mp: 0.15 } },
    ranger:   { name: 'นักล่า', en: 'Ranger', icon: '🏹', color: '#7ed957', act: ['ranged'], t2: ['พรานสายลม', 'นักล่าเงา'], bonus: { ranged: 0.12, crit: 0.06 } },
    priest:   { name: 'นักบวช', en: 'Priest', icon: '✝️', color: '#fff3a8', act: ['heal'], t2: ['นักบุญแห่งรุ่งอรุณ', 'นักบวชคำสาป'], bonus: { heal: 0.3, mpregen: 0.5 } },
    artisan:  { name: 'ช่างฝีมือ', en: 'Artisan', icon: '🔨', color: '#ffb347', act: ['craft', 'enhance'], t2: ['ปรมาจารย์ช่างเวท', 'ช่างตีอาวุธต้องสาป'], bonus: { enhance: 0.06, craftDouble: 0.15 } },
    explorer: { name: 'นักสำรวจ', en: 'Explorer', icon: '🗺️', color: '#5bd1d7', act: ['explore', 'puzzle', 'gather'], t2: ['ผู้ไขปริศนาโลก', 'ผู้เดินในรัตติกาล'], bonus: { speed: 0.12, gather: 0.3 } },
    merchant: { name: 'พ่อค้า', en: 'Merchant', icon: '💰', color: '#ffd84d', act: ['trade'], t2: ['พ่อค้าแห่งราชสำนัก', 'นายหน้าตลาดมืด'], bonus: { sell: 0.2, buy: 0.1 } },
    bard:     { name: 'นักกวี', en: 'Bard', icon: '🎵', color: '#ff8fd1', act: ['social'], t2: ['กวีผู้เชื่อมใจ', 'นักเล่าเรื่องต้องห้าม'], bonus: { affinity: 0.5, cha: 1 } }
  };
  D.CLASS_T1 = 60; D.CLASS_T2 = 220; D.CLASS_T2_LV = 15;
  // how many "points" each action is worth for class scoring
  D.ACT_WEIGHT = { melee: 1, magic: 1, ranged: 1, heal: 2, craft: 3, enhance: 3, explore: 1, puzzle: 8, gather: 1.5, trade: 2, social: 3 };

  // stats grow from use. key → [stat, xp]
  D.STAT_TRAIN = { melee: ['str', 1], magic: ['int', 1], ranged: ['dex', 1], heal: ['wis', 2], hurt: ['vit', 1], craft: ['luk', 2], enhance: ['luk', 3],
                   gather: ['luk', 1], social: ['cha', 3], trade: ['cha', 2], dodge: ['dex', 2], explore: ['dex', 0.3], puzzle: ['int', 4] };
  D.STAT_NAMES = { str: 'STR พลัง', int: 'INT ปัญญา', dex: 'DEX ว่องไว', vit: 'VIT อึด', wis: 'WIS ศรัทธา', luk: 'LUK โชค', cha: 'CHA เสน่ห์' };

  D.expForLevel = lv => Math.floor(40 * Math.pow(lv, 1.85) + 30);

  // ---------- Recipes ----------
  D.RECIPES = [
    { id: 'r_hp', out: 'hp_potion', qty: 2, mats: [['herb', 2], ['jelly', 1]] },
    { id: 'r_mp', out: 'mp_potion', qty: 2, mats: [['herb', 1], ['crystal', 1]] },
    { id: 'r_hi', out: 'hi_potion', qty: 1, mats: [['hp_potion', 2], ['spore', 2]] },
    { id: 'r_tea', out: 'herbal_tea', qty: 2, mats: [['herb', 2], ['flower', 1]] },
    { id: 'r_bouquet', out: 'bouquet', qty: 1, mats: [['flower', 5]] },
    { id: 'r_stone', out: 'enh_stone', qty: 1, mats: [['ore', 5], ['crystal', 1]] },
    { id: 'r_iron_sword', out: 'iron_sword', qty: 1, mats: [['ore', 6], ['wood', 2]] },
    { id: 'r_steel_axe', out: 'steel_axe', qty: 1, mats: [['ore', 8], ['wood', 4], ['moss', 2]] },
    { id: 'r_oak_staff', out: 'oak_staff', qty: 1, mats: [['wood', 6], ['ember', 4]] },
    { id: 'r_crystal_wand', out: 'crystal_wand', qty: 1, mats: [['wood', 3], ['crystal', 3]] },
    { id: 'r_hunter_bow', out: 'hunter_bow', qty: 1, mats: [['wood', 6], ['pelt', 2]] },
    { id: 'r_shadow_dagger', out: 'shadow_dagger', qty: 1, mats: [['ore', 4], ['shade_ess', 3]] },
    { id: 'r_leather', out: 'leather_armor', qty: 1, mats: [['pelt', 5], ['bone', 2]] },
    { id: 'r_iron_armor', out: 'iron_armor', qty: 1, mats: [['ore', 12], ['pelt', 3]] },
    { id: 'r_iron_helm', out: 'iron_helm', qty: 1, mats: [['ore', 6]] },
    { id: 'r_mage_hat', out: 'mage_hat', qty: 1, mats: [['spore', 6], ['ember', 3], ['crystal', 1]] },
    { id: 'r_luck', out: 'luck_charm', qty: 1, mats: [['shiny_pebble', 3], ['flower', 3]] },
    { id: 'r_mana_ring', out: 'mana_ring', qty: 1, mats: [['ore', 3], ['crystal', 4]] },
    { id: 'r_knight', out: 'knight_blade', qty: 1, mats: [['wraith_steel', 4], ['iron_sword', 1], ['shade_ess', 4]], locked: true },
    { id: 'r_wind_bow', out: 'wind_bow', qty: 1, mats: [['wraith_steel', 3], ['hunter_bow', 1], ['crystal', 4]], locked: true },
    { id: 'r_sage', out: 'sage_staff', qty: 1, mats: [['wraith_steel', 2], ['oak_staff', 1], ['grimoire_page', 1]], locked: true },
    { id: 'r_elixir', out: 'elixir', qty: 1, mats: [['hi_potion', 2], ['mp_potion', 2], ['warden_core', 1]], locked: true }
  ];
  // enhancement +1..+10 success rates
  D.ENHANCE_RATE = [0.95, 0.9, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15];
  D.ENHANCE_MAX = 10;

  // ---------- NPCs with relationship progression ----------
  D.NPCS = {
    maren: { name: 'ผู้เฒ่ามาเรน', title: 'ผู้นำหมู่บ้าน', pos: [4, -14], colors: { hair: '#dcdcdc', cloth: '#5a4a8a', skin: '#f1d2b6' },
      likes: ['herbal_tea', 'old_coin'], loves: ['grimoire_page'], dislikes: ['bone', 'jelly'],
      lines: ['เจ้าตื่นขึ้นมาท่ามกลางซากปรักหักพังโดยไม่มีความทรงจำ... เหมือนคนอื่น ๆ ที่ "ม่านรัตติกาล" พามา', 'โลกนี้ไม่ได้มืดมาแต่แรก เคยมีแสงเหมือนทุ่งดอกไม้ฤดูใบไม้ผลิ', 'บางคืนข้าได้ยินเสียงกระซิบจากรอยแยก มันเรียกชื่อที่ข้าไม่รู้จัก...', 'เครื่องหมายบนหลังมือเจ้า... ข้าเคยเห็นมันในบันทึกต้องห้าม', 'ไม่ว่าเจ้าจะมาจากไหน สิ่งที่เจ้าเลือกทำต่างหากที่กำหนดว่าเจ้าเป็นใคร'],
      rewards: { 2: ['herbal_tea', 3], 4: ['recipe', 'r_elixir'], 6: ['grimoire_page', 1], 8: ['lore', 7], 10: ['elder_amulet', 1] } },
    fenn:  { name: 'เฟนน์', title: 'ช่างตีเหล็ก', pos: [-20, 8], colors: { hair: '#7a3b1e', cloth: '#6b4a2b', skin: '#d9a77a' }, shop: 'smith',
      likes: ['ore', 'moss'], loves: ['wraith_steel', 'warden_core'], dislikes: ['flower', 'bouquet'],
      lines: ['ฮึ่ม... จะตีบวกอาวุธก็เอาหินมา อย่ามาเสียเวลา', 'อาวุธไม่ได้เลือกผู้ใช้ ผู้ใช้ต่างหากที่เลือกอาวุธ', 'พ่อข้าเคยตีดาบให้วีรบุรุษคนหนึ่ง... ก่อนที่ม่านรัตติกาลจะลงมา', 'เจ้าดูแลอาวุธดีนี่ ข้าชักชอบเจ้าแล้วสิ', 'นี่คือผลงานชิ้นสุดท้ายของพ่อข้า ข้าอยากให้มันอยู่กับเจ้า'],
      rewards: { 2: ['enh_stone', 2], 4: ['recipe', 'r_knight'], 6: ['enh_stone', 5], 8: ['protect_scroll', 1], 10: ['dawn_sword', 1] } },
    lira:  { name: 'ลิร่า', title: 'นักสมุนไพร & นักบวช', pos: [18, 10], colors: { hair: '#8fd3a8', cloth: '#f4f1e6', skin: '#f6dcc8' }, shop: 'herb',
      likes: ['herb', 'flower', 'herbal_tea'], loves: ['bouquet', 'crystal'], dislikes: ['shade_ess', 'bone'],
      lines: ['บาดเจ็บมาเหรอ? นั่งก่อนสิ เดี๋ยวฉันทำแผลให้', 'การรักษาผู้อื่นก็เป็นพลังอย่างหนึ่งนะ บางทีอาจแข็งแกร่งกว่าดาบ', 'สมุนไพรแสงจันทร์จะเรืองแสงตอนกลางคืน ลองไปหาดูสิ', 'ฉันรู้สึกได้ว่าในตัวเธอมีทั้งแสงและความมืดปนกัน...', 'อาภรณ์นี้เป็นของอาจารย์ฉัน เธอคู่ควรกับมัน'],
      rewards: { 2: ['hp_potion', 5], 4: ['mp_potion', 5], 6: ['hi_potion', 5], 8: ['skillxp', 'heal'], 10: ['priest_vest', 1] } },
    tobi:  { name: 'โทบิ', title: 'พ่อค้าเร่', pos: [-6, 20], colors: { hair: '#c99a4b', cloth: '#2f7a5a', skin: '#e8c4a0' }, shop: 'general',
      likes: ['old_coin', 'shiny_pebble'], loves: ['warden_core', 'crystal'], dislikes: ['spore'],
      lines: ['ยินดีต้อนรับ! ของดีราคาถูก มีทุกอย่างยกเว้นความทรงจำ ฮ่า ๆ', 'การค้าคือการแลกเปลี่ยนความไว้ใจ จำไว้นะลูกค้า', 'ข้าเดินทางมาทั่วเอลิสมาร์ ทุกที่มีข่าวลือเรื่อง "ผู้ถูกเรียก" เหมือนเจ้า', 'ได้ยินมาว่าในสุสานเสียงสะท้อนมีสมบัติยุคก่อนรัตติกาล...', 'เข็มกลัดนี้ทำให้พ่อค้าทุกคนเชื่อใจเจ้า เก็บไว้ให้ดี'],
      rewards: { 2: ['sweet_bun', 5], 4: ['luck_charm', 1], 6: ['protect_scroll', 1], 8: ['old_coin', 3], 10: ['merchant_badge', 1] } },
    seren: { name: 'เซเรน', title: 'จอมเวทเอลฟ์ผู้เดินทางมาพันปี', pos: [-205, -128], colors: { hair: '#f2f2f7', cloth: '#ffffff', skin: '#fbe7dc', elf: true },
      likes: ['grimoire_page', 'sweet_bun'], loves: ['flower_spell'], dislikes: ['ember'],
      lines: ['...อ้อ มนุษย์อีกคน ฉันกำลังดูดอกไม้อยู่ อย่าเพิ่งรบกวนสิ', 'ฉันสะสมเวทมนตร์ที่ไม่มีประโยชน์ เช่นเวทที่ทำให้องุ่นเปรี้ยวหวานขึ้น', 'พันปีมันไม่ได้นานอย่างที่คิดหรอก แต่ทุกคนที่ฉันรู้จักก็จากไปหมดแล้ว', 'ม่านรัตติกาล... ฉันเคยเห็นมันมาแล้วครั้งหนึ่ง เมื่อนานมาแล้ว', 'เธอทำให้ฉันนึกถึงเพื่อนร่วมทางคนเก่า... ไม้เท้านี้ ฉันให้'],
      rewards: { 2: ['grimoire_page', 1], 3: ['skill', 'bloom'], 4: ['recipe', 'r_sage'], 6: ['skill', 'piercing_ray'], 8: ['lore', 9], 10: ['bloom_staff', 1] } },
    kip:   { name: 'คิป', title: 'เด็กกำพร้าในหมู่บ้าน', pos: [10, 26], colors: { hair: '#3b2a20', cloth: '#d65a5a', skin: '#f0c9a6' },
      likes: ['sweet_bun', 'shiny_pebble'], loves: ['bouquet', 'flower'], dislikes: ['ore', 'bone'],
      lines: ['พี่ๆ! วันนี้เล่นกับคิปได้ไหม?', 'คิปเก็บก้อนหินแวววาวได้เยอะเลย อยากดูไหม?', 'พ่อแม่คิปหายไปตอนม่านรัตติกาลลงมา... แต่คิปไม่ร้องไห้แล้วนะ', 'พี่เป็นคนดีใช่ไหม? คิปเชื่อว่าพี่เป็นคนดี', 'คิปทำจี้นี้ให้พี่! มันจะปกป้องพี่นะ'],
      rewards: { 2: ['shiny_pebble', 3], 4: ['flower', 10], 6: ['luck_charm', 1], 8: ['lore', 4], 10: ['heart_pendant', 1] } },
    rowan: { name: 'กัปตันโรวาน', title: 'หัวหน้ายาม', pos: [0, 44], colors: { hair: '#2a2a2a', cloth: '#4a5a7a', skin: '#c99a74' },
      likes: ['bone', 'pelt'], loves: ['wraith_steel'], dislikes: ['flower'],
      lines: ['หยุดก่อน! อ้อ เจ้าเองหรอกรึ ผ่านไปได้', 'มอนสเตอร์เยอะขึ้นทุกวัน ช่วยกำจัดหน่อยจะขอบใจมาก', 'ที่รอยแยกทางตะวันตกเฉียงใต้ อย่าไปคนเดียวเด็ดขาด', 'ข้าเคยสงสัยเจ้า... แต่ตอนนี้ข้าไว้ใจเจ้าแล้ว', 'ตรานี้หมายความว่าเจ้าเป็นผู้พิทักษ์ลูเมนฮอลโลว์คนหนึ่ง'],
      rewards: { 2: ['hp_potion', 5], 4: ['iron_helm', 1], 6: ['enh_stone', 3], 8: ['lore', 6], 10: ['guard_crest', 1] } }
  };
  D.AFFINITY_PER_HEART = 100;

  // ---------- Quests ----------
  // type: talk | kill | gather | puzzle | dungeon | visit
  D.QUESTS = {
    // main story
    m1: { main: true, name: 'ตื่นจากรัตติกาล', giver: 'maren', type: 'kill', target: 'puff', n: 5, text: 'ผู้เฒ่ามาเรนขอให้เจ้าพิสูจน์ตัวเองด้วยการกำจัดพัฟฟลิ่ง 5 ตัวในทุ่งกระซิบ', reward: { exp: 80, gold: 50, items: [['hp_potion', 3]] } },
    m2: { main: true, req: 'm1', name: 'จอมเวทริมทะเลสาบ', giver: 'maren', type: 'talk', target: 'seren', text: 'ตามหาจอมเวทเอลฟ์ที่ทะเลสาบผลึกทางตะวันตกเฉียงเหนือ เธออาจรู้เรื่องเครื่องหมายบนมือเจ้า', reward: { exp: 120, lore: 1 } },
    m3: { main: true, req: 'm2', name: 'บันไดสู่ฟากฟ้า', giver: 'seren', type: 'puzzle', target: 'sky_steps', text: 'เซเรนบอกว่ามีเศษความทรงจำซ่อนอยู่บนยอด "บันไดฟ้า" ในทุ่งกระซิบตะวันออก', reward: { exp: 200, gold: 100, lore: 2 } },
    m4: { main: true, req: 'm3', name: 'เงาในป่าหมอก', giver: 'seren', type: 'kill', target: 'bonepup', n: 8, text: 'สัตว์ในป่าหมอกถูกความมืดกลืนกิน กำจัดโบนพัพ 8 ตัว', reward: { exp: 400, gold: 150, items: [['enh_stone', 1]] } },
    m5: { main: true, req: 'm4', name: 'ไฟแห่งความทรงจำ', giver: 'maren', type: 'puzzle', target: 'braziers', text: 'จุดไฟเตาบูชาทั้งสี่ในป่าหมอกตามลำดับที่ถูกต้อง', reward: { exp: 500, lore: 3 },
          choice: [{ text: 'มอบเศษความทรงจำให้ผู้เฒ่าเก็บรักษา', align: 15, items: [['elixir', 1]] }, { text: 'ดูดซับพลังของมันไว้กับตัวเอง', align: -15, stat: ['int', 3] }] },
    m6: { main: true, req: 'm5', name: 'ซากแห่งเถ้าถ่าน', giver: 'rowan', type: 'kill', target: 'mossgolem', n: 6, text: 'มอสโกเล็มในซากปรักหักพังตื่นขึ้นมาแล้ว ไปตรวจสอบ', reward: { exp: 900, gold: 300, lore: 5 } },
    m7: { main: true, req: 'm6', name: 'เสียงกระซิบจากรอยแยก', giver: 'maren', type: 'kill', target: 'shade', n: 10, text: 'เข้าไปในรอยแยกรัตติกาลและกำจัดเงาสลัว 10 ตัว เสียงกระซิบที่ได้ยินจะบอกอะไรเจ้า?', reward: { exp: 1600, gold: 500, lore: 8 },
          choice: [{ text: 'ปฏิเสธเสียงกระซิบ "ข้าเป็นผู้ปกป้อง"', align: 25 }, { text: 'ตอบรับเสียงกระซิบ "ข้าคือส่วนหนึ่งของรัตติกาล"', align: -25, items: [['shade_ess', 5]] }] },
    m8: { main: true, req: 'm7', name: 'สุสานเสียงสะท้อน', giver: 'maren', type: 'dungeon', target: 'crypt', text: 'รวมปาร์ตี้แล้วบุกสุสานเสียงสะท้อน (ทางเข้าอยู่ที่ซากปรักหักพังฝั่งตะวันออก) ปราบผู้พิทักษ์', reward: { exp: 3000, gold: 1000, lore: 10 } },
    m9: { main: true, req: 'm8', name: 'เสียงสะท้อนไม่สิ้นสุด', giver: 'maren', type: 'talk', target: 'seren', text: 'ความจริงยังไม่ครบ... ไปคุยกับเซเรนอีกครั้ง หลังจากนี้ "เสียงสะท้อน" จะปรากฏให้ตามหาไม่รู้จบ', reward: { exp: 1000, lore: 11 } },
    // side
    s_lira: { name: 'สมุนไพรสำหรับผู้บาดเจ็บ', giver: 'lira', type: 'gather', target: 'herb', n: 8, text: 'ลิร่าต้องการสมุนไพรแสงจันทร์ 8 ต้นเพื่อทำยารักษา', reward: { exp: 120, gold: 60, items: [['hp_potion', 5]], affinity: 60 }, repeat: true },
    s_fenn: { name: 'แร่สำหรับเตาหลอม', giver: 'fenn', type: 'gather', target: 'ore', n: 10, text: 'เฟนน์ต้องการแร่เหล็ก 10 ก้อน', reward: { exp: 200, gold: 120, items: [['enh_stone', 1]], affinity: 60 }, repeat: true },
    s_kip: { name: 'ดอกไม้ให้คิป', giver: 'kip', type: 'gather', target: 'flower', n: 6, text: 'คิปอยากได้ดอกไม้ไปวางที่หลุมศพพ่อแม่', reward: { exp: 100, items: [['shiny_pebble', 2]], affinity: 80, align: 5 }, repeat: true },
    s_rowan: { name: 'ล่าอิมป์ตะเกียง', giver: 'rowan', type: 'kill', target: 'lanternimp', n: 10, text: 'อิมป์ตะเกียงชอบมาจุดไฟเผาฟาง กำจัดมัน 10 ตัว', reward: { exp: 180, gold: 90, affinity: 50 }, repeat: true },
    s_rowan2: { name: 'อัศวินที่ไม่ยอมตาย', giver: 'rowan', type: 'kill', target: 'wraithknight', n: 5, text: 'กำจัดอัศวินวิญญาณ 5 ตัวในรอยแยก', reward: { exp: 1500, gold: 400, items: [['enh_stone', 2]], affinity: 100 }, repeat: true },
    s_tobi: { name: 'ของหายากสำหรับลูกค้า', giver: 'tobi', type: 'gather', target: 'spore', n: 8, text: 'โทบิมีลูกค้าต้องการสปอร์เห็ด 8 ชิ้น', reward: { exp: 160, gold: 250, affinity: 50 }, repeat: true },
    s_seren: { name: 'เวทที่ไร้ประโยชน์', giver: 'seren', type: 'puzzle', target: 'rune_memory', text: 'เซเรนอยากให้ช่วยไขปริศนาหินรูนจำลำดับ เธอเชื่อว่ามีเวทแปลก ๆ ซ่อนอยู่', reward: { exp: 300, items: [['flower_spell', 1]], affinity: 80 }, repeat: true }
  };

  // ---------- Puzzles (Genshin / MapleStory style) ----------
  D.PUZZLES = {
    sky_steps:  { name: 'บันไดฟ้า', kind: 'jump', diff: 'ปานกลาง', pos: [70, 125], reward: { exp: 150, gold: 80, items: [['crystal', 2]] }, cooldown: 600 },
    braziers:   { name: 'เตาบูชาทั้งสี่', kind: 'brazier', diff: 'ปานกลาง', pos: [40, -205], reward: { exp: 250, items: [['enh_stone', 1]] }, cooldown: 600,
                  hint: '"ตะวันตื่นจากบูรพา ขึ้นสูงสู่อุดร ลับฟ้าที่ประจิม แล้วหลับใหลในทักษิณ"' },
    rune_memory:{ name: 'หินรูนแห่งความทรงจำ', kind: 'simon', diff: 'ปานกลาง→ยาก', pos: [-215, -175], reward: { exp: 280, items: [['grimoire_page', 1]] }, cooldown: 600 },
    wind_rings: { name: 'วงแหวนสายลม', kind: 'rings', diff: 'ปานกลาง', pos: [-140, 95], reward: { exp: 200, gold: 150 }, cooldown: 600, time: 45 },
    ruined_spire:{ name: 'ยอดหอคอยพังทลาย', kind: 'jump', diff: 'ท้าทาย', pos: [235, -95], reward: { exp: 900, gold: 400, items: [['protect_scroll', 1], ['enh_stone', 2]], lore: 6 }, cooldown: 1800, hard: true },
    shade_lanterns:{ name: 'ตะเกียงเงาทั้งสาม', kind: 'lanterns', diff: 'ท้าทาย', pos: [-215, 205], reward: { exp: 1100, items: [['wraith_steel', 2]], lore: 12 }, cooldown: 1800, time: 5 }
  };

  // ---------- Lore: the endless mystery of the darkened world ----------
  D.LORE = {
    1: { title: 'เครื่องหมายบนมือ', text: 'เซเรนมองเครื่องหมายบนหลังมือเจ้านานผิดปกติ "มันคือตราแห่ง ‘ผู้ถูกเรียก’ คนที่ข้ามม่านมาจากโลกอื่น... ครั้งสุดท้ายที่ฉันเห็นมัน โลกเกือบสิ้นสลาย"' },
    2: { title: 'ความทรงจำแรก', text: 'เจ้าเห็นภาพเมืองที่สว่างไสวด้วยแสงไฟประหลาด ไม่มีเวทมนตร์ ผู้คนก้มมองแผ่นกระจกในมือ... นั่นคือโลกเดิมของเจ้า? หรือเป็นแค่ความฝัน?' },
    3: { title: 'เปลวไฟสี่ทิศ', text: 'เมื่อไฟทั้งสี่ลุกโชน เสียงหนึ่งดังขึ้น: "เจ้าไม่ได้ถูกเรียกมาเพื่อช่วยโลกนี้ เจ้าถูกเรียกมาเพื่อ ‘เลือก’ ว่าโลกนี้ควรอยู่หรือไป"' },
    4: { title: 'สิ่งที่คิปเห็น', text: 'คิปเล่าว่าคืนที่ม่านรัตติกาลลงมา มีคนผู้หนึ่งยืนอยู่กลางทุ่ง มีเครื่องหมายบนมือเหมือนพี่เลย... และคนนั้นกำลังร้องไห้' },
    5: { title: 'จารึกในซากปรักหักพัง', text: '"เราสร้างม่านขึ้นเพื่อปกป้อง ไม่ใช่ทำลาย สิ่งที่อยู่นอกม่านน่ากลัวยิ่งกว่าความมืด" — จารึกโดยสภาจอมเวทแห่งยุคแสง' },
    6: { title: 'บันทึกของยาม', text: 'โรวานยอมรับว่าเขาเคยได้รับคำสั่งให้ "กำจัดผู้ถูกเรียกทุกคนที่ตื่นขึ้นมา" แต่เขาไม่เคยทำตาม เพราะคนแรกที่เขาพบช่วยชีวิตลูกชายเขา' },
    7: { title: 'คำสารภาพของผู้เฒ่า', text: 'มาเรนเคยเป็นหนึ่งในผู้ถูกเรียกเมื่อห้าสิบปีก่อน เขาเลือก "แสง" และผนึกความทรงจำของตัวเองเพื่อแลกกับการปกป้องหมู่บ้าน' },
    8: { title: 'เสียงกระซิบ', text: '"กลับมาหาเราสิ... เจ้าคือผู้สร้างม่านนี้ เจ้าลืมไปแล้วหรือ?" — เสียงจากรอยแยกรู้จักชื่อจริงของเจ้า ชื่อที่แม้แต่เจ้ายังจำไม่ได้' },
    9: { title: 'สหายเก่าของเซเรน', text: 'เซเรนเคยเดินทางกับกลุ่มผู้กล้าเมื่อพันปีก่อน หนึ่งในนั้นมีเครื่องหมายเหมือนเจ้า เขาหายไปในรอยแยกหลังปราบราชันปีศาจ... "หรือว่าเธอคือเขาที่กลับมาเกิดใหม่?"' },
    10:{ title: 'แกนของผู้พิทักษ์', text: 'แกนผู้พิทักษ์ฉายภาพสุดท้าย: เจ้าในอดีตยืนอยู่หน้าม่าน มือข้างหนึ่งเปล่งแสง อีกข้างหนึ่งดำมืด และเจ้ายิ้ม' },
    11:{ title: 'เสียงสะท้อนไม่สิ้นสุด', text: 'ความจริงไม่ได้มีเพียงหนึ่งเดียว ทุกเสียงสะท้อนจะเล่าเรื่องที่ต่างกันเล็กน้อย จงตามหาต่อไป แล้วตัดสินใจเองว่าเจ้าคือแสงหรือรัตติกาล' },
    12:{ title: 'ตะเกียงที่ดับ', text: 'ในความมืดของรอยแยก เจ้าเห็นเงาสะท้อนตัวเอง แต่มันไม่ได้ขยับตามเจ้า มันกระซิบว่า "ข้าคือครึ่งที่เจ้าทิ้งไว้"' }
  };
  // endless "echo" whispers — randomly combined
  D.ECHO = {
    who: ['เจ้าคือผู้สร้างม่าน', 'เจ้าคือผู้ที่ทำลายแสง', 'เจ้าคือผู้กล้าที่กลับมาเกิด', 'เจ้าคือราชันปีศาจที่ลืมตัวเอง', 'เจ้าคือเด็กธรรมดาจากอีกโลก', 'เจ้าคือเศษเสี้ยวของเทพี'],
    why: ['เพื่อปกป้องบางสิ่งที่อยู่นอกม่าน', 'เพราะสัญญากับใครบางคนเมื่อพันปีก่อน', 'เพราะโลกเดิมของเจ้ากำลังจะดับสูญ', 'เพื่อชดใช้สิ่งที่เคยทำ', 'โดยไม่มีเหตุผล... เพียงเพราะเจ้าเลือก'],
    hint: ['ความจริงอยู่ใต้ทะเลสาบผลึก', 'จงถามเซเรนเรื่องสหายเก่า', 'ม่านจะบางลงเมื่อพระจันทร์เต็มดวง', 'บางเสียงสะท้อนกำลังโกหก', 'แสงและความมืดมาจากแหล่งเดียวกัน']
  };

  // ---------- Shops ----------
  D.SHOPS = {
    general: ['hp_potion', 'mp_potion', 'sweet_bun', 'bouquet', 'wooden_sword', 'hand_axe', 'rusty_dagger', 'apprentice_staff', 'twig_wand', 'short_bow', 'cloth_robe', 'straw_hat'],
    smith: ['enh_stone', 'iron_sword', 'steel_axe', 'hunter_bow', 'oak_staff', 'leather_armor', 'iron_armor', 'iron_helm', 'protect_scroll'],
    herb: ['hp_potion', 'hi_potion', 'mp_potion', 'herbal_tea', 'mana_ring']
  };

  D.newSave = function (name, look) {
    return {
      v: 1, name, look: look || {}, lv: 1, exp: 0, gold: 100,
      hp: 100, mp: 50, pos: [0, 0, 6], cls: 'novice', align: 0,
      stats: { str: 5, int: 5, dex: 5, vit: 5, wis: 5, luk: 5, cha: 5 },
      statXp: { str: 0, int: 0, dex: 0, vit: 0, wis: 0, luk: 0, cha: 0 },
      acts: {}, score: {}, inv: [], equip: { weapon: null, armor: null, helm: null, acc: null },
      skills: ['slash_wave', 'fire_bolt', 'heal', 'dash'], bar: ['slash_wave', 'fire_bolt', 'heal', 'dash'],
      recipes: [], quests: { active: {}, done: {} }, npc: {}, lore: [], puzzles: {}, explored: {}, kills: {}, playTime: 0
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = D; else root.GameData = D;
})(typeof self !== 'undefined' ? self : this);
