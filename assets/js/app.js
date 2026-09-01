(() => {
  const D = window.GW_DATA;
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = "good_weather_v2";
  function selectStore() {
    for (const name of ["localStorage", "sessionStorage"]) {
      try {
        const store = window[name];
        const probe = `${KEY}_probe`;
        store.setItem(probe, "1");
        store.removeItem(probe);
        return store;
      } catch {
        // Continue to the next browser-supported store.
      }
    }
    const memory = (() => {
      try {
        return JSON.parse(window.name || "{}")?.goodWeatherStore || {};
      } catch {
        return {};
      }
    })();
    return {
      getItem: (key) => memory[key] ?? null,
      setItem: (key, value) => {
        memory[key] = value;
        window.name = JSON.stringify({ goodWeatherStore: memory });
      },
      removeItem: (key) => {
        delete memory[key];
        window.name = JSON.stringify({ goodWeatherStore: memory });
      },
    };
  }
  const STORE = selectStore();
  let S;
  try {
    S = JSON.parse(STORE.getItem(KEY) || "{}");
  } catch {
    S = {};
  }
  S.visits = S.visits || [];
  S.read = S.read || [];
  S.searches = S.searches || [];
  S.history = S.history || [];
  S.tabs = S.tabs || [];
  const save = () => {
    try {
      STORE.setItem(KEY, JSON.stringify(S));
    } catch {
      // Browsing stays playable even when private-mode storage is exhausted.
    }
  };
  function esc(x = "") {
    return String(x).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );
  }
  function qs(k) {
    return new URLSearchParams(location.search).get(k);
  }
  function norm(x = "") {
    return String(x)
      .toLowerCase()
      .normalize("NFKC")
      .replace(
        /(\d{4})年0?(\d{1,2})月/g,
        (_, y, m) => y + String(m).padStart(2, "0"),
      )
      .replace(
        /(\d{1,2})月(\d{1,2})[日号]?/g,
        (_, m, d) => String(m).padStart(2, "0") + String(d).padStart(2, "0"),
      )
      .replace(/[^\p{L}\p{N}]+/gu, "");
  }
  const page = () => document.body.dataset.page;
  function rich(x = "") {
    return esc(x);
  }
  let narrativeCache;
  function narrative() {
    if (narrativeCache) return narrativeCache;
    try {
      const bytes = Uint8Array.from(atob(D.narrativePayload || ""), (c) =>
        c.charCodeAt(0),
      );
      narrativeCache = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      narrativeCache = { manifest: [], endings: {} };
    }
    return narrativeCache;
  }
  function nightRows() {
    return [...D.nightpost.manifest, ...(narrative().manifest || [])];
  }
  function deepRecord() {
    return (narrative().manifest || []).find((x) => x.current);
  }
  function withinOneEdit(haystack, needle) {
    if (haystack.includes(needle)) return true;
    if (needle.length < 4) return false;
    const min = Math.max(2, needle.length - 1);
    const max = needle.length + 1;
    for (let size = min; size <= max; size++) {
      for (let i = 0; i + size <= haystack.length; i++) {
        const part = haystack.slice(i, i + size);
        let a = 0,
          b = 0,
          edits = 0;
        while (a < part.length && b < needle.length) {
          if (part[a] === needle[b]) {
            a++;
            b++;
          } else if (++edits > 1) break;
          else if (part.length > needle.length) a++;
          else if (part.length < needle.length) b++;
          else {
            a++;
            b++;
          }
        }
        edits += part.length - a + (needle.length - b);
        if (edits <= 1) return true;
      }
    }
    return false;
  }
  function queryTerms(q = "") {
    const raw = String(q).trim();
    if (!raw) return [];
    const n = norm(raw),
      found = [];
    const concepts = [
      ["林沅", ["林沅", "小沅"]],
      ["海隅生活", ["海隅生活", "暑期旅行专题", "暑期专题"]],
      ["远岸内容合作中心", ["远岸内容合作中心", "远岸内容", "远岸"]],
      ["栖岸", ["栖岸", "栖岸项目", "旅游项目"]],
      ["白潮酒店", ["白潮酒店", "白潮"]],
      ["梁昭", ["梁昭", "梁老师"]],
      ["提前返程", ["提前返程", "提前离团", "返程"]],
      ["航班", ["航班", "机场"]],
      ["NIGHTPOST", ["nightpost", "夜间物流", "夜间供应商", "酒店供应商"]],
      ["拾味", ["拾味", "拾味餐桌"]],
      ["余味", ["余味", "余味席"]],
      ["许萌", ["许萌"]],
      ["陈可", ["陈可"]],
      ["韩译", ["韩译", "韩领队"]],
      ["后勤", ["后勤"]],
      ["供应商", ["供应商", "外包"]],
      ["退房", ["退房", "离店"]],
      ["DAY5", ["day5", "第五天"]],
      ["B2", ["b2"]],
      ["LY", ["ly"]],
      ["LZ", ["lz"]],
      ["XM", ["xm"]],
      ["CK", ["ck"]],
    ];
    for (const [canon, phrases] of concepts)
      if (phrases.some((x) => n.includes(norm(x)))) found.push(norm(canon));
    if (found.length) return [...new Set(found)];
    const stop = new Set(
      [
        "为什么",
        "怎么",
        "怎样",
        "哪里",
        "谁",
        "是什么",
        "有没有",
        "到底",
        "了吗",
        "什么",
        "相关",
        "信息",
        "查",
        "搜索",
        "一下",
        "回事",
      ].map(norm),
    );
    const parts = raw
      .split(/[\s,，、/？！?!.。]+/)
      .filter(Boolean)
      .map(
        (x) => D.searchAliases?.[x.toLowerCase()] || D.searchAliases?.[x] || x,
      )
      .map(norm)
      .filter((x) => x && !stop.has(x));
    return parts.length ? parts : [norm(raw)];
  }
  function visit(k) {
    if (!S.visits.includes(k)) S.visits.push(k);
    const u =
        (location.pathname.split("/").pop() || "index.html") +
        (location.search || ""),
      pg = page(),
      title = (typeof titles !== "undefined" && titles[pg]) || "网页";
    const h = { u, t: title, p: pg };
    S.history = [h, ...S.history.filter((x) => x.u !== u)].slice(0, 12);
    S.tabs = [
      ...S.tabs.filter((x) => x.p !== pg),
      { p: pg, u, t: title },
    ].slice(-6);
    save();
  }
  const PHOTO = {
    windows: "assets/img/window-memory.webp",
    luggage: "assets/img/luggage-duck.webp",
    qian: "assets/img/forum-market.webp",
    hotel: "assets/img/hotel-front.webp",
    pool: "assets/img/hotel-pool.webp",
    back: "assets/img/hotel-back.webp",
    food: "assets/img/menu-lunch.webp",
    supper: "assets/img/menu-night.webp",
    flight: "assets/img/airport-wing.webp",
    cold: "assets/img/nightpost-cold.webp",
    "room-712-incident": "assets/img/room-712-incident.webp",
    "b2-corridor-incident": "assets/img/b2-corridor-incident.webp",
    "nightpost-handover": "assets/img/nightpost-handover.webp",
    "window-day2": "assets/img/window-day2.webp",
    "coast-workshop.jpg": "assets/img/coast-workshop.webp",
    "forum-market.jpg": "assets/img/forum-market.webp",
    "hotel-pool.jpg": "assets/img/hotel-pool.webp",
    "dessert-menu.jpg": "assets/img/dessert-menu.webp",
    "hotel-room-city": "assets/img/hotel-room-city.webp",
    "hotel-room-courtyard": "assets/img/hotel-room-courtyard.webp",
    "hotel-room-sea-twin": "assets/img/hotel-room-sea-twin-v2.webp",
    "hotel-room-sea-queen": "assets/img/hotel-room-sea-queen.webp",
    "hotel-room-family": "assets/img/hotel-room-family.webp",
    "hotel-room-studio": "assets/img/hotel-room-studio-v2.webp",
    "hotel-room-accessible": "assets/img/hotel-room-accessible-v2.webp",
    "life-summer": "assets/img/life-summer.webp",
  };
  const PHOTO_ALT = {
    windows: "林沅共享相册中的酒店窗景",
    luggage: "玄关里的黄色行李箱与小鸭挂件",
    qian: "栖岸往届活动中的夜市街景",
    hotel: "白潮酒店临海建筑与入口",
    pool: "白潮酒店黄昏泳池露台",
    back: "白潮酒店夜间后勤走廊",
    food: "拾味餐桌白天的餐桌与菜品",
    supper: "拾味晚场烛光餐桌",
    flight: "旅行途中从舷窗看到的夕阳云海",
    cold: "NIGHTPOST冷链仓储空间",
    "room-712-incident":
      "白潮旧房务系统中的712房夜间附件：空房、黄色行李箱与房务车",
    "b2-corridor-incident":
      "白潮旧房务系统中的B2后勤附件：带约束带的服务车、湿轮迹与开启的货梯",
    "nightpost-handover":
      "NIGHTPOST交接附件：黄色行李箱与封闭转运袋同时停在夜间货台",
    "window-day2": "DAY2老城民宿窗外的海与街区",
    "coast-workshop.jpg": "旅友圈用户上传的海岸街区摄影返图",
    "forum-market.jpg": "旅友圈用户上传的旧城街道旅行照片",
    "hotel-pool.jpg": "旅友圈用户上传的酒店泳池黄昏返图",
    "dessert-menu.jpg": "旅友圈用户上传的拾味甜品返图",
    "hotel-room-city": "白潮酒店城市侧标准双床房",
    "hotel-room-courtyard": "白潮酒店庭院大床房",
    "hotel-room-sea-twin": "白潮酒店海景标准双床房",
    "hotel-room-sea-queen": "白潮酒店海景大床房",
    "hotel-room-family": "白潮酒店家庭套房",
    "hotel-room-studio": "白潮酒店长住单间",
    "hotel-room-accessible": "白潮酒店无障碍大床房",
    "life-summer": "海隅生活暑期旅行专题的海岸旅居配图",
  };
  function photo(key, cls = "site-photo") {
    if (!PHOTO[key]) return "";
    const image = `<img class="${cls}" src="${PHOTO[key]}" alt="${esc(PHOTO_ALT[key])}" loading="lazy" onerror="this.closest('figure').classList.add('photo-error')">`,
      inspectable =
        cls.includes("incident") ||
        cls.includes("handover") ||
        cls.includes("ending-photo");
    return `<figure class="photo-frame">${inspectable ? `<a class="attachment-open" href="${PHOTO[key]}" target="_blank" rel="noopener" aria-label="查看原始附件：${esc(PHOTO_ALT[key])}">${image}</a>` : image}<figcaption>${esc(PHOTO_ALT[key])}</figcaption></figure>`;
  }

  const host = {
    index: "mail.youji.me",
    life: "www.haiyulife.cn",
    qian: "www.qiancoast.travel",
    "qian-archive": "account.qiancoast.travel",
    forum: "www.travelers-circle.net",
    hotel: "www.baytidehotel.com",
    restaurant: "www.shiwei-table.com",
    news: "www.baymorning.news",
    insurance: "my.antutravelcare.com",
    nightpost: "www.nightpost-logistics.com",
    "nightpost-query": "legacy.nightpost-logistics.com",
    search: "www.haiyu-search.net",
    ending: "session.haiyu-search.net",
    404: "www.haiyu-search.net",
  };
  const titles = {
    index: "邮迹",
    life: "海隅生活",
    qian: "栖岸青年旅居",
    "qian-archive": "栖岸订单中心",
    forum: "旅友圈",
    hotel: "BAY TIDE 白潮酒店",
    restaurant: "拾味餐桌",
    news: "海湾晨报",
    insurance: "安途旅保",
    nightpost: "NIGHTPOST",
    "nightpost-query": "NIGHTPOST Legacy",
    search: "海隅搜索",
    ending: "一路好天气",
    404: "页面未找到",
  };
  function currentUrl() {
    const f = location.pathname.split("/").pop() || "index.html";
    return `https://${host[page()] || host.search}/${f}${location.search || ""}`;
  }
  function browser() {
    const hist = (S.history || []).slice(1, 7),
      tabs = (S.tabs || []).slice(-6);
    return `<div class="browser-chrome"><div class="browser-tabs">${tabs.map((x) => `<a class="browser-tab ${x.p === page() ? "active" : ""}" href="${x.u}" data-browser-tab="1"><span>${esc(x.t)}</span>${x.p === page() ? "<i></i>" : ""}</a>`).join("")}<span class="browser-plus" title="新标签页">＋</span></div><div class="browser-toolbar"><button class="browser-control" id="browserBack" aria-label="后退">‹</button><button class="browser-control" id="browserForward" aria-label="前进">›</button><button class="browser-control" id="browserReload" aria-label="刷新">↻</button><div class="address-bar"><span class="lockmark">▣</span><span>${esc(currentUrl())}</span></div><details class="browser-history"><summary>历史</summary><div>${hist.length ? hist.map((x) => `<a href="${x.u}"><b>${esc(x.t)}</b><span>${esc(x.u)}</span></a>`).join("") : "<span>暂无最近浏览</span>"}</div></details><a class="browser-search-link" href="search.html" aria-label="搜索网页">⌕</a><form id="chromeSearch" class="chrome-search"><input id="globalQ" aria-label="全站搜索" value="${esc(qs("q") || "")}" placeholder="搜索网页"><button>搜索</button></form></div></div>`;
  }
  function targetPage(href = "") {
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("javascript:")
    )
      return null;
    try {
      if (/^https?:/i.test(href)) return "external";
      const f =
        href.split("#")[0].split("?")[0].split("/").pop() || "index.html";
      return f.replace(/\.html$/, "") || "index";
    } catch {
      return null;
    }
  }
  function decorateLinks() {
    $$("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "",
        dest = targetPage(href);
      if (!dest) return;
      if (a.dataset.browserTab === "1") return;
      if (dest === "external") {
        a.target = "_blank";
        a.rel = "noopener";
        a.classList.add("real-external-link");
        a.title = a.title || "打开外部网站";
        return;
      }
      const cross = host[dest] && host[dest] !== host[page()];
      if (cross) {
        a.classList.add("external-link");
        a.title = a.title || "在游戏浏览器的新标签页打开";
        a.addEventListener("click", () => {
          const u = href,
            t = titles[dest] || dest;
          S.tabs = [
            ...S.tabs.filter((x) => x.p !== dest),
            { p: dest, u, t },
          ].slice(-6);
          save();
        });
      }
    });
  }
  function header() {
    const p = page();
    if (p === "index")
      return `<header class="mail-appbar"><a class="mail-logo" href="index.html"><span class="logo-square">邮</span><b>邮迹</b></a><div class="mail-app-search">搜索邮件、发件人或附件</div><div class="mail-user"><span>周宁</span><span class="avatar">周</span></div></header>`;
    if (p === "qian" || p === "qian-archive")
      return `<header class="qian-header"><div class="qian-top"><span>栖岸青年旅居 · 夏末特别期</span><span>客服 08:00—23:30</span></div><div class="qian-nav"><a class="qian-wordmark" href="qian.html"><b>栖岸</b><small>QIAN COASTAL RESIDENCY</small></a><nav><a href="qian.html?view=route">九日路线</a><a href="qian.html?view=price">费用</a><a href="qian.html?view=partners">合作服务</a><a href="forum.html">旅友圈</a><a href="qian.html?view=faq">常见问题</a></nav><a class="qian-account" href="qian-archive.html">订单查询</a></div></header>`;
    if (p === "life")
      return `<header class="life-header"><div class="life-topline"><span>海隅 · 生活方式与城市内容</span><span>2026 / SUMMER</span></div><div class="life-nav"><a class="life-logo" href="life.html">海隅生活<small>HAIYU LIFE</small></a><nav><a href="life.html?section=旅行">旅行</a><a href="life.html?section=城市">城市</a><a href="life.html?section=餐桌">餐桌</a><a href="life.html?section=工作">工作</a><a href="life.html?section=摄影">摄影</a></nav><span class="life-member">收藏夹 · 周宁</span></div></header>`;
    if (p === "forum")
      return `<header class="forum-header"><a class="forum-logo" href="forum.html">旅友圈 <small>TRAVELERS CIRCLE</small></a><div class="forum-search">搜索帖子 / 作者</div><nav><a href="forum.html">广场</a><a href="forum.html?tag=攻略">攻略</a><a href="forum.html?tag=酒店">酒店</a><a href="forum.html?tag=餐饮">餐饮</a></nav></header>`;
    if (p === "hotel")
      return `<header class="hotel-header"><div class="hotel-brand"><a href="hotel.html"><span>BAY TIDE</span><b>白潮酒店</b></a><small>COAST DISTRICT · GROUP & LEISURE STAY</small></div><nav><a href="hotel.html?view=service">客房与设施</a><a href="hotel.html?view=reviews">住客评价</a><a href="hotel.html?view=group">团体入住</a><a href="hotel.html?view=privacy">住客服务</a></nav><a class="hotel-book" href="hotel.html?view=group">查询订单</a></header>`;
    if (p === "restaurant")
      return `<header class="food-header"><a class="food-mark" href="restaurant.html"><span>拾味</span><small>SHIWEI TABLE</small></a><nav><a href="restaurant.html?view=menu">今日菜单</a><a href="restaurant.html?view=history">往期菜单</a><a href="restaurant.html?view=night">晚场小桌</a><a href="restaurant.html?view=comments">食客留言</a></nav><a class="food-book" href="restaurant.html?view=booking">订一张桌</a></header>`;
    if (p === "news")
      return `<header class="news-head"><div class="news-meta"><span>2026年8月20日 · 星期四</span><span>沿海版</span></div><a class="news-mast" href="news.html">海湾晨报<small>BAY MORNING</small></a><nav><a href="news.html">首页</a><a href="news.html?section=旅游">旅游</a><a href="news.html?section=社会">社会</a><a href="news.html?section=调查">调查</a><a href="news.html?section=商业">商业</a><a href="news.html?section=餐饮">餐饮</a><a href="news.html?view=tip">投稿</a></nav></header>`;
    if (p === "insurance")
      return `<header class="ins-header"><a class="ins-logo" href="insurance.html"><span class="ins-symbol">AT</span><b>安途旅保</b></a><nav><a href="insurance.html">我的保单</a><a href="insurance.html?view=safety">安全确认</a><a href="insurance.html?view=case">境外协助</a><a href="insurance.html?view=help">帮助中心</a></nav><div class="ins-account">周宁 · 紧急联系人</div></header>`;
    if (p === "nightpost" || p === "nightpost-query")
      return `<header class="np-header"><a href="nightpost.html" class="np-logo"><span>NIGHTPOST</span><small>REGIONAL LOGISTICS NETWORK</small></a><nav><a href="nightpost.html?view=service">服务能力</a><a href="nightpost-query.html">客户查询</a><span>CN / EN</span></nav></header>`;
    if (p === "search")
      return `<header class="search-head"><a href="search.html" class="search-logo">海隅</a><form id="siteSearch" class="search-box"><input id="siteQ" aria-label="搜索公开网页" value="${esc(qs("q") || "")}" placeholder="搜索网页"><button>搜索</button></form><span class="search-safe">公开网页索引</span></header>`;
    return `<header class="simple-header"><a href="index.html">《一路好天气》</a></header>`;
  }
  function footer() {
    const p = page();
    if (p === "index")
      return `<footer class="mail-footer"><span>邮迹 Webmail</span><span>隐私 · 帮助 · 账户活动</span></footer>`;
    if (p === "life")
      return `<footer class="life-footer"><div><b>海隅生活</b><p>城市 · 旅行 · 餐桌 · 文化 · 工作</p></div><div><span>商业合作标识说明</span><span>作者与更正</span><span>隐私</span></div><small>© 2026 Haiyu Life Media</small></footer>`;
    if (p === "qian" || p === "qian-archive")
      return `<footer class="qian-footer"><div><b>栖岸青年旅居</b><p>澄海国际文旅 · 青年文化体验项目</p></div><div><a href="qian.html?view=faq">常见问题</a><a href="qian.html?view=refund">退款规则</a><a href="qian.html?view=emergency">紧急情况</a></div><small>© 2026 Qian Coastal Program</small></footer>`;
    if (p === "hotel")
      return `<footer class="hotel-footer"><b>BAY TIDE HOTEL</b><span>海岸区 · 团体入住 · 前台服务</span><span>© 2026 白潮酒店</span></footer>`;
    if (p === "restaurant")
      return `<footer class="food-footer"><b>拾味餐桌</b><span>午餐 11:30—15:00 · 晚场 21:30 后</span><span>本店保留每日菜单调整权</span></footer>`;
    if (p === "news")
      return `<footer class="news-footer"><b>海湾晨报</b><span>本地新闻 · 旅游 · 商业 · 调查</span><span>编辑部材料邮箱开放中</span></footer>`;
    if (p === "insurance")
      return `<footer class="ins-footer"><span>安途旅保境外协助</span><span>24h援助中心 · 保单服务 · 隐私说明</span></footer>`;
    if (p === "nightpost" || p === "nightpost-query")
      return `<footer class="np-footer"><span>NIGHTPOST LOGISTICS</span><span>Partner Portal · Status Page · Terms</span></footer>`;
    if (p === "forum")
      return `<footer class="forum-footer"><span>旅友圈</span><span>社区规范 · 隐私 · 举报 · 联系管理员</span></footer>`;
    return `<footer class="generic-footer">《一路好天气》 · 页面记录仅保存在本设备。 <a href="#" id="resetLocal">清除浏览记录</a></footer>`;
  }
  function shell(content) {
    document.body.className = `site-${page()} page-${page()}`;
    $("#app").innerHTML =
      `${browser()}<div class="site-window">${header()}<main class="site-main">${content}</main>${footer()}</div>`;
    const doSearch = (q) => {
      if (q.trim())
        location.href = "search.html?q=" + encodeURIComponent(q.trim());
    };
    const chrome = $("#chromeSearch");
    if (chrome)
      chrome.onsubmit = (e) => {
        e.preventDefault();
        doSearch($("#globalQ").value);
      };
    const s = $("#siteSearch");
    if (s)
      s.onsubmit = (e) => {
        e.preventDefault();
        doSearch($("#siteQ").value);
      };
    const back = $("#browserBack");
    if (back)
      back.onclick = () =>
        history.length > 1 ? history.back() : (location.href = "index.html");
    const forward = $("#browserForward");
    if (forward) forward.onclick = () => history.forward();
    const reload = $("#browserReload");
    if (reload) reload.onclick = () => location.reload();
    const reset = $("#resetLocal");
    if (reset)
      reset.onclick = (e) => {
        e.preventDefault();
        if (confirm("清除本地浏览记录并重新开始？")) {
          STORE.removeItem(KEY);
          location.href = "index.html";
        }
      };
    decorateLinks();
  }
  function fileIcon(kind, label) {
    return `<span class="file-icon ${kind}">${label}</span>`;
  }
  function mailNav(active = "inbox") {
    const items = [
      ["inbox", "收件箱", String(D.mail.length)],
      ["star", "已加星标", "1"],
      ["sent", "已发送", "18"],
      ["draft", "草稿", "2"],
      ["archive", "归档", "64"],
      ["trash", "已删除", "7"],
    ];
    return `<aside class="mail-nav"><button class="compose" disabled aria-disabled="true" title="演示账号不开放写信功能">写邮件</button><div class="mail-folders">${items.map(([k, t, n]) => `<a class="${active === k ? "active" : ""}" href="index.html"><span>${t}</span><em>${n}</em></a>`).join("")}</div><div class="mail-labels"><h4>云端资料</h4><a href="index.html?view=shared">共享给我的</a><a href="index.html?view=windows">共享相册</a><a href="index.html?view=luggage">照片</a></div><div class="mail-quota"><span>云端空间</span><div><i style="width:37%"></i></div><small>5.6 GB / 15 GB</small></div></aside>`;
  }
  function inboxList(selected = -1) {
    return `<section class="inbox-panel"><div class="inbox-toolbar"><label><input type="checkbox"> 全选</label><span>刷新</span><span>更多</span><b>1—${D.mail.length} / ${D.mail.length}</b></div><div class="inbox-list">${D.mail.map((m, i) => `<a class="inbox-item ${m.important ? "unread" : ""} ${selected === i ? "selected" : ""}" href="index.html?mail=${i}"><span class="mail-star">${m.important ? "★" : "☆"}</span><b class="mail-from">${esc(m.from)}</b><span class="mail-subject"><strong>${esc(m.subject)}</strong><em>— ${esc(m.preview || m.body)}</em></span><time>${esc(m.date)}</time></a>`).join("")}</div></section>`;
  }
  function mailBody(m, i) {
    const sig = `<div class="mail-signature"><span>${esc(m.fromEmail || "")}</span><small>此邮件发送给 ${esc(m.to || "周宁")}</small></div>`;
    if (m.kind === "insurance")
      return `<p>周宁您好：</p><p>您作为林沅保单的第二紧急联系人，系统提醒：本次计划内安全确认已经超过24小时未由旅行人本人完成。</p><div class="mail-action-card warning"><div><b>安全确认逾期</b><dl><div><dt>旅行人</dt><dd>林沅</dd></div><div><dt>保单</dt><dd>${esc(D.insurance.policy)}</dd></div><div><dt>状态</dt><dd><em class="lexeme">未收到本人确认</em></dd></div></dl><p>设备在线或消息送达并不代表本人持有设备。</p></div><a href="insurance.html?view=safety">查看安全确认状态</a></div><p class="mail-muted">若您已经通过其他方式确认旅行人本人安全，可忽略本邮件。若持续无法联系，请通过保单页面发起境外协助。</p>${sig}`;
    if (m.kind === "itinerary")
      return `<p>给你留个底。我妈要问你帮我解释一下。</p><p>这版是我付款以后下载的最终行程，回来照片还是给你挑。DAY5上面写的是白潮18:30入住，我就不另外抄地址了。</p><div class="attachment-preview"><div class="pdf-page"><span>QIAN COASTAL</span><b>栖岸青年旅居 · 九日 / 八晚</b><p>ORDER / ${esc(D.order.code)}</p><hr><small>DAY5 · 18:30 白潮酒店入住<br>21:30 拾味晚场（可选）</small></div><div><b>栖岸行程_最终版.pdf</b><p>PDF · 428 KB · 林沅共享</p><div class="row-actions"><a href="qian.html">项目官网</a><a href="qian-archive.html?code=${encodeURIComponent(D.order.code)}">核对订单版本</a></div></div></div><div class="quoted-thread"><b>周宁 · 08/13 21:07</b><p>你妈真问我我只会把PDF再发她一遍。</p><b>林沅 · 08/13 21:09</b><p>那也算售后。</p></div>${sig}`;
    if (m.kind === "hotelConfirm")
      return `<p>酒店也发我了，还是给你一份。我怕到时候我妈问具体住哪层，我现场再看。</p><div class="forwarded-mail"><small>转发邮件 · reservations@baytidehotel.com</small><div class="forward-brand">BAY TIDE / 白潮酒店</div><h3>团体住宿确认</h3><dl><div><dt>入住</dt><dd>2026-08-18</dd></div><div><dt>团体确认号</dt><dd><b>${esc(D.hotel.groupCode)}</b></dd></div><div><dt>项目引用</dt><dd>${esc(D.order.code)}</dd></div><div><dt>房型</dt><dd>海景标准双床 / 团体保留</dd></div></dl><p>具体房号于到店办理入住后分配。团体确认号可用于查询正式入住与退房摘要。</p><a href="hotel.html?view=group&code=${encodeURIComponent(D.hotel.groupCode)}">白潮酒店团体入住自助</a></div>${sig}`;
    if (m.kind === "album")
      return `<p>林沅与你共享了一个相册。</p><div class="cloud-share-card"><span>共享相册</span><h3>到了就发窗户</h3><p>建立于三年前 · 最近同步 08/18 21:16</p><div><b>DAY2</b><b>DAY5</b><b class="empty">DAY6 —</b></div><a href="index.html?view=windows">打开共享相册</a></div><p class="mail-muted">相册所有者可以随时调整共享权限。删除此邮件不会影响相册本身。</p>${sig}`;
    if (m.kind === "lifestyleForward")
      return `<p>你前面问我怎么找到这个项目的，就是这篇。</p><p>我把七个都看了：北海道太贵，潜水那个我不会游，清迈还得自己找住宿。第五个栖岸的时间刚好，摄影课和酒店都包，4980也在我预算里。</p><div class="forwarded-mail lifestyle-forward"><small>转发内容 · newsletter@haiyulife.cn</small><div class="forward-brand">海隅生活 / HAIYU LIFE</div><span class="sponsored-badge">暑期旅行专题</span><h3>不想跟团，也不想一个人处理所有事情：7个适合独自出发的暑期计划</h3><p>按预算、自由时间和住宿方式整理七种选择。</p><a href="life.html?id=l01">阅读原文</a></div><div class="quoted-thread"><b>周宁 · 08/13 18:34</b><p>海隅生活推荐的也不等于安全背书，你至少把酒店和保险自己查一遍。</p><b>林沅 · 18:36</b><p>查了。白潮、保险、领队我都翻过，才敢报。</p></div>${sig}`;
    if (m.kind === "jobs")
      return `<p>周宁，你关注的“内容 / 品牌 / 生活方式”方向有新的岗位更新：</p><div class="job-list"><article><span>海岸生活</span><b>生活方式内容编辑</b><p>海隅 · 12—17K · 2年以上内容经验</p><small>与你最近浏览的“品牌内容编辑”相似度 91%</small></article><article><span>弦外品牌</span><b>品牌内容编辑</b><p>远程2天 / 周 · 13—18K</p><small>需要作品集与长文编辑经验</small></article><article><span>慢岛社区</span><b>社区内容运营</b><p>海隅 · 11—16K</p><small>偏UGC与活动内容</small></article></div><span class="mail-cta mail-muted-cta">本周推荐摘要</span><p class="mail-muted">你收到这封邮件，是因为开启了职位动态提醒。调整提醒 · 退订</p>${sig}`;
    if (m.kind === "work")
      return `<p>周宁，</p><p>第三屏的小标题我按你昨天的批注改了。版本历史还在云夹，今晚不用等我回。</p><div class="version-card"><header><b>夏季项目页文案_v7_final2.docx</b><span>1.8 MB</span></header><div><del>把夏天留给一段刚刚好的逃离</del><ins>给日常留九天空白</ins></div><small>方澄 · 10:02 修改</small></div><div class="quoted-thread"><b>周宁 · 昨天 22:18</b><p>“逃离”有点用力，第二版更像品牌自己会说的话。上线前再看一次手机端换行。</p></div>${sig}`;
    if (m.kind === "bill")
      return `<div class="bill-summary"><div><span>本期应还</span><b>¥3,842.71</b></div><div><span>最后还款日</span><b>09/08</b></div><div><span>本期状态</span><b>未还款</b></div></div><table class="mail-table"><tr><th>消费分类</th><th>金额</th></tr><tr><td>餐饮</td><td>¥1,126.40</td></tr><tr><td>交通</td><td>¥682.00</td></tr><tr><td>线上服务</td><td>¥419.90</td></tr><tr><td>其他</td><td>¥1,614.41</td></tr></table><p class="mail-muted">若发现非本人交易，请从账单详情提交争议。请勿通过邮件回复银行卡信息。</p>${sig}`;
    if (m.kind === "cinema")
      return `<p>周宁，本周会员片单更新。你还有 <b>620</b> 积分。</p><div class="cinema-grid"><article><b>潮汐以后</b><span>剧情 / 112分钟</span><small>周二 19:20</small></article><article><b>城市慢镜</b><span>纪录 / 96分钟</span><small>周三 20:10</small></article><article><b>夏夜站台</b><span>爱情 / 104分钟</span><small>周五 18:40</small></article><article><b>第七码头</b><span>悬疑 / 118分钟</span><small>周六 21:30</small></article></div><p class="mail-muted">会员积分可抵扣指定场次服务费。本邮件由系统自动发送。</p>${sig}`;
    if (m.kind === "thread")
      return `<div class="personal-thread"><p><b>林沅 · 08/13 18:41</b><br>我把海隅生活那七个项目又筛了一遍，最后还是第五个。时间、预算和摄影课都刚好。</p><p><b>林沅 · 08/13 18:44</b><br>补偿到账了，下份工作又推迟入职。4980九天，住宿都包，我自己订还更贵。</p><p><b>周宁 · 18:46</b><br>怎么这么便宜？</p><p><b>林沅 · 18:47</b><br>当地青年补贴 + 照片授权。我条款都看了。</p><p><b>林沅 · 18:52</b><br>回来照片发你，第一组九张你帮我挑。</p><p><b>周宁 · 18:53</b><br>先把地平线拍直。</p><p><b>林沅 · 18:53</b><br>那是风格。</p></div>${sig}`;
    if (m.kind === "cloudReport")
      return `<p>这是你的每周云端空间摘要。</p><div class="cloud-usage-card"><b>5.6 GB / 15 GB</b><div class="cloud-usage"><i style="width:37%"></i></div><small>最近7天新增 38 个文件</small></div><div class="cloud-stats"><div><b>22</b><span>工作_夏季页面</span></div><div><b>9</b><span>与我共享</span></div><div><b>7</b><span>照片</span></div></div><p class="mail-muted">空间不足时，系统会优先提醒大文件，不会自动删除“与我共享”的原文件。</p>${sig}`;
    return `<p>${esc(m.body)}</p>${sig}`;
  }
  function mailReader(i) {
    const m = D.mail[i];
    return `<article class="mail-reader"><div class="reader-tools"><a href="index.html">← 收件箱</a><span>归档</span><span>举报</span><span>删除</span></div><h1>${esc(m.subject)}</h1><div class="sender-line"><span class="avatar">${esc(m.from.slice(0, 1))}</span><div><b>${esc(m.from)}</b><small>${esc(m.fromEmail || "")} · 发送给 周宁</small></div><time>${esc(m.date)}</time></div><div class="mail-copy">${mailBody(m, i)}</div><div class="reply-box">回复 ${esc(m.from)}…</div></article>`;
  }
  function driveShared() {
    const files = [
      [
        "pdf",
        "PDF",
        "栖岸行程_最终版.pdf",
        "林沅",
        "08-13 21:04",
        "428 KB",
        `index.html?mail=${D.mail.findIndex((x) => x.kind === "itinerary")}`,
      ],
      [
        "hotel",
        "BTH",
        "白潮酒店_团体入住确认.pdf",
        "林沅",
        "08-14 10:26",
        "214 KB",
        `index.html?mail=${D.mail.findIndex((x) => x.kind === "hotelConfirm")}`,
      ],
      [
        "album",
        "IMG",
        "到了就发窗户",
        "林沅",
        "08-18 21:16",
        "相册",
        "index.html?view=windows",
      ],
      [
        "policy",
        "AT",
        "安途旅保_保单摘要",
        "安途旅保",
        "08-14 10:18",
        "保单",
        "insurance.html",
      ],
      [
        "photo",
        "JPG",
        "行李称重_出发前.jpg",
        "林沅",
        "08-13 19:22",
        "3.1 MB",
        "index.html?view=luggage",
      ],
    ];
    return `<div class="drive-shell">${mailNav("shared")}<section class="drive-main"><div class="drive-top"><div><span class="crumb">云夹 / 与我共享</span><h1>共享给我的</h1></div><div class="drive-actions"><span>只读共享</span><span>列表视图</span></div></div><div class="drive-filter"><span class="active">全部</span><span>文档</span><span>图片</span><span>相册</span><span>最近修改</span></div><div class="drive-table"><div class="drive-row head"><span>名称</span><span>共享者</span><span>修改时间</span><span>大小</span></div>${files.map(([c, l, n, o, d, z, u]) => `<a class="drive-row" href="${u}"><span class="drive-name">${fileIcon(c, l)}<b>${n}</b></span><span>${o}</span><span>${d}</span><span>${z}</span></a>`).join("")}</div><div class="drive-info"><b>共享资料说明</b><p>共享文件由原所有者控制访问权限。移动、重命名或删除快捷方式不会影响原文件。</p></div></section></div>`;
  }
  function windowAlbum() {
    return `<div class="drive-shell">${mailNav("shared")}<section class="album-main"><div class="album-head"><div><span class="crumb">云夹 / 共享相册</span><h1>到了就发窗户</h1><p>林沅创建 · 与周宁共享 · 3个时间节点</p></div><span class="album-sort">按拍摄时间</span></div><div class="album-gallery"><article>${photo("window-day2", "album-thumb")}<div><b>DAY2_老城民宿.jpg</b><span>08/15 21:08 · 已同步</span><p>“窗户外面全是坡和白房子。”</p></div></article><article>${photo("windows", "album-thumb")}<div><b>DAY5_白潮窗户.jpg</b><span>08/18 21:16 · 已同步</span><p>“明天去海边拍光。”</p></div></article><article class="album-missing-card"><div class="missing-frame"><span>DAY6</span><b>没有新照片</b></div><div><b>下一张窗户没有出现</b><span>最后同步后已超过24小时</span><p>相册没有删除记录，也没有新的上传失败提示。</p></div></article></div><div class="album-comment"><span class="avatar">林</span><p><b>林沅</b>：以后每换一家酒店就发一张窗户，不聊天也行。<br><small>三年前建立相册时的备注</small></p></div><div class="related-files"><b>这个相册附近共享的文件</b><a href="index.html?view=shared">栖岸行程与白潮团体确认</a></div></section></div>`;
  }
  function luggageViewer() {
    return `<div class="drive-shell">${mailNav("shared")}<section class="album-main"><div class="album-head"><div><span class="crumb">云夹 / 照片 / 出发前</span><h1>行李称重_出发前.jpg</h1><p>林沅 · 08/13 19:22</p></div><a class="download-link" href="${PHOTO.luggage}" download="行李称重_出发前.webp">下载原图</a></div><div class="single-photo">${photo("luggage", "luggage-photo")}</div><div class="photo-details"><div><b>文件信息</b><p>JPG · 3024 × 4032 · 3.1 MB</p></div><div><b>共享备注</b><p>“黄色鸭子终于贴牢了，这次谁都别想把我箱子拿错。”</p></div><div><b>周宁</b><p>“你整个箱子都是黄色的。”</p></div></div></section></div>`;
  }
  function index() {
    visit("mail:home");
    const v = qs("view"),
      mid = qs("mail");
    if (v === "shared") {
      shell(driveShared());
      return;
    }
    if (v === "windows") {
      visit("mail:window-memory");
      shell(windowAlbum());
      return;
    }
    if (v === "luggage") {
      visit("mail:luggage");
      shell(luggageViewer());
      return;
    }
    if (mid !== null) {
      const i = Number(mid);
      if (!D.mail[i]) {
        location.href = "index.html";
        return;
      }
      if (D.mail[i].kind === "itinerary") visit("mail:shared-itinerary");
      shell(
        `<div class="webmail-layout">${mailNav()}${inboxList(i)}${mailReader(i)}</div>`,
      );
      return;
    }
    shell(
      `<div class="webmail-layout inbox-only">${mailNav()}${inboxList()}<aside class="mail-preview"><h2>最近联系</h2><p>你和林沅平时并不每天聊天。她旅行时只有一个固定习惯：到新住宿以后发一张窗户。</p><div class="preview-thread"><b>林沅 · 08/19 21:38</b><p>到酒店给你发窗户。</p><b>周宁 · 08/20 07:10</b><p>到了吗？</p><span>最后一条没有回复</span></div><a class="preview-link" href="index.html?view=windows">最近共享相册</a><a class="preview-link" href="index.html?view=shared">与我共享的文件</a></aside></div>`,
    );
  }
  const qianExtras = {
    about: [
      [
        "项目形式",
        "9日 / 8晚固定小团；主要活动为旧城、摄影、海岸市场与自由创作。",
      ],
      ["适合人群", "22—30岁，能独立完成境外出行手续的青年旅行者。"],
      ["项目规模", "每期约18—24人，按到达时间分两组接机。"],
    ],
    price: [
      ["特别期", "¥4,980 / 人；国际交通自理。"],
      ["已包含", "8晚团体住宿、当地接驳、摄影工作坊、部分活动餐与保险。"],
      ["补贴说明", "当地青年文化推广补贴 + 参与者旅拍素材授权。"],
    ],
    insurance: [
      ["基础保障", "报名价已包含指定期间的境外意外与紧急援助。"],
      ["紧急联系人", "报名时可填写两位联系人，用于安全确认逾期或境外协助。"],
      ["独立查询", "保单由安途旅保独立提供，项目方无法代替本人确认安全。"],
    ],
    faq: [
      ["可以脱团吗？", "可在自由活动时段自行安排；离团需在项目群内报备。"],
      ["房间怎么安排？", "以双床团体房为主，特殊需求需提前说明。"],
      ["网络稳定吗？", "酒店Wi‑Fi覆盖主要公共区与客房；部分海崖区域信号较弱。"],
      [
        "什么叫换线？",
        "天气、交通、私人医疗或家庭安排导致原路线改变时，售后系统会以换线记录版本差异。",
      ],
    ],
    leader: [
      ["韩译 · 29岁", "栖岸驻地领队；负责接驳、活动协调与临时翻译。"],
      ["往届评价", "“耳机落车上，他晚上还帮我问到司机那里。”"],
      ["工作范围", "团体接机、行程通知、合作方协调；私人行程由运营另行确认。"],
    ],
    weather: [
      ["08/20", "晴到多云 · 27℃ · 海风4级"],
      ["08/21", "晴 · 28℃ · 午后风力偏大"],
      ["海崖提示", "穿防滑鞋；摄影器材建议加腕带。"],
    ],
    refund: [
      ["出发前7日", "可退项目服务费的80%。"],
      ["出发后", "已发生住宿与活动费用不退；未发生部分按合作方规则核算。"],
      ["临时提前退出", "需由本人或紧急联系人确认后办理剩余服务结算。"],
    ],
    emergency: [
      [
        "境外紧急情况",
        "优先联系当地公共安全机构；项目客服可协助语言和住宿信息。",
      ],
      ["保险协助", "涉及医疗、失联或证件遗失，可由安途旅保启动境外援助。"],
      ["项目客服", "08:00—23:30；夜间紧急电话见报名确认邮件。"],
    ],
    photo: [
      ["授权范围", "项目回顾、官网往届返图与合作机构青年推广材料。"],
      [
        "内容合作",
        "远岸内容合作中心负责暑期专题与合作媒体素材分发；报名来源会保留渠道码用于合作结算。",
      ],
      ["不会使用", "护照、保单、私人聊天、未主动提交的个人文件。"],
      ["撤回方式", "项目结束后可申请撤下尚未投放的个人肖像素材。"],
    ],
    transport: [
      ["蓝线A", "机场—团体酒店—主要活动点的常规接驳。"],
      ["临时换站", "天气、道路封闭或车辆调整时，可能更换上下车站点。"],
      [
        "个人换线",
        "私人医疗、家庭或其他个人安排可由运营另行协调，不显示在常规团体路线中。",
      ],
    ],
    gear: [
      ["摄影", "相机或手机、充电宝、备用储存卡。"],
      ["海边", "防晒、防滑鞋、轻薄外套。"],
      ["证件", "护照原件、保险凭证、酒店地址离线备份。"],
    ],
    diet: [
      ["过敏原", "报名表内填写，餐厅仅同步必要饮食字段。"],
      ["晚场", "随机菜单不接受指定菜品，但会遵循已登记过敏原。"],
      ["临时修改", "请在用餐前至少4小时联系项目客服。"],
    ],
  };
  function qianHome() {
    const cards = D.qian
      .filter((x) => !["route", "partners"].includes(x.id))
      .slice(0, 9);
    return `<section class="travel-hero"><div class="travel-photo">${photo("qian", "travel-hero-img")}<div class="travel-overlay"><span>SUMMER SESSION · 9 DAYS</span><h1>把九天留给海边</h1><p>旧城、摄影、海岸市场和一张不赶时间的餐桌。</p><a href="qian.html?view=route">查看九日路线</a></div></div><div class="travel-bookbox"><h2>夏末特别期</h2><div class="price"><b>¥4,980</b><span>/ 人</span></div><p>国际交通自理 · 8晚住宿 · 当地接驳 · 部分餐饮</p><dl><div><dt>出发</dt><dd>2026.08</dd></div><div><dt>人数</dt><dd>18—24</dd></div><div><dt>状态</dt><dd>本期已满</dd></div></dl><a href="qian.html?view=price">查看费用包含</a></div></section><section class="travel-intro"><div><span class="section-kicker">QIAN COASTAL RESIDENCY</span><h2>一段被安排得刚刚好的短暂停留</h2><p>栖岸是澄海国际文旅面向青年旅行者的九日海岸项目。报名页、合作酒店、保险与当地餐桌均可独立查询。</p></div><div class="travel-numbers"><div><b>09</b><span>天</span></div><div><b>03</b><span>合作服务</span></div><div><b>01</b><span>摄影工作坊</span></div></div></section><section class="travel-cards">${cards.map((x) => `<a href="qian.html?view=${x.id}"><span>${x.title}</span><p>${x.text}</p><em>了解更多 →</em></a>`).join("")}</section><section class="travel-route-tease"><div><span>DAY 01—09</span><h2>从抵达到返程</h2><p>当前官网将第五天列为“<em class="lexeme">自由活动</em>”。历史签约版本可通过订单中心核对。</p></div><a href="qian.html?view=route">查看完整路线</a></section>`;
  }
  function qianRoute() {
    const days = [
      ["01", "抵达与入住", "机场接驳 · 开营说明 · 团体入住"],
      ["02", "旧城与夜市", "步行导览 · 自由晚餐"],
      ["03", "城市摄影工作坊", "街区观察 · 自由拍摄"],
      ["04", "海岸市场", "上午市场 · 下午自由活动"],
      ["05", '<em class=\"lexeme\">自由活动</em>', "当前公开版本仅保留这一项"],
      ["06", "海崖拍摄", "晨间拍摄 · 蓝线A接驳"],
      ["07", "当地餐桌", "拾味餐桌 · 团体活动餐"],
      ["08", "自由创作", "作品整理 · 自由安排"],
      ["09", "返程", "统一送机 · 项目结束"],
    ];
    return `<div class="travel-page"><aside class="travel-side"><b>本期路线</b><span>夏末特别期 · 9日 / 8晚</span><a href="qian-archive.html">订单与版本</a><a href="qian.html?view=transport">接驳与路线调整</a></aside><section class="itinerary"><div class="travel-title"><span>ITINERARY</span><h1>九日路线</h1><p>实际时间可能因天气与当地活动调整；系统把需要更换原路线的情况记为 <em class="lexeme">换线</em>，重大变化会保留在订单修订记录中。</p></div>${days.map((d) => `<article class="day-row ${d[0] === "05" ? "day-change" : ""}"><div class="day-no">DAY ${d[0]}</div><div><h2>${d[1]}</h2><p>${d[2]}</p></div>${d[0] === "05" ? '<span class="revision-badge">当前版本</span>' : ""}</article>`).join("")}</section></div>`;
  }
  function qianPartners() {
    return `<section class="partners-page"><div class="travel-title"><span>PARTNERS</span><h1>本期合作服务</h1><p>住宿、餐饮与保险均由独立机构提供，可直接访问合作方公开页面。</p></div><div class="partner-grid"><a href="hotel.html"><b>BAY TIDE</b><h2>白潮酒店</h2><p>团体入住、住客服务、房态与酒店后勤。</p><span>访问酒店官网 →</span></a><a href="restaurant.html"><b>SHIWEI TABLE</b><h2>拾味餐桌</h2><p>活动餐、晚场小桌与团体饮食偏好同步。</p><span>查看餐厅网站 →</span></a><a href="insurance.html"><b>ANTU TRAVEL CARE</b><h2>安途旅保</h2><p>独立保单、安全确认与境外紧急协助。</p><span>打开保单服务 →</span></a></div><div class="partner-note"><b>服务边界</b><p>合作方只接收履行本次服务所需的必要字段。旅行人安全确认由保险机构独立完成。</p></div></section>`;
  }
  function qianSupport() {
    visit("qian:support");
    const deep = S.deepConfirmed;
    return `<div class="support-console"><aside class="ticket-list"><div class="support-title"><b>栖岸服务中心</b><span>周宁 · 我的工单</span></div><button class="new-ticket" disabled aria-disabled="true">已有进行中咨询</button><div class="ticket active"><span>行程中 · 进行中</span><b>无法联系团员 / 白潮酒店</b><small>工单 QN-260820-118</small></div><div class="ticket"><span>已结束</span><b>报名资料修改</b><small>08/14</small></div><div class="service-hours"><b>在线客服</b><p>08:00—23:30</p><span class="online-dot">在线</span></div></aside><section class="ticket-room"><header><div><span>工单 QN-260820-118</span><h1>无法联系团员 / 白潮酒店</h1></div><div class="ticket-state">等待核实</div></header><div class="ticket-context"><span><b>关联订单</b> ${esc(D.order.code)}</span><span><b>出行期次</b> 夏末特别期</span><span><b>服务对象</b> 林沅</span></div><div class="chat-log"><div class="bubble me"><small>周宁 · 08:21</small><p>林沅从昨晚开始联系不上。她现在是否还在白潮？</p></div><div class="bubble agent"><small>栖岸客服 · 08:27</small><p>林女士因当地网络条件暂时无法取得联系，团队工作人员已确认本人状态正常。</p><span>客服编号 QN-27</span></div>${deep ? `<div class="bubble agent alert-bubble"><small>栖岸客服 · 刚刚</small><p>周宁您好。请问您现在仍在查询林沅女士的行程吗？</p></div>` : ""}</div><form class="support-compose" id="supportForm"><textarea required minlength="8" aria-label="补充工单留言" placeholder="补充需要项目方核实的情况"></textarea><div><span>留言会进入普通售后工单；紧急安全问题请使用保险或当地正式渠道</span><button>发送</button></div><p id="supportMsg" class="form-feedback" aria-live="polite"></p></form></section><aside class="ticket-detail"><h3>工单信息</h3><dl><div><dt>优先级</dt><dd>普通</dd></div><div><dt>渠道</dt><dd>网页客服</dd></div><div><dt>创建</dt><dd>08/20 08:21</dd></div><div><dt>最近更新</dt><dd>08:27</dd></div></dl><h3>售后服务</h3><a href="qian-archive.html?code=${encodeURIComponent(D.order.code)}">订单与版本</a><a href="qian.html?view=faq">常见问题</a><a href="qian.html?view=refund">退款与退出</a><a href="qian.html?view=partners">合作机构</a></aside></div>`;
  }
  function qianDetail(id) {
    const x = D.qian.find((v) => v.id === id);
    if (!x) return qianHome();
    visit("qian:" + id);
    const extra = D.qianMore?.[id],
      rows = extra?.sections || qianExtras[id] || [[x.title, x.text]],
      intro = extra?.intro || x.text;
    return `<div class="travel-content"><aside class="travel-menu"><b>出发前信息</b><a href="qian.html?view=about">关于栖岸</a><a href="qian.html?view=price">费用说明</a><a href="qian.html?view=insurance">保险说明</a><a href="qian.html?view=faq">常见问题</a><a href="qian.html?view=leader">领队介绍</a><a href="qian.html?view=transport">接驳</a><a href="qian.html?view=diet">饮食偏好</a><a href="qian.html?view=refund">退款规则</a><small>本页属于公开产品说明，具体签约内容以订单版本为准。</small></aside><article class="travel-article"><div class="travel-title"><span>QIAN COASTAL PROGRAM</span><h1>${esc(x.title)}</h1><p>${rich(intro)}</p></div><div class="info-specs">${rows.map(([a, b]) => `<div><h3>${esc(a)}</h3><p>${rich(b)}</p></div>`).join("")}</div>${id === "about" ? `<section class="travel-factline"><div><b>运营</b><span>澄海国际文旅</span></div><div><b>形式</b><span>9日 / 8晚固定小团</span></div><div><b>人数</b><span>18—24人</span></div></section>` : ""}${id === "price" ? `<section class="price-breakdown"><b>特别期 ¥4,980</b><span>住宿 8晚</span><span>当地常规接驳</span><span>部分活动餐</span><span>指定期间保险</span><small>国际往返交通与自由活动个人消费自理。</small></section>` : ""}${id === "faq" ? `<div class="faq-note"><b>没有找到答案？</b><p>普通行程与售后问题可提交客服工单；无法确认旅行人安全时，项目客服不能替代保险或当地正式援助。</p></div>` : ""}${id === "leader" ? `<div class="testimonial"><b>往届旅友圈</b><blockquote>“耳机落车上，他晚上还帮我问到司机那里。”</blockquote><a href="forum.html?author=${encodeURIComponent("韩译")}">社区中关于韩译的公开发言</a></div>` : ""}${id === "transport" ? `<div class="route-box"><span>BLUE LINE A</span><b>常规团体接驳</b><p>机场 / 白潮酒店 / 主要活动点</p><small>道路变化可能临时<em class="lexeme">换站</em>；私人安排可能单独<em class="lexeme">换线</em>。</small></div>` : ""}</article></div>`;
  }
  function qian() {
    visit("qian:home");
    const v = qs("view") || "home";
    let content;
    if (v === "home") content = qianHome();
    else if (v === "route") content = qianRoute();
    else if (v === "partners") content = qianPartners();
    else if (v === "support") content = qianSupport();
    else content = qianDetail(v);
    shell(content);
    if (v === "support")
      $("#supportForm").onsubmit = (e) => {
        e.preventDefault();
        const msg = $("#supportForm textarea").value.trim();
        if (msg.length < 8) return;
        if (S.deepConfirmed) {
          S.ending = "support";
          save();
          location.href = "ending.html";
        } else {
          $("#supportMsg").textContent =
            "留言已进入原工单，客服会按普通售后流程继续核实。";
          $("#supportForm textarea").value = "";
        }
      };
  }
  function qianArchive() {
    visit("qian:archive");
    const code = qs("code") || "",
      ok = norm(code) === norm(D.order.code);
    if (ok && qs("view") === "ops") {
      visit("qian:ops");
      shell(
        `<div class="legacy-ops"><header><b>QIAN OPS 2.7</b><span>行程成员摘要 / 售后只读权限</span><em>SESSION: QN-260820-118</em></header><nav><span>成员</span><span>路线调整</span><span>风险标记</span><span>导出</span></nav><main><section class="ops-member"><h1>成员服务摘要</h1><table><tr><th>项目订单</th><td>${esc(D.order.code)}</td><th>成员</th><td>林沅 / LY</td></tr><tr><th>当前状态</th><td class="ops-warning">个人换线 · 等待复核</td><th>常规接驳</th><td>蓝线 A</td></tr><tr><th>住宿</th><td>${esc(D.hotel.groupCode)} / 712</td><th>外部联系</th><td>未收到本人回复</td></tr></table></section><section class="ops-log"><h2>路线修订记录</h2><ol><li><time>08/19 18:03</time><div><b>DAY5公开模板已修改</b><p>白潮入住替换为“自由活动”；签约版本保留。</p></div></li><li><time>08/19 18:07</time><div><b>个人换线标记写入</b><p>提交人：运营 QN-27；目的地字段未填写。</p></div></li><li><time>08/19 21:52</time><div><b>成员状态等待复核</b><p>蓝线 A 未登记离店或返程；客服仍沿用“工作人员已确认”。</p></div></li></ol></section><div class="ops-disclaimer"><b>权限配置提示</b><p>本页由售后工单中的历史版本链接错误开放，只能读取，不能编辑成员状态。</p></div><a class="ops-back" href="qian-archive.html?code=${encodeURIComponent(code)}">← 返回订单历史</a></main></div>`,
      );
      return;
    }
    shell(
      `<div class="account-shell"><aside><b>栖岸订单中心</b><span class="active">历史版本查询</span><span>订单资料</span><span>费用与退款</span><span>售后记录</span><hr><a href="qian.html">返回项目官网</a></aside><section class="account-main"><div class="account-title"><span>ORDER HISTORY</span><h1>历史签约版本查询</h1><p>用于售后争议、路线版本核对与签约内容留存。</p></div><form class="lookup-bar" id="orderForm"><label>项目订单号<input id="orderCode" value="${esc(code)}" placeholder="例如 QA26-XX-0000"></label><button>查询</button></form>${code && !ok ? '<div class="form-error">没有找到这个订单号，请核对格式。</div>' : ""}${ok ? `<div class="order-card"><header><div><b>${esc(D.order.code)}</b><span>夏末特别期 · 已签约</span></div><em>版本差异</em></header><div class="compare"><section><small>签约版</small><h3>DAY 5</h3><p>${rich(D.order.original)}</p></section><section class="current-version"><small>当前官网</small><h3>DAY 5</h3><p>${rich(D.order.current)}</p></section></div><div class="revision-log"><b>修订记录</b><p>${rich(D.order.revision)}</p><a href="qian-archive.html?view=ops&code=${encodeURIComponent(D.order.code)}">查看运营修订摘要（只读）</a></div><div class="order-services"><div><span>白潮住宿确认</span><b>${esc(D.order.hotelRef)}</b></div><div><span>拾味团餐引用</span><b>${esc(D.order.restaurantRef)}</b></div><div><span>蓝线接驳引用</span><b>${esc(D.order.transferRef)}</b></div><div><span>报名来源</span><b>${esc(D.order.campaign || "DIRECT")}</b></div></div><div class="order-links"><a href="hotel.html?view=group&code=${encodeURIComponent(D.order.hotelRef)}">白潮团体入住自助</a><a href="restaurant.html?view=group&code=${encodeURIComponent(D.order.restaurantRef)}">拾味团体用餐确认</a></div></div>` : ""}<div class="account-help"><b>为什么会保留历史版本？</b><p>签约后的路线、费用和合作服务若发生修改，订单中心仍会保留用户确认时的版本，用于售后核对。</p></div></section></div>`,
    );
    $("#orderForm").onsubmit = (e) => {
      e.preventDefault();
      location.href =
        "qian-archive.html?code=" + encodeURIComponent($("#orderCode").value);
    };
  }
  function avatar(n) {
    return `<span class="forum-avatar">${esc(n.slice(0, 1))}</span>`;
  }
  function forum() {
    visit("forum:home");
    const id = qs("id"),
      tag = qs("tag"),
      author = qs("author");
    if (id) {
      const p = D.forum.find((x) => x.id === id);
      if (!p) {
        location.href = "forum.html";
        return;
      }
      if (!S.read.includes(id)) {
        S.read.push(id);
        save();
      }
      visit("forum:" + id);
      const related = D.forum
        .filter((x) => x.id !== p.id && x.tags.some((t) => p.tags.includes(t)))
        .slice(0, 4);
      const newsLink = ["f16", "f51"].includes(id)
        ? `<div class="forum-link-card"><b>回复中引用的公开报道</b><p>海湾晨报 · 2026-07-16 · 当日机场晚间两班航班取消</p><a href="news.html?id=n07">打开原报道</a></div>`
        : "";
      shell(
        `<div class="forum-layout"><main class="thread-page"><div class="thread-breadcrumb"><a href="forum.html">旅友圈</a> / ${p.tags.map((t) => `<a href="forum.html?tag=${encodeURIComponent(t)}">${t}</a>`).join(" / ")}</div><article class="thread"><header>${avatar(p.author)}<div><h1>${rich(p.title)}</h1><p><a href="forum.html?author=${encodeURIComponent(p.author)}">${esc(p.author)}</a> · ${p.date} · ${p.tags.map((t) => `<span>${t}</span>`).join(" ")}</p></div></header><div class="thread-copy"><p>${rich(p.text)}</p></div><footer><span>收藏</span><span>分享</span><span>举报</span></footer></article><section class="replies"><h2>${p.comments.length} 条回复</h2>${p.comments
          .map((c, i) => {
            const parts = c.split("：");
            return `<div class="reply">${avatar(parts[0])}<div><b>${esc(parts[0])}</b><p>${rich(parts.slice(1).join("："))}</p><small>#${i + 1}</small></div></div>`;
          })
          .join(
            "",
          )}</section>${id === "f14" ? `<div class="forum-link-card"><b>帖子中曾分享的链接</b><p>拾味旧版晚场排版页 · 主站改版后已无导航入口。</p><a href="restaurant.html?view=archive">打开旧链接</a></div>` : ""}${newsLink}${id === "f15" ? '<div class="forum-notice">该用户此后没有新的公开帖子。</div>' : ""}</main><aside class="forum-aside"><section><h3>作者</h3>${avatar(p.author)}<b>${esc(p.author)}</b><a href="forum.html?author=${encodeURIComponent(p.author)}">查看公开发言</a></section><section><h3>相关讨论</h3>${related.map((x) => `<a href="forum.html?id=${x.id}">${esc(x.title)}</a>`).join("")}</section></aside></div>`,
      );
      return;
    }
    let list = [...D.forum].sort((a, b) => b.date.localeCompare(a.date));
    if (tag) list = list.filter((x) => x.tags.includes(tag));
    if (author)
      list = list.filter(
        (x) =>
          x.author === author ||
          x.comments.some((c) => c.startsWith(author + "：")),
      );
    const pg = Math.max(1, Number(qs("p") || 1)),
      size = 10,
      start = (pg - 1) * size,
      items = list.slice(start, start + size);
    const hot = D.forum.slice(0, 6);
    shell(
      `<div class="forum-home"><main><div class="feed-head"><div><h1>${author ? esc(author) + " 的公开发言" : tag ? esc(tag) + " · 讨论" : "旅友圈广场"}</h1><p>${author ? "帖子与公开回复汇总。" : "正在旅行的人、已经回来的人，和还在做攻略的人。"}</p></div><div class="feed-sort">最新发布 ▾</div></div><div class="forum-filter">${["全部", "攻略", "酒店", "餐饮", "返程", "摄影", "出发前"].map((t) => `<a class="${(!tag && t === "全部") || tag === t ? "active" : ""}" href="${t === "全部" ? "forum.html" : "forum.html?tag=" + encodeURIComponent(t)}">${t}</a>`).join("")}</div><div class="feed-list">${items.map((p) => `<article class="feed-item ${S.read.includes(p.id) ? "read" : ""}">${avatar(p.author)}<div class="feed-copy"><div class="feed-meta"><a href="forum.html?author=${encodeURIComponent(p.author)}">${esc(p.author)}</a><span>${p.date}</span></div><a class="feed-title" href="forum.html?id=${p.id}">${rich(p.title)}</a>${p.image && PHOTO[p.image] ? `<a class="feed-photo-link" href="forum.html?id=${p.id}">${photo(p.image, "feed-photo")}</a>` : ""}<p>${rich(p.text)}</p><div class="feed-foot"><span>${p.tags.map((t) => "#" + t).join(" ")}</span><a href="forum.html?id=${p.id}">${p.comments.length} 回复</a></div></div></article>`).join("")}</div><div class="pagination">${pg > 1 ? `<a href="forum.html?${tag ? "tag=" + encodeURIComponent(tag) + "&" : ""}${author ? "author=" + encodeURIComponent(author) + "&" : ""}p=${pg - 1}">上一页</a>` : ""}<span>第 ${pg} 页</span>${start + size < list.length ? `<a href="forum.html?${tag ? "tag=" + encodeURIComponent(tag) + "&" : ""}${author ? "author=" + encodeURIComponent(author) + "&" : ""}p=${pg + 1}">下一页</a>` : ""}</div></main><aside class="forum-sidebar"><section><h3>社区正在讨论</h3>${hot.map((p, i) => `<a href="forum.html?id=${p.id}"><em>${String(i + 1).padStart(2, "0")}</em><span>${rich(p.title)}</span></a>`).join("")}</section><section><h3>常用标签</h3><div class="tag-cloud">攻略 酒店 摄影 夜市 晚场 返程 预算 独自旅行</div></section><section class="community-rule"><b>发帖前</b><p>请勿公开护照、保单号码或他人联系方式。</p></section></aside></div>`,
    );
  }
  function hotel() {
    visit("hotel:home");
    const v = qs("view") || "home",
      code = qs("code") || "";
    let body = "";
    const rooms = D.hotelRooms || [];
    if (v === "home")
      body = `<section class="hotel-hero">${photo("hotel", "hotel-hero-img")}<div class="hotel-hero-copy"><span>COAST DISTRICT · BAY TIDE</span><h1>住在海边，离城市也不远</h1><p>短住、家庭与团体入住。</p><a href="hotel.html?view=service">查看客房</a></div><form class="hotel-search" action="hotel.html" method="get"><input type="hidden" name="view" value="service"><label>入住<input name="checkin" value="08/18"></label><label>退房<input name="checkout" value="08/21"></label><label>住客<select name="guests"><option>1间 · 1人</option><option>1间 · 2人</option><option>1间 · 2大1小</option></select></label><button>查询房型</button></form></section><section class="hotel-intro"><div><span>BAY TIDE HOTEL</span><h2>白潮酒店</h2><p>海岸区的中型酒店，共 ${rooms.length} 类公开房型；另设团体保留房。前台24小时开放。</p></div><dl><div><dt>前台</dt><dd>24小时</dd></div><div><dt>早餐</dt><dd>06:30—10:00</dd></div><div><dt>入住 / 退房</dt><dd>15:00 / 11:00</dd></div></dl></section><section class="room-teaser"><header><span>ROOMS</span><h2>选择适合这次停留的房间</h2><a href="hotel.html?view=service">全部客房与设施</a></header><div>${rooms
        .slice(0, 3)
        .map(
          (r) =>
            `<article class="room-teaser-text"><span>${esc(r.en)}</span><h3>${esc(r.name)}</h3><p>${esc(r.size)} · ${esc(r.occupancy)} · ${esc(r.from)} 起</p><small>${esc(r.bed)} · ${esc(r.view)}</small></article>`,
        )
        .join(
          "",
        )}</div></section><section class="hotel-services"><a href="hotel.html?view=service"><b>客房与设施</b><p>${rooms.length}类公开房型、泳池、洗衣与早餐</p></a><a href="hotel.html?view=reviews"><b>住客评价</b><p>${D.hotelReviews.length}条公开短评</p></a><a href="hotel.html?view=group"><b>团体入住自助</b><p>使用酒店确认号或项目订单核对入住与正式退房摘要</p></a></section>`;
    if (v === "service")
      body = `<div class="hotel-page"><div class="hotel-page-title"><span>ROOMS & AMENITIES</span><h1>客房与设施</h1><p>公开零售房型与团体保留房使用同一前台系统；具体房号以到店分配为准。</p></div><section class="room-catalog">${rooms.map((r) => `<article id="${r.id}">${photo(r.photo, "room-photo")}<div><span><em>${esc(r.en)}</em> · ${esc(r.size)}</span><h2>${esc(r.name)}</h2><p>${esc(r.desc)}</p><dl><div><dt>入住</dt><dd>${esc(r.occupancy)}</dd></div><div><dt>参考价</dt><dd>${esc(r.from)}</dd></div></dl></div></article>`).join("")}</section><section class="amenity-grid"><div><b>早餐</b><p>06:30—10:00；团体高峰约07:30。</p></div><div><b>自助洗衣</b><p>二楼东侧，两台洗衣与一台烘干设备。</p></div><div><b>泳池</b><p>屋顶小型泳池，18:00后光线最好。</p></div><div><b>行李寄存</b><p>入住前与退房当日均可使用。</p></div><div><b>客房清洁</b><p>${rich(D.hotel.housekeeping)}</p></div><div><b>团体房务</b><p>旅行团与会议订单在独立团体确认号下管理。</p></div></section></div>`;
    if (v === "reviews") {
      const pg = Math.max(1, Number(qs("p") || 1)),
        size = 7,
        start = (pg - 1) * size,
        rows = D.hotelReviews.slice(start, start + size),
        avg = (
          D.hotelReviews.reduce((a, b) => a + b.score, 0) /
          D.hotelReviews.length
        ).toFixed(1);
      body = `<div class="hotel-page"><div class="review-summary"><div><b>${avg}</b><span>/ 5.0</span><p>来自 ${D.hotelReviews.length} 条公开评价</p></div><div><span>位置</span><i style="width:89%"></i><span>清洁</span><i style="width:84%"></i><span>服务</span><i style="width:86%"></i></div></div><section class="hotel-review-list"><h1>住客评价</h1>${rows.map((r) => `<article><div><b>${esc(r.author)}</b><span>${r.date}</span></div><strong>${"★".repeat(r.score)}${"☆".repeat(5 - r.score)}</strong><p>${rich(r.text)}</p></article>`).join("")}<div class="pagination">${pg > 1 ? `<a href="hotel.html?view=reviews&p=${pg - 1}">上一页</a>` : ""}${start + size < D.hotelReviews.length ? `<a href="hotel.html?view=reviews&p=${pg + 1}">下一页</a>` : ""}</div></section></div>`;
    }
    if (v === "group") {
      const ok =
        code &&
        (norm(code) === norm(D.hotel.groupCode) ||
          norm(code) === norm(D.hotel.projectCode));
      body = `<div class="hotel-portal"><aside><b>团体入住自助</b><span class="active">住宿状态</span><span>房卡与前台</span><span>遗失物</span><a href="hotel.html?view=privacy">隐私说明</a><small>仅显示团体服务必要信息</small></aside><section><div class="portal-title"><span>GROUP STAY</span><h1>查询团体住宿状态</h1></div><form id="hotelGroup" class="portal-search"><label>酒店确认号 / 项目订单<input id="hotelCode" value="${esc(code)}" placeholder="例如 GRP/XX/0000"></label><button>查询</button></form>${code && !ok ? '<div class="portal-error">未找到匹配的团体住宿记录。</div>' : ""}${ok ? `<div class="stay-card"><header><div><b>确认号 ${esc(D.hotel.groupCode)}</b><span>项目引用 ${esc(D.hotel.projectCode)}</span></div><em class="stay-open">${D.hotel.publicStatus}</em></header><div class="stay-grid"><div><small>团体房</small><b>${D.hotel.room}</b></div><div><small>入住</small><b>${D.hotel.checkin}</b></div><div><small>正式退房</small><b class="missing-checkout">无正式退房记录</b></div></div><div class="stay-note"><b>前台摘要</b><p>${rich(D.hotel.frontdeskNote)}</p></div><div class="stay-service-links"><a href="hotel.html?view=pms&code=${encodeURIComponent(D.hotel.groupCode)}">打开关联房务摘要</a><a href="hotel.html?view=privacy">房态与隐私说明</a><a href="qian-archive.html?code=${encodeURIComponent(D.order.code)}">查看项目订单版本</a></div></div>` : ""}<div class="portal-help"><b>查询范围</b><p>${D.hotel.groupHelp}</p></div></section></div>`;
    }
    if (v === "pms") {
      const ok =
        norm(code) === norm(D.hotel.groupCode) ||
        norm(code) === norm(D.hotel.projectCode);
      if (ok) visit("hotel:pms");
      body = ok
        ? `<div class="hotel-pms"><header><b>BAY TIDE PMS 3.4</b><span>GROUP SERVICE / READ ONLY</span><em>前台链接映射：${esc(D.hotel.groupCode)}</em></header><nav><span>房态</span><span>房务工单</span><span>服务区</span><span>附件</span></nav><main><section class="pms-summary"><h1>房务事件摘要 / 712</h1><table><tr><th>工单</th><td>HK-0819-712</td><th>状态</th><td class="pms-alert">夜间房务 · 暂挂</td></tr><tr><th>住客状态</th><td>前台未办理退房</td><th>交接区域</th><td>B2 SERVICE</td></tr><tr><th>供应商</th><td>NIGHTPOST</td><th>合作编号</th><td>${esc(D.nightpost.partner)}</td></tr></table></section><section class="pms-events"><h2>事件记录</h2><ol><li><time>22:20</time><p>前台收到团体房状态同步；房内无人应答。</p></li><li><time>22:23</time><p>房务进入712，发现住客行李仍在房内；未见本人。</p></li><li><time>22:26</time><p>工单被改为“夜间深清”，后续操作转交B2服务区。</p></li><li><time>22:31</time><p>附件2上传后，工单不再接受前台修改。</p></li></ol></section><section class="pms-attachments"><h2>房务附件（2）</h2><article>${photo("room-712-incident", "incident-photo")}<div><b>ATT-712-01 / 房务入室记录</b><p>空房内保留黄色硬壳行李箱与小鸭挂件；窗帘未关，房务车停在门口。</p><small>上传 22:24 · 设备 HK-03</small></div></article><article>${photo("b2-corridor-incident", "incident-photo")}<div><b>ATT-B2-04 / 后勤交接区域</b><p>服务车约束带已放下，湿轮迹从服务梯延伸至外包装卸门。</p><small>上传 22:31 · 设备 B2-02</small></div></article></section><div class="pms-foot"><p>该只读摘要通过团体住宿页面的旧链接映射开放；不包含证件、电话或门锁记录。</p><a href="hotel.html?view=supplier">供应商公示</a><a href="hotel.html?view=annex">采购附件</a></div></main></div>`
        : `<div class="hotel-portal"><section><div class="portal-title"><span>PROPERTY MANAGEMENT</span><h1>关联房务摘要</h1><p>请从有效的团体住宿记录进入。</p></div><a class="hotel-text-link" href="hotel.html?view=group">返回团体入住查询</a></section></div>`;
    }
    if (v === "privacy")
      body = `<div class="hotel-legal"><aside><b>住客服务</b><span class="active">隐私与网络</span><a href="hotel.html?view=group">团体订单</a><a href="hotel.html?view=supplier">供应商公示</a></aside><article><h1>住客隐私与网络说明</h1><p>${D.hotel.privacy}</p><h2>网络记录</h2><p>酒店公开站不会显示MAC地址、证件号码或具体设备身份。处于保险安全确认流程中的投递摘要，仅由获得授权的保险服务商向紧急联系人提供。</p><h2>团体房态</h2><p>项目订单查询只显示入住、正式退房和必要的前台状态摘要。</p><a class="hotel-text-link" href="insurance.html?view=safety">安途旅保安全确认</a></article></div>`;
    if (v === "supplier")
      body = `<div class="hotel-legal"><aside><b>酒店信息</b><span class="active">供应商公示</span><a href="hotel.html?view=annex">历史采购附件</a><a href="hotel.html?view=back">B2后勤说明</a></aside><article><h1>夜间后勤供应商公示</h1><p>${D.hotel.supplierPublic}</p><div class="vendor-card"><div><b>NIGHTPOST 区域团队</b><span>夜间后勤 / 冷链 / 布草运输</span></div><a href="nightpost.html">供应商公开主页</a></div><h2>采购资料</h2><p>${D.hotel.supplierAnnex}</p><a class="hotel-text-link" href="hotel.html?view=annex">历史采购附件摘要</a></article></div>`;
    if (v === "annex")
      body = `<div class="document-center"><aside><b>文档中心</b><span>采购 / 历史附件</span><a href="hotel.html?view=supplier">← 返回供应商公示</a></aside><article class="document-paper"><header><span>BAY TIDE HOTEL</span><small>采购部 · 历史供应商摘要</small></header><h1>夜间后勤供应商历史摘要</h1><table><tr><th>供应商</th><td>NIGHTPOST 区域团队</td></tr><tr><th>合作编号</th><td><b>${esc(D.nightpost.partner)}</b></td></tr><tr><th>结算方式</th><td>按月</td></tr><tr><th>具体账期</th><td>以当月结算文件为准</td></tr></table><p>本文件用于团体采购争议与历史结算核对。</p><div class="legacy-entry"><b>旧供应商查询</b><p>采购附件仍保留供应商迁移前的只读查询地址，合作编号会随链接带入。</p><a href="nightpost-query.html?partner=${encodeURIComponent(D.nightpost.partner)}">打开旧供应商查询</a></div><footer>白潮酒店采购部 · 归档副本</footer></article></div>`;
    if (v === "back")
      body = `<div class="ops-page"><div class="ops-copy"><span>OPERATIONS / B2</span><h1>地下二层后勤通道</h1><p>${rich(D.hotel.back)}</p><dl><div><dt>住客权限</dt><dd>不开放</dd></div><div><dt>主要用途</dt><dd>布草 / 冷链 / 垃圾清运</dd></div><div><dt>夜间线路</dt><dd>B2-N / B2-L</dd></div></dl><p class="ops-note">普通前台只接收状态摘要，不显示夜间工单的客户自定义字段。</p></div>${photo("b2-corridor-incident", "ops-photo")}</div>`;
    shell(body);
    if (v === "group")
      $("#hotelGroup").onsubmit = (e) => {
        e.preventDefault();
        location.href =
          "hotel.html?view=group&code=" +
          encodeURIComponent($("#hotelCode").value);
      };
  }
  function restaurant() {
    visit("food:home");
    const v = qs("view") || "home",
      code = qs("code") || "";
    if (v === "archive") visit("food:archive");
    let body = "";
    if (v === "home")
      body = `<section class="food-hero"><div>${photo("food", "food-hero-img")}<span class="food-caption">昼 · 今日餐桌</span></div><div class="food-hero-copy"><small>LOCAL TABLE · COAST DISTRICT</small><h1>把当天好吃的东西，认真做完</h1><p>午餐固定菜单，21:30后只留六张小桌。</p><a href="restaurant.html?view=menu">看今日菜单</a></div></section><section class="food-intro"><div><span>今日午餐</span><h2>${D.menus[0].items.join(" · ")}</h2><p>${rich(D.menus[0].note)}</p></div><a href="restaurant.html?view=booking">预约一张桌</a></section><section class="food-links"><a href="restaurant.html?view=night"><b>晚场小桌</b><span>21:30 / 仅六桌 / 随机菜单</span></a><a href="restaurant.html?view=history"><b>往期菜单</b><span>查看最近的公开出餐版本</span></a><a href="restaurant.html?view=comments"><b>食客留言</b><span>等位、<em class="lexeme">余味</em>席与真实吐槽</span></a></section>`;
    if (v === "menu") {
      const ms = [...D.menus]
        .filter((m) => !m.archive)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      body = `<div class="menu-page"><div class="menu-cover"><span>MENU · ${ms[0].date}</span><h1>今日菜单</h1><p>午餐为固定出餐；实际供应会根据当日采购微调。</p></div><section class="menu-sheet"><h2>${ms[0].label}</h2>${ms[0].items.map((x, i) => `<div class="menu-line"><span>${String(i + 1).padStart(2, "0")}</span><b>${rich(x)}</b><em>${["主菜 / 当日柑橘与香草", "汤 / 烤南瓜与海盐", "主食 / 炭烤鸡腿", "甜点 / 黄桃与奶冻"][i] || "当日菜品"}</em></div>`).join("")}<p class="menu-note">${rich(ms[0].note)}</p></section><section class="menu-recent"><h2>近期公开菜单</h2>${ms
        .slice(1)
        .map(
          (m) =>
            `<a href="restaurant.html?view=history"><span>${m.date}</span><b>${m.items.map(rich).join(" / ")}</b></a>`,
        )
        .join("")}</section></div>`;
    }
    if (v === "history") {
      const arr = [...D.menus]
          .filter((m) => !m.archive)
          .sort((a, b) => b.date.localeCompare(a.date)),
        pg = Math.max(1, Number(qs("p") || 1)),
        size = 6,
        start = (pg - 1) * size;
      body = `<div class="menu-history"><header><span>PAST MENUS</span><h1>往期菜单</h1><p>公开出餐版本；员工排版与厨房预备页不在主站导航中。</p></header><div class="history-list">${arr
        .slice(start, start + size)
        .map(
          (m) =>
            `<article><time>${m.date}</time><div><b>${m.label}</b><p>${m.items.map(rich).join(" · ")}</p><small>${rich(m.note)}</small></div></article>`,
        )
        .join(
          "",
        )}</div><div class="pagination">${pg > 1 ? `<a href="restaurant.html?view=history&p=${pg - 1}">上一页</a>` : ""}${start + size < arr.length ? `<a href="restaurant.html?view=history&p=${pg + 1}">下一页</a>` : ""}</div></div>`;
    }
    if (v === "night")
      body = `<section class="night-supper"><div class="night-copy"><small>LATE TABLE · 21:30</small><h1>晚场小桌</h1><p>六张桌，不公布固定菜单。厨师根据当天仍适合使用的食材调整小份菜，并遵循已登记过敏原。</p><div class="night-quote"><b>“<em class="lexeme">余味</em>席”</b><p>老客人对晚场随机菜单的旧称，不是单独套餐。</p></div><a href="restaurant.html?view=booking">查看今晚候位</a></div>${photo("supper", "supper-photo")}</section>`;
    if (v === "booking")
      body = `<div class="booking-page"><section><small>RESERVATION</small><h1>订一张桌</h1><p>午餐可在线预约；21:30晚场只开放六桌，随机菜单不接受指定菜品。</p><form class="booking-form" id="bookingForm"><div><label>日期<input value="2026-08-20"></label><label>时间<select><option>19:00</option><option>19:30</option><option>20:00</option><option>21:30 晚场</option></select></label></div><div><label>人数<select><option>1位</option><option>2位</option></select></label><label>饮食偏好<input placeholder="例如：香草类不要"></label></div><label>联系邮箱<input type="email" required placeholder="name@example.com"></label><button>检查可预约时段</button><p id="bookingMsg" class="form-feedback" aria-live="polite"></p></form></section><aside><b>今晚</b><p>普通晚餐仍有少量位置</p><hr><b>21:30 晚场</b><p>网上预约已截止，可电话询问候位。</p><small>随机菜单会遵循已登记过敏原。</small></aside></div>`;
    if (v === "group") {
      const ok =
        code &&
        (norm(code) === norm(D.order.restaurantRef) ||
          norm(code) === norm(D.order.code));
      body = `<div class="food-group"><header><span>GROUP DINING</span><h1>团体用餐确认</h1><p>只显示项目订单同步的必要饮食字段，不显示姓名与联系方式。</p></header><form id="foodGroup"><label>团餐引用 / 项目订单<input id="foodCode" value="${esc(code)}" placeholder="SW-XX-000"></label><button>查询</button></form>${code && !ok ? '<div class="food-error">未找到对应团体用餐记录。</div>' : ""}${ok ? `<div class="diet-card"><span>${esc(D.order.restaurantRef)}</span><b>已同步饮食备注</b><p>香草类不要</p><small>来源项目 ${esc(D.order.code)} · 报名阶段饮食偏好</small></div>` : ""}</div>`;
    }
    if (v === "comments") {
      const pg = Math.max(1, Number(qs("p") || 1)),
        size = 8,
        start = (pg - 1) * size,
        rows = D.restaurantComments.slice(start, start + size);
      body = `<div class="food-comments"><header><span>GUEST BOOK</span><h1>食客留言</h1><p>普通公开留言，按发布时间倒序。</p></header><div>${rows
        .map((x, i) => {
          const [a, ...b] = x.split("|");
          return `<article><span>${String(start + i + 1).padStart(2, "0")}</span><div><b>${esc(a)}</b><p>${rich(b.join(" "))}</p></div></article>`;
        })
        .join(
          "",
        )}</div><div class="pagination">${pg > 1 ? `<a href="restaurant.html?view=comments&p=${pg - 1}">上一页</a>` : ""}${start + size < D.restaurantComments.length ? `<a href="restaurant.html?view=comments&p=${pg + 1}">下一页</a>` : ""}</div></div>`;
    }
    if (v === "archive")
      body = `<div class="kitchen-archive"><aside><span>ARCHIVED PAGE</span><h1>晚场厨房预览</h1><p>旧版员工排版页。主站改版后已经没有导航入口。</p><a href="restaurant.html?view=history">返回公开菜单</a></aside><section><h2>旧排版菜单</h2>${D.menus
        .filter((m) => m.archive)
        .map(
          (m) =>
            `<article><time>${m.date}</time><b>${m.items.map(rich).join(" / ")}</b><p>${rich(m.note)}</p></article>`,
        )
        .join(
          "",
        )}<h2>厨房预备摘要</h2><table><thead><tr><th>日期</th><th>晚场席位</th><th>预备份数</th><th>后仓字段</th><th>结算抬头</th></tr></thead><tbody>${D.restaurantKitchen.map((r) => `<tr><td>${r.date}</td><td>${r.seats}</td><td>${r.prepared}</td><td>${rich(r.batch)}</td><td>${r.settlement}</td></tr>`).join("")}</tbody></table><p class="archive-foot">B2-N为旧后仓批次字段，本页不解释来源；单独看到这一字段不足以判断实际物料。</p></section></div>`;
    shell(body);
    if (v === "group")
      $("#foodGroup").onsubmit = (e) => {
        e.preventDefault();
        location.href =
          "restaurant.html?view=group&code=" +
          encodeURIComponent($("#foodCode").value);
      };
    if (v === "booking")
      $("#bookingForm").onsubmit = (e) => {
        e.preventDefault();
        $("#bookingMsg").textContent =
          "当日网上预约已截止；普通晚餐可致电候位，21:30晚场不再接收网络预约。";
      };
  }
  function life() {
    visit("life:home");
    const id = qs("id"),
      sec = qs("section"),
      A = D.lifestyle?.articles || [];
    if (id) {
      const a = A.find((x) => x.id === id);
      if (!a) {
        location.href = "life.html";
        return;
      }
      visit("life:" + id);
      const paras = D.lifestyle.bodies?.[id] || [a.dek],
        related = A.filter(
          (x) =>
            x.id !== id && (x.section === a.section || x.section === "旅行"),
        ).slice(0, 4);
      shell(
        `<div class="life-article-layout"><article class="life-article"><div class="life-path">首页 / ${esc(a.section)} / 正文</div>${a.sponsored ? '<span class="sponsored-badge">商业合作内容</span>' : ""}<h1>${esc(a.title)}</h1><p class="life-dek">${esc(a.dek)}</p><div class="life-by"><b>${esc(a.author)}</b><time>${esc(a.date)}</time><span>阅读约 6 分钟</span></div><div class="life-copy">${paras.map((p) => `<p>${rich(p)}</p>`).join("")}</div>${id === "l01" ? `<section class="travel-comparison"><header><span>SUMMER 2026</span><h2>七个项目怎么选</h2><p>以下为文章发布时的公开信息；最终价格和服务以项目报名页为准。</p></header>${D.lifestyle.travelPlans.map((x, i) => `<article class="${x.url ? "picked-plan" : ""}"><div class="plan-no">${String(i + 1).padStart(2, "0")}</div><div><h3>${esc(x.name)}</h3><p>${esc(x.fit)}</p><small>${esc(x.note)}</small></div><div><b>${esc(x.days)}</b><span>${esc(x.price)}</span>${x.url ? `<a href="${x.url}">查看项目公开页</a>` : ""}</div></article>`).join("")}</section><div class="life-disclosure"><b>合作内容说明</b><p>${esc(D.lifestyle.partner.disclosure)}</p><span>专题来源码 ${esc(D.lifestyle.partner.campaign)}</span></div>` : ""}<div class="life-actions"><span>收藏 128</span><span>分享</span><span>纠错</span></div></article><aside class="life-related"><h3>继续阅读</h3>${related.map((r) => `<a href="life.html?id=${r.id}"><span>${esc(r.section)} · ${esc(r.date)}</span><b>${esc(r.title)}</b></a>`).join("")}<div class="life-newsletter"><b>每周生活邮件</b><p>旅行、餐桌、城市和工作内容，每周三发送。</p><span>周宁 · 已订阅</span></div></aside></div>`,
      );
      return;
    }
    let list = [...A].sort((a, b) => b.date.localeCompare(a.date));
    if (sec) list = list.filter((x) => x.section === sec);
    const lead = list.find((x) => x.id === "l01") || list[0],
      rest = list.filter((x) => x.id !== lead?.id);
    shell(
      `<div class="life-home"><section class="life-cover"><div>${photo("life-summer", "life-cover-photo")}</div><article><span>${esc(lead?.section || "")}</span>${lead?.sponsored ? '<small class="sponsored-badge">商业合作</small>' : ""}<a href="life.html?id=${lead?.id || ""}"><h1>${rich(lead?.title || "")}</h1></a><p>${esc(lead?.dek || "")}</p><div><b>${esc(lead?.author || "编辑部")}</b><time>${esc(lead?.date || "")}</time></div></article></section><section class="life-stream"><header><h2>${sec ? esc(sec) : "最近更新"}</h2><nav>${["旅行", "城市", "餐桌", "工作", "摄影"].map((x) => `<a href="life.html?section=${encodeURIComponent(x)}">${x}</a>`).join("")}</nav></header><div>${rest.map((a) => `<article><span>${esc(a.section)}</span><a href="life.html?id=${a.id}"><h3>${esc(a.title)}</h3></a><p>${esc(a.dek)}</p><small>${esc(a.author)} · ${esc(a.date)}</small></article>`).join("")}</div></section><aside class="life-side-note"><b>海隅生活编辑说明</b><p>商业合作文章会在标题下方和文末标注合作信息；商业合作不等于对项目安全、保险或履约作额外背书。</p></aside></div>`,
    );
  }
  function news() {
    visit("news:home");
    const id = qs("id"),
      v = qs("view"),
      sec = qs("section");
    if (v === "tip") {
      shell(
        `<div class="news-submit"><header><span>READER TIP</span><h1>向编辑部提交材料</h1><p>可匿名提交公开网页、文件链接与事件说明。编辑会优先处理能够独立复核的材料。</p></header><div class="news-submit-grid"><form id="tipForm"><label>主题<input id="tipSubject" required value="栖岸旅居相关材料"></label><label>材料说明<textarea id="tipNote" required minlength="20" placeholder="写明你看到的公开页面、编号、时间以及它们为什么互相矛盾"></textarea></label><label>公开链接或页面名<input id="tipLink" required placeholder="例如某篇公开报道或企业查询页"></label><label>联系邮箱（可选）<input type="email" placeholder="用于编辑核实"></label><button>提交给编辑部</button><div id="tipMsg" class="form-feedback" aria-live="polite"></div></form><aside><b>提交说明</b><p>请勿上传护照、证件号码或非公开私人资料。</p><p>编辑部只会使用可以独立打开、搜索或向机构核实的来源。</p></aside></div></div>`,
      );
      $("#tipForm").onsubmit = (e) => {
        e.preventDefault();
        if (S.deepConfirmed) {
          S.ending = "expose";
          save();
          location.href = "ending.html";
        } else {
          $("#tipMsg").textContent = "材料已进入编辑部材料邮箱。";
          $("#tipForm").reset();
        }
      };
      return;
    }
    if (v === "attachment") {
      shell(
        `<div class="news-archive"><span>ATTACHMENT CACHE</span><h1>报道公开附件缓存</h1><p>来源：2026-06-21 商业报道 · “白潮酒店更换后勤外包商”</p><div class="attachment-file"><b>night_vendor_202608.pdf</b><dl><div><dt>合作商</dt><dd>NIGHTPOST</dd></div><div><dt>合作编号</dt><dd>${esc(D.nightpost.partner)}</dd></div><div><dt>周期</dt><dd>2026-08</dd></div><div><dt>类别</dt><dd>酒店夜间后勤外包</dd></div></dl></div><div class="cache-link"><b>附件中的历史查询地址</b><p>旧系统仍以合作编号和结算月份读取记录；链接参数来自公开附件。</p><a href="nightpost-query.html?partner=${encodeURIComponent(D.nightpost.partner)}&period=202608">在NIGHTPOST旧系统打开</a></div><small>附件只说明采购与结算关系，不说明客户自定义业务字段。</small></div>`,
      );
      return;
    }
    if (id) {
      const n = D.news.find((x) => x.id === id);
      if (!n) {
        location.href = "news.html";
        return;
      }
      visit("news:" + id);
      const more = D.news
          .filter((x) => x.id !== id && x.section === n.section)
          .slice(0, 4),
        paras = D.newsBodies?.[id] || [n.text];
      shell(
        `<div class="news-article-layout"><article class="news-article"><div class="news-path">首页 / ${n.section}</div><span class="news-section">${n.section}</span><h1>${rich(n.title)}</h1><div class="news-by"><span>${n.by || "海湾晨报编辑部"}</span><time>${n.date}</time></div><div class="article-share">分享 · 收藏 · 字号</div><p class="lead-copy">${rich(n.text)}</p><div class="news-body-copy">${paras.map((x, i) => `<p${i === 0 ? ' class="first"' : ""}>${rich(x)}</p>`).join("")}</div>${id === "n08" ? '<div class="retraction-box"><b>页面状态：已撤下</b><p>编辑记录显示，该页面曾在发布后37分钟被撤下；公开索引仅保留标题与摘要。</p></div>' : ""}${id === "n10" ? '<div class="source-box"><b>公开附件</b><p>报道中引用的酒店后勤外包历史供应商摘要仍可从缓存访问。</p><a href="news.html?view=attachment">查看附件缓存</a></div>' : ""}<div class="news-fact-row"><span>栏目 ${esc(n.section)}</span><span>来源 公开报道 / 机构信息</span><span>更新 ${esc(n.date)}</span></div><footer>责任编辑：${n.by || "编辑部"} · 本文发布时间 ${n.date}</footer></article><aside class="news-related"><h3>同栏目</h3>${more.map((x) => `<a href="news.html?id=${x.id}"><span>${x.date}</span><b>${rich(x.title)}</b></a>`).join("")}</aside></div>`,
      );
      return;
    }
    let arr = [...D.news].sort((a, b) => b.date.localeCompare(a.date));
    if (sec) arr = arr.filter((x) => x.section === sec);
    const pg = Math.max(1, Number(qs("p") || 1)),
      size = 9,
      start = (pg - 1) * size,
      rows = arr.slice(start, start + size),
      lead = rows[0],
      secondary = rows.slice(1, 4),
      rest = rows.slice(4);
    shell(
      `<div class="news-home"><section class="news-lead"><article><span>${lead?.section || ""}</span><a href="news.html?id=${lead?.id || ""}"><h1>${rich(lead?.title || "")}</h1></a><p>${rich(lead?.text || "")}</p><small>${lead?.date || ""}</small></article><div>${secondary.map((n) => `<a href="news.html?id=${n.id}"><span>${n.section}</span><h2>${rich(n.title)}</h2><p>${rich(n.text)}</p></a>`).join("")}</div></section><div class="news-divider"><b>${sec ? esc(sec) : "最新报道"}</b><span>LOCAL / TRAVEL / BUSINESS</span></div><section class="news-index">${rest.map((n) => `<a href="news.html?id=${n.id}"><time>${n.date}</time><span>${n.section}</span><div><h2>${rich(n.title)}</h2><p>${rich(n.text)}</p></div></a>`).join("")}</section><div class="pagination">${pg > 1 ? `<a href="news.html?${sec ? "section=" + encodeURIComponent(sec) + "&" : ""}p=${pg - 1}">上一版</a>` : ""}${start + size < arr.length ? `<a href="news.html?${sec ? "section=" + encodeURIComponent(sec) + "&" : ""}p=${pg + 1}">下一版</a>` : ""}</div></div>`,
    );
  }
  function insurance() {
    visit("ins:home");
    const v = qs("view") || "home";
    if (v === "home") {
      shell(
        `<div class="ins-dashboard"><section class="policy-hero"><div><span>我的旅行保障</span><h1>境外旅行综合保障</h1><p>保单号 ${D.insurance.policy}</p><div class="policy-tags"><b>保障中</b><span>旅行人：${D.insurance.traveler}</span><span>第二紧急联系人：${D.insurance.contact}</span></div></div>${photo("flight", "policy-photo")}</section><section class="ins-actions"><a href="insurance.html?view=safety"><span>安全确认</span><b>当前有1项逾期确认</b><em>查看状态 →</em></a><a href="insurance.html?view=case"><span>境外协助</span><b>${S.caseCreated ? "协助单 AT-AID-0820" : "报告失联 / 医疗 / 证件问题"}</b><em>进入协助中心 →</em></a><a href="insurance.html?view=help"><span>帮助中心</span><b>了解援助范围与材料</b><em>阅读说明 →</em></a></section><section class="policy-info"><h2>保单摘要</h2><dl><div><dt>保障期间</dt><dd>2026-08-14 — 2026-08-23</dd></div><div><dt>旅行地区</dt><dd>境外海岸区</dd></div><div><dt>旅行人</dt><dd>林沅</dd></div><div><dt>紧急联系人</dt><dd>周宁</dd></div></dl></section></div>`,
      );
      return;
    }
    if (v === "safety") {
      visit("ins:safety");
      shell(
        `<div class="safety-page"><header><span>SAFETY CHECK</span><h1>旅行人安全确认</h1><p>用于行程中定期确认已登记设备与本人状态。</p></header><div class="safety-status"><div class="status-mark">!</div><div><b>确认逾期</b><p>${rich(D.insurance.safety)}</p></div><span>需要关注</span></div><section class="safety-timeline"><h2>投递记录</h2><article><time>08/19 07:46</time><div><b>安全确认请求送达</b><p>已登记设备收到确认请求，<em class="lexeme">未收到本人确认</em>。</p></div></article><article class="latest"><time>08/19 22:11</time><div><b>再次送达</b><p>${rich(D.insurance.gateway)}</p></div></article></section><div class="safety-actions"><p>如果无法通过常用联系方式确认旅行人安全，可由紧急联系人发起境外协助。</p><a href="insurance.html?view=case">进入境外紧急协助</a></div></div>`,
      );
      return;
    }
    if (v === "help") {
      shell(
        `<div class="help-center"><aside><b>帮助中心</b><span class="active">境外紧急协助</span><span>安全确认</span><span>证件遗失</span><span>医疗与住院</span><span>理赔材料</span></aside><article><h1>境外紧急协助</h1><p>紧急联系人可报告失联、证件遗失、医疗协助等情况。请尽量提供最后已知地点、住宿信息与可以核实的业务记录。</p><h2>提交后会发生什么</h2><ol><li>协助中心核实保单和紧急联系人权限。</li><li>人工坐席核对最后位置与相关服务记录。</li><li>必要时联系当地援助合作机构和正式公共安全渠道。</li></ol><h2>请避免提交</h2><p>未经授权的私人账号密码、非公开医疗记录或与事件无关的个人信息。</p></article></div>`,
      );
      return;
    }
    const deep = S.deepConfirmed,
      created = S.caseCreated;
    visit("ins:case");
    if (!created) {
      shell(
        `<div class="case-center"><aside><b>境外协助中心</b><span class="active">新建协助请求</span><a href="insurance.html?view=help">协助说明</a><small>24小时境外援助</small></aside><section><header><span>NEW ASSISTANCE CASE</span><h1>报告无法联系旅行人</h1><p>该表单由保单紧急联系人提交，后续信息由人工协助中心核实。</p></header><form id="caseForm" class="case-form"><label>旅行人<input value="林沅" readonly></label><label>保单号<input value="${D.insurance.policy}" readonly></label><label>最后可以确认联系的时间<input required value="2026-08-19 21:38"></label><label>最后已知住宿<input value="白潮酒店"></label><label class="wide">情况说明<textarea required minlength="6">自08/19晚间开始无法联系；项目方称工作人员已确认本人安全，但本人未完成安途安全确认。</textarea></label><label class="wide case-consent"><input type="checkbox" checked> 我确认以保单紧急联系人身份提交上述信息。</label><button class="wide">提交协助请求</button></form></section></div>`,
      );
      $("#caseForm").onsubmit = (e) => {
        e.preventDefault();
        S.caseCreated = true;
        save();
        location.reload();
      };
      return;
    }
    shell(
      `<div class="case-center"><aside><b>境外协助中心</b><span class="active">AT-AID-0820</span><a href="insurance.html?view=help">协助说明</a><small>24小时境外援助</small></aside><section><header class="case-head"><div><span>CASE / AT-AID-0820</span><h1>旅行人无法联系</h1></div><em>已受理</em></header><div class="case-progress"><span class="done">请求提交</span><span class="active">补充位置</span><span>人工核验</span><span>当地协助</span></div><div class="case-note"><b>协助中心</b><p>现有信息只能确认旅行人曾在白潮区域活动。若你找到更具体、可以复核的公开记录，可以继续补充。</p></div><form id="updateForm" class="case-form"><label>最后已知地点<input required id="aidPlace" value="白潮酒店" placeholder="填写你已经核实到的位置"></label><label>相关业务记录<input required id="aidRefs" value="${D.order.code}" placeholder="可填写多个业务编号"></label><label class="wide">补充说明<textarea required minlength="20" id="aidNote" placeholder="写明最新状态、时间与来源"></textarea></label><p class="wide case-helper">人工坐席会根据你提交的地点、业务记录和最新状态自行交叉核验。不需要提交私人账号密码。</p><button class="wide">更新协助单</button><div id="aidMsg" class="wide form-feedback"></div></form></section></div>`,
    );
    $("#updateForm").onsubmit = (e) => {
      e.preventDefault();
      const note = $("#aidNote").value.trim();
      if (!deep) {
        $("#aidMsg").textContent = "补充信息已保存，人工坐席会继续核实。";
        return;
      }
      if (note.length >= 20) {
        S.ending = "rescue";
        save();
        location.href = "ending.html";
      } else {
        $("#aidMsg").textContent = "请补充最新状态与信息来源。";
      }
    };
  }
  function nightpost() {
    visit("night:home");
    const v = qs("view") || "home";
    if (v === "service") {
      shell(
        `<div class="np-service"><header><span>CAPABILITIES</span><h1>区域夜间供应链</h1><p>NIGHTPOST为酒店、餐饮、实验室与商业客户提供夜间冷链和定时配送。</p></header><section><div><b>Cold Chain</b><h2>冷链配送</h2><p>温控仓储、夜间交接、区域末端配送。</p></div><div><b>Hotel Operations</b><h2>酒店后勤</h2><p>布草、补给、批量物资与夜间任务。</p></div><div><b>High-value Parts</b><h2>高价值配件</h2><p>按客户字段分类、状态确认与交接。</p></div><div><b>Legacy Records</b><h2>历史客户查询</h2><p>迁移期旧客户可按合作编号和账期查询历史运单。</p><a href="nightpost-query.html">进入旧客户查询</a></div></section></div>`,
      );
      return;
    }
    shell(
      `<section class="np-hero"><div class="np-hero-copy"><span>NIGHT OPERATIONS · 24/7</span><h1>Regional logistics after hours.</h1><p>冷链、酒店后勤、样本与高价值配件的夜间运输网络。</p><div><a href="nightpost.html?view=service">服务能力</a><a href="nightpost-query.html">客户查询</a></div><dl><div><dt>Coverage</dt><dd>Coast District</dd></div><div><dt>Operations</dt><dd>24 / 7</dd></div><div><dt>Portal</dt><dd>Legacy Migration</dd></div></dl></div>${photo("cold", "np-photo")}</section><section class="np-status"><div><span class="green-dot"></span><b>区域网络正常</b><small>Last update 23:21</small></div><a href="nightpost-query.html">查询历史合作记录 →</a></section>`,
    );
  }
  function parsePeriod(x = "") {
    const n = norm(x),
      m = n.match(/(20\d{2})(0[1-9]|1[0-2])/);
    return m ? m[1] + m[2] : "";
  }
  function nightQuery() {
    visit("night:query");
    const access = S.nightAccess,
      hintedPartner = qs("partner") || "",
      requested = parsePeriod(qs("period") || ""),
      active = requested || S.nightPeriod || (access ? "202608" : "");
    if (requested && access) {
      S.nightPeriod = requested;
      save();
    }
    if (!access) {
      shell(
        `<div class="legacy-login"><aside><span>NIGHTPOST</span><b>Legacy Partner Portal</b><p>旧客户迁移期间保留的历史合作查询入口。</p><dl><div><dt>System</dt><dd>NP Legacy / 4.2</dd></div><div><dt>Status</dt><dd>Read only</dd></div></dl></aside><section><h1>历史合作查询</h1><p>输入合作编号与结算周期。查询只返回该客户对应账期的历史运单。</p>${hintedPartner || requested ? '<div class="prefill-notice">参数来自你刚才打开的公开采购附件；仍需手动确认查询。</div>' : ""}<form id="nightLogin"><label>Partner ID<input id="partner" autocomplete="off" value="${esc(hintedPartner)}" placeholder="BTH-0000"></label><label>Billing period<input id="period" autocomplete="off" value="${esc(requested)}" placeholder="YYYYMM"></label><button>QUERY RECORDS</button></form><div id="loginMsg" aria-live="polite"></div><small>合作编号见签约或采购资料；账期使用结算月份 YYYYMM。旧客户系统只读，不需要个人账号或密码。</small></section></div>`,
      );
      $("#nightLogin").onsubmit = (e) => {
        e.preventDefault();
        const partner = norm($("#partner").value),
          period = parsePeriod($("#period").value);
        if (partner === norm(D.nightpost.partner) && period) {
          S.nightAccess = true;
          S.nightPeriod = period;
          save();
          location.href = "nightpost-query.html?period=" + period;
        } else
          $("#loginMsg").innerHTML =
            '<div class="np-error">合作信息不匹配。请核对合作编号与账期。</div>';
      };
      return;
    }
    const manifest = nightRows();
    const currentRecord = deepRecord();
    const periods = [...new Set(manifest.map((x) => x.period))]
      .sort()
      .reverse();
    const code = qs("code");
    if (code) {
      const x = manifest.find(
        (m) => norm(m.code) === norm(code) && m.period === active,
      );
      if (!x) {
        location.href = "nightpost-query.html?period=" + active;
        return;
      }
      visit("night:" + code);
      if (currentRecord && norm(code) === norm(currentRecord.code)) {
        S.deepConfirmed = true;
        save();
      }
      const isLY = currentRecord && norm(code) === norm(currentRecord.code);
      shell(
        `<div class="manifest-detail"><div class="np-breadcrumb"><a href="nightpost-query.html?period=${active}">${active} records</a> / ${esc(x.code)}</div><header><div><span>SHIPMENT RECORD</span><h1>${esc(x.code)}</h1></div><em class="${isLY ? "live-state" : ""}">${rich(x.state)}</em></header>${isLY ? `<div class="handover-photo"><span>ATTACHMENT / HANDOVER AUDIT</span>${photo("nightpost-handover", "handover-image")}<div><b>附件与来源酒店房务记录使用同一只黄色行李箱</b><p>外箱贴：黄色鸭子挂件；交接区域：B2；拍摄设备：NP-GATE-02。</p><small>平台未提供住客本人授权或正式退房凭证。</small></div></div>` : ""}<table><tr><th>Class</th><td>${rich(x.class)}</td><th>Route</th><td>${rich(x.route)}</td></tr><tr><th>Origin reference</th><td>${esc(x.origin)}</td><th>Receiver</th><td>${rich(x.receiver || "—")}</td></tr><tr><th>Processing</th><td colspan="3">${rich(x.processing || "—")}</td></tr></table>${isLY ? `<div class="live-manifest"><b>ORIGIN MAPPING</b><p>${esc(x.origin)} → ${esc(x.code)}</p><span>当前记录时间 ${D.timeline.now}</span><span>计划换站 ${D.timeline.transfer}</span></div><div class="leader-draft"><small>UNSENT / INTERNAL NOTE</small><b>韩译</b><p>${rich(narrative().leaderDraft)}</p></div>` : ""}<div class="np-record-actions"><a href="nightpost-query.html?period=${active}">← 返回运单列表</a>${x.origin === D.order.code ? `<a href="qian-archive.html?code=${encodeURIComponent(x.origin)}">打开来源订单</a>` : ""}</div></div>`,
      );
      return;
    }
    const rows = manifest.filter((x) => x.period === active);
    shell(
      `<div class="manifest-page"><header><div><span>PARTNER / ${D.nightpost.partner}</span><h1>Historical records</h1></div><div class="manifest-period"><label>Billing period<select id="periodSelect">${periods.map((x) => `<option value="${x}" ${x === active ? "selected" : ""}>${x}</option>`).join("")}</select></label><button id="logoutLegacy">Sign out</button></div></header><div class="manifest-meta"><b>Billing period ${active}</b><span>${rows.length} records</span><span>Read only</span></div>${rows.length ? `<table><thead><tr><th>Record ID</th><th>Class</th><th>Status</th><th>Route</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td><b>${esc(x.code)}</b></td><td>${rich(x.class)}</td><td>${rich(x.state)}</td><td>${rich(x.route)}</td><td><a href="nightpost-query.html?period=${active}&code=${encodeURIComponent(x.code)}">OPEN</a></td></tr>`).join("")}</tbody></table>` : '<div class="np-empty">该账期没有可查询的历史记录。</div>'}<div class="manifest-foot">客户自定义字段由合作方定义，NIGHTPOST公开站不解释字段业务含义。不同客户、不同年份使用相同缩写时，不代表同一对象。</div></div>`,
    );
    $("#periodSelect").onchange = (e) =>
      (location.href =
        "nightpost-query.html?period=" + encodeURIComponent(e.target.value));
    $("#logoutLegacy").onclick = () => {
      delete S.nightAccess;
      delete S.nightPeriod;
      save();
      location.href = "nightpost-query.html";
    };
  }

  function buildSearch() {
    let out = [];
    (D.lifestyle?.articles || []).forEach((x) =>
      out.push({
        type: "海隅生活",
        title: x.title,
        text:
          x.dek +
          " " +
          x.author +
          " " +
          x.section +
          " " +
          (x.id === "l01"
            ? D.lifestyle.partner.name +
              " " +
              D.lifestyle.partner.campaign +
              " 栖岸 暑期旅行"
            : ""),
        url: "life.html?id=" + x.id,
      }),
    );
    D.qian.forEach((x) =>
      out.push({
        type: "栖岸",
        title: x.title,
        text: x.text,
        url: "qian.html?view=" + x.id,
      }),
    );
    D.forum.forEach((x) =>
      out.push({
        type: "旅友圈",
        title: x.title,
        text: x.author + " " + x.text + " " + x.comments.join(" "),
        url: "forum.html?id=" + x.id,
      }),
    );
    D.news.forEach((x) =>
      out.push({
        type: "海湾晨报",
        title: x.title,
        text: x.text + " " + (x.by || ""),
        url: "news.html?id=" + x.id,
      }),
    );
    D.menus.forEach((x) =>
      out.push({
        type: x.archive ? "拾味旧菜单" : "拾味菜单",
        title: x.date + " " + x.label,
        text: x.items.join(" ") + " " + x.note,
        url: x.archive
          ? "restaurant.html?view=archive"
          : "restaurant.html?view=history",
      }),
    );
    D.restaurantComments.forEach((x, i) =>
      out.push({
        type: "拾味留言",
        title: "食客留言 " + (i + 1),
        text: x.replaceAll("|", " "),
        url: "restaurant.html?view=comments",
      }),
    );
    D.restaurantKitchen.forEach((r) =>
      out.push({
        type: "拾味旧厨房",
        title: r.date + " 厨房预备摘要",
        text: r.batch + " " + r.settlement + " " + r.note,
        url: "restaurant.html?view=archive",
      }),
    );
    D.hotelReviews.forEach((r) =>
      out.push({
        type: "白潮酒店",
        title: r.author + " · 住客评价",
        text: r.text,
        url: "hotel.html?view=reviews",
      }),
    );
    (D.hotelRooms || []).forEach((r) =>
      out.push({
        type: "白潮酒店",
        title: r.name,
        text: r.en + " " + r.size + " " + r.desc,
        url: "hotel.html?view=service#" + r.id,
      }),
    );
    out.push(
      {
        type: "栖岸",
        title: "照片与内容合作说明",
        text: "远岸内容合作中心 海隅生活 HY-SUMMER26 商业合作 素材授权 报名来源渠道",
        url: "qian.html?view=photo",
      },
      {
        type: "海湾晨报",
        title: "机场晚间两班航班取消",
        text: "梁昭 提前返程 返程 航班 机场 7月16日 晚间取消 团体接驳没有新增临时大巴记录",
        url: "news.html?id=n07",
      },
      {
        type: "海湾晨报",
        title: "澄海国际文旅回应网络讨论",
        text: "栖岸 提前返程 提前离团 澄海国际文旅 团体游客 私人原因 提前结束行程",
        url: "news.html?id=n06",
      },
      {
        type: "旅友圈",
        title: "往届“提前返程”讨论",
        text: "栖岸 提前返程 提前离团 梁昭 行程 调整 返程记录",
        url: "forum.html?tag=返程",
      },
      {
        type: "海湾晨报",
        title: "白潮酒店更换后勤外包商",
        text: "白潮酒店 后勤 供应商 NIGHTPOST 夜间物流 公开附件 2026-08",
        url: "news.html?id=n10",
      },
      {
        type: "白潮酒店",
        title: "团体入住自助",
        text: `林沅 白潮酒店 团体订单 入住 正式退房 712 ${D.hotel.groupCode} ${D.order.code}`,
        url: "hotel.html?view=group",
      },
      {
        type: "白潮酒店",
        title: "夜间后勤供应商公示",
        text: D.hotel.supplierPublic + " NIGHTPOST 酒店供应商 外包",
        url: "hotel.html?view=supplier",
      },
      {
        type: "白潮酒店",
        title: "历史采购附件",
        text: D.hotel.supplierAnnex + " " + D.nightpost.partner,
        url: "hotel.html?view=annex",
      },
      {
        type: "栖岸订单中心",
        title: "历史签约版本查询",
        text: `栖岸 订单 历史行程 DAY5 白潮 ${D.order.code}`,
        url: "qian-archive.html",
      },
      {
        type: "NIGHTPOST",
        title: "NIGHTPOST 夜间物流",
        text: "夜间物流 冷链 酒店后勤 供应商 历史合作",
        url: "nightpost.html",
      },
      {
        type: "安途旅保",
        title: "旅行人安全确认",
        text: D.insurance.safety + " " + D.insurance.gateway + " 林沅 白潮 712",
        url: "insurance.html?view=safety",
      },
    );
    return out;
  }
  function balancedHits(items) {
    const b = {};
    items.forEach((x) => (b[x.type] ??= []).push(x));
    const order = Object.keys(b),
      out = [];
    let moved = true;
    while (moved) {
      moved = false;
      for (const k of order) {
        if (b[k].length) {
          out.push(b[k].shift());
          moved = true;
        }
      }
    }
    return out;
  }
  function searchPage() {
    visit("search:home");
    const q = qs("q") || "",
      terms = queryTerms(q);
    if (q && !S.searches.includes(q)) {
      S.searches.unshift(q);
      S.searches = S.searches.slice(0, 10);
      save();
    }
    let hits = [];
    if (terms.length)
      hits = balancedHits(
        buildSearch().filter((x) => {
          const hay = norm(x.type + " " + x.title + " " + x.text);
          return terms.every((t) => withinOneEdit(hay, t));
        }),
      );
    const pg = Math.max(1, Number(qs("p") || 1)),
      size = 10,
      start = (pg - 1) * size,
      items = hits.slice(start, start + size);
    shell(
      `<div class="search-results-page"><div class="search-tabs"><span class="active">全部</span><span>新闻</span><span>社区</span><span>网页</span><span>旧索引</span></div>${
        q
          ? `<p class="result-count">找到约 ${hits.length} 条公开结果 · “${esc(q)}”</p>`
          : `<div class="search-welcome"><h1>海隅搜索</h1><p>输入你正在查的人、机构或事情。</p>${S.searches.length ? `<div>最近搜索：${S.searches.map((x) => `<a href="search.html?q=${encodeURIComponent(x)}">${esc(x)}</a>`).join(" · ")}</div>` : ""}${
              (S.history || []).filter((x) => !x.u.startsWith("search.html"))
                .length
                ? `<div class="recent-browse"><b>最近浏览</b>${(S.history || [])
                    .filter((x) => !x.u.startsWith("search.html"))
                    .slice(0, 5)
                    .map((x) => `<a href="${x.u}">${esc(x.t)}</a>`)
                    .join("")}</div>`
                : ""
            }</div>`
      }${q && items.length ? `<div class="serp">${items.map((h) => `<article><span class="serp-url">${esc(h.type)} · ${esc(new URL(h.url, "https://haiyu.local").pathname)}</span><a href="${h.url}"><h2>${rich(h.title)}</h2></a><p>${rich(h.text.slice(0, 190))}</p></article>`).join("")}</div><div class="pagination">${pg > 1 ? `<a href="search.html?q=${encodeURIComponent(q)}&p=${pg - 1}">上一页</a>` : ""}${start + size < hits.length ? `<a href="search.html?q=${encodeURIComponent(q)}&p=${pg + 1}">下一页</a>` : ""}</div>` : q ? '<div class="no-results"><h2>没有找到完全匹配的结果</h2><p>可以只保留你确定的人名、机构或事情描述，再试一次。</p></div>' : ""}</div>`,
    );
  }
  function ending() {
    const saved = S.ending;
    if (!saved) {
      location.href = "index.html";
      return;
    }
    const type = saved === "return" ? "support" : saved;
    const e = narrative().endings?.[type];
    if (!e) {
      location.href = "index.html";
      return;
    }
    const caseVoices = (narrative().caseVoices || []).filter((voice) =>
        voice.requires.every((visit) => S.visits.includes(visit)),
      ),
      intimate =
        S.visits.includes("mail:window-memory") &&
        S.visits.includes("forum:f03"),
      artifactVisual =
        type === "rescue"
          ? `${photo("windows", "ending-photo")}<small>临时住处 / 09月04日</small>`
          : type === "expose"
            ? `${photo("nightpost-handover", "ending-photo")}<small>公开附件副本 / 隐私字段已遮盖</small>`
            : '<div class="status-paper"><span>栖岸参与者状态</span><b>LY / 已中止换线</b><em>LAST SYNC 23:43</em></div>';
    shell(
      `<div class="ending-screen ${esc(type)}"><span>${esc(e.eyebrow)}</span><h1>${esc(e.title)}</h1><p>${esc(e.intro)}</p><blockquote>${esc(e.quote)}</blockquote><div class="ending-message"><small>${esc(e.messageTitle)}</small><b>${esc(e.speaker || "林沅")}</b>${e.messages.map((x) => `<p>${esc(x)}</p>`).join("")}</div>${e.followup ? `<div class="ending-message ending-followup"><small>稍后收到</small><b>林沅</b><p>${esc(e.followup)}</p></div>` : ""}<div class="ending-artifact ${esc(type)}-artifact"><div>${artifactVisual}</div><section><small>这条路留下的东西</small><b>${esc(e.artifactTitle)}</b><p>${esc(e.artifactText)}</p></section></div><div class="ending-consequence"><b>这条路留下的结果</b><p>${esc(e.consequence)}</p></div>${caseVoices.length ? `<section class="ending-voices"><small>你读过的名字，后来仍在网上留下这些</small>${caseVoices.map((voice) => `<article><b>${esc(voice.title)}</b><p>${esc(voice.text)}</p></article>`).join("")}</section>` : ""}${intimate ? `<div class="ending-epilogue"><small>一年后</small><p>${esc(narrative().intimate)}</p></div>` : ""}<div class="ending-actions"><a href="index.html">回到邮箱</a><a href="#" id="endingReset">重新开始</a></div></div>`,
    );
    $("#endingReset").onclick = (event) => {
      event.preventDefault();
      STORE.removeItem(KEY);
      location.href = "index.html";
    };
  }
  function notfound() {
    shell(
      `<div class="error404"><b>404</b><h1>页面不存在</h1><p>这个页面可能已经迁移、失效或被新的版本替换。</p><a href="search.html">搜索公开索引</a><a href="index.html">返回邮箱</a></div>`,
    );
  }
  const routes = {
    index,
    life,
    qian,
    "qian-archive": qianArchive,
    forum,
    hotel,
    restaurant,
    news,
    insurance,
    nightpost,
    "nightpost-query": nightQuery,
    search: searchPage,
    ending,
    404: notfound,
  };
  (routes[page()] || notfound)();
})();
