const SITE_LABEL = { encar: "엔카", kcar: "K Car" };
const listEl = document.getElementById("list");
const qEl = document.getElementById("q");
let records = [];

async function load() {
  const all = await chrome.storage.local.get(null);
  records = Object.entries(all)
    .filter(([k]) => k.startsWith("f:"))
    .map(([, v]) => v)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  render();
}

function render() {
  const q = qEl.value.trim().toLowerCase();
  const rows = records.filter((r) => !q || `${r.title} ${r.reason} ${r.id}`.toLowerCase().includes(q));
  document.getElementById("count").textContent = `(${records.length})`;
  listEl.replaceChildren();
  if (!rows.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = records.length ? "검색 결과 없음" : "아직 거른 매물이 없습니다.";
    listEl.appendChild(li);
    return;
  }
  for (const r of rows) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="top"><span class="site"></span><a target="_blank"></a><button class="del" title="해제">✕</button></div>
      <div class="reason"></div>
      <div class="meta"><span class="id"></span><span class="date"></span></div>`;
    const site = li.querySelector(".site");
    site.textContent = SITE_LABEL[r.site] ?? r.site;
    site.classList.add(r.site);
    const a = li.querySelector("a");
    a.href = r.url;
    a.textContent = r.title || r.id;
    a.title = r.title;
    li.querySelector(".reason").textContent = r.reason;
    li.querySelector(".id").textContent = r.id;
    li.querySelector(".date").textContent = new Date(r.updatedAt).toLocaleString("ko-KR");
    li.querySelector(".del").onclick = async () => {
      if (confirm(`"${r.title || r.id}" 거르기를 해제할까요?`)) {
        await chrome.storage.local.remove(`f:${r.site}:${r.id}`);
        load();
      }
    };
    listEl.appendChild(li);
  }
}

document.getElementById("export").onclick = () => {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `filtered-cars-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

const fileEl = document.getElementById("file");
document.getElementById("import").onclick = () => fileEl.click();
fileEl.onchange = async () => {
  const file = fileEl.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("배열 형식이 아닙니다.");
    const items = {};
    for (const r of data) {
      if (!r || !r.site || !r.id || typeof r.reason !== "string") continue;
      items[`f:${r.site}:${r.id}`] = r;
    }
    await chrome.storage.local.set(items);
    alert(`${Object.keys(items).length}건 가져왔습니다. (같은 매물은 덮어씀)`);
    load();
  } catch (e) {
    alert(`가져오기 실패: ${e.message}`);
  }
  fileEl.value = "";
};

qEl.oninput = render;
load();
