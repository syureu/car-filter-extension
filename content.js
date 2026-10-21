(() => {
  const adapter = window.UCF_SITES.find((s) => s.hosts.includes(location.hostname));
  if (!adapter) return;

  // 저장 스키마: chrome.storage.local["f:<site>:<id>"] = { site, id, reason, title, url, createdAt, updatedAt }
  const keyOf = (id) => `f:${adapter.site}:${id}`;
  let filtered = {}; // id -> record (현재 사이트만)

  async function loadAll() {
    const all = await chrome.storage.local.get(null);
    filtered = {};
    for (const [k, v] of Object.entries(all)) {
      if (k.startsWith(`f:${adapter.site}:`)) filtered[v.id] = v;
    }
  }

  async function saveRecord(id, reason, title) {
    const prev = filtered[id];
    const now = Date.now();
    const rec = {
      site: adapter.site,
      id,
      reason,
      title: title || prev?.title || "",
      url: adapter.detailUrl(id),
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    await chrome.storage.local.set({ [keyOf(id)]: rec });
  }

  const removeRecord = (id) => chrome.storage.local.remove(keyOf(id));

  function recentReasons(limit = 8) {
    const seen = new Set();
    return Object.values(filtered)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r) => r.reason.trim())
      .filter((r) => r && !seen.has(r) && seen.add(r))
      .slice(0, limit);
  }

  // ---------- 사유 입력 모달 ----------
  function askReason({ title, initial = "" }) {
    return new Promise((resolve) => {
      const back = document.createElement("div");
      back.className = "ucf-modal-back";
      back.innerHTML = `
        <div class="ucf-modal" role="dialog">
          <div class="ucf-modal-title">매물 거르기</div>
          <div class="ucf-modal-sub"></div>
          <textarea class="ucf-modal-input" rows="3" placeholder="거르는 사유 (예: 사고이력 2회, 침수, 렌트이력)"></textarea>
          <div class="ucf-chips"></div>
          <div class="ucf-modal-btns">
            <span class="ucf-hint">Ctrl+Enter 저장 · Esc 취소</span>
            <button type="button" class="ucf-btn ucf-cancel">취소</button>
            <button type="button" class="ucf-btn ucf-primary ucf-ok">저장</button>
          </div>
        </div>`;
      back.querySelector(".ucf-modal-sub").textContent = title || "";
      const input = back.querySelector("textarea");
      input.value = initial;
      const chips = back.querySelector(".ucf-chips");
      for (const r of recentReasons()) {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "ucf-chip";
        c.textContent = r;
        c.title = "클릭하면 사유에 추가";
        c.onclick = () => {
          input.value = input.value.trim() ? `${input.value.trim()}, ${r}` : r;
          input.focus();
        };
        chips.appendChild(c);
      }
      const close = (val) => {
        back.remove();
        resolve(val);
      };
      const ok = () => {
        const v = input.value.trim();
        if (!v) return input.focus();
        close(v);
      };
      back.querySelector(".ucf-ok").onclick = ok;
      back.querySelector(".ucf-cancel").onclick = () => close(null);
      back.addEventListener("mousedown", (e) => e.target === back && close(null));
      back.addEventListener("keydown", (e) => {
        e.stopPropagation(); // 사이트 단축키 방지
        if (e.key === "Escape") close(null);
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ok();
      });
      document.body.appendChild(back);
      input.focus();
    });
  }

  async function filterFlow(id, title) {
    const prev = filtered[id];
    const reason = await askReason({ title, initial: prev?.reason ?? "" });
    if (reason) await saveRecord(id, reason, title);
  }

  // 카드 안의 링크/사이트 핸들러로 클릭이 새지 않도록
  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // ---------- 목록 카드 장식 ----------
  // 버튼/툴팁/오버레이를 붙일 호스트. <tr> 은 absolute 기준점으로 안정적이지 않아
  // 마지막 td 를 기준점으로 쓴다 (CSS 의 .ucf-card-tr 참고).
  const hostOf = (card) => (card.tagName === "TR" ? card.cells[card.cells.length - 1] || card : card);

  const rowResize = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      const ov = target.querySelector(".ucf-overlay");
      if (ov) ov.style.width = `${target.offsetWidth}px`;
    }
  });

  function clearCard(card) {
    if (card.tagName === "TR") rowResize.unobserve(card);
    card.querySelectorAll(":scope .ucf-el").forEach((el) => el.remove());
    card.classList.remove("ucf-card", "ucf-card-tr", "ucf-filtered");
    delete card.dataset.ucfState;
  }

  function renderCard(card) {
    const id = adapter.getId(card);
    if (!id) {
      if (card.dataset.ucfState) clearCard(card);
      return;
    }
    const rec = filtered[id];
    const state = `${id}|${rec ? rec.updatedAt : "-"}`;
    if (card.dataset.ucfState === state) return; // 변경 없음 (Vue 가 DOM 재사용해도 id 로 감지)
    clearCard(card);
    card.dataset.ucfState = state;
    card.classList.add("ucf-card");
    if (card.tagName === "TR") card.classList.add("ucf-card-tr");
    const host = hostOf(card);

    if (!rec) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ucf-el ucf-filter-btn";
      btn.textContent = "✕ 거르기";
      btn.title = "이 매물을 거르기";
      btn.addEventListener("click", (e) => {
        stop(e);
        filterFlow(id, adapter.getTitle(card));
      }, true);
      host.appendChild(btn);
      return;
    }

    card.classList.add("ucf-filtered");
    const overlay = document.createElement("div");
    overlay.className = "ucf-el ucf-overlay";
    overlay.innerHTML = `
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="0" x2="100" y2="100" vector-effect="non-scaling-stroke"/>
        <line x1="100" y1="0" x2="0" y2="100" vector-effect="non-scaling-stroke"/>
      </svg>`;
    host.appendChild(overlay);
    if (card.tagName === "TR") {
      // 마지막 td 오른쪽 끝에 붙여 tr 폭만큼 왼쪽으로 늘린다
      overlay.style.left = "auto";
      overlay.style.width = `${card.offsetWidth}px`;
      rowResize.observe(card);
    }
    host.appendChild(buildTip(card, id, rec));
  }

  function buildTip(card, id, rec) {
    const tip = document.createElement("div");
    tip.className = "ucf-el ucf-tip";
    tip.innerHTML = `
      <div class="ucf-tip-label">거른 사유</div>
      <div class="ucf-tip-reason"></div>
      <div class="ucf-tip-date"></div>
      <div class="ucf-tip-btns">
        <button type="button" class="ucf-btn ucf-edit">수정</button>
        <button type="button" class="ucf-btn ucf-undo">해제</button>
      </div>`;
    tip.querySelector(".ucf-tip-reason").textContent = rec.reason;
    tip.querySelector(".ucf-tip-date").textContent = new Date(rec.updatedAt).toLocaleString("ko-KR");
    tip.querySelector(".ucf-edit").addEventListener("click", (e) => {
      stop(e);
      filterFlow(id, adapter.getTitle(card));
    }, true);
    tip.querySelector(".ucf-undo").addEventListener("click", (e) => {
      stop(e);
      removeRecord(id);
    }, true);
    tip.addEventListener("click", stop);
    return tip;
  }

  // ---------- 상세 페이지 플로팅 패널 ----------
  let panel = null;
  function renderDetail() {
    const id = adapter.matchDetail(location);
    if (!id) {
      panel?.remove();
      panel = null;
      return;
    }
    const rec = filtered[id];
    const state = `${id}|${rec ? rec.updatedAt : "-"}`;
    if (panel && panel.dataset.state === state) return;
    panel?.remove();
    panel = document.createElement("div");
    panel.className = "ucf-panel" + (rec ? " ucf-panel-filtered" : "");
    panel.dataset.state = state;
    if (rec) {
      panel.innerHTML = `
        <div class="ucf-tip-label">✕ 거른 매물</div>
        <div class="ucf-tip-reason"></div>
        <div class="ucf-tip-btns">
          <button type="button" class="ucf-btn ucf-edit">수정</button>
          <button type="button" class="ucf-btn ucf-undo">해제</button>
        </div>`;
      panel.querySelector(".ucf-tip-reason").textContent = rec.reason;
      panel.querySelector(".ucf-edit").onclick = () => filterFlow(id, rec.title || adapter.detailTitle());
      panel.querySelector(".ucf-undo").onclick = () => removeRecord(id);
    } else {
      panel.innerHTML = `<button type="button" class="ucf-btn ucf-primary">✕ 이 매물 거르기</button>`;
      panel.querySelector("button").onclick = () => filterFlow(id, adapter.detailTitle());
    }
    document.body.appendChild(panel);
  }

  // ---------- 스캔 루프 ----------
  function scan() {
    if (adapter.matchList(location)) adapter.findCards().forEach(renderCard);
    renderDetail();
  }

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(scan, 150);
  };

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local") return;
    if (!Object.keys(changes).some((k) => k.startsWith(`f:${adapter.site}:`))) return;
    await loadAll();
    scan();
  });

  // SPA/해시 라우팅/무한스크롤 대응: DOM 변경 시 재스캔 (renderCard 는 멱등이라 자기 변경으로 루프 안 돔)
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("hashchange", schedule);
  window.addEventListener("popstate", schedule);

  loadAll().then(scan);
})();
