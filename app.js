(function () {
  "use strict";

  var MOBILE = typeof window !== "undefined" ? window.matchMedia("(max-width: 959px)") : { matches: false, addEventListener: function () {} };
  var state = {
    data: null,
    cases: [],
    query: "",
    caseId: 1,
    view: "gnosis",
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMath(text) {
    return text.replace(/\$([^$\n]+)\$/g, function (_, raw) {
      var rendered = raw;
      rendered = rendered.replace(/\\Delta\\Psi_m/g, "ΔΨₘ");
      rendered = rendered.replace(/\\text\{--\}/g, "–");
      rendered = rendered.replace(/\\rightarrow/g, "→");
      rendered = rendered.replace(/\\times/g, "×");
      rendered = rendered.replace(/\\varepsilon/g, "ε");
      rendered = rendered.replace(/\\alpha/g, "α");
      rendered = rendered.replace(/\\beta/g, "β");
      rendered = rendered.replace(/\\Delta/g, "Δ");
      rendered = rendered.replace(/\\Psi_m/g, "Ψₘ");
      rendered = rendered.replace(/\\Psi/g, "Ψ");
      rendered = rendered.replace(/\\text\{([^}]*)\}/g, "$1");
      rendered = rendered.replace(/\\mathbf\{([^}]*)\}/g, "$1");
      rendered = rendered.replace(/\\boldsymbol\{([^}]*)\}/g, "$1");
      rendered = rendered.replace(/[{}]/g, "");
      rendered = rendered.replace(/\\/g, "");
      return rendered;
    });
  }

  function stitchTable(block) {
    if (!block.length) return [];
    var expected = (block[0].match(/\|/g) || []).length;
    var joined = block
      .map(function (line) { return line.trim(); })
      .join(" ")
      .replace(/<br\s*\/?>/gi, "%%BR%%");
    var rows = [];
    var count = 0;
    var start = 0;
    for (var i = 0; i < joined.length; i += 1) {
      if (joined.charAt(i) === "|") {
        count += 1;
        if (count === expected) {
          rows.push(joined.slice(start, i + 1).trim());
          start = i + 1;
          count = 0;
        }
      }
    }
    if (joined.slice(start).trim()) rows.push(joined.slice(start).trim());
    return rows;
  }

  function repairTables(text) {
    var lines = text.split("\n");
    var out = [];
    var i = 0;
    while (i < lines.length) {
      if (!lines[i].trim().startsWith("|")) {
        out.push(lines[i]);
        i += 1;
        continue;
      }
      var block = [];
      while (i < lines.length) {
        var trimmed = lines[i].trim();
        if (trimmed.startsWith("|") || trimmed.startsWith("<br")) {
          block.push(lines[i]);
          i += 1;
          continue;
        }
        if (trimmed === "") {
          var j = i + 1;
          while (j < lines.length && lines[j].trim() === "") j += 1;
          if (j < lines.length && (lines[j].trim().startsWith("|") || lines[j].trim().startsWith("<br"))) {
            i += 1;
            continue;
          }
        }
        break;
      }
      out = out.concat(stitchTable(block));
    }
    return out.join("\n");
  }

  function preprocess(source) {
    var text = String(source).replace(/\r\n/g, "\n");
    text = text.replace(/(^|[^*])\*TLDR:\*\*/g, "$1**TLDR:**");
    text = renderMath(text);
    text = repairTables(text);
    return text;
  }

function renderInline(text) {
  var html = "";
  var i = 0;
  while (i < text.length) {
    if (text.substr(i, 6) === "%%BR%%") {
      html += "<br>";
      i += 6;
      var extra = text.slice(i).match(/^(?:\s*%%BR%%)+/);
      if (extra) i += extra[0].length;
      continue;
    }
    var link = text.slice(i).match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    if (link) {
      html += '<a href="' + escapeHtml(link[2]) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(link[1]) + "</a>";
      i += link[0].length;
      continue;
    }
    if (text.substr(i, 2) === "**") {
      var endBold = text.indexOf("**", i + 2);
      var lineBreak = text.indexOf("\n", i + 2);
      if (endBold !== -1 && (lineBreak === -1 || endBold < lineBreak)) {
        html += "<strong>" + renderInline(text.slice(i + 2, endBold)) + "</strong>";
        i = endBold + 2;
        continue;
      }
    }
    if (text.charAt(i) === "*" && text.charAt(i + 1) !== "*") {
      var endItalic = text.indexOf("*", i + 1);
      var italicBreak = text.indexOf("\n", i + 1);
      if (endItalic !== -1 && (italicBreak === -1 || endItalic < italicBreak) && text.charAt(endItalic + 1) !== "*") {
        html += "<em>" + escapeHtml(text.slice(i + 1, endItalic)) + "</em>";
        i = endItalic + 1;
        continue;
      }
    }
    var url = text.slice(i).match(/^https?:\/\/[^\s<]+/);
    if (url && (i === 0 || /[\s(]/.test(text.charAt(i - 1)))) {
      var clean = url[0].replace(/[),.;:]+$/, "");
      html += '<a href="' + escapeHtml(clean) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(clean) + "</a>";
      i += clean.length;
      continue;
    }
    html += escapeHtml(text.charAt(i));
    i += 1;
  }
  return html;
}

  function isListItem(line) {
    return /^(\s*)([-*+]|\d+\.)\s+/.test(line);
  }

  function indentOf(line) {
    var match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  function isOrderedItem(line) {
    return /^\s*\d+\.\s+/.test(line);
  }

  function readList(lines, start, baseIndent) {
    var ordered = isOrderedItem(lines[start]);
    var items = [];
    var i = start;
    while (i < lines.length) {
      if (lines[i].trim() === "") {
        var look = i + 1;
        while (look < lines.length && lines[look].trim() === "") look += 1;
        if (
          look < lines.length &&
          isListItem(lines[look]) &&
          indentOf(lines[look]) >= baseIndent &&
          isOrderedItem(lines[look]) === ordered
        ) {
          i = look;
          continue;
        }
        break;
      }
      if (!isListItem(lines[i]) || indentOf(lines[i]) < baseIndent || isOrderedItem(lines[i]) !== ordered) break;
      if (indentOf(lines[i]) > baseIndent) break;
      var match = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
      i += 1;
      var nested = "";
      if (i < lines.length && isListItem(lines[i]) && indentOf(lines[i]) > match[1].length) {
        var child = readList(lines, i, indentOf(lines[i]));
        nested = child.html;
        i = child.next;
      }
      items.push("<li>" + renderInline(match[3]) + nested + "</li>");
    }
    var tag = ordered ? "ol" : "ul";
    return { html: "<" + tag + ">" + items.join("") + "</" + tag + ">", next: i };
  }

  function splitCells(row) {
    return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (cell) {
      return cell.trim();
    });
  }

  function readTable(lines, start) {
    var rows = [];
    var i = start;
    while (i < lines.length && lines[i].trim().startsWith("|")) {
      rows.push(splitCells(lines[i]));
      i += 1;
    }
    if (!rows.length) return { html: "", next: i };
    var header = null;
    var body = rows;
    if (rows.length > 1 && rows[1].every(function (cell) { return /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")); })) {
      header = rows[0];
      body = rows.slice(2);
    }
    var html = '<div class="table-scroll" tabindex="0"><table>';
    if (header) {
      html += "<thead><tr>" + header.map(function (cell) {
        return "<th>" + renderInline(cell) + "</th>";
      }).join("") + "</tr></thead>";
    }
    html += "<tbody>" + body.map(function (row) {
      return "<tr>" + row.map(function (cell) {
        return "<td>" + renderInline(cell) + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody></table></div>";
    return { html: html, next: i };
  }

  function readFence(lines, start) {
    var i = start + 1;
    var body = [];
    while (i < lines.length && lines[i].trim() !== "```") {
      body.push(lines[i]);
      i += 1;
    }
    if (i < lines.length && lines[i].trim() === "```") i += 1;
    return { html: "<pre><code>" + escapeHtml(body.join("\n")) + "</code></pre>", next: i };
  }

  function renderHeading(line) {
    var match = line.match(/^(#{2,6})\s+(.*)$/);
    var tag = "h" + Math.min(match[1].length + 3, 6);
    return "<" + tag + ">" + renderInline(match[2].trim()) + "</" + tag + ">";
  }

  function renderMarkdown(source) {
    var lines = preprocess(source).split("\n");
    var html = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (line.trim() === "") {
        i += 1;
        continue;
      }
      if (line.trim().startsWith("```")) {
        var fence = readFence(lines, i);
        html.push(fence.html);
        i = fence.next;
        continue;
      }
      if (/^#{2,6}\s+/.test(line)) {
        html.push(renderHeading(line));
        i += 1;
        continue;
      }
      if (/^\s*---\s*$/.test(line)) {
        html.push("<hr>");
        i += 1;
        continue;
      }
      if (line.trim().startsWith("|")) {
        var table = readTable(lines, i);
        html.push(table.html);
        i = table.next;
        continue;
      }
      if (isListItem(line)) {
        var list = readList(lines, i, indentOf(line));
        html.push(list.html);
        i = list.next;
        continue;
      }
      html.push("<p>" + renderInline(line.trim()) + "</p>");
      i += 1;
    }
    return html.join("\n");
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      var url = new URL(value, window.location.href);
      if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") return url.href;
    } catch (error) {
      return "";
    }
    return "";
  }

  function $(id) {
    return document.getElementById(id);
  }

  function showToast(message) {
    var toast = $("toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  function copyText(text, success) {
    var done = function () { showToast(success); };
    var failed = function () { showToast("Could not copy. Select the text and copy it manually."); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallbackCopy(text, done, failed);
      });
      return;
    }
    fallbackCopy(text, done, failed);
  }

  function fallbackCopy(text, done, failed) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    try {
      if (document.execCommand("copy")) done();
      else failed();
    } catch (error) {
      failed();
    }
    document.body.removeChild(area);
  }

  function filteredCases() {
    var query = state.query.trim().toLowerCase();
    if (!query) {
      return state.cases.map(function (item) { return { item: item, where: "" }; });
    }
    return state.cases.reduce(function (matches, item) {
      var title = item.title.toLowerCase();
      var question = item.question.toLowerCase();
      var responses = (item.gnosis + "\n" + item.gemini).toLowerCase();
      if (title.indexOf(query) !== -1 || question.indexOf(query) !== -1) {
        matches.push({ item: item, where: "" });
      } else if (responses.indexOf(query) !== -1) {
        matches.push({ item: item, where: "Matches response text" });
      }
      return matches;
    }, []);
  }

  function renderCaseList() {
    var list = $("case-list");
    var matches = filteredCases();
    var empty = $("empty-search");
    var status = $("search-status");
    list.innerHTML = "";
    matches.forEach(function (match) {
      var item = match.item;
      var li = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "case-link";
      button.setAttribute("data-case", String(item.id));
      if (item.id === state.caseId) button.setAttribute("aria-current", "true");
      var number = document.createElement("span");
      number.className = "num";
      number.textContent = String(item.id).padStart(2, "0");
      var name = document.createElement("span");
      name.className = "name";
      name.textContent = item.title;
      button.appendChild(number);
      button.appendChild(name);
      if (match.where) {
        var note = document.createElement("span");
        note.className = "match-note";
        note.textContent = match.where;
        button.appendChild(note);
      }
      button.addEventListener("click", function () {
        selectCase(item.id, { history: "push", scroll: true });
      });
      li.appendChild(button);
      list.appendChild(li);
    });

    var query = state.query.trim();
    list.classList.toggle("is-open", MOBILE.matches && query.length > 0);
    empty.hidden = !(query && matches.length === 0);
    if (!query) status.textContent = "";
    else if (matches.length === 0) status.textContent = "No matches.";
    else status.textContent = matches.length + (matches.length === 1 ? " match." : " matches.");

    var select = $("case-select");
    var currentValue = String(state.caseId);
    select.innerHTML = "";
    state.cases.forEach(function (item) {
      var option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = item.id + ". " + item.title;
      select.appendChild(option);
    });
    select.value = currentValue;
  }

  function fillOutline(container, outline, prefix) {
    var headings = container.querySelectorAll("h5, h6");
    outline.innerHTML = "";
    if (headings.length < 3) {
      outline.hidden = true;
      return;
    }
    var summary = document.createElement("summary");
    summary.textContent = "Sections in this response";
    var list = document.createElement("ol");
    Array.prototype.forEach.call(headings, function (heading, index) {
      heading.id = prefix + "-section-" + (index + 1);
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.href = "#" + heading.id;
      link.textContent = heading.textContent;
      li.appendChild(link);
      list.appendChild(li);
    });
    outline.hidden = false;
    outline.appendChild(summary);
    outline.appendChild(list);
  }

  function renderResponses(item) {
    var gnosis = $("gnosis-body");
    var gemini = $("gemini-body");
    gnosis.innerHTML = renderMarkdown(item.gnosis);
    gemini.innerHTML = renderMarkdown(item.gemini);
    fillOutline(gnosis, $("gnosis-outline"), "gnosis-" + item.id);
    fillOutline(gemini, $("gemini-outline"), "gemini-" + item.id);
  }

  function neighbor(direction) {
    var index = state.cases.findIndex(function (item) { return item.id === state.caseId; });
    return state.cases[index + direction] || null;
  }

  function updatePager() {
    var previous = neighbor(-1);
    var next = neighbor(1);
    ["prev-case", "prev-case-bottom"].forEach(function (id) {
      var button = $(id);
      button.disabled = !previous;
      button.textContent = "Previous";
      button.setAttribute("aria-label", previous ? "Previous use case: " + previous.title : "Previous use case");
    });
    ["next-case", "next-case-bottom"].forEach(function (id) {
      var button = $(id);
      button.disabled = !next;
      button.textContent = "Next";
      button.setAttribute("aria-label", next ? "Next use case: " + next.title : "Next use case");
    });
  }

  function syncPanels() {
    var mobile = MOBILE.matches;
    document.body.dataset.layout = mobile ? "mobile" : "desktop";
    ["gnosis", "gemini"].forEach(function (key) {
      var panel = $("panel-" + key);
      var tab = $("tab-" + key);
      var show = !mobile || state.view === "both" || state.view === key;
      panel.hidden = !show;
      if (tab) {
        var selected = state.view === key;
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
      }
    });
    var both = $("tab-both");
    var bothSelected = state.view === "both";
    both.setAttribute("aria-selected", bothSelected ? "true" : "false");
    both.tabIndex = bothSelected ? 0 : -1;
    if (!mobile) {
      $("panel-gnosis").hidden = false;
      $("panel-gemini").hidden = false;
    }
  }

  function writeUrl(id, mode) {
    var url = new URL(window.location.href);
    url.searchParams.set("case", String(id));
    if (mode === "push") history.pushState({ caseId: id }, "", url);
    else if (mode === "replace") history.replaceState({ caseId: id }, "", url);
  }

  function selectCase(id, options) {
    options = options || {};
    var item = state.cases.find(function (candidate) { return candidate.id === id; });
    if (!item) return;
    var changed = item.id !== state.caseId || options.force;
    state.caseId = item.id;
    $("case-number").textContent = String(item.id);
    $("case-total").textContent = String(state.cases.length);
    $("case-title").textContent = item.title;
    $("case-question").textContent = item.question;
    document.title = "Use case " + item.id + ": " + item.title + " — GNOSIS | AI Comparison";
    $("case-live").textContent = "Showing use case " + item.id + ", " + item.title;
    if (changed) renderResponses(item);
    renderCaseList();
    updatePager();
    syncPanels();
    if (options.history) writeUrl(item.id, options.history);
    var current = document.querySelector('.case-link[aria-current="true"]');
    var nav = document.querySelector(".case-nav");
    if (current && nav && !MOBILE.matches && nav.scrollHeight > nav.clientHeight + 8) {
      var navTop = nav.getBoundingClientRect().top;
      var linkTop = current.getBoundingClientRect().top;
      var linkBottom = current.getBoundingClientRect().bottom;
      var navBottom = nav.getBoundingClientRect().bottom;
      if (linkTop < navTop || linkBottom > navBottom) {
        nav.scrollTop += linkTop < navTop ? linkTop - navTop - 8 : linkBottom - navBottom + 8;
      }
    }
    if (options.scroll) {
      var card = $("question-card");
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  function readCaseId() {
    var value = parseInt(new URLSearchParams(window.location.search).get("case"), 10);
    if (state.cases.some(function (item) { return item.id === value; })) return value;
    return state.cases.length ? state.cases[0].id : 1;
  }

  function setView(view) {
    state.view = view;
    syncPanels();
  }

  function moveTab(step) {
    var order = ["gnosis", "gemini", "both"];
    var index = order.indexOf(state.view);
    var next = order[(index + step + order.length) % order.length];
    setView(next);
    $("tab-" + next).focus();
  }

  function syncHeaderHeight() {
    var header = document.querySelector(".site-header");
    if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var dark = theme === "dark";
    $("theme-toggle").setAttribute("aria-pressed", dark ? "true" : "false");
    $("theme-label").textContent = dark ? "Light mode" : "Dark mode";
    try { localStorage.setItem("gnosis-theme", theme); } catch (error) { /* storage may be blocked */ }
  }

  function loadIntroVideo(button) {
    var frame = document.createElement("iframe");
    frame.src = "https://www.youtube-nocookie.com/embed/sHaHzk2zHg4?start=1&autoplay=1";
    frame.title = "GNOSIS introductory video";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.allowFullscreen = true;
    button.replaceWith(frame);
  }

  function fillStatic(data) {
    $("case-count").textContent = String(data.useCases.length);
    var sourceContext = $("source-context");
    if (sourceContext) sourceContext.textContent = data.source.context;
    var bibliography = $("bibliography");
    if (bibliography) {
      bibliography.innerHTML = "";
      data.source.bibliography.forEach(function (entry) {
        var li = document.createElement("li");
        li.textContent = entry;
        bibliography.appendChild(li);
      });
    }
    $("gnosis-label").textContent = data.models.gnosis.responseLabel;
    $("gemini-label").textContent = data.models.gemini.responseLabel;
    $("gnosis-role").textContent = data.models.gnosis.role;
    $("gemini-role").textContent = data.models.gemini.role;
    $("gemini-method-label").textContent = data.models.gemini.responseLabel;
    var video = safeUrl(data.videoUrl);
    var videoLink = $("video-link");
    if (video && videoLink) videoLink.href = video;
    var collab = safeUrl(data.collaborationUrl);
    var action = $("collab-action");
    action.innerHTML = "";
    if (collab) {
      var link = document.createElement("a");
      link.className = "button";
      link.href = collab;
      link.textContent = "Interested in Collaborating?";
      if (collab.indexOf("mailto:") !== 0) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      action.appendChild(link);
    } else {
      var strong = document.createElement("strong");
      strong.textContent = "Interested in Collaborating?";
      action.appendChild(strong);
    }
  }

  function bindEvents() {
    $("case-search").addEventListener("input", function (event) {
      state.query = event.target.value;
      $("clear-search").hidden = state.query.length === 0;
      renderCaseList();
    });
    function clearSearch() {
      state.query = "";
      $("case-search").value = "";
      $("clear-search").hidden = true;
      renderCaseList();
      $("case-search").focus();
    }
    $("clear-search").addEventListener("click", clearSearch);
    $("empty-clear").addEventListener("click", clearSearch);
    $("case-select").addEventListener("change", function (event) {
      selectCase(parseInt(event.target.value, 10), { history: "push", scroll: true });
    });
    $("prev-case").addEventListener("click", function () { var item = neighbor(-1); if (item) selectCase(item.id, { history: "push", scroll: true }); });
    $("next-case").addEventListener("click", function () { var item = neighbor(1); if (item) selectCase(item.id, { history: "push", scroll: true }); });
    $("prev-case-bottom").addEventListener("click", function () { var item = neighbor(-1); if (item) selectCase(item.id, { history: "push", scroll: true }); });
    $("next-case-bottom").addEventListener("click", function () { var item = neighbor(1); if (item) selectCase(item.id, { history: "push", scroll: true }); });
    $("copy-question").addEventListener("click", function () {
      var item = state.cases.find(function (candidate) { return candidate.id === state.caseId; });
      copyText(item.question, "Question copied");
    });
    $("copy-gnosis").addEventListener("click", function () {
      var item = state.cases.find(function (candidate) { return candidate.id === state.caseId; });
      copyText(item.gnosis, "GNOSIS response copied");
    });
    $("copy-gemini").addEventListener("click", function () {
      var item = state.cases.find(function (candidate) { return candidate.id === state.caseId; });
      copyText(item.gemini, "Gemini response copied");
    });
    $("share-case").addEventListener("click", function () {
      writeUrl(state.caseId, "replace");
      copyText(window.location.href, "Link copied");
    });
    document.querySelectorAll("[role='tab']").forEach(function (tab) {
      tab.addEventListener("click", function () {
        setView(tab.id.replace("tab-", ""));
      });
      tab.addEventListener("keydown", function (event) {
        if (event.key === "ArrowRight") { event.preventDefault(); moveTab(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); moveTab(-1); }
        if (event.key === "Home") { event.preventDefault(); setView("gnosis"); $("tab-gnosis").focus(); }
        if (event.key === "End") { event.preventDefault(); setView("both"); $("tab-both").focus(); }
      });
    });
    $("nav-toggle").addEventListener("click", function () {
      var nav = $("site-nav");
      var open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      $("nav-toggle").setAttribute("aria-expanded", open ? "true" : "false");
      syncHeaderHeight();
    });
    $("site-nav").addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        $("site-nav").classList.remove("is-open");
        $("nav-toggle").setAttribute("aria-expanded", "false");
        syncHeaderHeight();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && $("site-nav").classList.contains("is-open")) {
        $("site-nav").classList.remove("is-open");
        $("nav-toggle").setAttribute("aria-expanded", "false");
        $("nav-toggle").focus();
        syncHeaderHeight();
      }
    });
    var playVideo = $("play-video");
    if (playVideo) {
      playVideo.addEventListener("click", function () {
        loadIntroVideo(playVideo);
      });
    }
    $("theme-toggle").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
    });
    window.addEventListener("popstate", function () {
      selectCase(readCaseId(), { history: null, scroll: true, force: true });
    });
    MOBILE.addEventListener("change", function () {
      renderCaseList();
      syncPanels();
      syncHeaderHeight();
    });
    window.addEventListener("resize", syncHeaderHeight);
    window.addEventListener("beforeprint", function () {
      $("panel-gnosis").hidden = false;
      $("panel-gemini").hidden = false;
    });
    window.addEventListener("afterprint", syncPanels);
  }

  function boot() {
    if (typeof document === "undefined") return;
    applyTheme(document.documentElement.getAttribute("data-theme") || "light");
    bindEvents();
    syncHeaderHeight();
    fetch("./use-cases.json")
      .then(function (response) {
        if (!response.ok) throw new Error("Could not load use cases");
        return response.json();
      })
      .then(function (data) {
        state.data = data;
        state.cases = data.useCases.slice().sort(function (a, b) { return a.id - b.id; });
        fillStatic(data);
        var requested = new URLSearchParams(window.location.search).get("case");
        var id = readCaseId();
        var hadInvalid = requested && String(id) !== String(parseInt(requested, 10));
        selectCase(id, { history: requested ? "replace" : null, scroll: Boolean(requested), force: true });
        if (hadInvalid) showToast("That use case was not found. Showing use case " + id + ".");
      })
      .catch(function () {
        $("case-title").textContent = "The comparisons could not be loaded.";
        $("case-question").textContent = "Check that use-cases.json is available next to this page, then reload.";
      });
  }

  var api = { renderMarkdown: renderMarkdown, renderMath: renderMath };
  if (typeof globalThis !== "undefined") globalThis.GNOSISCompare = api;
  if (typeof document !== "undefined") boot();
})();
