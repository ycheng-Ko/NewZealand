// 紐西蘭🇳🇿 15+1 日自駕行程資料
// 根據 schedule_draft.txt 規劃
const defaultItinerary = [
  {
    day: 1,
    date: "1/21 (四)",
    title: "搭飛機出發 ✈️",
    startLoc: "台灣桃園機場 (TPE)",
    endLoc: "飛行中",
    startCoords: [25.0797, 121.2342],
    endCoords: [25.0797, 121.2342],
    routeCoords: [
      [25.0797, 121.2342]
    ],
    attractions: [
      { name: "桃園機場報到 (13:20 起飛)", visited: false },
      { name: "機上過夜 - 準備入境卡", visited: false }
    ],
    estDuration: "整天 (飛行)",
    actDuration: "",
    estCost: 0,
    actCost: 0,
    notes: "13:20 起飛。記得帶好護照、入境卡、旅遊保險證明、國際駕照。紐西蘭海關對食品檢查非常嚴格，不要攜帶任何水果、肉類與蜂蜜製品。"
  },
  {
    day: 2,
    date: "1/22 (五)",
    title: "抵達基督城 → 市區探索",
    startLoc: "基督城機場 (CHC)",
    endLoc: "基督城市區 (Christchurch)",
    startCoords: [-43.4894, 172.5322],
    endCoords: [-43.5321, 172.6362],
    routeCoords: [
      [-43.4894, 172.5322],
      [-43.5321, 172.6362]
    ],
    attractions: [
      { name: "抵達基督城 (12:50 到達)", visited: false },
      { name: "機場租車取車", visited: false },
      { name: "超市採買旅途補給品", visited: false },
      { name: "基督城市區逛逛 (紙教堂、追憶橋)", visited: false }
    ],
    estDuration: "半天 (下午)",
    actDuration: "",
    estCost: 200,
    actCost: 0,
    notes: "12:50 抵達後先取車，熟悉左駕。建議先到 Countdown 或 PAK'nSAVE 超市補給。基督城市區可看紙教堂 (Cardboard Cathedral) 與追憶橋 (Bridge of Remembrance)。第一晚早點休息調時差。"
  },
  {
    day: 3,
    date: "1/23 (六)",
    title: "基督城 → 蒂卡波湖",
    startLoc: "基督城 (Christchurch)",
    endLoc: "蒂卡波湖 (Lake Tekapo)",
    startCoords: [-43.5321, 172.6362],
    endCoords: [-44.0047, 170.4771],
    routeCoords: [
      [-43.5321, 172.6362],
      [-43.6881, 172.2743],
      [-43.9022, 171.7481],
      [-44.1539, 171.2435],
      [-44.2494, 170.8931],
      [-44.0047, 170.4771]
    ],
    attractions: [
      { name: "坎特伯雷平原公路風光", visited: false },
      { name: "好牧羊人教堂 (Church of the Good Shepherd)", visited: false },
      { name: "蒂卡波湖畔散步 & 拍照", visited: false },
      { name: "約翰山天文台觀星 (Mt John Observatory)", visited: false }
    ],
    estDuration: "3.5 小時 (行車)",
    actDuration: "",
    estCost: 150,
    actCost: 0,
    notes: "沿路經過坎特伯雷平原，風景壯闊。蒂卡波湖是國際暗天保護區，晚上觀星超美。好牧羊人教堂是紐西蘭最具代表性的地標之一。"
  },
  {
    day: 4,
    date: "1/24 (日)",
    title: "蒂卡波湖 → 庫克山國家公園",
    startLoc: "蒂卡波湖 (Lake Tekapo)",
    endLoc: "庫克山村 (Mt Cook Village)",
    startCoords: [-44.0047, 170.4771],
    endCoords: [-43.7342, 170.1030],
    routeCoords: [
      [-44.0047, 170.4771],
      [-44.1751, 170.1557],
      [-43.9967, 170.1593],
      [-43.7342, 170.1030]
    ],
    attractions: [
      { name: "⚠️ 上山前先採買兩天份食物", visited: false },
      { name: "普卡基湖 (Lake Pukaki - 藍色牛奶湖)", visited: false },
      { name: "Mt Cook Alpine Salmon (鮭魚生魚片)", visited: false },
      { name: "胡克谷步道 (Hooker Valley Track)", visited: false },
      { name: "庫克山周邊步道健行", visited: false }
    ],
    estDuration: "1.5 小時 (行車)",
    actDuration: "",
    estCost: 120,
    actCost: 0,
    notes: "⚠️ 重要：庫克山村物資有限且昂貴，務必在出發前（蒂卡波或 Twizel 小鎮）先採買兩天份食物！普卡基湖有「藍色牛奶湖」之稱，湖畔可買到新鮮鮭魚。胡克谷步道來回約 3 小時，地勢平緩但風大。"
  },
  {
    day: 5,
    date: "1/25 (一)",
    title: "庫克山 → 塔斯曼冰河直升機冰川健行",
    startLoc: "庫克山村 (Mt Cook Village)",
    endLoc: "庫克山村 (Mt Cook Village)",
    startCoords: [-43.7342, 170.1030],
    endCoords: [-43.7342, 170.1030],
    routeCoords: [
      [-43.7342, 170.1030],
      [-43.6500, 170.2400],
      [-43.7342, 170.1030]
    ],
    attractions: [
      { name: "🚁 塔斯曼冰河直升機體驗 (Tasman Glacier Heli-Hike)", visited: false },
      { name: "冰川健行 (Ice Climbing / Walking)", visited: false },
      { name: "塔斯曼冰河觀景台 (Tasman Glacier Viewpoint)", visited: false }
    ],
    estDuration: "整天 (冰河活動)",
    actDuration: "",
    estCost: 600,
    actCost: 0,
    notes: "今日重點活動！塔斯曼冰河直升機冰川健行是庫克山最精彩的體驗。建議提前預訂。天氣不好可能取消，需有備案行程。穿著保暖防風衣物，裝備由導遊提供。"
  },
  {
    day: 6,
    date: "1/26 (二)",
    title: "庫克山 → 瓦納卡",
    startLoc: "庫克山村 (Mt Cook Village)",
    endLoc: "瓦納卡 (Wanaka)",
    startCoords: [-43.7342, 170.1030],
    endCoords: [-44.6934, 169.1413],
    routeCoords: [
      [-43.7342, 170.1030],
      [-44.2505, 169.9877],
      [-44.3725, 169.6427],
      [-44.6934, 169.1413]
    ],
    attractions: [
      { name: "林迪斯隘口觀景台 (Lindis Pass)", visited: false },
      { name: "🍓 草莓園採摘 (Berry Farm)", visited: false },
      { name: "💐 薰衣草農場 (Lavender Farm)", visited: false },
      { name: "瓦納卡孤獨樹 (That Wanaka Tree)", visited: false },
      { name: "瓦納卡湖畔漫步", visited: false }
    ],
    estDuration: "2.5 小時 (行車)",
    actDuration: "",
    estCost: 150,
    actCost: 0,
    notes: "林迪斯隘口海拔較高，荒涼壯麗。沿途可以去草莓園和薰衣草農場（紐西蘭 1 月正值盛夏，是薰衣草季節！）。傍晚到瓦納卡湖畔拍攝孤獨樹，夕陽時分最美。"
  },
  {
    day: 7,
    date: "1/27 (三)",
    title: "瓦納卡一日遊 → 跳傘 & 品酒",
    startLoc: "瓦納卡 (Wanaka)",
    endLoc: "瓦納卡 (Wanaka)",
    startCoords: [-44.6934, 169.1413],
    endCoords: [-44.6934, 169.1413],
    routeCoords: [
      [-44.6934, 169.1413],
      [-44.7200, 169.2500],
      [-44.6934, 169.1413]
    ],
    attractions: [
      { name: "🪂 高空跳傘 (Skydive Wanaka)", visited: false },
      { name: "🍷 瓦納卡酒莊品酒 (Wine Tasting)", visited: false },
      { name: "瓦納卡湖邊悠閒午後", visited: false },
      { name: "Puzzling World 迷宮世界", visited: false }
    ],
    estDuration: "整天 (活動)",
    actDuration: "",
    estCost: 500,
    actCost: 0,
    notes: "今日超刺激！瓦納卡的跳傘可以俯瞰整個南阿爾卑斯山脈與湖泊，非常壯觀。跳完傘去品酒放鬆一下。如果跳傘因天氣取消，隔天 Day 8 有備用時間。"
  },
  {
    day: 8,
    date: "1/28 (四)",
    title: "瓦納卡 → 克倫威爾 → 皇后鎮",
    startLoc: "瓦納卡 (Wanaka)",
    endLoc: "皇后鎮 (Queenstown)",
    startCoords: [-44.6934, 169.1413],
    endCoords: [-45.0312, 168.6626],
    routeCoords: [
      [-44.6934, 169.1413],
      [-44.8829, 169.0197],
      [-45.0389, 169.1960],
      [-44.9856, 168.8997],
      [-44.9427, 168.8315],
      [-45.0312, 168.6626]
    ],
    attractions: [
      { name: "🪂 跳傘備用日 (若前日取消)", visited: false },
      { name: "🍒 克倫威爾水果鎮 (買櫻桃、蘋果)", visited: false },
      { name: "皇冠山脈公路觀景台 (Crown Range Lookout)", visited: false },
      { name: "箭鎮 (Arrowtown) 散步逛逛", visited: false },
      { name: "🛝 天際纜車 & 溜溜車 (Skyline Luge)", visited: false },
      { name: "🌃 纜車山頂晚餐 (Stratosfare Restaurant)", visited: false }
    ],
    estDuration: "2 小時 (行車)",
    actDuration: "",
    estCost: 350,
    actCost: 0,
    notes: "克倫威爾是「水果小鎮」，1 月盛產櫻桃和蘋果，價格超便宜！皇冠山脈公路是紐西蘭海拔最高的公路，髮夾彎多。到皇后鎮後搭纜車看夕陽、玩溜溜車 Luge，晚餐在山頂 Stratosfare 餐廳非常浪漫。"
  },
  {
    day: 9,
    date: "1/29 (五)",
    title: "皇后鎮一日遊",
    startLoc: "皇后鎮 (Queenstown)",
    endLoc: "皇后鎮 (Queenstown)",
    startCoords: [-45.0312, 168.6626],
    endCoords: [-45.0312, 168.6626],
    routeCoords: [
      [-45.0312, 168.6626]
    ],
    attractions: [
      { name: "🎢 Nevis Swing 盪鞦韆 (160m 高)", visited: false },
      { name: "🍔 Fergburger 大漢堡", visited: false },
      { name: "🍦 Patagonia 冰淇淋", visited: false },
      { name: "♨️ 昂森溫泉 (Onsen Hot Pools)", visited: false }
    ],
    estDuration: "整天 (市區活動)",
    actDuration: "",
    estCost: 400,
    actCost: 0,
    notes: "Nevis Swing 是世界上最大的盪鞦韆，160 公尺高空擺盪，超級刺激！Fergburger 是皇后鎮必吃漢堡，建議電話預訂。傍晚去昂森溫泉 (Onsen Hot Pools) 泡湯看星空，極度放鬆。"
  },
  {
    day: 10,
    date: "1/30 (六)",
    title: "皇后鎮 → 蒂阿瑙",
    startLoc: "皇后鎮 (Queenstown)",
    endLoc: "蒂阿瑙 (Te Anau)",
    startCoords: [-45.0312, 168.6626],
    endCoords: [-45.4144, 167.7176],
    routeCoords: [
      [-45.0312, 168.6626],
      [-45.2589, 168.7188],
      [-45.3984, 168.1257],
      [-45.4144, 167.7176]
    ],
    attractions: [
      { name: "🚢 TSS 恩斯洛蒸汽船 (TSS Earnslaw Steamship)", visited: false },
      { name: "瓦爾特峰農場 (Walter Peak Farm)", visited: false },
      { name: "蒂阿瑙湖畔散步", visited: false },
      { name: "✨ 蒂阿瑙螢火蟲洞 (Glowworm Caves)", visited: false }
    ],
    estDuration: "2 小時 (行車)",
    actDuration: "",
    estCost: 280,
    actCost: 0,
    notes: "TSS 恩斯洛號是南半球僅存仍在營運的燃煤蒸汽船，非常復古浪漫。傍晚抵達蒂阿瑙後搭船前往螢火蟲洞，洞內像置身銀河，十分夢幻。"
  },
  {
    day: 11,
    date: "1/31 (日)",
    title: "蒂阿瑙 → 米佛峽灣 → 蒂阿瑙",
    startLoc: "蒂阿瑙 (Te Anau)",
    endLoc: "蒂阿瑙 (Te Anau)",
    startCoords: [-45.4144, 167.7176],
    endCoords: [-45.4144, 167.7176],
    routeCoords: [
      [-45.4144, 167.7176],
      [-45.1950, 167.9950],
      [-45.0250, 168.0120],
      [-44.7702, 167.9904],
      [-44.6716, 167.9255],
      [-44.7702, 167.9904],
      [-45.0250, 168.0120],
      [-45.4144, 167.7176]
    ],
    attractions: [
      { name: "🚌 參加蒂阿瑙出發團體旅遊", visited: false },
      { name: "埃格林頓山谷 (Eglinton Valley)", visited: false },
      { name: "鏡湖 (Mirror Lakes)", visited: false },
      { name: "荷馬隧道 (Homer Tunnel)", visited: false },
      { name: "🛥️ 米佛峽灣巡航 (Milford Sound Cruise)", visited: false }
    ],
    estDuration: "整天 (團體行程)",
    actDuration: "",
    estCost: 250,
    actCost: 0,
    notes: "今日參加從蒂阿瑙出發的團體行程前往米佛峽灣。峽灣公路極美但天氣多變，常有大霧。巡航時可以看到瀑布、海豹、可能還有企鵝和海豚！峽灣被譽為「世界第八大奇景」。"
  },
  {
    day: 12,
    date: "2/1 (一)",
    title: "蒂阿瑙 → 但尼丁",
    startLoc: "蒂阿瑙 (Te Anau)",
    endLoc: "但尼丁 (Dunedin)",
    startCoords: [-45.4144, 167.7176],
    endCoords: [-45.8788, 170.5028],
    routeCoords: [
      [-45.4144, 167.7176],
      [-46.1026, 168.8964],
      [-46.2330, 169.8510],
      [-45.8788, 170.5028]
    ],
    attractions: [
      { name: "南部風光公路自駕", visited: false },
      { name: "🏰 拉納克城堡 (Larnach Castle)", visited: false },
      { name: "但尼丁市區散步", visited: false }
    ],
    estDuration: "3.5 小時 (行車)",
    actDuration: "",
    estCost: 160,
    actCost: 0,
    notes: "今天車程較長。拉納克城堡是紐西蘭唯一的城堡，位於奧塔哥半島上，景色優美、建築華麗。城堡花園也值得一逛。"
  },
  {
    day: 13,
    date: "2/2 (二)",
    title: "但尼丁探索 → 奧馬魯看企鵝",
    startLoc: "但尼丁 (Dunedin)",
    endLoc: "奧馬魯 (Oamaru)",
    startCoords: [-45.8788, 170.5028],
    endCoords: [-45.1000, 170.9667],
    routeCoords: [
      [-45.8788, 170.5028],
      [-45.1000, 170.9667]
    ],
    attractions: [
      { name: "🚂 但尼丁火車站 (Dunedin Railway Station)", visited: false },
      { name: "🎓 奧塔哥大學 (University of Otago)", visited: false },
      { name: "世界最陡街道 Baldwin Street", visited: false },
      { name: "🐧 奧馬魯藍企鵝歸巢 (Blue Penguin Colony)", visited: false }
    ],
    estDuration: "整天 (含 1.5 小時行車)",
    actDuration: "",
    estCost: 130,
    actCost: 0,
    notes: "但尼丁火車站是必拍景點，佛蘭德文藝復興建築風格。奧塔哥大學是紐西蘭最古老的大學，校園很美。傍晚趕到奧馬魯看藍企鵝歸巢（約日落時分，需提前買票），小企鵝搖搖擺擺走上岸超可愛！"
  },
  {
    day: 14,
    date: "2/3 (三)",
    title: "奧馬魯 → 基督城",
    startLoc: "奧馬魯 (Oamaru)",
    endLoc: "基督城 (Christchurch)",
    startCoords: [-45.1000, 170.9667],
    endCoords: [-43.5321, 172.6362],
    routeCoords: [
      [-45.1000, 170.9667],
      [-45.3444, 170.8256],
      [-44.3894, 171.2464],
      [-43.5321, 172.6362]
    ],
    attractions: [
      { name: "🪨 莫拉基大圓石 (Moeraki Boulders)", visited: false },
      { name: "奧馬魯維多利亞石灰岩老街", visited: false },
      { name: "基督城歸還租車或最後逛逛", visited: false }
    ],
    estDuration: "4.5 小時 (行車)",
    actDuration: "",
    estCost: 100,
    actCost: 0,
    notes: "莫拉基大圓石退潮時前往效果最佳（查好潮汐時間）。奧馬魯老城區保留了極佳的十九世紀風貌。沿 1 號國道北上返回基督城，完成南島環線旅程！"
  },
  {
    day: 15,
    date: "2/4 (四)",
    title: "基督城 ✈️ 回家",
    startLoc: "基督城 (Christchurch)",
    endLoc: "基督城機場 (CHC)",
    startCoords: [-43.5321, 172.6362],
    endCoords: [-43.4894, 172.5322],
    routeCoords: [
      [-43.5321, 172.6362],
      [-43.4894, 172.5322]
    ],
    attractions: [
      { name: "基督城最後購物 / 伴手禮", visited: false },
      { name: "還車手續", visited: false },
      { name: "✈️ 搭機回台灣 (下午 2:20 起飛)", visited: false }
    ],
    estDuration: "半天 (上午)",
    actDuration: "",
    estCost: 50,
    actCost: 0,
    notes: "下午 2:20 的飛機，至少提前 3 小時到機場。記得保留足夠時間還車與辦理退稅。"
  },
  {
    day: 16,
    date: "2/5 (五)",
    title: "抵達台灣 🏠",
    startLoc: "飛行中",
    endLoc: "台灣桃園機場 (TPE)",
    startCoords: [25.0797, 121.2342],
    endCoords: [25.0797, 121.2342],
    routeCoords: [
      [25.0797, 121.2342]
    ],
    attractions: [
      { name: "凌晨十二點抵達台灣", visited: false },
      { name: "回家休息 🎉 旅程完美結束", visited: false }
    ],
    estDuration: "飛行",
    actDuration: "",
    estCost: 0,
    actCost: 0,
    notes: "凌晨抵達桃園機場，建議先訂好接機或停車。美好的紐西蘭自駕旅程完美劃下句點！"
  }
];
