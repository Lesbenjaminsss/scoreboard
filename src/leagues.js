'use strict';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Rules are checked in order. `both` = normalized name + country, `country` = normalized country.
const RULES = [
  {
    test: (both) => both.includes('champions league') && !both.includes('conference'),
    primary: '#10245c',
    secondary: '#33c3ff',
  },
  {
    test: (both) => both.includes('europa league') && !both.includes('conference league'),
    primary: '#b4480a',
    secondary: '#ffc04a',
  },
  {
    test: (both) => both.includes('conference league'),
    primary: '#0a5f58',
    secondary: '#2dd4bf',
  },
  {
    test: (both, country) =>
      both.includes('premier') && (country.includes('ingiltere') || country.includes('england')),
    primary: '#38003c',
    secondary: '#00ff87',
  },
  {
    test: (both, country) =>
      both.includes('bundesliga') && (country.includes('almanya') || country.includes('germany')),
    primary: '#c70016',
    secondary: '#f2a900',
  },
  {
    test: (both, country) =>
      (both.includes('laliga') || both.includes('la liga')) &&
      (country.includes('ispanya') || country.includes('spain')),
    primary: '#d1001c',
    secondary: '#ffd54a',
  },
  {
    test: (both, country) =>
      both.includes('serie a') && (country.includes('italya') || country.includes('italy')),
    primary: '#01679a',
    secondary: '#7fd8ff',
  },
  {
    test: (both, country) =>
      (both.includes('ligue 1') || both.includes('ligue1')) &&
      (country.includes('fransa') || country.includes('france')),
    primary: '#00336e',
    secondary: '#e3004b',
  },
  {
    test: (both, country) =>
      (both.includes('super lig') || both.includes('superleague')) &&
      (country.includes('turkiye') || country.includes('turkey')),
    primary: '#c00016',
    secondary: '#ffce2e',
  },
  {
    test: (both, country) =>
      both.includes('eredivisie') && (country.includes('hollanda') || country.includes('netherland')),
    primary: '#d6001c',
    secondary: '#ffd100',
  },
  {
    test: (both, country) =>
      (both.includes('primeira liga') || both.includes('premier lig')) &&
      (country.includes('portekiz') || country.includes('portugal')),
    primary: '#b6001d',
    secondary: '#ffd05a',
  },
  {
    test: (both) => both.includes('fa cup') || both.includes('fa kupasi'),
    primary: '#8f1a1a',
    secondary: '#ffd166',
  },
  {
    test: (both) => both.includes('world cup'),
    primary: '#1d3557',
    secondary: '#ffd166',
  },
  {
    test: (both) => both.includes('euro') && both.includes('champion'),
    primary: '#2b2b4d',
    secondary: '#7dd3fc',
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
    if (r.test(both, country)) return { primary: r.primary, secondary: r.secondary };
  }
  const h = hash(comp && comp.id) % 360;
  return { primary: `hsl(${h}, 40%, 30%)`, secondary: `hsl(${h}, 85%, 66%)` };
}

module.exports = { getLeagueStyle, norm };
