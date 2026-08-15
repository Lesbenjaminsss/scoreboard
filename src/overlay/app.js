'use strict';

(function () {
  const sb = document.getElementById('sb');
  const bar = document.getElementById('bar');
  const empty = document.getElementById('empty');

  const leagueLogo = document.getElementById('leagueLogo');
  const leagueName = document.getElementById('leagueName');
  const homeCrest = document.getElementById('homeCrest');
  const homeName = document.getElementById('homeName');
  const awayCrest = document.getElementById('awayCrest');
  const awayName = document.getElementById('awayName');
  const scoreEl = document.getElementById('score');
  const scoreHome = document.getElementById('scoreHome');
  const scoreAway = document.getElementById('scoreAway');
  const midLogo = document.getElementById('midLogo');
  const clockEl = document.getElementById('clock');
  const liveEl = document.querySelector('.live');
  const liveText = document.getElementById('liveText');
  const homeCards = document.getElementById('homeCards');
  const awayCards = document.getElementById('awayCards');
  const homeGoals = document.getElementById('homeGoals');
  const awayGoals = document.getElementById('awayGoals');
  const statsPanel = document.getElementById('statsPanel');
  const statsTitle = document.getElementById('statsTitle');
  const statsMatch = document.getElementById('statsMatch');
  const statsBody = document.getElementById('statsBody');
  const goalPanel = document.getElementById('goalPanel');
  const goalTag = document.getElementById('goalTag');
  const goalName = document.getElementById('goalName');
  const goalMin = document.getElementById('goalMin');
  const goalPhoto = document.getElementById('goalPhoto');

  let matches = [];
  let index = 0;
  let lang = 'tr';
  let settings = {
    cycleInterval: 8000,
    scale: 1,
    opacity: 1,
    position: 'bottom',
    offsetY: 26,
    language: 'tr',
    showVersion: false,
    versionPosition: 'bottom-left',
  };
  let prevScores = {};
  let prevCardCounts = {};
  const seenGoals = {};
  let goalTimer = null;
  let currentId = null;
  let fetchedAt = 0;
  let started = false;

  // ---------- helpers ----------

  function t(key) {
    return (window.I18N && window.I18N[lang] && window.I18N[lang][key]) || (window.I18N && window.I18N.tr[key]) || key;
  }

  const VALID_POSITIONS = ['bottom', 'top', 'top-left', 'top-right', 'middle-left', 'middle-right'];

  // Display clock. When the period has overrun its regular length while still
  // live, show stoppage time like "45+2'" / "90+3'" (derived from periodStart).
  function displayClock(m, now) {
    if (!m.isLive || m.status !== 'minutes' || !m.periodStart) return m.clockLabel;
    const elapsed = Math.floor((now - m.periodStart) / 60000) + 1;
    if (m.periodId === 1) {
      const plus = Math.min(9, elapsed - 45);
      if (plus > 0) return `45+${plus}'`;
      return `${Math.max(1, Math.min(45, elapsed))}'`;
    }
    if (m.periodId === 2) {
      const plus = Math.min(9, elapsed - 45);
      if (plus > 0) return `90+${plus}'`;
      return `${Math.max(46, Math.min(90, 45 + elapsed))}'`;
    }
    const plus = Math.min(9, elapsed - 30);
    if (plus > 0) return `120+${plus}'`;
    return `${Math.max(91, Math.min(120, 90 + elapsed))}'`;
  }

  function numericMinute(m) {
    if (!m.isLive || m.status !== 'minutes' || !m.periodStart) return null;
    const elapsed = Math.floor((Date.now() - m.periodStart) / 60000) + 1;
    let min;
    if (m.periodId === 1) min = Math.max(1, Math.min(45, elapsed));
    else if (m.periodId === 2) min = Math.max(46, Math.min(90, 45 + elapsed));
    else min = Math.max(91, Math.min(120, 90 + elapsed));
    return min;
  }

  function currentMatch() {
    return matches[index] || null;
  }

  function applySettings() {
    sb.style.setProperty('--scale', settings.scale || 1);
    sb.style.setProperty('--opacity', settings.opacity == null ? 1 : settings.opacity);
    sb.style.setProperty('--offset-y', `${settings.offsetY == null ? 26 : settings.offsetY}px`);
    document.documentElement.style.setProperty('--opacity', settings.opacity == null ? 1 : settings.opacity);
    sb.dataset.pos = VALID_POSITIONS.includes(settings.position) ? settings.position : 'bottom';

    lang = settings.language === 'en' ? 'en' : 'tr';
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });

    const versionEl = document.getElementById('version');
    versionEl.classList.toggle('hidden', settings.showVersion !== true);
    versionEl.classList.toggle('pos-top', settings.versionPosition === 'top-left');
  }

  // ---------- rendering ----------

  function setImg(el, src, fb) {
    const next = el.nextElementSibling;
    const fbEl = next && next.classList.contains('img-fallback') ? next : null;
    if (fbEl) fbEl.classList.remove('show');
    if (src) {
      el.onerror = () => {
        el.style.visibility = 'hidden';
        if (fbEl) {
          if (fb != null) fbEl.textContent = fb;
          fbEl.classList.add('show');
        }
      };
      el.src = src;
      el.style.visibility = 'visible';
    } else {
      el.removeAttribute('src');
      el.style.visibility = 'hidden';
      if (fbEl) {
        if (fb != null) fbEl.textContent = fb;
        fbEl.classList.add('show');
      }
    }
  }

  function shortMark(name) {
    return String(name || '').trim().charAt(0).toUpperCase() || '?';
  }

  function setTeam(img, name, team) {
    setImg(img, team && team.logo, team ? shortMark(team.name) : null);
    name.textContent = team ? team.name.toUpperCase() : '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderCards(container, kinds, matchId) {
    const list = Array.isArray(kinds) ? kinds : [];
    const html = list
      .map((k) => `<span class="card ${k === 'rc' ? 'rc' : 'yc'}"></span>`)
      .join('');
    if (container.dataset.html === html) return;
    container.dataset.html = html;
    container.innerHTML = html;
    const prev = prevCardCounts[matchId + ':' + container.id] || 0;
    const added = list.length - prev;
    prevCardCounts[matchId + ':' + container.id] = list.length;
    if (added > 0) {
      const els = container.querySelectorAll('.card');
      for (let i = Math.max(0, els.length - added); i < els.length; i += 1) {
        els[i].classList.add('in');
      }
    }
  }

  function goalChipHtml(g) {
    const fb = escapeHtml(shortMark(g.playerName));
    const name = escapeHtml(g.playerName || '');
    const min = escapeHtml(g.minute || '');
    const photo = g.photo
      ? `<img class="g-chip-photo" alt="" src="${escapeHtml(g.photo)}" /><span class="g-chip-fb">${fb}</span>`
      : `<span class="g-chip-fb show">${fb}</span>`;
    return `<span class="goal-chip">${photo}<span class="g-chip-name">${name}</span><span class="g-chip-min">${min}'</span></span>`;
  }

  function wireGoalChipImgs(container) {
    container.querySelectorAll('.goal-chip img.g-chip-photo').forEach((img) => {
      img.onerror = () => {
        img.style.visibility = 'hidden';
        const fb = img.nextElementSibling;
        if (fb && fb.classList.contains('g-chip-fb')) fb.classList.add('show');
      };
    });
  }

  function renderGoals(container, goals, side) {
    const list = (Array.isArray(goals) ? goals : []).filter((g) => g.position === side);
    const html = list.map(goalChipHtml).join('');
    if (container.dataset.html === html) return;
    container.dataset.html = html;
    container.innerHTML = html;
    wireGoalChipImgs(container);
  }

  function scoreKey(m) {
    return `${m.score.home}|${m.score.away}`;
  }

  function render() {
    const m = currentMatch();
    if (!m) {
      sb.classList.add('hidden');
      empty.classList.remove('hidden');
      bar.classList.remove('in', 'switching');
      return;
    }
    empty.classList.add('hidden');
    sb.classList.remove('hidden');

    // league accent -> middle badge + glow
    const style = m.style || {};
    sb.style.setProperty('--accent', style.primary || '#38003c');
    sb.style.setProperty('--accent2', style.secondary || '#00ff87');

    setTeam(homeCrest, homeName, m.home);
    setTeam(awayCrest, awayName, m.away);

    renderCards(homeCards, m.events && m.events.home, m.id);
    renderCards(awayCards, m.events && m.events.away, m.id);
    renderGoals(homeGoals, m.events && m.events.goals, 'home');
    renderGoals(awayGoals, m.events && m.events.goals, 'away');

    setImg(leagueLogo, m.competitionLogo, shortMark(m.competitionName));
    leagueName.textContent = (m.competitionName || t('leaguePlaceholder')).toUpperCase();

    setImg(midLogo, m.competitionLogo, shortMark(m.competitionName));

    scoreHome.textContent = m.score.home !== '' && m.score.home != null ? m.score.home : '-';
    scoreAway.textContent = m.score.away !== '' && m.score.away != null ? m.score.away : '-';

    // goal animation on score change
    const key = scoreKey(m);
    if (prevScores[m.id] !== undefined && prevScores[m.id] !== key) {
      scoreEl.classList.remove('goal');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('goal');
      setTimeout(() => scoreEl.classList.remove('goal'), 800);
    }
    prevScores[m.id] = key;

    checkGoals(m);

    if (m.isLive) {
      liveEl.classList.remove('off');
      liveText.textContent = t('LIVE');
      clockEl.textContent = displayClock(m, Date.now());
    } else if (m.state === 'post') {
      liveEl.classList.add('off');
      liveText.textContent = t('FINISHED');
      clockEl.textContent = m.clockLabel || 'MS';
    } else {
      liveEl.classList.add('off');
      liveText.textContent = t('UPCOMING');
      clockEl.textContent = m.clockLabel || '';
    }
  }

  // ---------- statistics panel ----------

  const STAT_LABEL_KEY = {
    toplaoynama: 'statToplaOynama',
    ikilimucadelekazanma: 'statIkilimucadele',
    toplampas: 'statToplamPas',
    isabetlipas: 'statIsabetliPas',
    pasisabeti: 'statPasIsabeti',
    toplamsut: 'statToplamSut',
    isabetlisut: 'statIsabetliSut',
    korner: 'statKorner',
    faul: 'statFaul',
    sarikart: 'statSariKart',
    ofsayt: 'statOfsayt',
  };
  const STAT_ORDER = [
    'toplaoynama',
    'toplampas',
    'isabetlipas',
    'pasisabeti',
    'toplamsut',
    'isabetlisut',
    'korner',
    'faul',
    'sarikart',
    'ikilimucadelekazanma',
    'ofsayt',
  ];

  function normLabel(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ş/g, 's')
      .replace(/ç/g, 'c')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ö/g, 'o')
      .replace(/i̇/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9%]/g, '');
  }

  function numVal(s) {
    const n = parseFloat(String(s == null ? '' : s).replace(/%/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  // Anchor a fixed panel just below (or above if needed) the scoreboard bar.
  function anchorPanel(panel) {
    const r = bar.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = r.bottom + gap;
    if (top + h > vh - 8) top = Math.max(8, r.top - gap - h);
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, vw - w - 8));
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
  }

  function renderStatsPanel(m, stats, isHalftime) {
    statsTitle.textContent = t(isHalftime ? 'statsHalftime' : 'statsTitle');
    statsMatch.textContent = `${m.home.name.toUpperCase()} ${m.score.home} - ${m.score.away} ${m.away.name.toUpperCase()}`;

    const all = []
      .concat(stats.general || [], stats.distribution || [], stats.attack || [], stats.defence || [], stats.discipline || []);
    const byNorm = {};
    for (const row of all) {
      const k = normLabel(row.label);
      if (k && !byNorm[k]) byNorm[k] = row;
    }

    const rows = [];
    for (const k of STAT_ORDER) {
      const row = byNorm[k];
      if (!row) continue;
      const labelKey = STAT_LABEL_KEY[k];
      const label = labelKey ? t(labelKey) : row.label;
      const hv = String(row.home).trim() === '' ? '0' : row.home;
      const av = String(row.away).trim() === '' ? '0' : row.away;
      const h = numVal(hv);
      const a = numVal(av);
      let hPct;
      if (/%$/.test(String(hv).trim()) && /%$/.test(String(av).trim())) {
        hPct = Math.max(0, Math.min(100, h));
      } else {
        hPct = h + a > 0 ? (h / (h + a)) * 100 : 50;
      }
      rows.push(
        `<div class="st-row">
          <span class="st-val">${escapeHtml(hv)}</span>
          <div class="st-mid">
            <span class="st-label">${escapeHtml(label)}</span>
            <div class="st-bar"><span class="st-bar-h" style="width:${hPct.toFixed(1)}%"></span><span class="st-bar-a" style="width:${(100 - hPct).toFixed(1)}%"></span></div>
          </div>
          <span class="st-val">${escapeHtml(av)}</span>
        </div>`
      );
      if (rows.length >= 8) break;
    }
    statsBody.innerHTML =
      rows.join('') || `<div class="st-none">${escapeHtml(t('statsUnavailable'))}</div>`;
    statsPanel.classList.remove('hidden');
    statsPanel.classList.remove('show');
    void statsPanel.offsetWidth;
    statsPanel.classList.add('show');
    anchorPanel(statsPanel);
  }

  let statsTimer = null;
  let statsLoading = false;

  async function showStats(m, isHalftime) {
    if (!m || !m.isLive || statsLoading) return;
    statsLoading = true;
    try {
      const res = await fetch(`/api/stats?id=${encodeURIComponent(m.id)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!json || !json.stats) {
        statsPanel.classList.add('hidden');
        return;
      }
      renderStatsPanel(m, json.stats, isHalftime);
      clearTimeout(statsTimer);
      statsTimer = setTimeout(() => statsPanel.classList.add('hidden'), isHalftime ? 20000 : 12000);
    } catch (e) {
      statsPanel.classList.add('hidden');
    } finally {
      statsLoading = false;
    }
  }

  const lastStatsMinute = {};
  const htShown = {};
  const prevPeriod = {};

  function maybeStatsMilestone(m) {
    if (!m || !m.isLive) return;
    const min = numericMinute(m);
    if (min != null && min >= 20 && min <= 90 && min % 20 === 0) {
      if (lastStatsMinute[m.id] !== min) {
        lastStatsMinute[m.id] = min;
        showStats(m, false);
      }
    }
    const isHt =
      String(m.status).toLowerCase() === 'ht' ||
      String(m.substate).toLowerCase() === 'ht' ||
      (m.periodId === 2 && prevPeriod[m.id] === 1);
    if (isHt && !htShown[m.id]) {
      htShown[m.id] = true;
      showStats(m, true);
    }
    prevPeriod[m.id] = m.periodId;
  }

  // ---------- goal popup ----------

  function showGoalPopup(m, goal) {
    goalTag.textContent = t('goalTag');
    goalName.textContent = goal.playerName || '';
    goalMin.textContent = goal.minute ? `${goal.minute}'` : '';
    setImg(goalPhoto, goal.photo, shortMark(goal.playerName));
    goalPanel.classList.remove('hidden');
    goalPanel.classList.remove('show');
    void goalPanel.offsetWidth;
    goalPanel.classList.add('show');
    anchorPanel(goalPanel);
    clearTimeout(goalTimer);
    goalTimer = setTimeout(() => goalPanel.classList.add('hidden'), 6000);
  }

  function checkGoals(m) {
    if (!m || !m.isLive) return;
    const goals = (m.events && m.events.goals) || [];
    if (!goals.length) return;
    const seen = seenGoals[m.id] || (seenGoals[m.id] = new Set());
    let fresh = null;
    for (const g of goals) {
      if (g.key && !seen.has(g.key)) {
        seen.add(g.key);
        fresh = g;
      }
    }
    if (fresh) showGoalPopup(m, fresh);
  }

  function triggerSwitchAnimation() {
    bar.classList.remove('switching');
    void bar.offsetWidth;
    bar.classList.add('switching');
    setTimeout(() => bar.classList.remove('switching'), 500);
  }

  function goTo(i) {
    if (matches.length === 0) {
      render();
      return;
    }
    const next = ((i % matches.length) + matches.length) % matches.length;
    if (started && next !== index) triggerSwitchAnimation();
    index = next;
    render();
  }

  // ---------- state sync ----------

  async function fetchState() {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const s = await res.json();
      fetchedAt = Date.now();

      if (s.settings) {
        settings = { ...settings, ...s.settings };
      }

      const newMatches = Array.isArray(s.matches) ? s.matches : [];
      if (newMatches.length > 0) {
        const prevId = currentMatch() ? currentMatch().id : null;
        matches = newMatches;
        const idx = matches.findIndex((m) => m.id === prevId);
        index = idx >= 0 ? idx : Math.min(Math.max(index, 0), matches.length - 1);
        if (!started) {
          started = true;
          bar.classList.add('in');
        }
      } else {
        matches = [];
        index = 0;
        if (!started) started = true;
      }
      applySettings();
      render();
      setupCycle();
    } catch (e) {
      /* keep last state on screen */
    }
    setTimeout(fetchState, 2000);
  }

  // ---------- clock tick ----------

  function tick() {
    const m = currentMatch();
    if (m && m.isLive) {
      clockEl.textContent = displayClock(m, Date.now());
      maybeStatsMilestone(m);
    }
  }

  // ---------- cycling ----------

  let cycleTimer = null;
  function setupCycle() {
    if (cycleTimer) clearInterval(cycleTimer);
    const interval = Number(settings.cycleInterval) || 0;
    if (interval > 0 && matches.length > 1) {
      cycleTimer = setInterval(() => goTo(index + 1), interval);
    }
  }

  // ---------- init ----------

  applySettings();
  render();
  fetchState();
  setupCycle();
  setInterval(tick, 1000);
})();
