'use strict';

(function () {
  const sb = document.getElementById('sb');
  const bar = document.getElementById('bar');
  const empty = document.getElementById('empty');

  const leagueLogo = document.getElementById('leagueLogo');
  const leagueName = document.getElementById('leagueName');
  const homeTeamEl = document.querySelector('.team.home');
  const awayTeamEl = document.querySelector('.team.away');
  const homeCrest = document.getElementById('homeCrest');
  const homeName = document.getElementById('homeName');
  const awayCrest = document.getElementById('awayCrest');
  const awayName = document.getElementById('awayName');
  const scoreEl = document.getElementById('score');
  const scoreHome = document.getElementById('scoreHome');
  const scoreAway = document.getElementById('scoreAway');
  const midLogo = document.getElementById('midLogo');
  const centerLeague = document.getElementById('centerLeague');
  const clockEl = document.getElementById('clock');
  const liveEl = document.querySelector('.live');
  const liveText = document.getElementById('liveText');
  const homeCards = document.getElementById('homeCards');
  const awayCards = document.getElementById('awayCards');
  const homeGoals = document.getElementById('homeGoals');
  const awayGoals = document.getElementById('awayGoals');
  const homePenFlash = document.getElementById('homePenFlash');
  const awayPenFlash = document.getElementById('awayPenFlash');
  const statsPanel = document.getElementById('statsPanel');
  const statsTitle = document.getElementById('statsTitle');
  const statsMatch = document.getElementById('statsMatch');
  const statsBody = document.getElementById('statsBody');
  const goalPanel = document.getElementById('goalPanel');
  const goalTag = document.getElementById('goalTag');
  const goalName = document.getElementById('goalName');
  const goalMin = document.getElementById('goalMin');
  const goalAssist = document.getElementById('goalAssist');
  const goalPhoto = document.getElementById('goalPhoto');
  const subPanel = document.getElementById('subPanel');
  const subTeam = document.getElementById('subTeam');
  const subMin = document.getElementById('subMin');
  const subInPhoto = document.getElementById('subInPhoto');
  const subInName = document.getElementById('subInName');
  const subOutPhoto = document.getElementById('subOutPhoto');
  const subOutName = document.getElementById('subOutName');
  const lineupPanel = document.getElementById('lineupPanel');
  const lineupMatch = document.getElementById('lineupMatch');
  const lineupHomeCrest = document.getElementById('lineupHomeCrest');
  const lineupHomeName = document.getElementById('lineupHomeName');
  const lineupHomeFormation = document.getElementById('lineupHomeFormation');
  const lineupHomeBody = document.getElementById('lineupHomeBody');
  const lineupAwayCrest = document.getElementById('lineupAwayCrest');
  const lineupAwayName = document.getElementById('lineupAwayName');
  const lineupAwayFormation = document.getElementById('lineupAwayFormation');
  const lineupAwayBody = document.getElementById('lineupAwayBody');

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
    statsShowSec: 12,
    statsHalfShowSec: 20,
    statsShowMinutes: [20, 40, 60, 80],
  };
  let prevScores = {};
  let prevCardCounts = {};
  const seenGoals = {};
  let goalTimer = null;
  let currentId = null;
  let fetchedAt = 0;
  let started = false;
  let currentLayout = 'broadcast';

  // ---------- helpers ----------

  function pickClockText(bg) {
    const s = String(bg || '');
    if (s.startsWith('hsl')) {
      const parts = s.match(/[\d.]+/g);
      if (parts && parts.length >= 3) {
        return Number(parts[2]) > 55 ? '#111111' : '#ffffff';
      }
    }
    if (s.startsWith('#') && s.length >= 7) {
      const r = parseInt(s.slice(1, 3), 16);
      const g = parseInt(s.slice(3, 5), 16);
      const b = parseInt(s.slice(5, 7), 16);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return lum > 0.62 ? '#111111' : '#ffffff';
    }
    return '#111111';
  }

  function applyLeagueAccent(style) {
    const primary = style.primary || '#38003c';
    const secondary = style.secondary || '#d4ff00';
    sb.style.setProperty('--accent', primary);
    sb.style.setProperty('--accent2', secondary);
    sb.style.setProperty('--clock-bg', secondary);
    sb.style.setProperty('--clock-color', pickClockText(secondary));
  }

  function t(key) {
    return (window.I18N && window.I18N[lang] && window.I18N[lang][key]) || (window.I18N && window.I18N.tr[key]) || key;
  }

  const VALID_POSITIONS = ['bottom', 'top', 'top-left', 'top-right', 'middle-left', 'middle-right'];

  // Clock: replicates the exact number mackolik's site displays for live
  // matches: siteMinute = baseOffset + (lastUpdated - periodStart)/60000 with
  // baseOffset 1 / 45 / 90 for the 1st half / 2nd half / extra time. The minute
  // is computed from the feed's lastUpdated (never the local clock, which runs
  // 60-90s ahead of the feed and made the overlay drift ~1 min in front).
  function displayClock(m) {
    if (!m.isLive || m.status !== 'minutes' || !m.periodStart) return m.clockLabel;
    const ref = m.lastUpdated || Date.now();
    const diff = Math.round((ref - m.periodStart) / 60000);
    const minute = m.periodId === 1 ? 1 + diff : m.periodId === 2 ? 45 + diff : 90 + diff;
    if (m.periodId === 1) {
      if (minute > 45) return `45+${Math.min(9, minute - 45)}'`;
      return `${minute}'`;
    }
    if (m.periodId === 2) {
      if (minute > 90) return `90+${Math.min(9, minute - 90)}'`;
      return `${minute}'`;
    }
    if (minute > 120) return `120+${Math.min(9, minute - 120)}'`;
    return `${minute}'`;
  }

  function numericMinute(m) {
    if (!m.isLive || m.status !== 'minutes' || !m.periodStart) return null;
    const ref = m.lastUpdated || Date.now();
    const diff = Math.round((ref - m.periodStart) / 60000);
    const minute = m.periodId === 1 ? 1 + diff : m.periodId === 2 ? 45 + diff : 90 + diff;
    if (m.periodId === 1) return Math.max(1, Math.min(45, minute));
    if (m.periodId === 2) return Math.max(46, Math.min(90, minute));
    return Math.max(91, Math.min(120, minute));
  }

  function currentMatch() {
    return matches[index] || null;
  }

  function isBroadcast() {
    return currentLayout === 'broadcast';
  }

  function broadcastClock(m) {
    if (m.isLive) return displayClock(m);
    if (m.state === 'post') return "90'";
    return m.clockLabel || "0'";
  }

  function applyBroadcastColors(m) {
    const tc = window.TeamColors;
    if (!tc) return;

    const home = tc.teamColors(m.home && m.home.name, m.home && m.home.id);
    const away = tc.teamColors(m.away && m.away.name, m.away && m.away.id);

    sb.style.setProperty('--home-color', home.color);
    sb.style.setProperty('--home-text', home.text);
    sb.style.setProperty('--away-color', away.color);
    sb.style.setProperty('--away-text', away.text);

    paintBroadcastTeam(homeTeamEl, homeName, home, 'home');
    paintBroadcastTeam(awayTeamEl, awayName, away, 'away');
  }

  function paintBroadcastTeam(teamEl, nameEl, colors, side) {
    if (!teamEl || !nameEl || !colors) return;
    const { color, text } = colors;
    const grad =
      side === 'home'
        ? `linear-gradient(90deg, ${color} 0%, #0a0a0a 78%, #000 100%)`
        : `linear-gradient(90deg, #000 0%, #0a0a0a 22%, ${color} 100%)`;
    const edge =
      side === 'home' ? `inset 5px 0 0 ${color}` : `inset -5px 0 0 ${color}`;

    teamEl.style.setProperty('background', grad, 'important');
    teamEl.style.setProperty('box-shadow', edge, 'important');
    nameEl.style.setProperty('background', color, 'important');
    nameEl.style.setProperty('color', text, 'important');
    nameEl.style.setProperty('text-shadow', 'none', 'important');
  }

  function clearBroadcastColors() {
    sb.style.removeProperty('--home-color');
    sb.style.removeProperty('--home-text');
    sb.style.removeProperty('--away-color');
    sb.style.removeProperty('--away-text');
    clearPaint(homeTeamEl, homeName);
    clearPaint(awayTeamEl, awayName);
  }

  function clearPaint(teamEl, nameEl) {
    if (teamEl) {
      teamEl.style.removeProperty('background');
      teamEl.style.removeProperty('box-shadow');
    }
    if (nameEl) {
      nameEl.style.removeProperty('background');
      nameEl.style.removeProperty('color');
      nameEl.style.removeProperty('text-shadow');
    }
  }

  function formatClock(m) {
    return broadcastClock(m);
  }

  function applySettings() {
    sb.style.setProperty('--scale', settings.scale || 1);
    sb.style.setProperty('--opacity', settings.opacity == null ? 1 : settings.opacity);
    sb.style.setProperty('--offset-y', `${settings.offsetY == null ? 26 : settings.offsetY}px`);
    document.documentElement.style.setProperty('--opacity', settings.opacity == null ? 1 : settings.opacity);
    document.documentElement.style.setProperty('--scale', settings.scale || 1);
    sb.dataset.pos = VALID_POSITIONS.includes(settings.position) ? settings.position : 'bottom';

    lang = settings.language === 'en' ? 'en' : 'tr';
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });

    const versionEl = document.getElementById('version');
    versionEl.classList.toggle('hidden', settings.showVersion !== true);
    versionEl.classList.toggle('pos-top', settings.versionPosition === 'top-left');

    homeGoals.dataset.html = '';
    awayGoals.dataset.html = '';
    syncBarMetrics();
    reanchorPopups();
  }

  function panelScale() {
    return Number(settings.scale) || 1;
  }

  function syncBarMetrics() {
    const sc = panelScale();
    document.documentElement.style.setProperty('--scale', sc);
    const w = bar && bar.offsetWidth ? bar.offsetWidth : 860;
    document.documentElement.style.setProperty('--bar-width', `${w}px`);
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

  function setTeam(img, nameEl, team, broadcast) {
    setImg(img, team && team.logo, team ? shortMark(team.name) : null);
    if (!team) {
      nameEl.textContent = '';
      return;
    }
    if (broadcast && window.TeamColors) {
      nameEl.textContent = window.TeamColors.teamAbbrev(team.name, team.id);
    } else {
      nameEl.textContent = team.name.toUpperCase();
    }
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
      .map((k) => {
        const kind = k && k.kind ? k.kind : k;
        return `<span class="card ${kind === 'rc' ? 'rc' : 'yc'}"></span>`;
      })
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
    const name = escapeHtml((g.pen ? '(P) ' : '') + (g.playerName || ''));
    const min = escapeHtml(g.minute || '');
    const assist = g.assist ? `<span class="g-chip-assist">${escapeHtml(t('assistLabel'))}: ${escapeHtml(g.assist)}</span>` : '';
    const photo = g.photo
      ? `<img class="g-chip-photo" alt="" src="${escapeHtml(g.photo)}" /><span class="g-chip-fb">${fb}</span>`
      : `<span class="g-chip-fb show">${fb}</span>`;
    return `<span class="goal-chip">${photo}<span class="g-chip-body"><span class="g-chip-top"><span class="g-chip-name">${name}</span><span class="g-chip-min">${min}'</span></span>${assist}</span></span>`;
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
      hideLineup();
      sb.classList.add('hidden');
      empty.classList.remove('hidden');
      bar.classList.remove('in', 'switching');
      return;
    }
    empty.classList.add('hidden');
    sb.classList.remove('hidden');

    if (lineupPanelMatch && lineupPanelMatch !== m.id) hideLineup();

    // league accent + broadcast theme (all leagues)
    const style = m.style || {};
    const theme = style.theme || 'generic';
    currentLayout = 'broadcast';
    sb.dataset.theme = theme;
    sb.dataset.layout = 'broadcast';
    document.documentElement.dataset.layout = 'broadcast';
    applyLeagueAccent(style);
    centerLeague.textContent = (m.competitionName || '').toUpperCase();

    applyBroadcastColors(m);

    setTeam(homeCrest, homeName, m.home, true);
    setTeam(awayCrest, awayName, m.away, true);

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
    checkPenalties(m);
    checkSubs(m);
    maybeShowLineup(m);
    syncBarMetrics();
    reanchorPopups();

    if (m.isLive) {
      liveEl.classList.remove('off');
      liveText.textContent = t('LIVE');
      clockEl.textContent = broadcastClock(m);
    } else if (m.state === 'post') {
      liveEl.classList.add('off');
      liveText.textContent = t('FINISHED');
      clockEl.textContent = broadcastClock(m);
    } else {
      liveEl.classList.add('off');
      liveText.textContent = t('UPCOMING');
      clockEl.textContent = broadcastClock(m);
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

  function scaledPanelSize(panel) {
    const sc = panelScale();
    return {
      w: panel.offsetWidth * sc,
      h: panel.offsetHeight * sc,
    };
  }

  // Anchor a fixed panel just below the scoreboard bar (broadcast layout).
  function anchorPanel(panel, opts) {
    const options = opts || {};
    const r = bar.getBoundingClientRect();
    if (!r.width && !r.height) return;
    syncBarMetrics();
    const sc = panelScale();
    const gap = options.gap == null ? 4 : options.gap;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const inner = panel.querySelector('.stats-inner, .lineup-inner, .goal-inner, .sub-inner') || panel;
    const body = panel.querySelector('.stats-body, .lineup-cols');
    const head = panel.querySelector('.stats-head, .lineup-head');
    const fullWidth = options.fullWidth === true
      || panel.classList.contains('stats-panel')
      || panel.classList.contains('lineup-panel');

    if (options.belowBar) {
      const barW = Math.min(r.width, vw - pad * 2);
      panel.style.width = '';
      if (fullWidth) {
        inner.style.width = `${barW / sc}px`;
        inner.style.maxWidth = `${barW / sc}px`;
      } else {
        inner.style.width = '';
        inner.style.maxWidth = `${barW / sc}px`;
      }

      const top = r.bottom + gap;
      let left = fullWidth
        ? Math.max(pad, Math.min(r.left, vw - barW - pad))
        : r.left + r.width / 2;

      if (body) {
        const headH = head ? head.offsetHeight : 0;
        const innerPad = 28;
        const maxBody = Math.max(72, vh - top - headH - innerPad - pad);
        body.style.maxHeight = `${maxBody / sc}px`;
        body.style.overflowY = 'auto';
        body.style.overflowX = 'hidden';
      }

      const { w, h } = scaledPanelSize(panel);
      if (!fullWidth) left -= w / 2;
      left = Math.max(pad, Math.min(left, vw - w - pad));

      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
      return;
    }

    const { w, h } = scaledPanelSize(panel);
    let top = r.bottom + gap;
    if (top + h > vh - pad) top = Math.max(pad, r.top - gap - h);
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(pad, Math.min(left, vw - w - pad));
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }

  function reanchorPopups() {
    syncBarMetrics();
    const anchor = { belowBar: true, gap: 4 };
    if (!statsPanel.classList.contains('hidden')) anchorPanel(statsPanel, anchor);
    if (!lineupPanel.classList.contains('hidden')) anchorPanel(lineupPanel, anchor);
    if (!goalPanel.classList.contains('hidden')) anchorPanel(goalPanel, anchor);
    if (!subPanel.classList.contains('hidden')) anchorPanel(subPanel, anchor);
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
    anchorPanel(statsPanel, { belowBar: true, gap: 4 });
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
      const showMs = (isHalftime ? settings.statsHalfShowSec : settings.statsShowSec) || (isHalftime ? 20 : 12);
      statsTimer = setTimeout(() => statsPanel.classList.add('hidden'), showMs * 1000);
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
    const minutes = Array.isArray(settings.statsShowMinutes) && settings.statsShowMinutes.length
      ? settings.statsShowMinutes
      : [20, 40, 60, 80];
    if (min != null && min >= 1 && minutes.includes(min)) {
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
    goalName.textContent = (goal.pen ? '(P) ' : '') + (goal.playerName || '');
    goalMin.textContent = goal.minute ? `${goal.minute}'` : '';
    goalAssist.textContent = goal.assist ? `${t('assistLabel')}: ${goal.assist}` : '';
    setImg(goalPhoto, goal.photo, shortMark(goal.playerName));
    goalPanel.classList.remove('hidden');
    goalPanel.classList.remove('show');
    void goalPanel.offsetWidth;
    goalPanel.classList.add('show');
    anchorPanel(goalPanel, { belowBar: true, gap: 4 });
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

  // ---------- transient penalty indicator ----------

  const seenPenalties = {};
  let penFlashTimer = null;

  function showPenFlash(side, penalty) {
    const el = side === 'home' ? homePenFlash : awayPenFlash;
    el.textContent = `${t('penaltyTag')} ${penalty.minute || ''}'`;
    el.className = 'pen-flash ' + (penalty.scored ? 'scored' : 'missed');
    el.classList.remove('hidden', 'in');
    void el.offsetWidth;
    el.classList.add('in');
    clearTimeout(penFlashTimer);
    penFlashTimer = setTimeout(() => el.classList.add('hidden'), 6000);
  }

  function checkPenalties(m) {
    if (!m || !m.isLive) return;
    const pens = (m.events && m.events.penalties) || [];
    if (!pens.length) return;
    const seen = seenPenalties[m.id] || (seenPenalties[m.id] = new Set());
    let fresh = null;
    for (const p of pens) {
      if (p.key && !seen.has(p.key)) {
        seen.add(p.key);
        fresh = p;
      }
    }
    if (fresh) showPenFlash(fresh.position, fresh);
  }

  // ---------- substitution popup ----------

  const seenSubs = {};
  let subTimer = null;

  function showSubPopup(m, sub) {
    const teamName = sub.position === 'home' ? m.home.name : sub.position === 'away' ? m.away.name : '';
    subTeam.textContent = teamName ? teamName.toUpperCase() : '';
    subMin.textContent = sub.minute ? `${sub.minute}'` : '';
    subInName.textContent = sub.playerIn || '';
    subOutName.textContent = sub.playerOut || '';
    setImg(subInPhoto, sub.inPhoto, shortMark(sub.playerIn));
    setImg(subOutPhoto, sub.outPhoto, shortMark(sub.playerOut));
    subPanel.classList.remove('hidden');
    subPanel.classList.remove('show');
    void subPanel.offsetWidth;
    subPanel.classList.add('show');
    anchorPanel(subPanel, { belowBar: true, gap: 4 });
    clearTimeout(subTimer);
    subTimer = setTimeout(() => subPanel.classList.add('hidden'), 6000);
  }

  function checkSubs(m) {
    if (!m || !m.isLive) return;
    const subs = (m.events && m.events.subs) || [];
    if (!subs.length) return;
    const seen = seenSubs[m.id] || (seenSubs[m.id] = new Set());
    let fresh = null;
    for (const s of subs) {
      if (s.key && !seen.has(s.key)) {
        seen.add(s.key);
        fresh = s;
      }
    }
    if (fresh) showSubPopup(m, fresh);
  }

  // ---------- starting eleven drop-down panel ----------

  function lineupRowHtml(p) {
    const fb = escapeHtml(shortMark(p.name));
    const photo = p.photo
      ? `<span class="lineup-photo-wrap"><img class="lineup-photo" alt="" src="${escapeHtml(p.photo)}" /><span class="img-fallback">${fb}</span></span>`
      : `<span class="lineup-photo-wrap"><span class="img-fallback show">${fb}</span></span>`;
    return `<div class="lineup-row">
      <span class="lineup-num">${p.number != null ? escapeHtml(String(p.number)) : '–'}</span>
      ${photo}
      <span class="lineup-pname">${escapeHtml(p.name || '?')}</span>
      <span class="lineup-pos">${escapeHtml(p.positionShort || p.position || '')}</span>
    </div>`;
  }

  function wireLineupImgs(container) {
    container.querySelectorAll('.lineup-photo').forEach((img) => {
      img.onerror = () => {
        img.style.visibility = 'hidden';
        const fb = img.nextElementSibling;
        if (fb && fb.classList.contains('img-fallback')) fb.classList.add('show');
      };
    });
  }

  function renderLineup(m, lineup) {
    if (!m || !lineup) return;
    lineupMatch.textContent = `${m.home.name.toUpperCase()} ${m.score ? m.score.home : '-'} - ${m.score ? m.score.away : '-'} ${m.away.name.toUpperCase()}`;
    setImg(lineupHomeCrest, m.home.logo, shortMark(m.home.name));
    setImg(lineupAwayCrest, m.away.logo, shortMark(m.away.name));
    lineupHomeName.textContent = m.home.name.toUpperCase();
    lineupAwayName.textContent = m.away.name.toUpperCase();
    lineupHomeFormation.textContent = (lineup.home && lineup.home.formation) || '';
    lineupAwayFormation.textContent = (lineup.away && lineup.away.formation) || '';
    lineupHomeBody.innerHTML = ((lineup.home && lineup.home.players) || []).map(lineupRowHtml).join('');
    lineupAwayBody.innerHTML = ((lineup.away && lineup.away.players) || []).map(lineupRowHtml).join('');
    wireLineupImgs(lineupHomeBody);
    wireLineupImgs(lineupAwayBody);
    lineupPanelMatch = m.id;
    lineupPanel.classList.remove('hidden');
    lineupPanel.classList.remove('show');
    void lineupPanel.offsetWidth;
    lineupPanel.classList.add('show');
    anchorPanel(lineupPanel, { belowBar: true, gap: 4 });
  }

  function hideLineup() {
    lineupPanelMatch = null;
    clearTimeout(lineupTimer);
    lineupTimer = null;
    lineupPanel.classList.add('hidden');
  }

  // Show the starting elevens once, just after kickoff (while the clock is still
  // in the first minutes of the 1st half), then auto-hide after a few seconds.
  let lineupPanelMatch = null;
  let lineupHandled = {};
  let lineupTimer = null;
  let lineupLoading = false;

  async function maybeShowLineup(m) {
    if (!m || !m.isLive || lineupHandled[m.id] || lineupLoading) return;
    const min = numericMinute(m);
    if (min != null && min > 4) return;
    lineupLoading = true;
    try {
      const res = await fetch(`/api/lineup?id=${encodeURIComponent(m.id)}`, { cache: 'no-store' });
      const json = await res.json();
      const lineup = json && json.lineup;
      const total =
        lineup && lineup.home && lineup.away
          ? lineup.home.players.length + lineup.away.players.length
          : 0;
      if (lineup && total >= 22) {
        lineupHandled[m.id] = true;
        renderLineup(m, lineup);
        clearTimeout(lineupTimer);
        lineupTimer = setTimeout(hideLineup, 15000);
      }
    } catch (e) {
      /* retry on the next tick while the clock is still early */
    } finally {
      lineupLoading = false;
    }
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
      clockEl.textContent = formatClock(m);
      maybeStatsMilestone(m);
    }
  }

  // ---------- cycling ----------

  let cycleTimer = null;
  function setupCycle() {
    if (cycleTimer) clearInterval(cycleTimer);
    cycleTimer = null;
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
  window.addEventListener('resize', reanchorPopups);

  // Test/debug hook used by the --smoke run.
  window.__scoreboardDebug = {
    showSubPopup: showSubPopup,
    renderLineup: renderLineup,
    hideLineup: hideLineup,
  };
})();
