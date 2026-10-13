/* BellekPad v0.1 — local-first capture, no libraries or network calls. */
(() => {
  "use strict";

  const KEY = "efss.bellekpad.records.v1";
  const CATEGORIES = {
    general: "Genel", project: "Proje", work: "İş",
    learning: "Öğrenme", finance: "Finans", personal: "Kişisel"
  };
  const byId = (id) => document.getElementById(id);
  const form = byId("entryForm");
  const list = byId("entryList");
  const status = byId("storageState");
  const notice = byId("notice");
  let records = [];
  let persistence = false;

  function notify(message) {
    notice.textContent = message;
  }

  function updateStorageStatus() {
    status.textContent = persistence
      ? "● Yalnızca bu cihazda"
      : "● Geçici oturum — yedek al";
    status.title = persistence
      ? "Kayıtlar bu tarayıcının yerel depolamasında tutulur."
      : "Bu ortamda yerel depolama kullanılamıyor. JSON dışa aktar.";
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    if (typeof raw.title !== "string" || !raw.title.trim()) return null;
    if (!Object.hasOwn(CATEGORIES, raw.category)) return null;
    if (!["open", "done"].includes(raw.status)) return null;
    if (typeof raw.id !== "string" || !raw.id || raw.id.length > 100) return null;
    const due = typeof raw.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate)
      ? raw.dueDate : "";
    const created = typeof raw.createdAt === "string" && Number.isFinite(Date.parse(raw.createdAt))
      ? raw.createdAt : new Date().toISOString();
    return {
      id: raw.id,
      title: raw.title.trim().slice(0, 120),
      detail: typeof raw.detail === "string" ? raw.detail.slice(0, 2000) : "",
      category: raw.category,
      dueDate: due,
      status: raw.status,
      createdAt: created
    };
  }

  function decode(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.items)
      || data.items.length > 5000) throw new Error("Desteklenmeyen veya aşırı büyük yedek dosyası.");
    const clean = data.items.map(normalize);
    if (clean.some((x) => !x)) throw new Error("Yedekte geçersiz kayıt var.");
    const unique = new Set(clean.map((item) => item.id));
    if (unique.size !== clean.length) throw new Error("Yedekte tekrar eden kayıt kimliği var.");
    return clean;
  }

  function read() {
    try {
      const test = KEY + ".probe";
      localStorage.setItem(test, "ok");
      localStorage.removeItem(test);
      persistence = true;
      const raw = localStorage.getItem(KEY);
      records = raw ? decode(JSON.parse(raw)) : [];
    } catch (error) {
      persistence = false;
      records = [];
      notify("Yerel depolama kapalı veya kayıtlar okunamadı. Bu oturum geçicidir.");
    }
    updateStorageStatus();
  }

  function persist() {
    if (!persistence) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, items: records }));
    } catch (error) {
      persistence = false;
      updateStorageStatus();
      notify("Depolama başarısız. Veriler şu an bellekte; JSON yedeği al.");
    }
  }

  function textNode(tag, text, className) {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function getVisible() {
    const query = byId("search").value.trim().toLocaleLowerCase("tr-TR");
    const state = byId("statusFilter").value;
    const category = byId("categoryFilter").value;
    return records.filter((item) => {
      if (state !== "all" && item.status !== state) return false;
      if (category !== "all" && item.category !== category) return false;
      return !query || (item.title + " " + item.detail)
        .toLocaleLowerCase("tr-TR").includes(query);
    });
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("tr-TR", {
      day: "numeric", month: "short", year: "numeric"
    }).format(date);
  }

  function renderEntry(item) {
    const row = textNode("li", "", "entry" + (item.status === "done" ? " done" : ""));
    const top = textNode("div", "", "entry-top");
    const body = textNode("div");
    body.append(textNode("h3", item.title, "entry-title"));
    if (item.detail) body.append(textNode("p", item.detail, "entry-detail"));
    const meta = textNode("div", "", "entry-meta");
    meta.append(textNode("span", CATEGORIES[item.category]));
    meta.append(textNode("span", "• " + formatDate(item.createdAt)));
    if (item.dueDate) meta.append(textNode("span", "• Hedef: " + formatDate(item.dueDate)));
    body.append(meta);
    const actions = textNode("div", "", "entry-actions");

    const toggle = textNode("button", item.status === "done" ? "↶ Aç" : "✓ Bitti");
    toggle.type = "button";
    toggle.setAttribute("aria-label", item.title + " — durumu değiştir");
    toggle.addEventListener("click", () => {
      item.status = item.status === "done" ? "open" : "done";
      persist();
      render();
    });

    const remove = textNode("button", "Sil", "danger");
    remove.type = "button";
    remove.setAttribute("aria-label", item.title + " — sil");
    remove.addEventListener("click", () => {
      if (!window.confirm("Bu kaydı silmek istiyor musun?")) return;
      records = records.filter((entry) => entry.id !== item.id);
      persist();
      render();
    });
    actions.append(toggle, remove);
    top.append(body, actions);
    row.append(top);
    return row;
  }

  function render() {
    const complete = records.filter((r) => r.status === "done").length;
    byId("totalCount").textContent = String(records.length);
    byId("openCount").textContent = String(records.length - complete);
    byId("doneCount").textContent = String(complete);
    const xp = complete * 10;
    byId("level").textContent = "Seviye " + (1 + Math.floor(xp / 100));
    byId("xpText").textContent = (xp % 100) + " / 100 XP";
    byId("xpProgress").style.width = (xp % 100) + "%";
    const visible = getVisible();
    list.replaceChildren(...visible.map(renderEntry));
    byId("emptyState").hidden = visible.length > 0;
    if (!visible.length && records.length) {
      byId("emptyState").textContent = "Bu filtrelere uygun kayıt bulunamadı.";
    } else {
      byId("emptyState").textContent = "Burada henüz bir şey yok. İlk kaydını ekleyerek başla. ✨";
    }
  }

  function nextId() {
    return globalThis.crypto && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "local-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  // Capture a note without leaving the keyboard (Ctrl/Cmd + Enter).
  // requestSubmit retains native required-field validation.
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    form.requestSubmit();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = byId("title").value.trim();
    if (!title) return;
    const item = normalize({
      id: nextId(), title, detail: byId("detail").value,
      category: byId("category").value, dueDate: byId("dueDate").value,
      status: "open", createdAt: new Date().toISOString()
    });
    if (!item) return notify("Kayıt doğrulanamadı.");
    records.unshift(item);
    persist();
    render();
    form.reset();
    byId("title").focus();
    notify("Kayıt eklendi.");
  });

  ["search", "statusFilter", "categoryFilter"].forEach((id) => {
    byId(id).addEventListener("input", render);
  });

  byId("exportButton").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({
      schemaVersion: 1, exportedAt: new Date().toISOString(), items: records
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bellekpad-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Yedek oluşturuldu. İndirilen dosyayı güvenli bir yerde sakla.");
  });

  byId("importFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) return notify("Yedek dosyası 2 MB sınırını aşıyor.");
    try {
      const imported = decode(JSON.parse(await file.text()));
      if (!window.confirm(imported.length + " kayıt mevcut kayıtların yerine alınacak. Devam edilsin mi?")) return;
      records = imported;
      persist();
      render();
      notify(imported.length + " kayıt yedekten alındı.");
    } catch (error) {
      notify("İçe aktarılamadı: " + error.message);
    }
  });

  read();
  render();
})();
