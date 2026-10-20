(() => {
  "use strict";

  const STORAGE_KEY = "heqie-practice-v1";
  const UI_KEY = "heqie-practice-position-v1";
  const data = Array.isArray(window.MAHJONG_DATA) ? window.MAHJONG_DATA : [];
  const questions = data.filter(q => q && Number.isInteger(Number(q.id))).sort((a, b) => Number(a.id) - Number(b.id));
  const meta = window.MAHJONG_META || {};
  const $ = selector => document.querySelector(selector);
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const numerals = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const honors = ["", "東", "南", "西", "北", "白", "發", "中"];
  const honorNames = ["", "东", "南", "西", "北", "白", "发", "中"];
  let storageWorks = true;
  let records = readStorage(STORAGE_KEY, {});
  if (!records || typeof records !== "object" || Array.isArray(records)) records = {};
  let savedPosition = readStorage(UI_KEY, {});
  let currentIndex = Math.max(0, questions.findIndex(q => Number(q.id) === Number(savedPosition?.id)));
  let activeGroup = questions.length ? String(Math.floor((Number(questions[currentIndex].id) - 1) / 50)) : "0";
  let activeFilter = "all";
  let selectedTile = null;
  let selectedIndex = null;
  let selectedAction = "discard";
  let submitted = false;
  let toastTimer;

  function readStorage(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      storageWorks = false;
      return fallback;
    }
  }

  function saveStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      if (storageWorks) toast("浏览器无法保存记录；本次练习仍可继续。");
      storageWorks = false;
    }
  }

  function canonicalTile(value) {
    const s = String(value ?? "").trim().toLowerCase();
    const aliases = { 東: "1z", 东: "1z", 南: "2z", 西: "3z", 北: "4z", 白: "5z", 發: "6z", 发: "6z", 中: "7z" };
    return aliases[s] || s.replace(/^0([mps])$/, "5$1");
  }

  function exactTile(value) {
    const s = String(value ?? "").trim().toLowerCase();
    return /^0[mps]$/.test(s) ? s : canonicalTile(s);
  }

  function tileName(code) {
    const value = String(code ?? "").trim().toLowerCase();
    const normalized = canonicalTile(value);
    const match = normalized.match(/^([1-9])([mpsz])$/);
    if (!match) return value;
    const n = Number(match[1]), suit = match[2];
    if (suit === "z") return (honorNames[n] || n) + "牌";
    return (value.startsWith("0") ? "赤" : "") + numerals[n] + ({ m: "万", p: "筒", s: "索" })[suit];
  }

  function tileFace(code) {
    return window.MahjongTileArt.face(code);
  }

  window.MahjongTiles = { face: tileFace, name: tileName, canonical: canonicalTile };

  function toast(message) {
    const box = $("#toast");
    window.clearTimeout(toastTimer);
    box.textContent = message;
    box.hidden = false;
    toastTimer = window.setTimeout(() => { box.hidden = true; }, 3800);
  }

  function correctRecord(record) { return record && record.lastCorrect === true; }
  function isDone(record) { return record && Number(record.attempts) > 0; }

  function updateProgress() {
    const completed = questions.filter(q => isDone(records[q.id])).length;
    const correct = questions.filter(q => isDone(records[q.id]) && correctRecord(records[q.id])).length;
    const percent = questions.length ? Math.round(completed / questions.length * 100) : 0;
    $("#completed-count").textContent = completed;
    $("#total-count").textContent = questions.length || 300;
    $("#correct-count").textContent = correct;
    $("#incorrect-count").textContent = completed - correct;
    $("#progress-percent").textContent = `${percent}%`;
    $("#progress-fill").style.width = `${percent}%`;
    $("#random-question").disabled = completed === questions.length;
    $("#random-question").title = completed === questions.length ? "全部题目已完成" : "随机选择一道尚未做过的题";
  }

  function renderGrid() {
    const current = questions[currentIndex];
    const visible = questions.filter(q => {
      if (activeGroup !== "all" && Math.floor((Number(q.id) - 1) / 50) !== Number(activeGroup)) return false;
      const record = records[q.id];
      if (activeFilter === "new") return !isDone(record);
      if (activeFilter === "done") return isDone(record);
      if (activeFilter === "wrong") return isDone(record) && !correctRecord(record);
      return true;
    });
    $("#question-grid").innerHTML = visible.map(q => {
      const record = records[q.id], done = isDone(record);
      const status = done ? (correctRecord(record) ? "correct" : "incorrect") : "";
      const isCurrent = Number(q.id) === Number(current?.id);
      const label = `第 ${q.id} 题，${done ? correctRecord(record) ? "上次答对" : "上次答错" : "尚未练习"}`;
      return `<button type="button" class="question-cell ${status}${isCurrent ? " current" : ""}" data-question="${q.id}" aria-label="${label}"${isCurrent ? ' aria-current="true"' : ""} title="${label}">${String(q.id).padStart(2, "0")}</button>`;
    }).join("");
    $("#grid-empty").hidden = visible.length > 0;
    $("#question-group").value = activeGroup;
    $("#history-filters").querySelectorAll("button").forEach(button => {
      const active = button.dataset.filter === activeFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function fieldValue(value) {
    if (value === undefined || value === null || value === "") return "以题面为准";
    return String(value);
  }

  function renderQuestion() {
    const q = questions[currentIndex];
    selectedTile = null;
    selectedIndex = null;
    selectedAction = "discard";
    submitted = false;
    $("#feedback").hidden = true;
    $("#feedback").innerHTML = "";
    $("#source-details").open = false;
    $("#question-number").textContent = `第 ${String(q.id).padStart(3, "0")} 题`;
    $("#question-title").textContent = q.title || "这一手，你会切哪张？";
    document.title = `第 ${q.id} 题 · 何切练习室`;
    $("#context-items").innerHTML = [
      ["场况", q.round], ["自风", q.seat], ["巡目", q.turn], ...(q.condition ? [["条件", q.condition]] : [])
    ].map(([label, value]) => `<div class="context-item"><span class="context-label">${label}</span><span class="context-value">${escapeHTML(fieldValue(value))}</span></div>`).join("");
    const dora = Array.isArray(q.dora) ? q.dora : q.dora ? [q.dora] : [];
    $("#dora-tiles").innerHTML = dora.length ? dora.map(code => `<span title="宝牌指示牌：${escapeHTML(tileName(code))}" aria-label="宝牌指示牌：${escapeHTML(tileName(code))}">${tileFace(code)}</span>`).join("") : '<span class="context-value">见原题</span>';
    const hasTiles = Array.isArray(q.tiles) && q.tiles.length > 0;
    $("#hand-scroll").hidden = !hasTiles;
    $("#fallback-palette").hidden = hasTiles;
    $("#question-visual").hidden = hasTiles || !q.questionImage;
    $("#question-image").removeAttribute("src");
    if (!hasTiles && q.questionImage) $("#question-image").src = q.questionImage;
    $("#hand-caption").textContent = hasTiles ? "你的手牌" : "选择要切出的牌";
    $("#hand-hint").textContent = hasTiles ? "点击一张牌，选择要切出的牌" : "依据上方原题，从下方牌种中选择";
    $("#meld-display").hidden = !q.meldImage;
    $("#meld-image").removeAttribute("src");
    if (q.meldImage) $("#meld-image").src = q.meldImage;
    $(".table-note").innerHTML = `<span class="tiny-diamond"></span>${q.meldImage ? "最后一张为摸入牌；副露区不可切" : "最后一张为摸入牌；以原书题意为准"}`;
    if (hasTiles) {
      $("#hand").innerHTML = q.tiles.map((code, index) => tileButton(code, index, index === q.tiles.length - 1)).join("");
      $("#fallback-palette").innerHTML = "";
    } else {
      const codes = ["m", "p", "s", "z"].flatMap(suit => Array.from({ length: suit === "z" ? 7 : 9 }, (_, i) => `${i + 1}${suit}`));
      $("#fallback-palette").innerHTML = codes.map((code, i) => tileButton(code, i, false)).join("");
      $("#hand").innerHTML = "";
    }
    const sourcePage = q.sourcePage ? `${escapeHTML(meta.source || "日文原版")}，第 ${escapeHTML(q.sourcePage)} 页` : `${escapeHTML(meta.source || "日文原版")}题面`;
    $("#source-content").innerHTML = q.questionImage
      ? `<img src="${escapeHTML(q.questionImage)}" alt="第 ${q.id} 题原书题面" loading="lazy"><span>${sourcePage}${q.sourceNote ? ` · ${escapeHTML(q.sourceNote)}` : ""}</span>`
      : '<p class="source-empty">本题没有单独的题面图片。</p>';
    $("#previous-question").disabled = currentIndex === 0;
    $("#next-question").disabled = currentIndex === questions.length - 1;
    $("#hand-scroll").scrollLeft = 0;
    updateStatus(q);
    updateSelection();
    renderGrid();
    updateProgress();
    saveStorage(UI_KEY, { id: Number(q.id) });
  }

  function tileButton(code, index, drawn) {
    return `<button type="button" class="tile-button${drawn ? " drawn" : ""}" data-tile="${escapeHTML(code)}" data-index="${index}" aria-label="${drawn ? "摸入牌，" : ""}${tileName(code)}，选择切出" aria-pressed="false" title="${tileName(code)}${drawn ? "（摸入牌）" : ""}">${tileFace(code)}</button>`;
  }

  function updateStatus(q) {
    const record = records[q.id], badge = $("#question-status");
    badge.className = "status-badge";
    if (!isDone(record)) {
      badge.textContent = "尚未练习";
      badge.removeAttribute("title");
    } else {
      badge.classList.add(correctRecord(record) ? "correct" : "incorrect");
      badge.textContent = correctRecord(record) ? "已答对" : "待巩固";
      badge.title = `已练习 ${record.attempts} 次 · 答对 ${record.correct || 0} 次 · 答错 ${record.incorrect || 0} 次${record.lastSelection ? ` · 上次${record.lastAction === "ankan" ? "暗杠" : "切"}${tileName(record.lastSelection)}` : ""}`;
    }
  }

  function updateSelection() {
    const button = $("#submit-answer");
    const q = questions[currentIndex];
    const canKan = selectedTile && (q.tiles || []).filter(t => canonicalTile(t) === canonicalTile(selectedTile)).length === 4;
    $("#declare-kan").hidden = !canKan || submitted;
    $("#declare-kan").setAttribute("aria-pressed", String(selectedAction === "ankan"));
    $("#declare-kan").textContent = selectedAction === "ankan" ? "已选择暗杠 · 点击改为切牌" : "也可暗杠这四张牌";
    if (submitted) {
      button.disabled = false;
      button.innerHTML = '再想一次 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.7 7M3 5v6h6"/></svg>';
    } else {
      button.disabled = selectedTile === null;
      button.innerHTML = `${selectedAction === "ankan" ? "确认暗杠" : "确认切牌"} <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`;
    }
    $("#selection-summary").innerHTML = selectedTile
      ? `<span class="selected-copy">${submitted ? "本次" : "已选择"}${selectedAction === "ankan" ? "暗杠" : "切出"} <strong class="selected-mini">${escapeHTML(tileName(selectedTile))}</strong></span><span class="action-help">${submitted ? "读懂牌理，比记住答案更重要" : "可以重新选牌，确认后查看解析"}</span>`
      : '<span class="selection-placeholder">从手牌中选择一张</span><span class="action-help">想好以后，再揭晓答案</span>';
  }

  function goToQuestion(index, { preserveFilter = false } = {}) {
    if (index < 0 || index >= questions.length) return;
    currentIndex = index;
    if (activeGroup !== "all") activeGroup = String(Math.floor((Number(questions[index].id) - 1) / 50));
    if (!preserveFilter) activeFilter = "all";
    renderQuestion();
    if (window.innerWidth <= 760) $("#main").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }

  function answersFor(q) {
    const raw = Array.isArray(q.answer) ? q.answer : [q.answer];
    return raw.flatMap(a => typeof a === "string" && /[,，/／、|]/.test(a) ? a.split(/[,，/／、|]\s*/) : [a]).filter(Boolean);
  }

  function explanationHTML(q) {
    const explanation = Array.isArray(q.explanation) ? q.explanation.join("\n\n") : q.explanation;
    if (!explanation) return "<p>本题的详细解析见下方原书答案图片。</p>";
    return String(explanation).split(/\n\s*\n|\n/).filter(line => line.trim()).map(line => `<p>${escapeHTML(line)}</p>`).join("");
  }

  function submitAnswer() {
    if (submitted) {
      renderQuestion();
      toast("已重置本题选择，之前的练习记录仍然保留。");
      return;
    }
    if (selectedTile === null) return;
    const q = questions[currentIndex], answers = answersFor(q);
    if (!answers.length) {
      toast("本题答案尚未录入，暂时无法判分。");
      return;
    }
    const accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : answers;
    const matches = code => selectedAction === "ankan" ? canonicalTile(code) === canonicalTile(selectedTile) : exactTile(code) === exactTile(selectedTile);
    const primaryMatch = answers.some(matches);
    const correct = selectedAction === (q.action || "discard") && accepted.some(matches);
    const previous = records[q.id] || {};
    records[q.id] = {
      attempts: (Number(previous.attempts) || 0) + 1,
      correct: (Number(previous.correct) || 0) + (correct ? 1 : 0),
      incorrect: (Number(previous.incorrect) || 0) + (correct ? 0 : 1),
      lastCorrect: correct,
      lastSelection: selectedTile,
      lastAction: selectedAction,
      lastAnsweredAt: new Date().toISOString()
    };
    saveStorage(STORAGE_KEY, records);
    submitted = true;
    document.querySelectorAll(".tile-button").forEach(button => { button.disabled = true; });
    const feedback = $("#feedback");
    feedback.hidden = false;
    feedback.className = `feedback ${correct ? "is-correct" : "is-incorrect"}`;
    const answerNames = answers.map(code => tileName(code)).join(" / ");
    const actionName = q.action === "ankan" ? "暗杠" : "切";
    const answerImages = Array.isArray(q.answerImages) ? q.answerImages : q.answerImages ? [q.answerImages] : [];
    feedback.innerHTML = `<div class="feedback-top"><span class="result-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${correct ? '<path d="m5 12 4 4L19 6"/>' : '<path d="M12 7v6m0 4h.01"/><circle cx="12" cy="12" r="9"/>'}</svg></span><div><h3 class="feedback-title">${correct ? (primaryMatch ? "答对了 · 与书中推荐一致" : "答对了 · 书中认可的备选") : `再想一想 · 本题推荐${actionName}${escapeHTML(answerNames)}`}</h3><p class="feedback-subtitle">${correct ? "原书推荐" : `你选择了${selectedAction === "ankan" ? "暗杠" : "切"}${escapeHTML(tileName(selectedTile))}，原书推荐`}${actionName} <span class="answer-chip">${escapeHTML(answerNames)}</span>。<br>依据本书当前场况判定。${q.answerNote ? escapeHTML(q.answerNote) : ""}</p></div></div><div class="explanation-label">牌理解析</div><div class="explanation-text">${explanationHTML(q)}</div>${answerImages.length ? `<details class="answer-source"><summary>核对原书答案${q.answerPage ? ` · 第 ${escapeHTML(q.answerPage)} 页` : ""}</summary><div class="answer-images">${answerImages.map((src, i) => `<img src="${escapeHTML(src)}" alt="第 ${q.id} 题原书答案解析${answerImages.length > 1 ? `（${i + 1}）` : ""}" loading="lazy">`).join("")}</div></details>` : ""}`;
    updateSelection();
    updateStatus(q);
    renderGrid();
    updateProgress();
  }

  function selectTile(event) {
    const button = event.target.closest(".tile-button");
    if (!button || submitted) return;
    selectedTile = button.dataset.tile;
    selectedIndex = Number(button.dataset.index);
    selectedAction = "discard";
    document.querySelectorAll(".tile-button").forEach(tile => {
      const selected = Number(tile.dataset.index) === selectedIndex;
      tile.classList.toggle("selected", selected);
      tile.setAttribute("aria-pressed", String(selected));
    });
    updateSelection();
  }

  $("#question-grid").addEventListener("click", event => {
    const button = event.target.closest("[data-question]");
    if (button) goToQuestion(questions.findIndex(q => Number(q.id) === Number(button.dataset.question)), { preserveFilter: true });
  });
  $("#history-filters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    renderGrid();
  });
  $("#question-group").addEventListener("change", event => { activeGroup = event.target.value; renderGrid(); });
  $("#jump-form").addEventListener("submit", event => {
    event.preventDefault();
    const id = Number($("#jump-input").value), index = questions.findIndex(q => Number(q.id) === id);
    if (index < 0) { toast(`请输入 1–${questions.length || 300} 之间的有效题号。`); return; }
    goToQuestion(index);
    $("#jump-input").value = "";
  });
  $("#hand").addEventListener("click", selectTile);
  $("#fallback-palette").addEventListener("click", selectTile);
  $("#submit-answer").addEventListener("click", submitAnswer);
  $("#declare-kan").addEventListener("click", () => {
    if (submitted || !selectedTile) return;
    selectedAction = selectedAction === "ankan" ? "discard" : "ankan";
    updateSelection();
  });
  $("#previous-question").addEventListener("click", () => goToQuestion(currentIndex - 1));
  $("#next-question").addEventListener("click", () => goToQuestion(currentIndex + 1));
  $("#random-question").addEventListener("click", () => {
    const unseen = questions.map((q, i) => ({ q, i })).filter(({ q }) => !isDone(records[q.id]));
    const alternatives = unseen.filter(({ i }) => i !== currentIndex);
    const pool = alternatives.length ? alternatives : unseen;
    if (!pool.length) { toast("300 道题都练习过了，做得不错！可以用错题筛选继续巩固。"); return; }
    goToQuestion(pool[Math.floor(Math.random() * pool.length)].i);
  });
  $("#clear-history").addEventListener("click", () => {
    if (!Object.keys(records).length) { toast("还没有练习记录，无需清除。"); return; }
    $("#clear-dialog").returnValue = "";
    $("#clear-dialog").showModal();
  });
  $("#clear-dialog").addEventListener("close", () => {
    if ($("#clear-dialog").returnValue !== "confirm") return;
    records = {};
    saveStorage(STORAGE_KEY, records);
    if (questions.length) renderQuestion();
    toast("所有练习记录已清除，可以重新开始了。");
  });
  $("#clear-dialog").addEventListener("click", event => {
    if (event.target === $("#clear-dialog")) {
      const r = $("#clear-dialog").getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) $("#clear-dialog").close("cancel");
    }
  });
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      const next = readStorage(STORAGE_KEY, {});
      records = next && typeof next === "object" && !Array.isArray(next) ? next : {};
      updateProgress();
      renderGrid();
      if (questions.length) updateStatus(questions[currentIndex]);
    }
  });

  if (meta.sourceCredit) $("#source-credit").textContent = meta.sourceCredit;
  else if (meta.source) $("#source-credit").textContent = `题目与解析依据${meta.source}整理。`;
  if (meta.title) $(".brand-name").firstChild.textContent = meta.title;
  if (questions.length) {
    $("#jump-input").max = Math.max(...questions.map(q => Number(q.id)));
    renderQuestion();
    if (!storageWorks) toast("浏览器限制了本地存储；练习可继续，但记录可能无法保存。");
  } else {
    $(".exercise").innerHTML = '<div class="empty-state"><h2>题库还没有加载</h2><p>请确认 data.js 与本页面位于同一文件夹，<br>然后重新打开 index.html。</p></div>';
    $("#clear-history").disabled = true;
    $("#jump-input").disabled = true;
    $("#question-group").disabled = true;
  }
})();
