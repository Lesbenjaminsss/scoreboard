'use strict';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Rules checked in order. `both` = normalized name + country.
const RULES = [
  {
    test: (both) => both.includes('champions league') && !both.includes('conference'),
    primary: '#10245c',
    secondary: '#33c3ff',
    theme: 'champions-league',
  },
  {
    test: (both) => both.includes('europa league') && !both.includes('conference league'),
    primary: '#b4480a',
    secondary: '#ffc04a',
    theme: 'europa-league',
  },
  {
    test: (both) => both.includes('conference league'),
    primary: '#0a5f58',
    secondary: '#2dd4bf',
    theme: 'conference-league',
  },
  {
    test: (both, country) =>
      both.includes('premier') && (country.includes('ingiltere') || country.includes('england')),
    primary: '#38003c',
    secondary: '#00ff87',
    theme: 'premier-league',
  },
  {
    test: (both, country) =>
      both.includes('bundesliga') && (country.includes('almanya') || country.includes('germany')),
    primary: '#c70016',
    secondary: '#f2a900',
    theme: 'bundesliga',
  },
  {
    test: (both, country) =>
      (both.includes('laliga') || both.includes('la liga')) &&
      (country.includes('ispanya') || country.includes('spain')),
    primary: '#d1001c',
    secondary: '#ffd54a',
    theme: 'laliga',
  },
  {
    test: (both, country) =>
      both.includes('serie a') && (country.includes('italya') || country.includes('italy')),
    primary: '#01679a',
    secondary: '#7fd8ff',
    theme: 'serie-a',
  },
  {
    test: (both, country) =>
      (both.includes('ligue 1') || both.includes('ligue1')) &&
      (country.includes('fransa') || country.includes('france')),
    primary: '#00336e',
    secondary: '#e3004b',
    theme: 'ligue-1',
  },
  {
    test: (both, country) =>
      (both.includes('super lig') ||
        both.includes('superleague') ||
        both.includes('trendyol')) &&
      (country.includes('turkiye') || country.includes('turkey')) &&
      !both.includes('1lig'),
    primary: '#c00016',
    secondary: '#ffce2e',
    theme: 'super-lig',
  },
  {
    test: (both, country) =>
      (both.includes('1lig') || both.includes('1 lig')) &&
      (country.includes('turkiye') || country.includes('turkey')),
    primary: '#1a1a1a',
    secondary: '#ffce2e',
    theme: 'super-lig',
  },
  {
    test: (both, country) =>
      both.includes('eredivisie') && (country.includes('hollanda') || country.includes('netherland')),
    primary: '#d6001c',
    secondary: '#ffd100',
    theme: 'eredivisie',
  },
  {
    test: (both, country) =>
      (both.includes('primeira liga') || both.includes('premier lig')) &&
      (country.includes('portekiz') || country.includes('portugal')),
    primary: '#b6001d',
    secondary: '#ffd05a',
    theme: 'primeira-liga',
  },
  {
    test: (both) => both.includes('fa cup') || both.includes('fa kupasi'),
    primary: '#8f1a1a',
    secondary: '#ffd166',
    theme: 'fa-cup',
  },
  {
    test: (both) => both.includes('world cup'),
    primary: '#1d3557',
    secondary: '#ffd166',
    theme: 'world-cup',
  },
  {
    test: (both) => both.includes('euro') && both.includes('champion'),
    primary: '#2b2b4d',
    secondary: '#7dd3fc',
    theme: 'euro',
  },
  {
    test: (both, country) =>
      both.includes('championship') &&
      (country.includes('ingiltere') || country.includes('england')),
    primary: '#003087',
    secondary: '#00ff87',
    theme: 'premier-league',
  },
  {
    test: (both) => both.includes('mls') || both.includes('major league soccer'),
    primary: '#003087',
    secondary: '#c8102e',
    theme: 'generic',
  },
  {
    test: (both) => both.includes('libertadores'),
    primary: '#1d3557',
    secondary: '#ffd166',
    theme: 'generic',
  },
  {
    test: (both) => both.includes('scottish'),
    primary: '#003087',
    secondary: '#ffffff',
    theme: 'generic',
  },
  {
    test: (both) => both.includes('belgian') || both.includes('jupiler'),
    primary: '#111111',
    secondary: '#ffd100',
    theme: 'generic',
  },
  {
    test: (both) => both.includes('saudi') || both.includes('roshn'),
    primary: '#006b3a',
    secondary: '#ffffff',
    theme: 'generic',
  },
  {
    test: (both) => both.includes('a league') || both.includes('aleague'),
    primary: '#003087',
    secondary: '#ffd100',
    theme: 'generic',
  },
  {
    test: (both) => both.includes('j league') || both.includes('jleague'),
    primary: '#b01020',
    secondary: '#ffffff',
    theme: 'generic',
  },
  {
    test: (both) => both.includes('k league'),
    primary: '#003087',
    secondary: '#ffd100',
    theme: 'generic',
  },
  {
    test: (both) => both.includes('copa del rey'),
    primary: '#d1001c',
    secondary: '#ffd54a',
    theme: 'laliga',
  },
  {
    test: (both) => both.includes('dfb pokal') || both.includes('dfbpokal'),
    primary: '#c70016',
    secondary: '#f2a900',
    theme: 'bundesliga',
  },
  {
    test: (both) => both.includes('coppa italia'),
    primary: '#01679a',
    secondary: '#7fd8ff',
    theme: 'serie-a',
  },
  {
    test: (both) => both.includes('coupe de france'),
    primary: '#00336e',
    secondary: '#e3004b',
    theme: 'ligue-1',
  },
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < (s || '').length; i += 1) {
    h = (h * 31 + (s || '').charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getLeagueStyle(comp) {
  const name = norm(comp && comp.name);
  const country = norm(comp && comp.country);
  const both = `${name} ${country}`;
  for (const r of RULES) {
    if (r.test(both, country)) {
      return {
        primary: r.primary,
        secondary: r.secondary,
        theme: r.theme || 'generic',
        layout: 'broadcast',
      };
    }
  }
  const h = hash(comp && comp.id) % 360;
  return {
    primary: `hsl(${h}, 40%, 30%)`,
    secondary: `hsl(${h}, 85%, 66%)`,
    theme: 'generic',
    layout: 'broadcast',
  };
}

module.exports = { getLeagueStyle, norm, RULES };
