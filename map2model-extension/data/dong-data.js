// data/dong-data.js
// 한국 행정동 이름 → bounding box 좌표 매핑 데이터
// 좌표 출처: OpenStreetMap / 통계청 행정구역 데이터 기반
// bbox: { south: 남위, west: 서경, north: 북위, east: 동경, center_lat, center_lng }

var DONG_DATA = [
  // ========== 강남구 ==========
  { full_name:"서울특별시 강남구 역삼1동", short_name:"역삼1동", si:"서울특별시", gu:"강남구", dong:"역삼1동", code:"1168053000", bbox:{ south:37.4953, west:127.0283, north:37.5042, east:127.0412, center_lat:37.4998, center_lng:127.0348 }},
  { full_name:"서울특별시 강남구 역삼2동", short_name:"역삼2동", si:"서울특별시", gu:"강남구", dong:"역삼2동", code:"1168053100", bbox:{ south:37.4942, west:127.0390, north:37.5018, east:127.0510, center_lat:37.4980, center_lng:127.0450 }},
  { full_name:"서울특별시 강남구 삼성1동", short_name:"삼성1동", si:"서울특별시", gu:"강남구", dong:"삼성1동", code:"1168054000", bbox:{ south:37.5050, west:127.0480, north:37.5150, east:127.0620, center_lat:37.5100, center_lng:127.0550 }},
  { full_name:"서울특별시 강남구 삼성2동", short_name:"삼성2동", si:"서울특별시", gu:"강남구", dong:"삼성2동", code:"1168054100", bbox:{ south:37.5090, west:127.0550, north:37.5170, east:127.0680, center_lat:37.5130, center_lng:127.0615 }},
  { full_name:"서울특별시 강남구 대치1동", short_name:"대치1동", si:"서울특별시", gu:"강남구", dong:"대치1동", code:"1168055000", bbox:{ south:37.4930, west:127.0550, north:37.5030, east:127.0680, center_lat:37.4980, center_lng:127.0615 }},
  { full_name:"서울특별시 강남구 대치2동", short_name:"대치2동", si:"서울특별시", gu:"강남구", dong:"대치2동", code:"1168055100", bbox:{ south:37.4940, west:127.0630, north:37.5010, east:127.0750, center_lat:37.4975, center_lng:127.0690 }},
  { full_name:"서울특별시 강남구 대치4동", short_name:"대치4동", si:"서울특별시", gu:"강남구", dong:"대치4동", code:"1168055300", bbox:{ south:37.4950, west:127.0560, north:37.5020, east:127.0660, center_lat:37.4985, center_lng:127.0610 }},
  { full_name:"서울특별시 강남구 도곡1동", short_name:"도곡1동", si:"서울특별시", gu:"강남구", dong:"도곡1동", code:"1168056000", bbox:{ south:37.4830, west:127.0370, north:37.4930, east:127.0500, center_lat:37.4880, center_lng:127.0435 }},
  { full_name:"서울특별시 강남구 도곡2동", short_name:"도곡2동", si:"서울특별시", gu:"강남구", dong:"도곡2동", code:"1168056100", bbox:{ south:37.4850, west:127.0460, north:37.4940, east:127.0580, center_lat:37.4895, center_lng:127.0520 }},
  { full_name:"서울특별시 강남구 개포1동", short_name:"개포1동", si:"서울특별시", gu:"강남구", dong:"개포1동", code:"1168057000", bbox:{ south:37.4760, west:127.0480, north:37.4870, east:127.0620, center_lat:37.4815, center_lng:127.0550 }},
  { full_name:"서울특별시 강남구 개포4동", short_name:"개포4동", si:"서울특별시", gu:"강남구", dong:"개포4동", code:"1168057300", bbox:{ south:37.4700, west:127.0520, north:37.4800, east:127.0650, center_lat:37.4750, center_lng:127.0585 }},
  { full_name:"서울특별시 강남구 청담동", short_name:"청담동", si:"서울특별시", gu:"강남구", dong:"청담동", code:"1168058000", bbox:{ south:37.5160, west:127.0400, north:37.5270, east:127.0570, center_lat:37.5215, center_lng:127.0485 }},
  { full_name:"서울특별시 강남구 신사동", short_name:"신사동", si:"서울특별시", gu:"강남구", dong:"신사동", code:"1168059000", bbox:{ south:37.5150, west:127.0180, north:37.5270, east:127.0350, center_lat:37.5210, center_lng:127.0265 }},
  { full_name:"서울특별시 강남구 논현1동", short_name:"논현1동", si:"서울특별시", gu:"강남구", dong:"논현1동", code:"1168060000", bbox:{ south:37.5080, west:127.0220, north:37.5170, east:127.0380, center_lat:37.5125, center_lng:127.0300 }},
  { full_name:"서울특별시 강남구 논현2동", short_name:"논현2동", si:"서울특별시", gu:"강남구", dong:"논현2동", code:"1168060100", bbox:{ south:37.5050, west:127.0170, north:37.5140, east:127.0290, center_lat:37.5095, center_lng:127.0230 }},
  { full_name:"서울특별시 강남구 압구정동", short_name:"압구정동", si:"서울특별시", gu:"강남구", dong:"압구정동", code:"1168061000", bbox:{ south:37.5210, west:127.0150, north:37.5320, east:127.0350, center_lat:37.5265, center_lng:127.0250 }},
  { full_name:"서울특별시 강남구 세곡동", short_name:"세곡동", si:"서울특별시", gu:"강남구", dong:"세곡동", code:"1168062000", bbox:{ south:37.4600, west:127.0700, north:37.4750, east:127.0950, center_lat:37.4675, center_lng:127.0825 }},
  { full_name:"서울특별시 강남구 일원1동", short_name:"일원1동", si:"서울특별시", gu:"강남구", dong:"일원1동", code:"1168063000", bbox:{ south:37.4780, west:127.0750, north:37.4890, east:127.0900, center_lat:37.4835, center_lng:127.0825 }},
  { full_name:"서울특별시 강남구 수서동", short_name:"수서동", si:"서울특별시", gu:"강남구", dong:"수서동", code:"1168065000", bbox:{ south:37.4830, west:127.0880, north:37.4950, east:127.1050, center_lat:37.4890, center_lng:127.0965 }},

  // ========== 서초구 ==========
  { full_name:"서울특별시 서초구 서초1동", short_name:"서초1동", si:"서울특별시", gu:"서초구", dong:"서초1동", code:"1165051000", bbox:{ south:37.4840, west:127.0050, north:37.4960, east:127.0230, center_lat:37.4900, center_lng:127.0140 }},
  { full_name:"서울특별시 서초구 서초2동", short_name:"서초2동", si:"서울특별시", gu:"서초구", dong:"서초2동", code:"1165051100", bbox:{ south:37.4900, west:127.0150, north:37.5010, east:127.0300, center_lat:37.4955, center_lng:127.0225 }},
  { full_name:"서울특별시 서초구 서초3동", short_name:"서초3동", si:"서울특별시", gu:"서초구", dong:"서초3동", code:"1165051200", bbox:{ south:37.4800, west:126.9950, north:37.4920, east:127.0100, center_lat:37.4860, center_lng:127.0025 }},
  { full_name:"서울특별시 서초구 서초4동", short_name:"서초4동", si:"서울특별시", gu:"서초구", dong:"서초4동", code:"1165051300", bbox:{ south:37.4920, west:127.0080, north:37.5020, east:127.0200, center_lat:37.4970, center_lng:127.0140 }},
  { full_name:"서울특별시 서초구 잠원동", short_name:"잠원동", si:"서울특별시", gu:"서초구", dong:"잠원동", code:"1165052000", bbox:{ south:37.5060, west:127.0060, north:37.5200, east:127.0200, center_lat:37.5130, center_lng:127.0130 }},
  { full_name:"서울특별시 서초구 반포1동", short_name:"반포1동", si:"서울특별시", gu:"서초구", dong:"반포1동", code:"1165053000", bbox:{ south:37.5000, west:126.9870, north:37.5150, east:127.0080, center_lat:37.5075, center_lng:126.9975 }},
  { full_name:"서울특별시 서초구 반포2동", short_name:"반포2동", si:"서울특별시", gu:"서초구", dong:"반포2동", code:"1165053100", bbox:{ south:37.4970, west:126.9920, north:37.5080, east:127.0050, center_lat:37.5025, center_lng:126.9985 }},
  { full_name:"서울특별시 서초구 반포4동", short_name:"반포4동", si:"서울특별시", gu:"서초구", dong:"반포4동", code:"1165053300", bbox:{ south:37.5020, west:127.0050, north:37.5130, east:127.0170, center_lat:37.5075, center_lng:127.0110 }},
  { full_name:"서울특별시 서초구 방배1동", short_name:"방배1동", si:"서울특별시", gu:"서초구", dong:"방배1동", code:"1165054000", bbox:{ south:37.4750, west:126.9830, north:37.4880, east:127.0000, center_lat:37.4815, center_lng:126.9915 }},
  { full_name:"서울특별시 서초구 방배2동", short_name:"방배2동", si:"서울특별시", gu:"서초구", dong:"방배2동", code:"1165054100", bbox:{ south:37.4800, west:126.9900, north:37.4910, east:127.0030, center_lat:37.4855, center_lng:126.9965 }},
  { full_name:"서울특별시 서초구 양재1동", short_name:"양재1동", si:"서울특별시", gu:"서초구", dong:"양재1동", code:"1165056000", bbox:{ south:37.4680, west:127.0250, north:37.4810, east:127.0430, center_lat:37.4745, center_lng:127.0340 }},
  { full_name:"서울특별시 서초구 양재2동", short_name:"양재2동", si:"서울특별시", gu:"서초구", dong:"양재2동", code:"1165056100", bbox:{ south:37.4570, west:127.0200, north:37.4710, east:127.0400, center_lat:37.4640, center_lng:127.0300 }},
  { full_name:"서울특별시 서초구 내곡동", short_name:"내곡동", si:"서울특별시", gu:"서초구", dong:"내곡동", code:"1165057000", bbox:{ south:37.4450, west:127.0350, north:37.4620, east:127.0600, center_lat:37.4535, center_lng:127.0475 }},

  // ========== 송파구 ==========
  { full_name:"서울특별시 송파구 잠실본동", short_name:"잠실본동", si:"서울특별시", gu:"송파구", dong:"잠실본동", code:"1171051000", bbox:{ south:37.5050, west:127.0750, north:37.5170, east:127.0920, center_lat:37.5110, center_lng:127.0835 }},
  { full_name:"서울특별시 송파구 잠실2동", short_name:"잠실2동", si:"서울특별시", gu:"송파구", dong:"잠실2동", code:"1171051200", bbox:{ south:37.5060, west:127.0830, north:37.5180, east:127.0960, center_lat:37.5120, center_lng:127.0895 }},
  { full_name:"서울특별시 송파구 잠실3동", short_name:"잠실3동", si:"서울특별시", gu:"송파구", dong:"잠실3동", code:"1171051300", bbox:{ south:37.5100, west:127.0850, north:37.5210, east:127.1000, center_lat:37.5155, center_lng:127.0925 }},
  { full_name:"서울특별시 송파구 잠실6동", short_name:"잠실6동", si:"서울특별시", gu:"송파구", dong:"잠실6동", code:"1171051600", bbox:{ south:37.5120, west:127.0920, north:37.5230, east:127.1050, center_lat:37.5175, center_lng:127.0985 }},
  { full_name:"서울특별시 송파구 잠실7동", short_name:"잠실7동", si:"서울특별시", gu:"송파구", dong:"잠실7동", code:"1171051700", bbox:{ south:37.5050, west:127.0950, north:37.5150, east:127.1070, center_lat:37.5100, center_lng:127.1010 }},
  { full_name:"서울특별시 송파구 석촌동", short_name:"석촌동", si:"서울특별시", gu:"송파구", dong:"석촌동", code:"1171053000", bbox:{ south:37.5000, west:127.0950, north:37.5100, east:127.1100, center_lat:37.5050, center_lng:127.1025 }},
  { full_name:"서울특별시 송파구 송파1동", short_name:"송파1동", si:"서울특별시", gu:"송파구", dong:"송파1동", code:"1171054000", bbox:{ south:37.4960, west:127.1050, north:37.5070, east:127.1180, center_lat:37.5015, center_lng:127.1115 }},
  { full_name:"서울특별시 송파구 풍납1동", short_name:"풍납1동", si:"서울특별시", gu:"송파구", dong:"풍납1동", code:"1171052000", bbox:{ south:37.5250, west:127.1050, north:37.5370, east:127.1200, center_lat:37.5310, center_lng:127.1125 }},
  { full_name:"서울특별시 송파구 가락1동", short_name:"가락1동", si:"서울특별시", gu:"송파구", dong:"가락1동", code:"1171055000", bbox:{ south:37.4920, west:127.1150, north:37.5030, east:127.1300, center_lat:37.4975, center_lng:127.1225 }},
  { full_name:"서울특별시 송파구 문정1동", short_name:"문정1동", si:"서울특별시", gu:"송파구", dong:"문정1동", code:"1171057000", bbox:{ south:37.4830, west:127.1100, north:37.4950, east:127.1260, center_lat:37.4890, center_lng:127.1180 }},
  { full_name:"서울특별시 송파구 장지동", short_name:"장지동", si:"서울특별시", gu:"송파구", dong:"장지동", code:"1171058000", bbox:{ south:37.4700, west:127.1200, north:37.4850, east:127.1400, center_lat:37.4775, center_lng:127.1300 }},
  { full_name:"서울특별시 송파구 위례동", short_name:"위례동", si:"서울특별시", gu:"송파구", dong:"위례동", code:"1171059000", bbox:{ south:37.4620, west:127.1350, north:37.4780, east:127.1530, center_lat:37.4700, center_lng:127.1440 }},

  // ========== 마포구 ==========
  { full_name:"서울특별시 마포구 합정동", short_name:"합정동", si:"서울특별시", gu:"마포구", dong:"합정동", code:"1144053000", bbox:{ south:37.5430, west:126.9030, north:37.5550, east:126.9180, center_lat:37.5490, center_lng:126.9105 }},
  { full_name:"서울특별시 마포구 망원1동", short_name:"망원1동", si:"서울특별시", gu:"마포구", dong:"망원1동", code:"1144054000", bbox:{ south:37.5480, west:126.8950, north:37.5590, east:126.9100, center_lat:37.5535, center_lng:126.9025 }},
  { full_name:"서울특별시 마포구 망원2동", short_name:"망원2동", si:"서울특별시", gu:"마포구", dong:"망원2동", code:"1144054100", bbox:{ south:37.5510, west:126.8870, north:37.5620, east:126.9010, center_lat:37.5565, center_lng:126.8940 }},
  { full_name:"서울특별시 마포구 연남동", short_name:"연남동", si:"서울특별시", gu:"마포구", dong:"연남동", code:"1144055000", bbox:{ south:37.5600, west:126.9180, north:37.5700, east:126.9300, center_lat:37.5650, center_lng:126.9240 }},
  { full_name:"서울특별시 마포구 성산1동", short_name:"성산1동", si:"서울특별시", gu:"마포구", dong:"성산1동", code:"1144056000", bbox:{ south:37.5580, west:126.9050, north:37.5690, east:126.9200, center_lat:37.5635, center_lng:126.9125 }},
  { full_name:"서울특별시 마포구 상암동", short_name:"상암동", si:"서울특별시", gu:"마포구", dong:"상암동", code:"1144061000", bbox:{ south:37.5650, west:126.8850, north:37.5830, east:126.9050, center_lat:37.5740, center_lng:126.8950 }},
  { full_name:"서울특별시 마포구 서교동", short_name:"서교동", si:"서울특별시", gu:"마포구", dong:"서교동", code:"1144062000", bbox:{ south:37.5470, west:126.9100, north:37.5580, east:126.9250, center_lat:37.5525, center_lng:126.9175 }},
  { full_name:"서울특별시 마포구 홍대앞", short_name:"홍대앞", si:"서울특별시", gu:"마포구", dong:"서교동", code:"1144062000", bbox:{ south:37.5480, west:126.9180, north:37.5570, east:126.9300, center_lat:37.5525, center_lng:126.9240 }},

  // ========== 용산구 ==========
  { full_name:"서울특별시 용산구 이태원1동", short_name:"이태원1동", si:"서울특별시", gu:"용산구", dong:"이태원1동", code:"1117054000", bbox:{ south:37.5300, west:126.9850, north:37.5400, east:126.9980, center_lat:37.5350, center_lng:126.9915 }},
  { full_name:"서울특별시 용산구 이태원2동", short_name:"이태원2동", si:"서울특별시", gu:"용산구", dong:"이태원2동", code:"1117054100", bbox:{ south:37.5280, west:126.9950, north:37.5380, east:127.0070, center_lat:37.5330, center_lng:127.0010 }},
  { full_name:"서울특별시 용산구 한남동", short_name:"한남동", si:"서울특별시", gu:"용산구", dong:"한남동", code:"1117055000", bbox:{ south:37.5280, west:127.0000, north:37.5410, east:127.0170, center_lat:37.5345, center_lng:127.0085 }},
  { full_name:"서울특별시 용산구 용산2가동", short_name:"용산2가동", si:"서울특별시", gu:"용산구", dong:"용산2가동", code:"1117051100", bbox:{ south:37.5250, west:126.9680, north:37.5370, east:126.9830, center_lat:37.5310, center_lng:126.9755 }},
  { full_name:"서울특별시 용산구 남영동", short_name:"남영동", si:"서울특별시", gu:"용산구", dong:"남영동", code:"1117052000", bbox:{ south:37.5370, west:126.9680, north:37.5470, east:126.9800, center_lat:37.5420, center_lng:126.9740 }},

  // ========== 종로구 ==========
  { full_name:"서울특별시 종로구 사직동", short_name:"사직동", si:"서울특별시", gu:"종로구", dong:"사직동", code:"1111052000", bbox:{ south:37.5730, west:126.9630, north:37.5830, east:126.9750, center_lat:37.5780, center_lng:126.9690 }},
  { full_name:"서울특별시 종로구 삼청동", short_name:"삼청동", si:"서울특별시", gu:"종로구", dong:"삼청동", code:"1111053000", bbox:{ south:37.5770, west:126.9780, north:37.5900, east:126.9900, center_lat:37.5835, center_lng:126.9840 }},
  { full_name:"서울특별시 종로구 부암동", short_name:"부암동", si:"서울특별시", gu:"종로구", dong:"부암동", code:"1111054000", bbox:{ south:37.5850, west:126.9550, north:37.6050, east:126.9750, center_lat:37.5950, center_lng:126.9650 }},
  { full_name:"서울특별시 종로구 종로1·2·3·4가동", short_name:"종로1234가동", si:"서울특별시", gu:"종로구", dong:"종로1·2·3·4가동", code:"1111060000", bbox:{ south:37.5680, west:126.9770, north:37.5780, east:127.0000, center_lat:37.5730, center_lng:126.9885 }},

  // ========== 중구 ==========
  { full_name:"서울특별시 중구 명동", short_name:"명동", si:"서울특별시", gu:"중구", dong:"명동", code:"1114055000", bbox:{ south:37.5580, west:126.9790, north:37.5670, east:126.9900, center_lat:37.5625, center_lng:126.9845 }},
  { full_name:"서울특별시 중구 을지로동", short_name:"을지로동", si:"서울특별시", gu:"중구", dong:"을지로동", code:"1114056000", bbox:{ south:37.5630, west:126.9870, north:37.5720, east:126.9990, center_lat:37.5675, center_lng:126.9930 }},

  // ========== 영등포구 ==========
  { full_name:"서울특별시 영등포구 여의동", short_name:"여의동", si:"서울특별시", gu:"영등포구", dong:"여의동", code:"1156052000", bbox:{ south:37.5180, west:126.9150, north:37.5350, east:126.9380, center_lat:37.5265, center_lng:126.9265 }},
  { full_name:"서울특별시 영등포구 영등포동", short_name:"영등포동", si:"서울특별시", gu:"영등포구", dong:"영등포동", code:"1156054000", bbox:{ south:37.5130, west:126.8950, north:37.5260, east:126.9120, center_lat:37.5195, center_lng:126.9035 }},

  // ========== 성동구 ==========
  { full_name:"서울특별시 성동구 성수1가1동", short_name:"성수1가1동", si:"서울특별시", gu:"성동구", dong:"성수1가1동", code:"1120060000", bbox:{ south:37.5370, west:127.0400, north:37.5480, east:127.0560, center_lat:37.5425, center_lng:127.0480 }},
  { full_name:"서울특별시 성동구 성수2가1동", short_name:"성수2가1동", si:"서울특별시", gu:"성동구", dong:"성수2가1동", code:"1120062000", bbox:{ south:37.5350, west:127.0480, north:37.5470, east:127.0620, center_lat:37.5410, center_lng:127.0550 }},

  // ========== 광진구 ==========
  { full_name:"서울특별시 광진구 건대입구", short_name:"화양동", si:"서울특별시", gu:"광진구", dong:"화양동", code:"1121553000", bbox:{ south:37.5380, west:127.0650, north:37.5480, east:127.0780, center_lat:37.5430, center_lng:127.0715 }},
  { full_name:"서울특별시 광진구 자양1동", short_name:"자양1동", si:"서울특별시", gu:"광진구", dong:"자양1동", code:"1121551000", bbox:{ south:37.5300, west:127.0680, north:37.5420, east:127.0830, center_lat:37.5360, center_lng:127.0755 }},
];

// 전역 등록
if (typeof window !== 'undefined') window.DONG_DATA = DONG_DATA;
