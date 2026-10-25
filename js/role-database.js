/*
 * Awoo role database
 * This file is deliberately independent from the DOM so role records can be tested in Node.
 * Add/update role metadata here; see docs/ADDING_ROLES.md before changing the schema.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AwooRoleDatabase = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
// 統一角色資料庫：圖鑑、陣營識別與角色別名共用同一來源。
    // 技能以「常見版本摘要」描述；正式對局仍須明確選定板型和房規。
    function makeRole(name, team, category, ability, extra = {}) {
      const camp = team === 'wolf' ? '狼人陣營'
        : team === 'wolfAlly' ? '狼人同盟／協力者'
        : team === 'good' ? (category === '神職' ? '好人・神職' : '好人・平民')
        : team === 'couple' ? '情侶／連結角色'
        : '第三方／獨立陣營';
      return {
        name, team, category, camp, ability, desc: ability,
        aliases: extra.aliases || [],
        timing: extra.timing || '依技能而定；通常由主持人依板型指定行動時機。',
        relations: extra.relations || [],
        interaction: extra.interaction || '與其他角色的互動需依當局板型與主持人規則裁定。',
        variants: extra.variants || '此角色在不同平台、卡牌套組或房規中可能有差異；請以開局公告為準。',
        implementation: extra.implementation || '已收錄於圖鑑；遊戲引擎技能尚未實作。'
      };
    }

    const ROLE_DATABASE = [
      // 基礎好人與常見神職
      makeRole('平民','good','平民','沒有主動技能；透過白天發言、推理與投票找出狼人。',{aliases:['村民','VILLAGER'],timing:'白天討論與公投。',relations:['預言家','獵人','小狼'],interaction:'平民與神職同屬好人陣營；公投目標選擇及好人勝利條件由板型決定。',implementation:'已接入：基礎陣營識別與勝負判定原型。'}),
      makeRole('預言家','good','神職','每晚查驗一名玩家，獲得其陣營或身分資訊。',{aliases:['占卜師','先知','SEER'],timing:'夜晚；通常每晚一次。',relations:['女巫','守衛','純白之女','小狼','狂人'],interaction:'查驗結果可能只區分狼人／非狼人，也可能顯示具體身分；狂人、隱狼、妖狐等對查驗的回應因版本不同。',variants:'有些版本查驗的是陣營，有些版本顯示具體身分；通常不能查自己。',implementation:'已接入：基礎查驗原型；多人資訊保密尚待伺服器化。'}),
      makeRole('女巫','good','神職','持有解藥與毒藥；常見規則為各限用一次，可救狼人襲擊目標或毒殺一名玩家。',{aliases:['WITCH'],timing:'夜晚，在得知或選定狼刀後依順序操作。',relations:['小狼','守衛','獵人','惡靈騎士','獵魔人'],interaction:'解藥可能與守衛保護互相影響；女巫被毒、獵人被毒後是否能開槍，以及是否能自救都依房規。',variants:'自救限制、首夜自救、同夜用兩瓶、被毒是否可發動技能，各版本可能不同。',implementation:'已接入：解藥／毒藥目標紀錄原型，規則仍待完整測試。'}),
      makeRole('獵人','good','神職','出局時可依規則開槍帶走一名玩家。',{aliases:['HUNTER'],timing:'符合開槍條件的出局時。',relations:['女巫','狼王','白狼王','小狼'],interaction:'女巫毒殺、某些特殊技能造成的出局可能封槍；狼王與獵人的開槍觸發條件需要分別設定。',variants:'被毒、被白狼王帶走、殉情或技能連帶出局是否能開槍，各版不同。'}),
      makeRole('守衛','good','神職','每晚守護一名玩家，使其免受部分夜間襲擊。',{aliases:['守護者','GUARD'],timing:'夜晚；通常每晚一次。',relations:['女巫','小狼','攝夢人','魔術師'],interaction:'守衛與女巫同時作用於同一目標時，可能出現不同結算結果；需要在夜晚結算器明確定義優先序。',variants:'能否守自己、能否連守、守中毒藥或特殊殺傷能否生效均依房規。',implementation:'已接入：單目標守護原型；與女巫互動規則尚待確定。'}),
      makeRole('白痴','good','神職','部分版本中，被公投放逐時可翻牌免除本次放逐；之後可能失去投票權。',{aliases:['愚者','IDIOT'],timing:'白天被公投放逐時。',relations:['騎士','定序王子','小狼'],interaction:'與騎士決鬥、毒殺或其他非公投出局的互動不一定觸發翻牌保命。',variants:'有的版本翻牌後不能投票，有的版本仍保有部分權利。'}),
      makeRole('騎士','good','神職','白天可翻牌發起一次決鬥；若對方是狼人，通常狼人出局，若對方是好人則騎士承擔懲罰。',{aliases:['KNIGHT'],timing:'白天發言或投票前後的指定窗口。',relations:['小狼','白狼王','白痴','預言家'],interaction:'決鬥若擊中狼人，可能立刻結束白天；技能是否能對特殊狼或狼同盟生效依規則設定。',variants:'可發動時點、每局次數及失敗懲罰因板型不同。'}),
      makeRole('攝夢人','good','神職','每晚選擇一名夢遊者；常見版本會給予夜間保護，並設有連續選擇或攝夢人死亡的連帶風險。',{aliases:['夢遊者','Dreamcatcher'],timing:'夜晚，依主持人指定順序。',relations:['小狼','女巫','守衛','魔術師'],interaction:'夢遊者保護、連續夢到同一人、攝夢人出局時的連帶結果，必須跟夜間傷害一起結算。',variants:'是否可連夢、是否能夢自己、夢遊者何種傷害免疫都有不同版本。'}),
      makeRole('魔術師','good','神職','夜間交換兩名玩家的座位／身分對應，使當夜部分技能效果轉移。',{aliases:['MAGICIAN'],timing:'夜晚通常較早行動。',relations:['預言家','小狼','女巫','守衛'],interaction:'交換對象會影響狼刀、查驗或守護究竟作用於誰；需統一區分玩家 ID 與當夜目標映射。',variants:'有些版本交換座位，有些交換當夜技能目標或號碼牌；效果持續時間不同。'}),
      makeRole('守墓人','good','神職','夜晚查知上一位白天被公投出局者的陣營或狼／非狼結果。',{aliases:['靈媒','GRAVEKEEPER'],timing:'夜晚；第一夜通常沒有前一日資訊。',relations:['預言家','小狼','狂人'],interaction:'若只顯示狼／非狼，狼同盟或特殊第三方可能被歸類成非狼；需跟查驗規則一致。',variants:'可能顯示陣營、身分或僅狼／非狼；部分版本使用通靈師作為不同角色。'}),
      makeRole('烏鴉','good','神職','夜晚詛咒一名玩家，讓其在下一次公投額外承受一票或其他投票懲罰。',{aliases:['RAVEN'],timing:'夜晚，通常不可連續指定同一人。',relations:['村長','替罪羊','小狼'],interaction:'烏鴉的額外票應與警長票權重、平票規則、棄票一起進行投票結算。',variants:'額外票數與效果持續天數可能不同。'}),
      makeRole('獵魔人','good','神職','部分版本從第二夜起選擇一人狩獵；命中狼人則狼人出局，誤傷好人可能反噬自身。',{aliases:['DEMON HUNTER'],timing:'通常從第二夜起，每夜一次。',relations:['小狼','女巫','惡靈騎士','狼美人'],interaction:'可能免疫女巫毒藥，且可能與反傷狼、魅惑或守護交互；務必寫入同一結算優先序。',variants:'誤傷條件、毒藥免疫與首次行動時間依版本而異。'}),
      makeRole('奇蹟商人','good','神職','夜晚指定幸運兒，讓其獲得一次性查驗、毒殺或守護等技能中的一種。',{aliases:['奇蹟商人'],timing:'夜晚較早行動；整局通常限一次。',relations:['預言家','女巫','守衛','小狼'],interaction:'幸運兒若屬狼人，部分版本會觸發商人出局或技能失效。',variants:'贈予哪些技能、狼隊友是否可成為幸運兒與懲罰條件依平台不同。'}),
      makeRole('定序王子','good','神職','公投完成後可消耗一次能力，撤回或重啟本次投票流程。',{aliases:['時間王子'],timing:'白天公投結束後的指定窗口。',relations:['白痴','騎士','替罪羊'],interaction:'必須保存第一次投票快照，否則無法安全回溯票數、特殊票權重及技能使用。',variants:'是否重投、是否可追加發言、每局次數由板型決定。'}),
      makeRole('純白之女','good','神職','每晚查驗一名玩家的具體身分；部分版本從第二夜開始可直接處決查到的狼人。',{aliases:['純白少女'],timing:'夜晚；處決效果常有延遲或起始夜限制。',relations:['小狼','石像鬼','預言家','隱狼'],interaction:'查驗石像鬼、隱狼等特殊狼的結果以及直接處決的優先序需先定義。',variants:'首夜是否能驗、是否直接擊殺狼人、可否查自己皆依版本不同。'}),
      makeRole('鍊金魔女','good','神職','某些官方或平台版本中持有多種一次性煉金道具，可限制狼刀候選或在公告前救援。',{aliases:['炼金魔女'],timing:'夜晚，需依道具分別設定使用窗口。',relations:['小狼','女巫','守衛','白晝學者'],interaction:'技能可能改變狼隊可選的目標集合，或延後死亡公告；應視為獨立結算效果，而非一般解藥。',variants:'道具名稱、次數與觸發流程屬特定平台版本，不是通用標準。'}),
      makeRole('馴熊師','good','神職','天亮時根據仍存活的相鄰玩家判斷是否存在狼人，並公開提示。',{aliases:['熊','馴熊人','熊人','BEAR TAMER'],timing:'天亮後被動觸發。',relations:['小狼','預言家','守墓人'],interaction:'死亡玩家是否跳過、座位相鄰如何計算及特殊狼是否算狼人，會影響提示。',variants:'有些版本只要相鄰位置有狼便咆哮，另有提示範圍不同的變體。'}),
      makeRole('子狐','good','神職','部分版本每局一次，夜晚迷惑一名玩家；若目標是狼隊，可能阻止當夜狼刀。',{aliases:['小狐狸'],timing:'通常從第二夜起，一局一次。',relations:['小狼','狼美人','狐狸'],interaction:'若封鎖狼刀，需與守衛、女巫、夢魘等技能互相確認優先順序。',variants:'技能觸發夜數、封鎖範圍與狼美人互動屬特定版本。'}),
      makeRole('河豚','good','神職','部分版本在公投後翻牌，反擊或帶走所有投票給自己的玩家。',{aliases:['河豚公爵'],timing:'白天公投後的指定窗口；通常整局一次。',relations:['小狼','狼美人','定序王子'],interaction:'被夜刀、投票帶走或其他方式出局時是否觸發反擊，必須分開處理。',variants:'反擊對象可能是投票者或特定目標，實際效果高度依版本。'}),
      makeRole('白貓','good','神職','某些版本出局時翻牌並延後真正離場至下一次公投後。',{aliases:['白猫'],timing:'出局時被動觸發。',relations:['小狼','女巫','定序王子'],interaction:'延遲出局會影響存活人數與勝負判定時點，需有 pending-death 狀態。',variants:'延遲期間是否有投票權及適用哪些出局原因因版本而異。'}),
      makeRole('白晝學者','good','神職','特定平台版本中可有限次增幅或削弱其他玩家當夜的技能效果。',{aliases:['白昼学者'],timing:'通常從第二夜起，限定次數。',relations:['預言家','女巫','守衛','小狼','寂夜導師'],interaction:'技能增幅、禁用與同夜互相衝突時應採明確優先級，而非用 UI 點擊先後決定。',variants:'屬於平台特色角色，技能目標、次數與衝突懲罰可能不同。'}),
      makeRole('流光伯爵','good','神職','特定進階版本的資訊／攻擊型神職，依板型獲得或使用特殊追擊能力。',{aliases:['流光伯爵'],timing:'依指定版本的夜間或白天技能階段。',relations:['小狼','預言家','女巫'],interaction:'需把查驗結果、追擊結果與普通夜刀區分，避免重複死亡事件。',variants:'不同平台角色效果並不完全一致，應以該板型說明為準。'}),
      makeRole('通靈師','good','神職','依所採版本，可查知上一位出局玩家的陣營或獲得特殊靈界資訊。',{aliases:['魔鏡少女'],timing:'夜晚。',relations:['守墓人','預言家','小狼'],interaction:'通靈師與守墓人可能是同名近似或完全不同角色，圖鑑用別名提示但不將其視為所有版本完全相同。',variants:'有些版本等同守墓人；另一些版本能查看更精細的身分資訊。'}),
      makeRole('狐狸','good','神職','不同版本中可透過查驗、相鄰資訊或其他方式辨別狼隊。',{aliases:['狐'],timing:'依板型設定，常見為夜晚資訊技能。',relations:['預言家','九尾妖狐','小狼'],interaction:'不要與第三方妖狐混為一談；查驗結果與勝利條件可能完全不同。',variants:'「狐狸」是多個玩法中的重名角色，需標示採用版本。'}),
      makeRole('縱火者','good','神職','部分進階板型中可標記或引燃目標，按該版本規則造成延遲或群體傷害。',{aliases:['縱火神職'],timing:'依特定板型安排夜間行動。',relations:['女巫','守衛','小狼'],interaction:'若技能造成延遲死亡，必須讓延遲事件與普通夜刀分開記錄。',variants:'同名角色也可能屬第三方獨立陣營；本條是某類神職板型用法。'}),
      makeRole('賞金獵人','good','神職','依版本可指定懸賞目標，當目標出局或被驗出時取得資訊、獎勵或追擊效果。',{aliases:['懸賞獵人'],timing:'依板型可能在夜晚選標或白天結算。',relations:['小狼','預言家','獵人'],interaction:'需明確定義目標死亡原因是否影響獎勵，以及獎勵是否能改變勝負。',variants:'技能內容在平台間差異很大，不能直接套用一種規則。'}),
      makeRole('潛行者','good','神職','部分進階板型中可暗中追蹤或在夜晚指定目標，依版本揭露資訊或施加效果。',{aliases:['潛伏者'],timing:'依板型安排，通常夜晚。',relations:['小狼','預言家','狼美人'],interaction:'追蹤資訊不應自動等同查驗結果；要定義是否會被夢魘或禁用技能阻止。',variants:'同名角色存在資訊型與追擊型等不同版本。'}),
      makeRole('命官','good','神職','進階衍生角色，通常依特定板型取得命運判定、保命或指定出局效果。',{aliases:[] ,timing:'依板型設定。',relations:['女巫','獵人','小狼'],interaction:'必須在規則表中定義被動觸發條件，避免與其他保命技能無限疊加。'}),
      makeRole('賭徒','good','神職','以猜測、押注或選擇目標為核心，成功與否會依板型提供資訊或懲罰。',{aliases:['賭神'],timing:'通常夜晚選擇或白天結算。',relations:['預言家','小狼','定序王子'],interaction:'若涉及隨機數或機率，結算結果必須可被記錄與重現。',variants:'不同房規可能將賭徒設為好人或第三方。'}),
      makeRole('審判官','good','神職','特定進階板型中的裁決角色，可在限定窗口審判、驗證或改變一項對局結果。',{aliases:['審判者'],timing:'依板型指定的白天或夜晚窗口。',relations:['騎士','定序王子','小狼'],interaction:'應明確設定一次性次數、判定依據與能否被取消。'}),
      makeRole('九天聖人','good','神職','特定擴充板型的高階神職；技能效果以該套牌的官方規則為準。',{aliases:['九天聖人'],timing:'依特定板型。',relations:['小狼','預言家','女巫'],interaction:'不可僅依角色名稱推測效果，應在房間規則中存放此角色的具體技能版本。',variants:'屬衍生／平台角色，並非通用基礎身份。'}),
      makeRole('禁言長老','good','神職','可指定玩家在下一個白天無法發言或受到發言限制。',{aliases:['禁言者'],timing:'夜晚施加，白天生效。',relations:['小狼','村長','定序王子'],interaction:'需明確禁止發言是否包含警長歸票、遺言、技能宣告或投票。',variants:'禁言次數、能否連續禁同一人因版本而異。'}),
      makeRole('長老','good','神職','可能具有額外生命、抗性或死亡後懲罰等被動能力。',{aliases:['村莊長老','ELDER'],timing:'被動，遭受指定傷害時觸發。',relations:['女巫','小狼','獵人'],interaction:'額外生命會影響死亡事件數量，需區分「受傷」與「出局」。',variants:'有些版本被狼刀一次不死，有些版本出局會使神職失去技能。'}),
      makeRole('替罪羊','good','神職','某些版本在公投平票或無人出局時，會被指定出局或承擔投票後果。',{aliases:['替死鬼','SCAPEGOAT'],timing:'白天投票結算時。',relations:['定序王子','村長','烏鴉'],interaction:'與平票規則直接連動；需先決定平票是否會觸發替罪羊。',variants:'出局後可指定誰能投票等附加權利因版本而異。'}),
      makeRole('共濟會','good','神職','通常有兩名或多名同伴，彼此知道身分，藉此建立可信資訊鏈。',{aliases:['共濟會成員','MASON'],timing:'開局確認同伴；通常沒有夜間主動技能。',relations:['平民','預言家','小狼'],interaction:'與情侶的差異在於共濟會通常不會因同伴死亡而連帶出局。',variants:'人數與是否允許其中一人為狼等設定視板型而定。'}),
      makeRole('麵包師','good','平民','存活時可能在每天早上觸發公開提示，讓全場推斷其是否仍存活。',{aliases:['麵包師傅'],timing:'天亮公告階段。',relations:['平民','小狼','守墓人'],interaction:'公開提示本身會成為公共資訊；需定義第一天是否公告及死亡後公告內容。',variants:'常見於部分瀏覽器遊戲或自訂板型，不是所有桌遊共有角色。'}),
      makeRole('貓又','good','神職','部分版本被公投出局時會帶走另一名玩家；被狼襲擊時也可能反殺襲擊者。',{aliases:['貓又神'],timing:'指定出局事件發生時。',relations:['小狼','獵人','守衛'],interaction:'守衛保護是否阻止反殺、殉情或被帶走是否觸發技能，必須分別判定。',variants:'觸發條件與反擊對象依平台不同。'}),
      makeRole('小女孩','good','神職','在夜間可能偷偷觀察狼隊行動；若被狼隊發現或規則判定，可能面臨特殊風險。',{aliases:['小姑娘','LITTLE GIRL'],timing:'狼人夜間行動期間。',relations:['小狼','預言家'],interaction:'屬於暗中獲取資訊的角色；線上實作需定義是否真的向玩家開放狼隊資訊。',variants:'多見於傳統桌遊版本，觀察方式與被發現懲罰差異很大。'}),
      makeRole('白神','good','神職','某些平台擴充角色，具有指定的守護、資訊或制衡型技能。',{aliases:['白神職'],timing:'依具體板型設定。',relations:['小狼','女巫','預言家'],interaction:'名稱並無跨平台統一技能，建議建立獨立規則檔而非沿用其他神職技能。',variants:'特定遊戲／擴充身份。'}),
      makeRole('毒師','good','神職','可用毒或其他消耗品對目標施加效果；與標準女巫毒藥不一定相同。',{aliases:['毒藥師'],timing:'通常夜晚；次數由板型指定。',relations:['女巫','小狼','獵魔人'],interaction:'需區分毒師的毒與女巫毒藥，尤其在免疫、反傷與結算優先序上。',variants:'陣營及毒藥效果因平台差異大。'}),
      makeRole('舞者','good','神職','特定衍生板型的角色，通常透過選擇或標記玩家產生持續效果。',{aliases:['舞者身份'],timing:'依板型設定。',relations:['小狼','守衛','魔術師'],interaction:'若效果持續多日，需保存狀態並在玩家出局或技能失效時清除。',variants:'技能內容需由所使用的擴充規則補足。'}),
      makeRole('蒙面人','good','神職','特定版本的隱藏資訊或身分遮蔽角色，技能可能影響公開資訊或查驗。',{aliases:['蒙面者'],timing:'依板型設定。',relations:['預言家','純白之女','小狼'],interaction:'身分偽裝與實際陣營要分開存放，不能僅用角色名稱代替查驗結果。',variants:'不同平台差異較大。'}),
      makeRole('守護天使','good','神職','每晚保護一名玩家免於部分攻擊；某些版本限制只能保護其他人。',{aliases:['Guardian Angel','天使'],timing:'夜晚。',relations:['小狼','女巫','守衛'],interaction:'與守衛功能相近但保護範圍可能不同；不能直接合併成同一技能。',variants:'部分版本也會以第三方身分出現。'}),
      makeRole('醫師','good','神職','可治療被指定的玩家或抵消某一類傷害。',{aliases:['醫生','Doctor'],timing:'通常夜晚。',relations:['小狼','女巫','守衛'],interaction:'若可治療多類傷害，應對每種傷害設置保護層級及適用期限。',variants:'常見於國際版 Werewolf／Mafia 擴充，與女巫解藥機制不同。'}),
      makeRole('偵探','good','神職','夜晚調查玩家或兩名玩家之間的關係，獲得線索而非必然的陣營答案。',{aliases:['DETECTIVE'],timing:'夜晚調查。',relations:['預言家','調查員','小狼'],interaction:'線索型資訊與直接查驗不同，應避免把猜測結果直接當成陣營判定。',variants:'可查一人、兩人或追蹤行動，視版本而定。'}),
      makeRole('調查員','good','神職','透過調查取得一名或多名玩家的身分特徵、行動記錄或關係資訊。',{aliases:['INVESTIGATOR'],timing:'多為夜晚。',relations:['偵探','預言家','小狼'],interaction:'與偵探、通靈師有功能重疊，但回傳的資訊格式應獨立定義。',variants:'屬於廣泛的變體角色名稱。'}),
      makeRole('神諭者','good','神職','每晚或在特定時點獲得預言式提示，提示內容可能是陣營、危險或未來事件。',{aliases:['Oracle'],timing:'依版本，通常夜晚。',relations:['預言家','守墓人','小狼'],interaction:'應明確標示提示是否精確、是否可能受干擾或延遲。',variants:'國際版與自訂規則中的能力差異大。'}),
      makeRole('村長','good','平民','可能擁有額外投票權、公開身分後的權力或生存加成。',{aliases:['鎮長'],timing:'白天投票或被動觸發。',relations:['烏鴉','替罪羊','小狼'],interaction:'投票權重需與警長票權重及烏鴉額外票一同結算。',variants:'額外票數及公開身份條件不同。'}),
      makeRole('槍手','good','神職','持有有限彈藥，可在符合條件時射擊或影響投票。',{aliases:['Gunner'],timing:'依版本在白天或夜晚。',relations:['獵人','小狼','白狼王'],interaction:'彈藥使用、夜間射擊是否公開及是否屬於普通殺傷需分開記錄。',variants:'不同遊戲中的槍手可能是主動射擊，也可能只是投票加成。'}),
      makeRole('狙擊手','good','神職','使用有限次數的遠程擊殺或指定目標能力。',{aliases:['Sharpshooter','神槍手'],timing:'依板型指定的行動時段。',relations:['獵人','小狼','守衛'],interaction:'需定義保護能否擋下、是否可被反傷，以及擊殺資訊是否公開。',variants:'屬於常見衍生／國際版角色。'}),
      makeRole('祈禱師','good','神職','透過祈禱獲得保護、資訊或限制邪惡角色的能力。',{aliases:['Priest','祭司'],timing:'依板型設定。',relations:['預言家','小狼','吸血鬼'],interaction:'如可處理多個陣營，必須明確定義每種角色是否屬邪惡目標。',variants:'不同套牌能力差異大。'}),
      makeRole('覺醒預言家','good','神職','預言家的強化衍生版本，可能獲得額外查驗或不同結果。',{aliases:['覺醒先知'],timing:'依特定平台版本的覺醒條件。',relations:['預言家','女巫','小狼'],interaction:'需有獨立的覺醒狀態、觸發條件與查驗次數，不宜只當成一般預言家別名。',variants:'平台衍生角色。'}),
      makeRole('覺醒女巫','good','神職','女巫的強化衍生版本，可能追加道具或改變解藥／毒藥規則。',{aliases:[],timing:'依特定平台版本。',relations:['女巫','獵人','小狼'],interaction:'覺醒前後需記錄技能可用次數及能否改變原本已使用的藥劑規則。',variants:'平台衍生角色。'}),
      makeRole('覺醒獵人','good','神職','獵人的強化衍生版本，可能改變開槍條件、次數或可射擊目標。',{aliases:[],timing:'符合特定版本的覺醒／出局條件。',relations:['獵人','狼王','白狼王'],interaction:'獵人與狼王類角色都有出局追擊效果，但觸發限制應分開設定。',variants:'平台衍生角色。'}),
      makeRole('白夜使者','good','神職','進階衍生角色，技能可能在白天或夜晚揭露身分、追蹤資訊或改變流程。',{aliases:['白夜使者'],timing:'依特定版本。',relations:['白晝學者','預言家','小狼'],interaction:'此角色沒有跨平台統一的技能定義，必須選定明確的版本資料。',variants:'特定遊戲擴充。'}),
      makeRole('杠精','good','神職','特定平台的衍生角色，可能透過質疑、反制或投票規則產生特殊效果。',{aliases:['槓精'],timing:'依特定版本。',relations:['禁言長老','村長','定序王子'],interaction:'名稱的趣味性不代表技能統一；上桌前需完整列出實際觸發條件。',variants:'平台特色身份，技能需以當局規則為準。'}),
      makeRole('白澤','good','神職','擴充角色，通常提供辨識、提示或特殊保護能力。',{aliases:['白泽'],timing:'依特定板型。',relations:['馴熊師','預言家','小狼'],interaction:'若為資訊型角色，應明確說明資訊來源與準確性。',variants:'特定平台／擴充角色。'}),

      // 狼人陣營：基礎、追擊、查驗與干擾型
      makeRole('小狼','wolf','狼隊','每晚與狼隊選擇一名目標襲擊；依 Awoo 標準房規，小狼也可在白天允許階段自爆，立即中止當日流程並進入黑夜。',{aliases:['狼人','普通狼人','WEREWOLF','WOLF'],timing:'夜晚狼隊行動；白天符合房規設定的階段可自爆。',relations:['預言家','女巫','守衛','狼王','白狼王','狼美人','狂人'],interaction:'狼刀會受到守護、解藥、夢境或免疫技能影響；自爆則是獨立的出局原因，不進入公投與遺言流程，並直接切換至下一夜（若該出局已達成終局勝利，則立即結束遊戲）。',implementation:'已接入：夜間襲擊原型與白天自爆流程，具有引擎驗證及自動化測試。'}),
      makeRole('狼王','wolf','狼隊','出局時可依版本發動追擊，帶走一名玩家；部分出局原因會禁用技能。',{aliases:['WOLF KING'],timing:'符合條件的出局時。',relations:['小狼','獵人','白狼王','女巫'],interaction:'狼王與獵人的追擊需使用不同技能標記；通常被毒或自爆時可能不能發動。',variants:'觸發條件及能否由毒殺、殉情、獵人帶走時發動有差異。'}),
      makeRole('白狼王','wolf','狼隊','部分版本白天可自爆並額外帶走一名玩家。',{aliases:['WHITE WOLF'],timing:'白天符合自爆規則時。',relations:['小狼','狼王','騎士','獵人'],interaction:'自爆會改變白天流程；是否能在警長競選、投票或特定發言階段發動必須明確設定。',variants:'是否可帶走任意玩家、是否能被技能阻止依板型而異。'}),
      makeRole('狼美人','wolf','狼隊','夜晚魅惑一名玩家；部分版本在自身出局時，魅惑對象會連帶出局。',{aliases:['WOLF BEAUTY'],timing:'夜晚選擇魅惑目標；死亡時可能觸發連帶效果。',relations:['小狼','子狐','惡靈騎士','河豚'],interaction:'魅惑連死需與獵人、女巫毒殺、河豚等事件一起結算，並處理多重連死。',variants:'魅惑目標能否是狼隊友、死亡觸發範圍依版本不同。'}),
      makeRole('噩夢之影','wolf','狼隊','每晚可恐懼或封鎖一名玩家，使其當夜無法使用技能或受到其他負面效果。',{aliases:['夢魘','夜魘','NIGHTMARE SHADOW'],timing:'夜晚，通常在部分神職之前行動。',relations:['預言家','女巫','守衛','小狼','白晝學者'],interaction:'封鎖技能需先於被封鎖者結算，並定義是否影響狼刀或被動技能。',variants:'有的版本封鎖技能，有的版本強制改變行動目標或禁止連續恐懼同人。'}),
      makeRole('惡靈騎士','wolf','狼隊','具有反傷或特殊反制能力；某些版本會反制查驗或讓攻擊者付出代價。',{aliases:['惡灵骑士','PHANTOM KNIGHT'],timing:'常見為被動反制，依技能觸發條件生效。',relations:['預言家','獵魔人','女巫','小狼'],interaction:'查驗反傷與普通夜間擊殺要區分；反傷發生後可能再觸發其他角色的出局技能。',variants:'是否免疫查驗、毒藥或是否能被狼刀，依板型不同。'}),
      makeRole('石像鬼','wolf','狼隊','通常擁有獨立查驗或識別其他玩家身分的能力，並可能不參與普通狼刀。',{aliases:['GARGOYLE'],timing:'夜晚獨立行動。',relations:['純白之女','預言家','隱狼','小狼'],interaction:'是否與狼隊互認、是否可參與狼刀、被查驗時如何顯示，要與狼人名冊資料一致。',variants:'有些版本開局不與狼隊互認，某些版本查驗具體身分。'}),
      makeRole('黑騎士','wolf','狼隊','特定版本中的狼人反制型角色，可對指定神職施加限制或利用一次性能力反擊。',{aliases:['BLACK KNIGHT'],timing:'依特定板型的夜晚／白天窗口。',relations:['騎士','預言家','小狼'],interaction:'與好人騎士是不同角色；切勿共用同一個「決鬥」技能。',variants:'技能並無全球統一標準，需使用明確板型描述。'}),
      makeRole('機械狼','wolf','狼隊','可模仿、複製或獲取其他角色的技能資訊；某些版本需先選擇模仿對象。',{aliases:['覺醒隱狼','机械狼'],timing:'開局選擇或夜晚執行複製技能。',relations:['預言家','女巫','守衛','隱狼'],interaction:'複製技能時需處理技能使用次數、原角色出局及是否能複製第三方能力。',variants:'有些版本先隱藏陣營，另一些版本直接模仿神職技能。'}),
      makeRole('狼犬','wolf','狼隊','在部分版本中介於狼與特殊角色之間，可能依開局或死亡條件改變陣營。',{aliases:['狼狗','WOLF DOG'],timing:'可能在開局、查驗或特定事件觸發。',relations:['小狼','野孩子','狂人'],interaction:'此角色名稱在不同版本中可能屬狼人、好人或雙陣營，需依規則定義勝利陣營。',variants:'同名技能差異大，不應僅因名字含「狼」就自動判定陣營。'}),
      makeRole('大灰狼','wolf','狼隊','特殊追擊型狼人；部分版型可在一般狼刀外追加一次襲擊或有額外限制。',{aliases:['GREY WOLF'],timing:'夜晚狼隊行動。',relations:['小狼','血月使徒','女巫','守衛'],interaction:'額外襲擊應作為獨立事件，逐一判定保護、免疫、毒藥與死亡公告。',variants:'追加刀次數與觸發條件取決於板型。'}),
      makeRole('大野狼','wolf','狼隊','部分版本具有額外夜刀或特殊追殺條件的強化狼人。',{aliases:['BIG BAD WOLF'],timing:'夜晚或符合條件的特殊階段。',relations:['小狼','大灰狼','守衛','女巫'],interaction:'若存在額外狼刀，需設定是否與狼隊共用目標以及同一目標是否重複受傷。',variants:'不同平台技能差異較大。'}),
      makeRole('血月使徒','wolf','狼隊','死亡或觸發條件可能改變白天／夜晚流程，或為狼隊提供特殊收益。',{aliases:['血月使者','BLOOD MOON HERALD'],timing:'通常為被動觸發或特定夜晚。',relations:['小狼','狼王','白狼王'],interaction:'流程改變應由狀態機負責，不能只用公告文字代替。',variants:'可能包含自爆、禁票或限時等不同效果。'}),
      makeRole('狼兄','wolf','狼隊','成對特殊狼人之一；兩兄弟通常有彼此相關的技能或存活條件。',{aliases:['狼哥哥'],timing:'依兄弟狼板型設定。',relations:['狼弟','小狼','預言家'],interaction:'需同時追蹤狼兄／狼弟存活、是否互認及一人出局後是否改變技能。',variants:'兄弟連動規則以該擴充身份定義為準。'}),
      makeRole('狼弟','wolf','狼隊','與狼兄配對的特殊狼人，可能有互認、復仇或強化夜刀效果。',{aliases:['狼弟弟'],timing:'依兄弟狼板型設定。',relations:['狼兄','小狼','狼王'],interaction:'與狼兄共用的狀態需要在同一遊戲狀態中管理，避免兩邊資料不一致。',variants:'常見技能為自訂擴充，無統一標準。'}),
      makeRole('雪狼','wolf','狼隊','特殊狼人變體，技能可能影響查驗、投票或夜晚行動限制。',{aliases:['SNOW WOLF'],timing:'依特定板型。',relations:['小狼','預言家','噩夢之影'],interaction:'需明確定義其查驗回應與是否參與狼隊夜刀。',variants:'屬平台／擴充角色。'}),
      makeRole('隱狼','wolf','狼隊','通常對部分查驗呈現非狼人或隱藏陣營資訊；有些版本開局不與狼隊互認。',{aliases:['HIDDEN WOLF'],timing:'被動查驗效果；夜間行動依板型。',relations:['預言家','純白之女','石像鬼','小狼'],interaction:'「查驗偽裝」不應更改真實陣營或勝利陣營；另需定義狼隊是否知道其身分。',variants:'是否有狼刀、何時與狼隊互認因版本而異。'}),
      makeRole('種狼','wolf','狼隊','某些版本可使被指定玩家感染、變成狼人或在後續回合改變陣營。',{aliases:['狼教父','SEED WOLF'],timing:'夜晚指定或被動觸發。',relations:['小狼','女巫','預言家','狼犬'],interaction:'陣營轉換需同步更新查驗結果、狼隊名冊、勝負統計與角色技能。',variants:'感染是否能被防護、何時轉化以及原技能保留方式不同。'}),
      makeRole('惡魔','wolf','狼隊','查驗／詛咒型狼人變體，通常能獲得額外資訊或針對特定神職施加限制。',{aliases:['DEMON'],timing:'多為夜晚獨立行動。',relations:['預言家','純白之女','小狼'],interaction:'需要定義其資訊技能是否取代普通狼刀，以及與石像鬼等資訊狼的差異。',variants:'名稱在不同遊戲中並不一致。'}),
      makeRole('天狗','wolf','狼隊','特定擴充狼人角色，通常具備干擾、追擊或特殊陣營能力。',{aliases:['DOG WOLF'],timing:'依特定版本。',relations:['小狼','狼外婆','機械狼'],interaction:'名稱本身不足以確定技能；需對應到所用平台／卡牌規則。',variants:'非基礎通用身份。'}),
      makeRole('狼外婆','wolf','狼隊','特定版本的功能型狼人，可能以偽裝、詛咒或追擊方式輔助狼隊。',{aliases:['GRANDMA WOLF'],timing:'依特定版本。',relations:['小狼','狼美人','噩夢之影'],interaction:'如果技能有偽裝效果，應將真實陣營與對外查驗回應分離。',variants:'平台特色角色。'}),
      makeRole('狐仙','wolf','狼隊','某些衍生板型中的特殊狼人，可追擊或影響資訊判定。',{aliases:['狐仙狼'],timing:'依特定板型。',relations:['小狼','妖狐','狐狸'],interaction:'與好人狐狸或第三方妖狐不是同一概念，角色 ID 應分別保存。',variants:'技能因平台差異大。'}),
      makeRole('狼鴉之爪','wolf','狼隊','特殊進階狼人，可能具有追加追擊、詛咒或改變死亡結果的能力。',{aliases:['狼鸦之爪'],timing:'依特定板型。',relations:['小狼','烏鴉','狼王'],interaction:'與烏鴉的投票詛咒、狼王的死亡追擊是不同機制，應分開實作。',variants:'特定擴充角色。'}),
      makeRole('黑蝙蝠','wolf','狼隊','特殊狼人變體，可能具有夜間干擾、反制或死亡聯動效果。',{aliases:['BLACK BAT'],timing:'依特定板型。',relations:['小狼','狼美人','惡靈騎士'],interaction:'若帶有反傷或免疫，需要獨立定義可抵抗的傷害類型。',variants:'擴充角色，各平台不同。'}),
      makeRole('夜之貴族','wolf','狼隊','特殊狼隊追擊型角色，可能獲得追加夜刀或對存活玩家施加持續效果。',{aliases:['夜之贵族'],timing:'依特定板型。',relations:['小狼','大灰狼','守衛'],interaction:'持續效果需儲存目標、開始夜與結束條件。',variants:'平台／擴充身份。'}),
      makeRole('火狼','wolf','狼隊','干擾型狼人變體，技能可能造成延遲傷害、阻止保護或改變目標狀態。',{aliases:['火焰狼'],timing:'夜晚。',relations:['小狼','女巫','守衛','縱火者'],interaction:'傷害類型必須有標籤，才能正確判定守護、解藥與免疫。',variants:'同名技能因板型差異大。'}),
      makeRole('毒狼','wolf','狼隊','可對目標施加毒傷或令其技能失效的特殊狼人。',{aliases:['毒藥狼'],timing:'夜晚，通常有限次數。',relations:['女巫','獵人','小狼'],interaction:'毒狼效果與女巫毒藥應使用不同事件來源，避免誤用「被女巫毒不能開槍」的規則。',variants:'具體毒效、免疫與次數依版本不同。'}),
      makeRole('蝕時狼妃','wolf','狼隊','干擾型特殊狼人，可能改變技能生效時間、延遲效果或回合順序。',{aliases:['蚀时狼妃'],timing:'依特定板型，通常夜晚。',relations:['小狼','白晝學者','噩夢之影'],interaction:'時間操控效果需由回合引擎管理，不宜只修改目標資料。',variants:'衍生角色，規則依平台而定。'}),
      makeRole('混沌之魔','wolf','狼隊','特殊狼人，可擾亂資訊或使技能產生偏移、混亂結果。',{aliases:['混沌狼'],timing:'依特定板型，常見為夜晚。',relations:['預言家','機械狼','小狼'],interaction:'需分開記錄原始結果與受干擾後結果，確保日後能稽核。',variants:'不同衍生套牌效果不同。'}),
      makeRole('尋香魅影','wolf','狼隊','特殊干擾狼，可能標記或魅惑玩家，改變其行動或資訊。',{aliases:['寻香魅影'],timing:'夜晚。',relations:['狼美人','小狼','子狐'],interaction:'與狼美人魅惑效果可能疊加，需規定同一人可否同時被多種魅惑。',variants:'平台特色角色。'}),
      makeRole('戰狼','wolf','狼隊','具有強化攻擊、防守或在指定回合發動額外能力的狼人變體。',{aliases:['战狼','WAR WOLF'],timing:'依特定板型。',relations:['小狼','狼王','大野狼'],interaction:'若具有額外生命或攻擊，需明確套用到存活人數與死亡事件。',variants:'技能依版本不同。'}),
      makeRole('帝尊魔皇','wolf','狼隊','高階衍生狼角色，通常具有追擊、封鎖或強化狼隊的特殊能力。',{aliases:['帝尊魔皇'],timing:'依所採用的特定板型。',relations:['小狼','狼王','血月使徒'],interaction:'請為此角色選擇明確技能版本，避免只以名稱推測技能或勝利條件。',variants:'特定平台／擴充角色。'}),
      makeRole('怪盜狼王','wolf','狼隊','狼王的衍生版本，可能複製、偷取或改變其他角色技能並保留追擊效果。',{aliases:['怪盗狼王'],timing:'依特定版本，可能開局或死亡時觸發。',relations:['狼王','機械狼','小狼'],interaction:'技能複製與狼王追擊必須分為不同能力旗標，並明確定義被毒或自爆時效果。',variants:'衍生版本技能非通用。'}),
      makeRole('寂夜導師','wolf','狼隊','特殊狼人，可封鎖、削弱或干擾其他角色的技能。',{aliases:['寂夜导师'],timing:'夜晚。',relations:['白晝學者','預言家','小狼'],interaction:'與白晝學者等增幅／削弱技能相遇時，需預先設定衝突結果。',variants:'特定平台的擴充身份。'}),
      makeRole('蝕日侍女','wolf','狼隊','特殊狼人變體，可能具有干擾、保護狼隊或在特定條件下啟動的技能。',{aliases:['蚀日侍女'],timing:'依特定板型。',relations:['小狼','血月使徒','噩夢之影'],interaction:'應將被動觸發與主動夜間行動分開保存。',variants:'衍生角色。'}),
      makeRole('狼巫','wolf','狼隊','狼隊資訊型角色，可查驗或識別特定玩家身分，也可能具有封鎖神職的能力。',{aliases:['狼祭司','WOLF SHAMAN'],timing:'夜晚獨立行動。',relations:['預言家','石像鬼','純白之女','小狼'],interaction:'需區分狼巫的查驗對象與普通狼刀目標，並決定是否與狼隊互認。',variants:'查驗範圍和是否參與狼刀因板型不同。'}),
      makeRole('狼預言家','wolf','狼隊','獲得查驗資訊的狼人變體，可能用於定位神職或偽裝資訊。',{aliases:['狼先知'],timing:'夜晚。',relations:['預言家','純白之女','小狼'],interaction:'與石像鬼、狼巫不同，必須明確界定查驗資訊是否能被其他狼隊成員看到。',variants:'不是所有版本都有此角色。'}),
      makeRole('阿爾法狼','wolf','狼隊','國際版常見的強化狼人變體，可能可轉化、招募或強化另一名玩家。',{aliases:['Alpha Werewolf','Alpha Wolf'],timing:'通常夜晚或一次性特殊時點。',relations:['小狼','種狼','野孩子'],interaction:'轉化類技能需處理原角色陣營、狼隊名單、勝利條件及原技能是否保留。',variants:'不同桌遊／線上遊戲定義不一。'}),
      makeRole('大壞狼','wolf','狼隊','強化狼人角色，可能在特殊條件下獲得第二次襲擊或其他攻擊加成。',{aliases:['Direwolf'],timing:'夜晚或條件觸發。',relations:['小狼','大灰狼','守衛'],interaction:'不同來源中與大野狼可能是別名，也可能是獨立角色；應以 role ID 區分來源。',variants:'此條目保留國際版名稱對照，不保證與中文平台的「大野狼」完全相同。'}),

      // 狼人同盟：勝利目標可能偏向狼隊，但不一定是真正狼人
      makeRole('狂人','wolfAlly','協力者','沒有一般狼刀；透過偽裝好人、誤導公投協助狼人獲勝。',{aliases:['白癡狼','叛徒','MADMAN'],timing:'白天行動；是否知道狼隊身份依版本。',relations:['小狼','預言家','守墓人'],interaction:'狂人常與狼人同勝，但未必算真正狼人；查驗可能顯示非狼人，也可能不計入屠邊人數。',variants:'是否認狼、狼刀是否可殺、勝負計數方式因房規而異。'}),

      // 第三方與特殊勝利條件
      makeRole('妖狐','third','獨立','常見版本可躲避狼人襲擊，但被預言家查驗會暴露或出局；存活到規定終局可獨立獲勝。',{aliases:['狐妖','狐狸精','FOX'],timing:'多為被動；特殊技能依版本。',relations:['預言家','小狼','狐狸','九尾妖狐'],interaction:'妖狐可能不屬於好人或狼隊；其存活條件應優先於一般陣營獲勝檢查。',variants:'有些版本狼刀可殺妖狐，有些版本妖狐可另行行動。'}),
      makeRole('九尾妖狐','third','獨立','進階衍生角色，通常是具特殊查驗回應或獨立勝利目標的狐系角色。',{aliases:['九尾狐','九尾狐狸'],timing:'依特定板型。',relations:['妖狐','狐狸','預言家'],interaction:'不要與好人神職「狐狸」混淆；勝利條件、狼刀抗性與查驗結果需獨立設定。',variants:'各平台對九尾妖狐的陣營和技能差異很大。'}),
      makeRole('吸血鬼','third','獨立','常見獨立陣營；部分版本只需活到終局，另一些版本可夜晚吸血、感染或淘汰玩家。',{aliases:['VAMPIRE'],timing:'被動存活或夜晚行動，依版本。',relations:['小狼','女巫','祈禱師','瘟疫使者'],interaction:'吸血感染若改變陣營，需同步更新角色身分、勝負計算及夜間名冊。',variants:'存在純存活型與夜間殺傷型等不同版本。'}),
      makeRole('殺人狂','third','獨立','某些版本是獨立殺手，只靠白天放逐出局；另一些版本可反殺對其使用技能的玩家。',{aliases:['刺客小孩','PSYCHO','SERIAL KILLER'],timing:'依版本被動反制或夜間行動。',relations:['預言家','守衛','小狼','獵人'],interaction:'可能只被公投淘汰，且查驗／守護／狼襲會反殺施術者；必須為每種效果定義例外。',variants:'同一中文名可能對應完全不同的獨立殺手規則。'}),
      makeRole('邱比特','couple','連結角色','開局或首夜指定兩名戀人；其中一人出局時，另一人可能殉情。',{aliases:['丘比特','愛神','CUPID'],timing:'開局或首夜，通常一次。',relations:['情侶','暗戀者','小狼','平民'],interaction:'若一名戀人是狼人、另一名是好人，可能形成第三方戀人勝利條件；也可能依規則沿用原陣營。',variants:'邱比特自身是否屬好人、戀人是否改為第三方及殉情觸發方式各版不同。'}),
      makeRole('情侶','couple','連結角色','兩位玩家形成連結並知道彼此；部分版本一人出局，另一人立即殉情，兩人存活到終局可獲勝。',{aliases:['戀人','Lovers'],timing:'開局建立連結；死亡時被動觸發。',relations:['邱比特','暗戀者','小狼','平民'],interaction:'情侶連結應由獨立的關係資料管理，不能直接把雙方職業覆寫成「情侶」。',variants:'有些規則讓戀人沿用原陣營勝利，有些規則設定獨立情侶勝利。'}),
      makeRole('暗戀者','couple','連結角色','通常暗中選擇或被分配一名愛慕對象；勝利條件可能跟隨對象或依特定條件結算。',{aliases:['秘密愛慕者','SECRET ADMIRER'],timing:'開局或首夜建立關係。',relations:['情侶','邱比特','小狼'],interaction:'暗戀關係不一定等於情侶連結：需明確定義對象出局是否連帶死亡，以及勝利條件。',variants:'不同板型可為好人、第三方或勝利條件依對象變化。'}),
      makeRole('盜賊','third','特殊','開局從額外身份牌中選擇或交換一個角色；部分規則可能被迫選擇其中一張。',{aliases:['小偷','THIEF'],timing:'開局發牌後、第一夜前。',relations:['小狼','平民','預言家'],interaction:'需要預留額外角色牌並明確處理偷到狼人或第三方角色的情況。',variants:'有些版本盜賊是開局換牌，有些版本可於夜間偷取技能。'}),
      makeRole('野孩子','third','變動陣營','開局選擇一名榜樣；若榜樣出局，野孩子可能轉為狼人或更改勝利陣營。',{aliases:['野小孩','WILD CHILD'],timing:'開局／首夜選擇榜樣；榜樣出局時觸發。',relations:['小狼','平民','情侶'],interaction:'陣營轉換要明確決定保留原神職能力與否，並立即更新勝負檢查。',variants:'有些版本變狼，有些版本只改變個人勝利目標。'}),
      makeRole('失憶者','third','變動陣營','開局不知道自己的完整身分，或在特定時點複製一名已出局角色的身份。',{aliases:['失憶人','AMNESIAC'],timing:'開局隱藏資訊或中後期觸發。',relations:['盜賊','機械狼','小狼'],interaction:'複製身分時要區分角色能力、陣營、已耗用技能和公開資訊。',variants:'國際版及自訂模式中差異很大。'}),
      makeRole('倖存者','third','獨立','沒有固定擊殺技能，依規則只需活到終局或達成個人目標即可獲勝。',{aliases:['生還者','SURVIVOR'],timing:'全局被動。',relations:['小狼','獵人','吸血鬼'],interaction:'可能和其他陣營同時獲勝，也可能只有在特定終局存活才算勝利。',variants:'是否能與村莊／狼隊共同獲勝由房規定義。'}),
      makeRole('小丑','third','獨立','某些版本的目標是被白天公投放逐；達成後立即獲勝或觸發特殊效果。',{aliases:['丑角','JESTER'],timing:'白天公投結算。',relations:['替罪羊','平民','村長'],interaction:'小丑的個人勝利應在公投出局判定後優先檢查，避免被當作普通好人淘汰。',variants:'有些版本被夜殺不獲勝，另一些版本有額外行動。'}),
      makeRole('行刑者','third','獨立','開局獲得指定目標，個人勝利條件通常與該目標被公投出局相關。',{aliases:['Executioner'],timing:'開局選定目標；白天投票期間。',relations:['小丑','平民','小狼'],interaction:'目標若夜間出局、被技能帶走或轉化，行刑者的勝利條件需按房規處理。',variants:'達成目標後可能轉職為小丑或直接結束個人勝利。'}),
      makeRole('縱火狂','third','獨立','獨立殺手變體，可能夜間標記目標，之後一次性引燃造成群體出局。',{aliases:['ARSONIST'],timing:'夜晚標記，之後在指定時點引燃。',relations:['守衛','女巫','小狼','吸血鬼'],interaction:'標記與引燃要分成兩類事件；一般守護可能只能防止其中一個階段。',variants:'標記人數、是否可洗掉標記、獲勝目標依遊戲版本不同。'}),
      makeRole('瘟疫使者','third','獨立','透過感染或標記將效果逐步傳播給其他玩家，達到指定感染條件後獲勝。',{aliases:['PLAGUE BRINGER'],timing:'通常夜晚擴散或被動感染。',relations:['吸血鬼','醫師','小狼'],interaction:'感染計數、治療、出局與陣營轉換須使用單獨狀態，不能直接覆寫角色名稱。',variants:'部分國際版角色可能需要感染所有存活玩家或滿足特定門檻。'}),
      makeRole('邪教首領','third','獨立','可夜間招募或轉化其他玩家加入邪教，達到人數或清除條件後獲勝。',{aliases:['教主','CULT LEADER'],timing:'通常夜晚。',relations:['小狼','吸血鬼','野孩子'],interaction:'招募可能被特定角色免疫或改變陣營；轉化規則要能與狼人轉化分辨。',variants:'有些版本禁止招募狼人或可被醫師阻擋。'}),
      makeRole('酒鬼','third','特殊','可能不知道自己的真實身分、收到錯誤資訊，或被設定為無技能的特殊好人／中立者。',{aliases:['醉鬼','DRUNK'],timing:'依版本被動或資訊階段。',relations:['預言家','盜賊','失憶者'],interaction:'錯誤資訊應與真實身分分離，方便引擎追蹤而不洩漏給玩家。',variants:'不同套牌中的酒鬼可有不同陣營和能力。'}),
      makeRole('寄生蟲','third','獨立','特定衍生角色，可能選擇寄生目標，並透過目標存活或感染條件獲勝。',{aliases:['PARASITE'],timing:'依特定版本，通常夜晚。',relations:['野孩子','吸血鬼','小狼'],interaction:'寄生連結是否會隨目標死亡轉移或解除，需要獨立關係狀態。',variants:'屬於國際版／自訂角色，不是通用基礎牌。'}),
      makeRole('流浪者','third','獨立','無固定陣營技能，通常有個人存活、選邊或特殊任務條件。',{aliases:['漂泊者','DRIFTER'],timing:'整局或特定選邊窗口。',relations:['倖存者','小狼','平民'],interaction:'必須把個人獲勝條件從陣營勝負中獨立計算。',variants:'名稱常用於自訂角色，需由房主設定任務。'}),
      makeRole('黑市商人','third','獨立','可在特定時點交換、贈送或交易道具／技能，具體內容由該版本定義。',{aliases:['商人','黑市商人'],timing:'通常夜晚或白天限定窗口。',relations:['盜賊','奇蹟商人','小狼'],interaction:'交易應記錄物品所有者、使用次數與是否可被偷取。',variants:'多為平台或房規擴充。'}),
      makeRole('怪盜','third','特殊','可能在開局或夜晚竊取另一名玩家的角色、道具或能力。',{aliases:['PHANTOM THIEF'],timing:'依版本開局或夜晚。',relations:['盜賊','機械狼','怪盜狼王'],interaction:'偷取角色和複製技能是兩種不同操作；要明確定義原角色是否失去能力。',variants:'中文平台間名稱和技能不統一。'}),
      makeRole('催眠師','third','獨立','以干擾、誤導或操控玩家行動為主的擴充角色。',{aliases:['HYPNOTIST'],timing:'通常夜晚。',relations:['噩夢之影','魔術師','預言家'],interaction:'若操控玩家目標，需在該玩家原技能結算前套用效果。',variants:'國際版角色或自訂擴充，技能差異大。'}),
      makeRole('狂戰士','third','獨立','部分版本為具攻擊或反擊能力的個人陣營角色。',{aliases:['BERSERKER'],timing:'依規則可能夜晚或受傷時觸發。',relations:['獵人','小狼','吸血鬼'],interaction:'需定義是否能和一般狼人同勝，以及是否計入狼隊人數。',variants:'在不同遊戲中可屬獨立、狼隊或好人，這裡只作變體索引。'}),
      makeRole('刺客','third','獨立','通常有一次性指定擊殺或暗殺能力，且可能需要達成個人目標。',{aliases:['ASSASSIN'],timing:'夜晚或指定暗殺窗口。',relations:['獵人','守衛','小狼','倖存者'],interaction:'暗殺是否可被守護、是否公開兇手與失敗代價應分別定義。',variants:'可作為獨立角色或陣營技能，視遊戲版本。'}),
      makeRole('殉道者','good','神職','在自己出局或指定事件發生時，可替代、阻止或轉移某個死亡結果。',{aliases:['MARTYR'],timing:'受傷、被投票或出局時。',relations:['情侶','獵人','女巫'],interaction:'救人或替死效果會影響多重出局鏈，需防止重複觸發。',variants:'國際版／桌遊變體。'}),
      makeRole('禁衛','good','神職','提供一次性保護或限制目標被攻擊的能力。',{aliases:['SENTRY','護衛'],timing:'通常夜晚。',relations:['守衛','女巫','小狼'],interaction:'與守衛需視為不同技能來源，避免保護次數與效果範圍混淆。',variants:'擴充角色，技能由房規定義。'}),
      makeRole('工匠','good','神職','可以製作、修復或分配一次性道具，讓其他玩家獲得有限技能。',{aliases:['ARTIFICER'],timing:'夜晚或特定白天階段。',relations:['奇蹟商人','盜賊','女巫'],interaction:'道具要有唯一 ID、持有者與使用次數；不能只在 UI 顯示道具。',variants:'國際版／自訂角色。'}),
      makeRole('酒保','good','神職','可能影響玩家的能力使用、資訊可信度或行動順序。',{aliases:['BARTENDER'],timing:'依擴充規則，常見於夜晚。',relations:['酒鬼','預言家','噩夢之影'],interaction:'若造成技能失效，需與封鎖技能效果使用同一套狀態處理。',variants:'國際版角色，中文桌上譯名可能不同。'}),
      makeRole('失眠者','good','神職','在夜晚末尾得知自身是否曾受到某些技能效果影響，藉此推理其他玩家。',{aliases:['INSOMNIAC'],timing:'夜晚結束前或天亮前。',relations:['噩夢之影','魔術師','預言家'],interaction:'應讀取已結算的行動記錄，而不是靠前端操作順序推測。',variants:'常見於國際版角色擴充。'}),
      makeRole('槍械師','good','神職','給予玩家額外投票、射擊或特殊行動能力的擴充角色。',{aliases:['GUNSMITH'],timing:'依板型。',relations:['獵人','槍手','小狼'],interaction:'需記錄被給予者的真實能力、是否公開以及一次性使用狀態。',variants:'名稱和效果需以牌組規則為準。'}),
      makeRole('市長','good','平民','擁有額外票權、公開身分或在平票時改變結果的可能。',{aliases:['MAYOR'],timing:'白天公投時。',relations:['村長','烏鴉','替罪羊'],interaction:'若市長票有權重，需與警長加權、額外票及平票處理一致。',variants:'有些版本市長與村長是同一角色，有些版本能力不同。'}),
      makeRole('保鏢','good','神職','指定一名玩家保護；部分版本若擋下攻擊，保鏢自己會承受傷害。',{aliases:['BODYGUARD'],timing:'夜晚。',relations:['守衛','小狼','女巫'],interaction:'和守衛功能接近，但保鏢可能替目標承傷，必須是不同的傷害解析流程。',variants:'保護後是否死亡、可否自保等房規不同。'}),
      makeRole('神秘學者','good','神職','透過夜間研究獲取玩家身分、陣營或技能使用線索。',{aliases:['MYSTIC','學者'],timing:'夜晚。',relations:['預言家','調查員','小狼'],interaction:'資訊粒度需寫明是角色、陣營還是模糊提示。',variants:'國際版與衍生規則中的泛用型角色。'}),
      makeRole('復仇者','good','神職','出局或受到特定技能時，可選擇對造成事件的玩家反擊。',{aliases:['VIGILANTE','復仇者'],timing:'夜晚或出局時，視版本。',relations:['獵人','狼王','殺人狂'],interaction:'反擊對象是攻擊者還是玩家自選，應分開設定。',variants:'多個遊戲都存在此名稱，但具體條件不同。'}),
      makeRole('暴徒','good','神職','以主動攻擊、制裁或干擾能力為特色的衍生角色。',{aliases:['VETERAN'],timing:'依板型。',relations:['小狼','獵人','守衛'],interaction:'需要定義主動技能是否造成普通死亡，以及能否被保護阻擋。',variants:'國際版角色對譯可能不同。'}),
      makeRole('觀察者','good','神職','追蹤某玩家夜間是否出門、是否行動或曾被誰造訪。',{aliases:['LOOKOUT','VOYEUR'],timing:'夜晚或天亮前。',relations:['預言家','偵探','小狼'],interaction:'追蹤結果涉及私人資訊，正式多人版只能傳給有權知道的玩家。',variants:'可能只看到行動與否，也可能看到造訪者名單。'}),
      makeRole('時間領主','good','神職','可在特定回合改變計時、回合順序或技能期限。',{aliases:['TIME LORD'],timing:'依特定板型。',relations:['定序王子','白晝學者','寂夜導師'],interaction:'時間效果必須在伺服器狀態機中實作，不能只調整瀏覽器倒數。',variants:'國際版角色／擴充身份。'}),
      makeRole('瘋狂科學家','third','獨立','某些版本出局時會引發連鎖傷害或選擇其他玩家同歸於盡。',{aliases:['MAD SCIENTIST'],timing:'出局事件觸發。',relations:['貓又','獵人','小狼'],interaction:'連鎖死亡需使用待處理事件隊列，並防止同一玩家多次死亡。',variants:'不同遊戲的觸發範圍可能不同。'}),
      makeRole('詛咒村民','good','平民','受到某些條件影響後可能轉化為狼人或呈現特殊查驗結果。',{aliases:['CURSED VILLAGER'],timing:'被動，依條件觸發。',relations:['小狼','預言家','種狼'],interaction:'若轉化成狼，要明確決定轉化前後是否保留村民身分及勝利陣營。',variants:'有些版本可被狼隊轉化，有些只在特定攻擊後轉化。'}),
      makeRole('祝福村民','good','平民','受到保護或具有一次性免疫，通常沒有主動攻擊能力。',{aliases:['BLESSED VILLAGER'],timing:'被動觸發。',relations:['守衛','女巫','小狼'],interaction:'需將祝福視為獨立防護層，並設定能抵擋哪些傷害。',variants:'國際版／自訂角色。'}),
      makeRole('殉情者','couple','連結角色','因戀人或連結對象出局而被動跟隨出局。',{aliases:['LOVER'],timing:'連結對象死亡時。',relations:['邱比特','情侶','暗戀者'],interaction:'多重連結可能形成連鎖出局，應避免遞迴重複結算。',variants:'是否獨立勝利及能否與原陣營同勝依房規。'}),
      makeRole('混血兒','third','變動陣營','首夜通常選擇一名玩家作為效忠或跟隨對象；勝利陣營可能依目標變化。',{aliases:['混血','HALF-BLOOD'],timing:'首夜選擇跟隨對象；後續多為被動。',relations:['野孩子','邱比特','小狼','平民'],interaction:'跟隨對象出局、陣營變動與是否保留原能力必須依板型定義。',variants:'不同版本可能在好人／狼人／其他陣營間跟隨，不能只靠角色名稱推定最終陣營。'}),
      makeRole('吹笛者','third','獨立','夜晚通常可迷惑一名或多名玩家；依版本，迷惑所有存活玩家可能達成個人勝利。',{aliases:['笛手','PIPER'],timing:'夜晚，通常每夜選擇兩名玩家。',relations:['小狼','吸血鬼','催眠師','倖存者'],interaction:'被迷惑狀態需持續保存，且要與死亡、免疫、重複選擇及獨立勝利條件一起處理。',variants:'選擇人數、是否能重複迷惑與勝利門檻因版本而異。'}),
    ];

    const ROLE_ALIAS_MAP = Object.create(null);
    const ROLE_CAMP = Object.create(null);
    ROLE_DATABASE.forEach(role => {
      const mappedCamp = role.team === 'wolf' ? '狼人'
        : role.team === 'good' ? (role.category === '神職' ? '神職' : '平民')
        : '特殊';
      [role.name, ...(role.aliases || [])].forEach(alias => {
        ROLE_ALIAS_MAP[String(alias).toLocaleLowerCase()] = role;
        ROLE_CAMP[alias] = mappedCamp;
      });
      ROLE_CAMP[role.name] = mappedCamp;
    });
    const ROLES = ROLE_DATABASE;

    function getRoleDefinition(roleName) {
      if (roleName == null) return null;
      const normalized = String(roleName).trim().toLocaleLowerCase();
      const canonical = ROLE_DATABASE.find(r => r.name.toLocaleLowerCase() === normalized);
      return canonical || ROLE_ALIAS_MAP[normalized] || null;
    }

    function getRoleCamp(role) {
      if (role == null) return '未知';
      if (ROLE_CAMP[role]) return ROLE_CAMP[role];
      const definition = getRoleDefinition(role);
      if (definition) return definition.team === 'wolf' ? '狼人'
        : definition.team === 'good' ? (definition.category === '神職' ? '神職' : '平民')
        : '特殊';
      return '未知';
    }

  return { ROLE_DATABASE, ROLE_ALIAS_MAP, ROLE_CAMP, ROLES, getRoleDefinition, getRoleCamp };
});
