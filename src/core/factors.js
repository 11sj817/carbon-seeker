/* 排放因子库与业务常量
   取值原则：优先采用中国官方口径（生态环境部 / 省级清单指南）与国际公开数据集
   （DEFRA 2023、Poore & Nemecek 2018）。所有数值保留 3~4 位有效数字，
   页面「数据与方法」逐条列出单位与来源；这些是本演示站的唯一计算依据。 */
(function (global) {
  'use strict';

  var FACTORS = [
    /* --- 能源（Scope 1 / 2）--- */
    { k: 'elec', g: '能源', name: '外购电力', unit: 'kWh', v: 0.5703,
      src: '生态环境部：2022 年全国电网平均 CO₂ 排放因子 0.5703 tCO₂/MWh' },
    { k: 'heat', g: '能源', name: '外购热力', unit: 'GJ', v: 110,
      src: '按 0.11 tCO₂/GJ 的化石供热缺省值折算' },
    { k: 'gas', g: '能源', name: '天然气', unit: 'm³', v: 2.162,
      src: '《省级温室气体清单编制指南（试行）》化石燃料缺省值' },
    { k: 'lpg', g: '能源', name: '液化石油气', unit: 'kg', v: 3.101, src: '《省级温室气体清单编制指南》LPG 3.101 tCO₂/t' },
    { k: 'gasoline', g: '能源', name: '汽油', unit: 'L', v: 2.12,
      src: '2.925 tCO₂/t × 密度 0.725 kg/L' },
    { k: 'diesel', g: '能源', name: '柴油', unit: 'L', v: 2.6,
      src: '3.096 tCO₂/t × 密度 0.84 kg/L' },
    { k: 'coal', g: '能源', name: '原煤', unit: 't', v: 1900,
      src: '1.900 tCO₂/t 原煤（低位发热量 20 908 kJ/kg）' },
    { k: 'water', g: '能源', name: '自来水', unit: 'm³', v: 0.344,
      src: '供水处理与输配电耗折算的近似值，用于生活侧估算' },

    /* --- 出行（Scope 3 / 生活侧）--- */
    { k: 'car', g: '出行', name: '汽油私家车', unit: 'km', v: 0.17,
      src: '按 8 L/100 km 汽油车 × 2.12 kgCO₂/L' },
    { k: 'taxi', g: '出行', name: '出租 / 网约车', unit: 'km', v: 0.21, src: 'DEFRA 2023 中型汽油车平均值' },
    { k: 'bus', g: '出行', name: '公共汽车', unit: '人·km', v: 0.103, src: 'DEFRA 2023 local bus' },
    { k: 'metro', g: '出行', name: '城市轨道交通', unit: '人·km', v: 0.041, src: 'DEFRA 2023 light rail / metro' },
    { k: 'rail', g: '出行', name: '高铁 / 普速铁路', unit: '人·km', v: 0.029, src: 'DEFRA 2023 national rail' },
    { k: 'flight', g: '出行', name: '国内航空', unit: '人·km', v: 0.246, src: 'DEFRA 2023 domestic flight（含辐射强迫校正）' },
    { k: 'commute', g: '出行', name: '员工通勤（混合方式）', unit: '人·km', v: 0.12, src: '公交与私家车按 6:4 加权的企业填报代理值' },

    /* --- 食物（kgCO₂e/kg 食材，含土地利用与供应链）--- */
    { k: 'beef', g: '食物', name: '牛肉', unit: 'kg', v: 60, src: 'Poore & Nemecek 2018（Our World in Data 汇总）' },
    { k: 'pork', g: '食物', name: '猪肉', unit: 'kg', v: 7.2, src: 'Poore & Nemecek 2018（Our World in Data 汇总）' },
    { k: 'poultry', g: '食物', name: '禽肉', unit: 'kg', v: 6.1, src: 'Poore & Nemecek 2018（Our World in Data 汇总）' },
    { k: 'fish', g: '食物', name: '水产', unit: 'kg', v: 5.1, src: 'Poore & Nemecek 2018，养殖类平均' },
    { k: 'egg', g: '食物', name: '蛋类', unit: 'kg', v: 4.5, src: 'Poore & Nemecek 2018（Our World in Data 汇总）' },
    { k: 'dairy', g: '食物', name: '奶及奶制品', unit: 'kg', v: 3.0, src: 'Poore & Nemecek 2018（Our World in Data 汇总）' },
    { k: 'rice', g: '食物', name: '米面主食', unit: 'kg', v: 4.0, src: 'Poore & Nemecek 2018，稻米为主，含 CH₄' },
    { k: 'wheat', g: '食物', name: '小麦制品', unit: 'kg', v: 1.4, src: 'Poore & Nemecek 2018（Our World in Data 汇总）' },
    { k: 'veg', g: '食物', name: '蔬菜', unit: 'kg', v: 0.5, src: 'Poore & Nemecek 2018（Our World in Data 汇总）' },
    { k: 'fruit', g: '食物', name: '水果', unit: 'kg', v: 0.7, src: 'Poore & Nemecek 2018（Our World in Data 汇总）' },
    { k: 'meal', g: '食物', name: '外出就餐', unit: '次', v: 2.5, src: '按一餐 1.2 kg 食材 + 烹饪与损耗估算' },

    /* --- 用品与废弃物（Scope 3）--- */
    { k: 'tshirt', g: '用品', name: '棉质 T 恤', unit: '件', v: 6.5, src: 'WRAP / Carbon Trust 服装碳足迹区间中值' },
    { k: 'pants', g: '用品', name: '长裤', unit: '件', v: 12, src: 'WRAP / Carbon Trust 服装碳足迹区间中值' },
    { k: 'coat', g: '用品', name: '外套', unit: '件', v: 20, src: 'WRAP / Carbon Trust 服装碳足迹区间中值' },
    { k: 'paper', g: '用品', name: 'A4 复印纸', unit: '张', v: 0.005, src: '文化用纸 1.1 tCO₂/t × 4.5 g/张' },
    { k: 'bottle', g: '用品', name: 'PET 饮料瓶', unit: '个', v: 0.082, src: '500 mL PET 瓶全生命周期估算' },
    { k: 'bag', g: '用品', name: '塑料袋', unit: '个', v: 0.033, src: 'HDPE 袋 2.0 kgCO₂e/kg × 16.5 g' },
    { k: 'freight', g: '用品', name: '公路货运', unit: 't·km', v: 0.062, src: '中型柴油货车装载率 60% 折算' },
    { k: 'waste', g: '用品', name: '生活垃圾（填埋）', unit: 'kg', v: 0.6, src: '填埋 CH₄ 排放按 0.6 kgCO₂e/kg 湿基估算' }
  ];

  var MAP = {};
  FACTORS.forEach(function (f) { MAP[f.k] = f; });

  /* 生活侧人均参照：城镇居民生活消费直接与间接排放的近似值 */
  var BENCHMARK = {
    personalAnnual: 2600,      // kgCO₂e/人·年
    personalLabel: '城镇居民生活消费 2.6 tCO₂e/人·年（近似参照值）',
    nationalPerCapita: 8000    // 含工业与电力的全国人均，仅作背景
  };

  /* 行业强度示意值：tCO₂e / 万元产值，用于企业账本对标 */
  var SECTORS = [
    { k: 'steel', name: '钢铁冶炼', v: 2.6 },
    { k: 'building', name: '建材（水泥/玻璃）', v: 2.2 },
    { k: 'chemical', name: '化学制品', v: 1.45 },
    { k: 'logistics', name: '物流仓储', v: 0.55 },
    { k: 'machinery', name: '机械制造', v: 0.42 },
    { k: 'food', name: '食品加工', v: 0.3 },
    { k: 'electronics', name: '电子与设备', v: 0.16 }
  ];

  /* 积分与兑换（1 kg 减排 = 10 绿色积分） */
  var POINTS = {
    perKg: 10,
    items: [
      { k: 'spirulina', name: '螺旋藻干粉 100 g', cost: 500, kind: 'carbon', credit: 0.18,
        note: '螺旋藻光合固碳，按 1.8 gCO₂/g 干重折算，可制营养品' },
      { k: 'ocean', name: '海洋垃圾清理 1 kg', cost: 300, kind: 'eco', credit: 0,
        note: '与沿海机构合作的清理服务，计生态贡献量，不折算碳减排' },
      { k: 'reuse', name: '旧物循环 1 件', cost: 200, kind: 'carbon', credit: 3.2,
        note: '以二手替代新品，按平均单件隐含碳 3.2 kg 折算' },
      { k: 'tree', name: '合作林场乔木 1 棵·年', cost: 1200, kind: 'carbon', credit: 10,
        note: '按乔木年净固碳 10 kgCO₂e 估算' }
    ]
  };

  var CONST = {
    co2PerKgSpirulina: 1.8,
    treePerYear: 10,
    maxPointsPerYear: 200000
  };

  var API = { FACTORS: FACTORS, map: MAP, BENCHMARK: BENCHMARK, SECTORS: SECTORS, POINTS: POINTS, CONST: CONST };
  global.CS = global.CS || {};
  global.CS.factors = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
