/*
 * Awoo moderator / God voice script builder.
 * Generates the night-call sequence from the roles actually configured for the current game.
 * Note: common Werewolf variants use different action orders. The default follows the
 * order requested for Awoo (wolves -> witch -> seer -> guard); `classic` can be selected
 * in the ruleset for guard -> wolves -> witch -> seer.
 */
(function (root, factory) {
  const roleDb = (typeof module === 'object' && module.exports)
    ? require('./role-database.js')
    : (root && root.AwooRoleDatabase);
  const api = factory(roleDb);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AwooModeratorScript = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (roleDb) {
  'use strict';

  const getRoleDefinition = roleDb && roleDb.getRoleDefinition
    ? roleDb.getRoleDefinition
    : () => null;
  const getRoleCamp = roleDb && roleDb.getRoleCamp
    ? roleDb.getRoleCamp
    : () => '未知';

  const FIRST_NIGHT_SETUP = Object.freeze({
    '盜賊': {
      order: 10,
      lines: [
        ['盜賊請睜眼。', '確認可供選擇的額外身份牌，並依本局房規選擇是否換牌。'],
        ['盜賊請選擇身份牌。', '若此板型沒有提供額外身份牌，請在房規中停用盜賊。'],
        ['盜賊請閉眼。', '記錄盜賊最終身份，再進入下一個首夜角色。'],
      ],
    },
    '邱比特': {
      order: 20,
      lines: [
        ['邱比特請睜眼。', '首夜指定兩名玩家成為情侶。'],
        ['邱比特請選擇兩位玩家成為情侶。', '確認兩個座位後記錄連結關係。'],
        ['邱比特請閉眼。', '接著喚醒情侶確認彼此。'],
      ],
    },
    '混血兒': {
      order: 30,
      lines: [
        ['混血兒請睜眼。', '選擇或確認本局的跟隨對象，依選用版本處理。'],
        ['混血兒請選擇一名玩家作為跟隨對象。', '混血兒的勝利陣營在本局規則中需要明確定義。'],
        ['混血兒請閉眼。', '記錄跟隨對象。'],
      ],
    },
    '野孩子': {
      order: 40,
      lines: [
        ['野孩子請睜眼。', '首夜選擇一名玩家作為榜樣。'],
        ['野孩子請選擇一名玩家作為你的榜樣。', '記錄榜樣座位；榜樣出局後的陣營變化依房規結算。'],
        ['野孩子請閉眼。', '記錄榜樣關係。'],
      ],
    },
    '暗戀者': {
      order: 60,
      lines: [
        ['暗戀者請睜眼。', '依本局版本確認暗戀對象或接收設定。'],
        ['暗戀者請閉眼。', '暗戀關係不自動等同於情侶殉情關係。'],
      ],
    },
  });

  // Explicit scripts for frequently used active roles and common extensions.
  // `speechText: null` is intentional for private results that must never be read aloud publicly.
  const ROLE_SCRIPTS = Object.freeze({
    '魔術師': { order: 80, lines: [
      ['魔術師請睜眼。', '若本局使用交換規則，請在其他夜間技能前選擇兩個有效座位。'],
      ['魔術師，請選擇今晚要交換的兩個座位。', '交換效果只作用於本夜；請由結算器統一套用目標映射。'],
      ['魔術師請閉眼。', '確認交換結果已記錄。'],
    ]},
    '狼美人': { order: 130, lines: [
      ['狼美人請睜眼。', '選擇本夜魅惑目標；目標是否會在狼美人出局時殉情，依房規處理。'],
      ['狼美人請選擇今晚要魅惑的玩家。', '記錄魅惑目標，不要與狼人共同夜刀目標混為同一欄位。'],
      ['狼美人請閉眼。', '確認魅惑目標已記錄。'],
    ]},
    '噩夢之影': { order: 140, lines: [
      ['噩夢之影請睜眼。', '選擇本夜要恐懼或封鎖的玩家。'],
      ['噩夢之影，請選擇今晚要恐懼的玩家。', '封鎖必須在受影響角色行動之前套用。'],
      ['噩夢之影請閉眼。', '確認封鎖目標已記錄。'],
    ]},
    '石像鬼': { order: 150, lines: [
      ['石像鬼請睜眼。', '依石像鬼版本查驗一名玩家；通常與狼人團隊行動分開。'],
      ['石像鬼，請選擇要查驗的玩家。', '查驗結果只顯示在石像鬼的私密控制台。'],
      ['石像鬼請閉眼。', '確認查驗紀錄。'],
    ]},
    '機械狼': { order: 155, lines: [
      ['機械狼請睜眼。', '依本局機械狼版本，選擇模仿、複製或獲取技能的目標。'],
      ['機械狼，請選擇技能目標。', '複製技能的種類、次數與生效時間必須由房規明確指定。'],
      ['機械狼請閉眼。', '確認機械狼行動紀錄。'],
    ]},
    '狼預言家': { order: 160, lines: [
      ['狼預言家請睜眼。', '依本局角色版本查驗一名玩家。'],
      ['狼預言家，請選擇查驗目標。', '此結果只提供給狼預言家，不應公開播報。'],
      ['狼預言家請閉眼。', '確認查驗紀錄。'],
    ]},
    '狼巫': { order: 165, lines: [
      ['狼巫請睜眼。', '依本局狼巫版本選擇詛咒、查驗或干擾目標。'],
      ['狼巫，請選擇技能目標。', '若房規未選定該版本，應停用此技能，不可自行猜測效果。'],
      ['狼巫請閉眼。', '確認狼巫行動紀錄。'],
    ]},
    '女巫': { order: 200, lines: [
      ['女巫請睜眼。', '女巫的藥劑狀態與夜刀目標會顯示在女巫私密控制台。'],
      ['今天晚上這位玩家死了，你要救他嗎？', '若解藥尚未使用，私下顯示狼刀目標編號；切勿用語音向全場讀出目標編號。', 'PRIVATE_IF_ANTIDOTE_AVAILABLE'],
      ['你有一瓶毒藥，你要毒死誰嗎？請選擇目標。', '開啟座位選擇器；所有玩家編號都顯示，已出局玩家反灰並禁用。', 'PRIVATE_IF_POISON_AVAILABLE'],
      ['女巫請閉眼。', '毒藥與解藥的使用狀態需在整局保留。'],
    ]},
    '覺醒女巫': { order: 205, lines: [
      ['覺醒女巫請睜眼。', '依覺醒女巫採用的版本確認藥劑能力與剩餘次數。'],
      ['覺醒女巫，請選擇本夜要使用的技能與目標。', '這是版本提示；需在房規中定義技能後才可正式結算。'],
      ['覺醒女巫請閉眼。', '確認技能使用紀錄。'],
    ]},
    '預言家': { order: 300, lines: [
      ['預言家請睜眼。', '請選擇今晚要查驗的玩家。'],
      ['今天晚上你要驗誰？', '點選玩家後，查驗結果只顯示在預言家私密控制台。'],
      ['這個人的身份是……', '私下顯示手勢或陣營結果：大拇指向上代表好人，向下代表狼人。此結果不可由公開語音播報。', null],
      ['預言家請閉眼。', '確認查驗紀錄。'],
    ]},
    '覺醒預言家': { order: 305, lines: [
      ['覺醒預言家請睜眼。', '依覺醒預言家採用的版本選擇查驗目標。'],
      ['覺醒預言家，請選擇查驗目標。', '查驗結果只顯示於此角色的私密控制台。'],
      ['覺醒預言家請閉眼。', '確認查驗紀錄。'],
    ]},
    '純白之女': { order: 310, minDay: 2, lines: [
      ['純白之女請睜眼。', '依本局規則，從允許開始行動的夜晚起選擇一名玩家查驗。'],
      ['純白之女，請選擇今晚的查驗目標。', '查驗結果只顯示在角色私密控制台。'],
      ['純白之女請閉眼。', '確認查驗紀錄。'],
    ]},
    '守衛': { order: 400, lines: [
      ['守衛請睜眼。', '請選擇一名玩家進行守護；本局預設禁止連續兩晚守同一人。'],
      ['守衛今天晚上你要守護誰？', '同守同救是否死亡由目前房規決定；守護不應自動免疫毒藥。'],
      ['守衛請閉眼。', '確認守護目標已記錄。'],
    ]},
    '攝夢人': { order: 500, lines: [
      ['攝夢人請睜眼。', '選擇本夜的夢遊者，依採用版本判定保護與連帶傷害。'],
      ['攝夢人，請選擇今晚的夢遊者。', '連續選擇同一人與攝夢人死亡時的效果需要依房規結算。'],
      ['攝夢人請閉眼。', '確認夢遊目標。'],
    ]},
    '烏鴉': { order: 510, lines: [
      ['烏鴉請睜眼。', '選擇本次詛咒或增加投票壓力的目標。'],
      ['烏鴉，請選擇詛咒目標。', '詛咒效果必須在下一次公投時計入票數。'],
      ['烏鴉請閉眼。', '確認詛咒目標。'],
    ]},
    '禁言長老': { order: 520, lines: [
      ['禁言長老請睜眼。', '選擇下一個白天不能發言的玩家。'],
      ['禁言長老，請選擇禁言目標。', '禁言狀態應在下一個白天套用並於適當時點重置。'],
      ['禁言長老請閉眼。', '確認禁言目標。'],
    ]},
    '守墓人': { order: 530, lines: [
      ['守墓人請睜眼。', '查看上一個白天被公投出局者的陣營；第一夜通常沒有資料。'],
      ['守墓人，請查看上一位放逐者的資訊。', '資訊只顯示於守墓人私密控制台。', null],
      ['守墓人請閉眼。', '確認資訊已顯示。'],
    ]},
    '獵魔人': { order: 540, minDay: 2, lines: [
      ['獵魔人請睜眼。', '從本局規定可行動的夜晚起選擇狩獵目標。'],
      ['獵魔人，請選擇狩獵目標。', '命中與誤傷的結果依本局規則結算。'],
      ['獵魔人請閉眼。', '確認狩獵目標。'],
    ]},
    '子狐': { order: 550, lines: [
      ['子狐請睜眼。', '依本局子狐版本選擇查驗或使用夜間技能。'],
      ['子狐，請選擇技能目標。', '查驗結果只顯示於該角色的私密控制台。'],
      ['子狐請閉眼。', '確認行動紀錄。'],
    ]},
    '狐狸': { order: 560, lines: [
      ['狐狸請睜眼。', '依本局版本選擇目標或接收夜間資訊。'],
      ['狐狸，請依本局規則執行技能。', '此角色在不同板型可能是被動、查驗或夜間行動角色。'],
      ['狐狸請閉眼。', '確認行動紀錄。'],
    ]},
    '奇蹟商人': { order: 70, firstNightOnly: true, lines: [
      ['奇蹟商人請睜眼。', '依本局版本選擇幸運兒或指定技能給予對象。'],
      ['奇蹟商人，請選擇本局技能目標。', '給予的技能、對象限制與懲罰需在房規中明確定義。'],
      ['奇蹟商人請閉眼。', '確認選擇。'],
    ]},
    '馴熊師': { order: 900, passive: true, lines: [] },
    '長老': { order: 900, passive: true, lines: [] },
    '白痴': { order: 900, passive: true, lines: [] },
    '村長': { order: 900, passive: true, lines: [] },
    // In the common base rules, the Hunter is triggered by death rather than a nightly action.
    // Do not wake the Hunter every night; the death-triggered shot flow is handled separately
    // and must not be confused with this nightly script.
    '獵人': { order: 700, passive: true, lines: [] },
    '吹笛者': { order: 600, lines: [
      ['吹笛者請睜眼。', '選擇本夜要迷惑的玩家；常見版本一次選兩人。'],
      ['吹笛者，請選擇兩名玩家進行迷惑。', '被迷惑狀態需累積到勝利條件滿足時才結算。'],
      ['吹笛者請閉眼。', '確認迷惑目標。'],
    ]},
    '縱火狂': { order: 610, lines: [
      ['縱火狂請睜眼。', '依本局版本選擇塗油標記或引燃。'],
      ['縱火狂，請選擇本夜的標記或引燃目標。', '標記與引燃是不同事件，需分開保存。'],
      ['縱火狂請閉眼。', '確認行動紀錄。'],
    ]},
    '縱火者': { order: 615, lines: [
      ['縱火者請睜眼。', '依本局版本選擇縱火技能與目標。'],
      ['縱火者，請選擇技能目標。', '此為版本通用口白，請確認採用的縱火者規則。'],
      ['縱火者請閉眼。', '確認行動紀錄。'],
    ]},
    '吸血鬼': { order: 620, lines: [
      ['吸血鬼請睜眼。', '依本局版本選擇吸血、感染或其他夜間目標。'],
      ['吸血鬼，請選擇今晚的技能目標。', '是否轉換陣營與何時獲勝需由本局規則定義。'],
      ['吸血鬼請閉眼。', '確認行動紀錄。'],
    ]},
    '殺人狂': { order: 630, lines: [
      ['殺人狂請睜眼。', '依本局版本選擇夜間攻擊或其他可用能力。'],
      ['殺人狂，請選擇今晚的技能目標。', '獨立陣營的勝利條件不能只靠狼人／好人勝負代替。'],
      ['殺人狂請閉眼。', '確認行動紀錄。'],
    ]},
    '邪教首領': { order: 640, lines: [
      ['邪教首領請睜眼。', '依本局版本選擇招募或轉化目標。'],
      ['邪教首領，請選擇今晚的招募目標。', '轉化需保留原始角色與當前陣營的分離資料。'],
      ['邪教首領請閉眼。', '確認招募紀錄。'],
    ]},
    '寄生蟲': { order: 650, lines: [
      ['寄生蟲請睜眼。', '依本局版本選擇寄生目標。'],
      ['寄生蟲，請選擇今晚的寄生目標。', '目標死亡或轉換陣營時的連結處理由房規定義。'],
      ['寄生蟲請閉眼。', '確認寄生紀錄。'],
    ]},
    '催眠師': { order: 660, lines: [
      ['催眠師請睜眼。', '選擇本夜要干擾或改變行動的玩家。'],
      ['催眠師，請選擇技能目標。', '干擾需在受影響者行動前套用。'],
      ['催眠師請閉眼。', '確認行動紀錄。'],
    ]},
    '刺客': { order: 670, lines: [
      ['刺客請睜眼。', '依本局版本選擇暗殺目標或確認剩餘次數。'],
      ['刺客，請選擇暗殺目標。', '是否可被守護、是否有獨立勝利條件依房規設定。'],
      ['刺客請閉眼。', '確認行動紀錄。'],
    ]},
    '觀察者': { order: 680, lines: [
      ['觀察者請睜眼。', '依本局版本選擇要追蹤的玩家。'],
      ['觀察者，請選擇追蹤目標。', '追蹤結果只顯示在觀察者私密控制台。', null],
      ['觀察者請閉眼。', '確認行動紀錄。'],
    ]},
    '失眠者': { order: 690, lines: [
      ['失眠者請睜眼。', '查看本夜受到的效果或行動結果。'],
      ['失眠者，請查看本夜資訊。', '此資訊應在夜間其他技能結算後顯示。', null],
      ['失眠者請閉眼。', '確認資訊已顯示。'],
    ]},
    '鍊金魔女': { order: 210, lines: [
      ['鍊金魔女請睜眼。', '依本局鍊金魔女版本確認可用道具與剩餘次數。'],
      ['鍊金魔女，請選擇要使用的道具與目標。', '各種道具需分別記錄與結算；不要直接套用普通女巫的藥劑規則。'],
      ['鍊金魔女請閉眼。', '確認道具使用紀錄。'],
    ]},
    '通靈師': { order: 315, lines: [
      ['通靈師請睜眼。', '依本局版本查看指定出局者或接收死者資訊。'],
      ['通靈師，請選擇／查看要通靈的對象。', '資訊結果只應顯示在通靈師私密控制台；首夜沒有可查死者時依房規跳過。', null],
      ['通靈師請閉眼。', '確認資訊已顯示。'],
    ]},
    '賞金獵人': { order: 325, lines: [
      ['賞金獵人請睜眼。', '依本局版本指定懸賞目標或查看剩餘行動。'],
      ['賞金獵人，請選擇懸賞目標。', '懸賞獎勵、誤傷懲罰及結算時機需依房規定義。'],
      ['賞金獵人請閉眼。', '確認目標已記錄。'],
    ]},
    '潛行者': { order: 335, lines: [
      ['潛行者請睜眼。', '依本局潛行者版本選擇追蹤、潛伏或攻擊目標。'],
      ['潛行者，請選擇今晚的技能目標。', '本角色不同平台版本差異較大；本句僅為主持流程提示。'],
      ['潛行者請閉眼。', '確認行動紀錄。'],
    ]},
    '毒師': { order: 345, lines: [
      ['毒師請睜眼。', '確認毒師本局可用的毒藥次數與限制。'],
      ['毒師，請選擇毒殺目標。', '本角色與女巫毒藥不是同一資源；請獨立記錄毒師目標與免疫規則。'],
      ['毒師請閉眼。', '確認毒師行動紀錄。'],
    ]},
    '守護天使': { order: 350, lines: [
      ['守護天使請睜眼。', '依本局守護天使版本選擇保護目標。'],
      ['守護天使，請選擇今晚要守護的玩家。', '保護能否抵擋毒藥、連守限制與自保規則依房規設定。'],
      ['守護天使請閉眼。', '確認守護目標。'],
    ]},
    '醫師': { order: 355, lines: [
      ['醫師請睜眼。', '依本局醫師版本確認可用治療次數。'],
      ['醫師，請選擇今晚要治療的玩家。', '治療是否抵銷狼人襲擊或其他傷害須由規則引擎明確判定。'],
      ['醫師請閉眼。', '確認治療目標。'],
    ]},
    '偵探': { order: 360, lines: [
      ['偵探請睜眼。', '依偵探版本選擇調查對象或查詢相鄰玩家。'],
      ['偵探，請選擇調查目標。', '調查結果只顯示在角色私密控制台。', null],
      ['偵探請閉眼。', '確認調查資訊已顯示。'],
    ]},
    '調查員': { order: 365, lines: [
      ['調查員請睜眼。', '依本局調查員版本指定調查目標。'],
      ['調查員，請選擇調查目標。', '調查結果只顯示在調查員私密控制台。', null],
      ['調查員請閉眼。', '確認調查紀錄。'],
    ]},
    '神諭者': { order: 370, lines: [
      ['神諭者請睜眼。', '依本局神諭者版本選擇目標或接收夜間預兆。'],
      ['神諭者，請選擇技能目標。', '這是流程提示；具體回傳資訊須由房規定義。', null],
      ['神諭者請閉眼。', '確認資訊已顯示。'],
    ]},
    '白晝學者': { order: 375, minDay: 2, lines: [
      ['白晝學者請睜眼。', '若本局規則允許白晝學者在夜間準備資訊，從指定夜晚開始行動。'],
      ['白晝學者，請選擇本夜技能目標。', '此角色的能力可能在白天生效；需以採用版本為準。'],
      ['白晝學者請閉眼。', '確認技能紀錄。'],
    ]},
  });

  const WOLF_SPECIAL_ROLES = new Set([
    '狼美人', '噩夢之影', '石像鬼', '機械狼', '狼預言家', '狼巫',
    '黑騎士', '狼犬', '大灰狼', '大野狼', '血月使徒', '狼兄', '狼弟',
    '雪狼', '隱狼', '種狼', '惡魔', '天狗', '狼外婆', '狼鴉之爪',
    '黑蝙蝠', '夜之貴族', '火狼', '毒狼', '蝕時狼妃', '混沌之魔',
    '尋香魅影', '戰狼', '帝尊魔皇', '怪盜狼王', '寂夜導師', '蝕日侍女',
    '阿爾法狼', '大壞狼', '狂人',
  ]);

  const NIGHT_TIMING_RE = /夜|每晚|夜間|夜间|首夜|天黑|晚間|晚间/;

  function canonicalRole(value) {
    const definition = getRoleDefinition(value);
    return definition ? definition.name : String(value == null ? '' : value).trim();
  }

  function line(role, text, note = '', speechText = text, kind = 'call', actionKey = null) {
    return { role, text, note, speechText, kind, actionKey };
  }

  function inferActionKey(roleName, text) {
    if (roleName === '狼人陣營' && text.includes('狼人請殺人')) return 'wolfAttack';
    if (roleName === '女巫' && text.includes('你要救他嗎')) return 'witchSaveDecision';
    if (roleName === '女巫' && text.includes('你要毒死誰嗎')) return 'witchPoisonDecision';
    if (roleName === '預言家' && text.includes('今天晚上你要驗誰')) return 'seerCheck';
    if (roleName === '守衛' && text.includes('你要守護誰')) return 'guardProtect';
    // Other roles have a spoken prompt but may not yet have an implemented skill UI.
    // Requiring an explicit moderator acknowledgement prevents accidental advancement.
    const asksForAction = /(請選擇|请选择|要驗誰|要验谁|要救他嗎|要救他吗|要毒死誰嗎|要毒死谁吗|要守護誰|要守护谁|請殺人|请杀人|確認身份|确认身份|請確認|请确认|請查看|请查看|查看上一位|技能目標|技能目标|狩獵目標|狩猎目标|迷惑|暗殺目標|暗杀目标|行動目標|行动目标)/.test(text);
    return asksForAction ? `manual:${roleName}` : null;
  }

  function appendTemplateSteps(target, roleName, template) {
    (template.lines || []).forEach(([text, note = '', third, explicitActionKey]) => {
      let speechText = text;
      let kind = 'call';
      if (third === null) {
        speechText = null;
        kind = 'private';
      } else if (third === 'PRIVATE_IF_ANTIDOTE_AVAILABLE') {
        speechText = '今天晚上這位玩家死了，你要救他嗎？';
        kind = 'conditional';
      } else if (third === 'PRIVATE_IF_POISON_AVAILABLE') {
        speechText = '你有一瓶毒藥，你要毒死誰嗎？請選擇目標。';
        kind = 'conditional';
      }
      const actionKey = explicitActionKey || inferActionKey(roleName, text);
      const newLine = line(roleName, text, note, speechText, kind, actionKey);
      if (third === 'PRIVATE_IF_ANTIDOTE_AVAILABLE') newLine.condition = 'antidote-available';
      if (third === 'PRIVATE_IF_POISON_AVAILABLE') newLine.condition = 'poison-available';
      target.push(newLine);
    });
  }

  function buildNightScript(rolesInGame, day = 1, rules = {}) {
    const names = [...new Set((Array.isArray(rolesInGame) ? rolesInGame : []).map(canonicalRole).filter(Boolean))];
    const nameSet = new Set(names);
    const firstNight = Number(day) === 1;
    const orderPreset = rules.moderatorNightOrderPreset === 'classic' ? 'classic' : 'awoo-custom';
    const steps = [line('全體', '天黑請閉眼。', '等待所有玩家準備好，再逐句推進主持流程。')];
    const configuredRoles = new Set(['狼人']);
    const notices = [];

    if (firstNight) {
      const setupEntries = Object.entries(FIRST_NIGHT_SETUP)
        .filter(([roleName]) => nameSet.has(roleName))
        .sort((a, b) => a[1].order - b[1].order);
      setupEntries.forEach(([roleName, template]) => {
        appendTemplateSteps(steps, roleName, template);
        configuredRoles.add(roleName);
        if (roleName === '邱比特' && (nameSet.has('邱比特') || nameSet.has('情侶'))) {
          steps.push(line('情侶', '情侶請睜眼，請相互確認身份。', '主持人確認連結雙方都已看見彼此。'));
          steps.push(line('情侶', '情侶請閉眼。', '連結已建立。'));
          configuredRoles.add('情侶');
        }
      });
    }

    // Magic/early-order roles act before the common four-role sequence.
    const explicitRoles = Object.entries(ROLE_SCRIPTS)
      .filter(([roleName, template]) => nameSet.has(roleName) && !template.passive && (!template.firstNightOnly || firstNight) && (!template.minDay || Number(day) >= template.minDay))
      .map(([roleName, template]) => ({ roleName, template }));

    const hasWolves = names.some(name => {
      const definition = getRoleDefinition(name);
      return definition && definition.team === 'wolf';
    });

    // Avoid processing special wolf templates before the collective wolf action.
    const orderedEntries = explicitRoles.filter(({ roleName }) => roleName !== '女巫' && roleName !== '預言家' && roleName !== '覺醒預言家' && roleName !== '守衛');
    const getRank = (roleName, template) => {
      let rank = template.order || 500;
      if (orderPreset === 'classic') {
        if (roleName === '守衛') rank = 100;
        else if (roleName === '魔術師') rank = 80;
        else if (roleName === '女巫') rank = 300;
        else if (roleName === '預言家' || roleName === '覺醒預言家') rank = 400;
        else if (roleName === '狼人') rank = 200;
      } else {
        if (roleName === '魔術師') rank = 80;
        else if (roleName === '女巫') rank = 200;
        else if (roleName === '預言家' || roleName === '覺醒預言家') rank = 300;
        else if (roleName === '守衛') rank = 400;
      }
      return rank;
    };

    orderedEntries.sort((a, b) => getRank(a.roleName, a.template) - getRank(b.roleName, b.template) || a.roleName.localeCompare(b.roleName, 'zh-Hant'));
    if (hasWolves) {
      // Insert wolf action at the requested/custom or classic position.
      const wolfOpeningNote = nameSet.has('小女孩')
        ? '本局包含小女孩：其是否能在狼隊行動期間偷看依採用版本處理；不另外單獨叫醒，以免改變夜間節奏。'
        : '狼人陣營角色一起確認隊友；部分特殊狼是否參與共同夜刀，依板型設定。';
      const wolfSteps = [
        line('狼人陣營', '狼人現身，請睜眼。', wolfOpeningNote),
      ];
      if (firstNight) {
        const identifyCue = line('狼人陣營', '狼人請相互確認身份。', '首夜互認隊友；系統會停頓數秒，讓狼人確認彼此身份。');
        identifyCue.postSpeechPauseMs = 2400;
        wolfSteps.push(identifyCue);
        if (nameSet.has('狼王')) {
          const wolfKingCue = line('狼王', '狼王請比讚。', '首夜由狼王以手勢向狼隊確認身份；這是主持提示，不需要額外點擊。');
          wolfKingCue.postSpeechPauseMs = 1800;
          wolfSteps.push(wolfKingCue);
        }
      }
      wolfSteps.push(line('狼人陣營', '狼人請選擇今晚要殺的對象，請統一意見。', '系統會等待狼隊確認有效目標或確認空刀；決策完成後自動播放「狼人請閉眼」。', '狼人請選擇今晚要殺的對象，請統一意見。', 'call', 'wolfAttack'));
      wolfSteps.push(line('狼人陣營', '狼人請閉眼。', '記錄狼刀目標。'));

      // Each regular role's script is inserted by ordering below. The collective wolves are a single group.
      const wolfRank = orderPreset === 'classic' ? 200 : 100;
      const combined = orderedEntries.map(entry => ({ ...entry, rank: getRank(entry.roleName, entry.template), type: 'role' }));
      combined.push({ roleName: '狼人陣營', template: { lines: [] }, rank: wolfRank, type: 'wolves', steps: wolfSteps });
      const remaining = ['女巫', '預言家', '覺醒預言家', '守衛']
        .filter(roleName => nameSet.has(roleName) && (!ROLE_SCRIPTS[roleName].minDay || Number(day) >= ROLE_SCRIPTS[roleName].minDay))
        .map(roleName => ({ roleName, template: ROLE_SCRIPTS[roleName], rank: getRank(roleName, ROLE_SCRIPTS[roleName]), type: 'role' }));
      remaining.forEach(entry => combined.push(entry));
      combined.sort((a, b) => a.rank - b.rank || a.roleName.localeCompare(b.roleName, 'zh-Hant'));
      combined.forEach(entry => {
        if (entry.type === 'wolves') {
          steps.push(...entry.steps);
          configuredRoles.add('狼人');
          return;
        }
        appendTemplateSteps(steps, entry.roleName, entry.template);
        configuredRoles.add(entry.roleName);
      });
    } else {
      // Even a custom board without wolves should call its configured roles.
      orderedEntries.forEach(({ roleName, template }) => {
        appendTemplateSteps(steps, roleName, template);
        configuredRoles.add(roleName);
      });
      ['女巫', '預言家', '覺醒預言家', '守衛'].filter(name => nameSet.has(name)).forEach(roleName => {
        const template = ROLE_SCRIPTS[roleName];
        if (!template.minDay || Number(day) >= template.minDay) {
          appendTemplateSteps(steps, roleName, template);
          configuredRoles.add(roleName);
        }
      });
    }

    // Add a cautious generic script for catalogued roles whose own metadata says they may act at night.
    // This is explicitly marked as a placeholder so it cannot be mistaken for a finished skill implementation.
    names.forEach(roleName => {
      if (configuredRoles.has(roleName) || FIRST_NIGHT_SETUP[roleName] || (ROLE_SCRIPTS[roleName] && ROLE_SCRIPTS[roleName].passive)) return;
      if (WOLF_SPECIAL_ROLES.has(roleName)) {
        const template = ROLE_SCRIPTS[roleName];
        if (template && (!template.minDay || Number(day) >= template.minDay)) {
          appendTemplateSteps(steps, roleName, template);
          configuredRoles.add(roleName);
          return;
        }
      }
      const definition = getRoleDefinition(roleName);
      if (roleName === '小女孩') {
        configuredRoles.add(roleName);
        notices.push('小女孩：是否偷看由採用版本規定，已附註在狼人行動流程，不會另行叫醒。');
        return;
      }
      if (!definition) {
        notices.push(`${roleName}：角色資料未解析，沒有可安全套用的專屬口白。`);
        return;
      }
      // Basic wolf roles are already called together in the collective wolf phase.
      // Do not append a second generic individual wake/sleep sequence for them.
      if (definition.team === 'wolf' && !WOLF_SPECIAL_ROLES.has(roleName)) {
        configuredRoles.add(roleName);
        return;
      }
      const nightRelevant = NIGHT_TIMING_RE.test(`${definition.timing || ''} ${definition.ability || ''}`);
      if (nightRelevant) {
        steps.push(line(roleName, `${roleName}請睜眼，請依本局已選定的角色規則執行技能。`, '通用佔位口白：此角色尚無專屬主持腳本，必須依實際板型核對，不能代表技能已實作。'));
        steps.push(line(roleName, `${roleName}請選擇或確認本夜技能目標。`, '此角色目前可能尚未接入實際操作面板；測試模式可由主持人手動確認此流程，但這不代表技能已實作。', undefined, 'call', `manual:${roleName}`));
        steps.push(line(roleName, `${roleName}請閉眼。`, '通用佔位口白：此角色尚無專屬主持腳本。'));
        configuredRoles.add(roleName);
        notices.push(`${roleName}：使用通用佔位口白，需依板型補完專屬流程。`);
      } else {
        notices.push(`${roleName}：目前沒有夜間主動行動口白；可能是被動／白天技能，請確認板型。`);
      }
    });

    steps.push(line('全體', '天亮請睜眼。', '進入夜晚結算；實際死訊應只依夜晚結算器回傳的死亡清單公告。'));
    return { steps, notices, orderPreset, roleNames: names, firstNight };
  }

  return Object.freeze({
    FIRST_NIGHT_SETUP,
    ROLE_SCRIPTS,
    buildNightScript,
    canonicalRole,
  });
});
