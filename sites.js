// 사이트별 어댑터. DOM 구조가 바뀌면 여기만 고치면 된다.
// 각 어댑터:
//   site            : 저장 키 prefix
//   matchList(loc)  : 목록 페이지 여부
//   findCards()     : 매물 카드 엘리먼트 배열
//   getId(card)     : 매물 고유 ID (없으면 null → 광고 등으로 보고 무시)
//   getTitle(card)  : 사람이 읽을 제목 (팝업 목록용)
//   detailUrl(id)   : 상세 페이지 URL
//   matchDetail(loc): 상세 페이지면 매물 ID, 아니면 null
//   detailTitle()   : 상세 페이지 제목
window.UCF_SITES = [
  {
    // 엔카 (구 목록 dc_carsearchlist.do, 해시 라우팅)
    // 행: tbody[data-role=list_container] > tr[data-impression="carid|..."]
    //     ul.car_list[data-role=list_container] > li  (사진형/보증 리스트)
    site: "encar",
    hosts: ["www.encar.com", "fem.encar.com"],
    matchList: (loc) => loc.hostname === "www.encar.com" && loc.pathname.startsWith("/dc/dc_carsearchlist"),
    findCards() {
      const cards = new Set();
      document
        .querySelectorAll('[data-role="list_container"] a[href*="carid="]')
        .forEach((a) => {
          const c = a.closest("tr, li");
          if (c) cards.add(c);
        });
      return [...cards];
    },
    getId(card) {
      const imp = card.getAttribute("data-impression");
      if (imp && /^\d+\|/.test(imp)) return imp.split("|")[0];
      const a = card.querySelector('a[href*="carid="]');
      const m = a && a.getAttribute("href").match(/carid=(\d+)/);
      return m ? m[1] : null;
    },
    getTitle(card) {
      const cls = card.querySelector(".cls")?.innerText ?? "";
      const dtl = card.querySelector(".dtl")?.innerText ?? "";
      const detail = card.querySelector(".detail")?.innerText ?? "";
      const t = `${cls} ${dtl}`.replace(/\s+/g, " ").trim();
      return [t, detail.replace(/\s+/g, " ").trim()].filter(Boolean).join(" | ") || card.innerText.slice(0, 80);
    },
    detailUrl: (id) => `https://fem.encar.com/cars/detail/${id}`,
    matchDetail(loc) {
      if (loc.hostname === "fem.encar.com") {
        const m = loc.pathname.match(/\/cars\/detail\/(\d+)/);
        return m ? m[1] : null;
      }
      if (loc.pathname.startsWith("/dc/dc_cardetailview")) {
        return new URLSearchParams(loc.search).get("carid");
      }
      return null;
    },
    detailTitle: () => document.title.replace(/\s*[|-]\s*엔카.*$/, "").trim(),
  },
  {
    // K Car (Nuxt/Vue SPA). 카드: div.carListBox
    // 링크 href 가 전부 "/bc/search"(JS 이동)라 URL 로는 ID 를 못 얻음.
    // 대신 카드 내부 id="timerInfoDtlEC61407955" / "stateDlvyEC..." 와
    // 이미지 경로(.../61407955_...)에 차량코드가 들어있다.
    site: "kcar",
    hosts: ["www.kcar.com"],
    matchList: (loc) => loc.pathname.startsWith("/bc/search"),
    findCards: () => [...document.querySelectorAll(".carListBox")],
    getId(card) {
      const el = card.querySelector('[id*="EC"]');
      const m = el && el.id.match(/EC\d{6,}/);
      if (m) return m[0];
      for (const img of card.querySelectorAll('img[src*="img.kcar.com"]')) {
        const n = img.getAttribute("src").match(/(?:_|\/)(\d{8})(?:_|\.)/);
        if (n) return "EC" + n[1];
      }
      return null;
    },
    getTitle(card) {
      const t = card.querySelector(".carTit")?.innerText ?? "";
      const price = card.querySelector(".carExp")?.childNodes[0]?.textContent ?? "";
      const con = card.querySelector(".detailCarCon")?.innerText ?? "";
      return [t, price, con].map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | ");
    },
    detailUrl: (id) => `https://www.kcar.com/bc/detail/carInfoDtl?i_sCarCd=${id}`,
    matchDetail(loc) {
      if (!loc.pathname.startsWith("/bc/detail")) return null;
      return new URLSearchParams(loc.search).get("i_sCarCd");
    },
    detailTitle: () => document.title.replace(/\s*[|-]\s*K Car.*$/, "").trim(),
  },
];
