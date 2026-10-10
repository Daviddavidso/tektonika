// Сборщик статического сайта без зависимостей: node build.mjs
// Переменные окружения:
//   BASE    — базовый путь сайта ('/' на своём домене, '/tektonika/' на GitHub Pages)
//   ORIGIN  — адрес сайта для canonical/sitemap (https://example.ru)
//   NOINDEX — '1' (по умолчанию) запрещает индексацию демо-версии, '0' — боевой режим
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  site, stats, ongoing, directions, projects, principles, process as steps,
  timeline, team, licenses, reviews, faqGroups, rubrics, legalDocs,
} from './content.mjs';
import { articles } from './articles.mjs';
import { ICONS } from './icons.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || '/tektonika/';
const ORIGIN = (process.env.ORIGIN || 'https://daviddavidso.github.io').replace(/\/$/, '');
const NOINDEX = process.env.NOINDEX !== '0';
const OUT = path.join(ROOT, process.env.OUT || 'dist');
const YEAR = 2026;
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- helpers ----------
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const u = (p = '') => BASE + p.replace(/^\//, '');
const abs = (p = '') => ORIGIN + u(p);
const fixLinks = (html) => html.replace(/"@\//g, `"${BASE}`);
const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const plural = (n, forms) => forms[new Intl.PluralRules('ru').select(n) === 'one' ? 0 : new Intl.PluralRules('ru').select(n) === 'few' ? 1 : 2];
const pad2 = (n) => String(n).padStart(2, '0');
const initials = (name) => name.split(' ').map((w) => w[0]).join('');

const unsplash = (id, w, ar) => `https://images.unsplash.com/${id}?auto=format&amp;fit=crop&amp;w=${w}&amp;h=${Math.round(w / ar)}&amp;q=72`;
function img(id, { alt = '', ar = 4 / 3, sizes = '100vw', widths = [480, 800, 1200, 1600], eager = false, cls = '' } = {}) {
  const w0 = widths[Math.min(1, widths.length - 1)];
  return `<img${cls ? ` class="${cls}"` : ''} src="${unsplash(id, w0, ar)}" srcset="${widths.map((w) => `${unsplash(id, w, ar)} ${w}w`).join(', ')}" sizes="${sizes}" width="${w0}" height="${Math.round(w0 / ar)}" alt="${esc(alt)}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}

const LOGO_MARK = `<svg class="logo__mark" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><rect x="2" y="5" width="17" height="5" rx="1.5" fill="currentColor"/><rect x="9" y="11.5" width="17" height="5" rx="1.5" fill="#FF5A1F"/><rect x="2" y="18" width="17" height="5" rx="1.5" fill="currentColor"/></svg>`;
const logo = (extra = '') => `<a class="logo${extra}" href="${u()}">${LOGO_MARK}<span class="logo__word">${site.name}</span></a>`;

const dirBySlug = Object.fromEntries(directions.map((d) => [d.slug, d]));
const projBySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));
const sortedArticles = [...articles].sort((a, b) => b.date.localeCompare(a.date));
const rubricTitle = (slug) => rubrics.find((r) => r.slug === slug)?.title || '';

// ---------- shared blocks ----------
const NAV = [
  ['kompaniya/', 'Компания', 'kompaniya'],
  ['napravleniya/', 'Направления', 'napravleniya'],
  ['proekty/', 'Проекты', 'proekty'],
  ['otzyvy/', 'Отзывы', 'otzyvy'],
  ['zhurnal/', 'Журнал', 'zhurnal'],
  ['kontakty/', 'Контакты', 'kontakty'],
];
const MENU_EXTRA = [
  ['principy/', 'Принципы работы'],
  ['voprosy/', 'Вопросы и ответы'],
  ['dokumenty/', 'Документы'],
];

function navCurrent(href, section, page) {
  if (page.path === href) return ' aria-current="page"';
  if (page.section === section) return ' aria-current="true"';
  return '';
}

function header(page) {
  return `<header class="hdr" id="hdr">
  <div class="wrap hdr__in">
    ${logo()}
    <nav class="nav" aria-label="Основная">
      <ul>${NAV.map(([href, t, s]) => `<li><a href="${u(href)}"${navCurrent(href, s, page)}>${t}</a></li>`).join('')}</ul>
    </nav>
    <div class="hdr__end">
      <a class="hdr__tel" href="tel:${site.phoneHref}">${site.phone}</a>
      <a class="btn btn--dark btn--sm hdr__cta" href="${u('kontakty/')}#form">Обсудить проект</a>
      <a class="burger burger--nojs" href="#ftr-nav" aria-label="Меню">${icon('menu-2')}</a>
      <button class="burger burger--js" type="button" aria-label="Меню" aria-haspopup="dialog" aria-controls="menu">${icon('menu-2')}</button>
    </div>
  </div>
</header>`;
}

function menu(page) {
  const items = [...NAV.map(([h, t, s]) => [h, t, s]), ...MENU_EXTRA.map(([h, t]) => [h, t, h.replace('/', '')])];
  return `<dialog class="menu" id="menu" aria-label="Меню">
  <div class="menu__top wrap">
    <button class="menu__close" type="button" autofocus aria-label="Закрыть меню">${icon('x')}</button>
    ${logo(' logo--menu')}
  </div>
  <nav class="menu__nav wrap" aria-label="Меню сайта">
    <ul>${items.map(([h, t, s], i) => `<li style="--i:${i}"><a href="${u(h)}"${navCurrent(h, s, page)}><span class="menu__idx" aria-hidden="true">${pad2(i + 1)}</span>${t}</a></li>`).join('')}</ul>
  </nav>
  <div class="menu__foot wrap">
    <a class="menu__tel" href="tel:${site.phoneHref}">${site.phone}</a>
    <a href="mailto:${site.email}">${site.email}</a>
    <a class="btn btn--accent" href="${u('kontakty/')}#form">Обсудить проект ${icon('arrow-up-right')}</a>
  </div>
</dialog>`;
}

function footer() {
  const col = (title, links) => `<div class="ftr__col"><h2 class="ftr__h">${title}</h2><ul>${links.map(([h, t]) => `<li><a href="${u(h)}">${t}</a></li>`).join('')}</ul></div>`;
  return `<footer class="ftr dark">
  <div class="wrap">
    <div class="ftr__cta">
      <p class="ftr__big">Обсудим ваш&nbsp;проект?</p>
      <div class="ftr__cta-r">
        <a class="ftr__tel" href="tel:${site.phoneHref}">${site.phone}</a>
        <a class="ftr__mail" href="mailto:${site.email}">${site.email}</a>
        <a class="btn btn--accent" href="${u('kontakty/')}#form">Оставить заявку ${icon('arrow-up-right')}</a>
      </div>
    </div>
    <div class="ftr__grid">
      <div class="ftr__brand">
        ${logo(' logo--light')}
        <p>${site.tagline}. Проектируем, строим и реконструируем с ${site.founded} года.</p>
        <address>${site.address}<br>${site.hours}</address>
      </div>
      <nav class="ftr__nav" id="ftr-nav" aria-label="Подвал">
        ${col('Компания', [['kompaniya/', 'О компании'], ['principy/', 'Принципы работы'], ['otzyvy/', 'Отзывы'], ['voprosy/', 'Вопросы и ответы'], ['kontakty/', 'Контакты']])}
        ${col('Направления', directions.map((d) => [`napravleniya/${d.slug}/`, d.title]))}
        ${col('Проекты и журнал', [['proekty/', 'Все проекты'], ['zhurnal/', 'Журнал'], ['zhurnal/stati/', 'Статьи'], ['zhurnal/novosti/', 'Новости']])}
        ${col('Документы', [['dokumenty/', 'Реквизиты и лицензии'], ...legalDocs.map((d) => [`dokumenty/${d.slug}/`, d.title])])}
      </nav>
    </div>
    <div class="ftr__bottom">
      <p>© ${site.founded}–${YEAR} ${esc(site.legal)}. ИНН ${site.inn}, ОГРН ${site.ogrn}</p>
      <p class="ftr__demo">${icon('info-circle')}Демо-версия сайта: компания, тексты, цифры и отзывы условные.</p>
    </div>
  </div>
  <div class="ftr__word" aria-hidden="true" data-word="${site.name}"></div>
</footer>`;
}

const cookieBar = () => `<section class="cookie" id="cookie" aria-label="Уведомление о cookie" hidden>
  <p>Мы используем cookie, чтобы сайт работал удобнее. <a href="${u('dokumenty/cookie/')}">Политика использования cookie</a></p>
  <button class="btn btn--dark btn--sm" type="button" data-cookie-ok>Понятно</button>
</section>`;

function breadcrumbs(trail) {
  // trail: [[path, title], ...] — последний элемент = текущая страница
  return `<nav class="crumbs" aria-label="Хлебные крошки"><ol>
    <li><a href="${u()}">Главная</a></li>
    ${trail.map(([p, t], i) => i === trail.length - 1 ? `<li><a href="${u(p)}" aria-current="page">${esc(t)}</a></li>` : `<li><a href="${u(p)}">${esc(t)}</a></li>`).join('')}
  </ol></nav>`;
}
const crumbsLd = (trail) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: [['', 'Главная'], ...trail].map(([p, t], i) => ({ '@type': 'ListItem', position: i + 1, name: t, item: abs(p) })),
});

function pageHero({ trail, title, lead, kicker, aside = '' }) {
  return `<section class="phero">
  <div class="wrap">
    ${breadcrumbs(trail)}
    <div class="phero__grid">
      <div>
        ${kicker ? `<p class="kicker">${kicker}</p>` : ''}
        <h1 class="h1 phero__title">${title}</h1>
      </div>
      ${lead ? `<p class="lead phero__lead">${lead}</p>` : ''}
      ${aside}
    </div>
  </div>
</section>`;
}

function secHead({ idx, kicker, title, text, link, linkText, id }) {
  return `<div class="sh">
    <div class="sh__l">
      <p class="kicker">${idx ? `<span class="kicker__idx" aria-hidden="true">${idx}</span>` : ''}${kicker}</p>
      <h2 class="h2"${id ? ` id="${id}"` : ''} data-reveal>${title}</h2>
    </div>
    ${text || link ? `<div class="sh__r" data-reveal style="--d:120ms">${text ? `<p>${text}</p>` : ''}${link ? `<a class="arrow-link" href="${u(link)}">${linkText}${icon('arrow-up-right')}</a>` : ''}</div>` : ''}
  </div>`;
}

const statNum = (s) => {
  const fmt = (v) => s.decimals ? v.toFixed(s.decimals).replace('.', ',') : String(v);
  return `<span class="stat__num"><span class="sr-only">${fmt(s.value)}${s.suffix}</span><span aria-hidden="true"><span data-count="${s.value}" data-dec="${s.decimals || 0}">${fmt(s.value)}</span>${s.suffix}</span></span>`;
};
const statsList = (cls = '') => `<ul class="stats ${cls}" role="list">${stats.map((s, i) => `<li class="stat" data-reveal style="--d:${i * 80}ms">${statNum(s)}<span class="stat__label">${s.label}</span></li>`).join('')}</ul>`;

// --- форма заявки ---
let formSeq = 0;
function leadForm({ title = 'Оставить заявку', note = 'Инженер свяжется с вами в течение рабочего дня.' } = {}) {
  const f = `f${++formSeq}`;
  return `<div class="formcard" data-form-wrap>
  <form class="lead" novalidate data-form aria-labelledby="${f}-t">
    <h3 class="formcard__t h3" id="${f}-t">${title}</h3>
    <p class="formcard__note">${note} Поля, отмеченные «обязательно», нужно заполнить.</p>
    <div class="errsum" tabindex="-1" hidden data-errsum>
      <h4 class="errsum__t" data-errsum-title></h4>
      <ul data-errsum-list></ul>
    </div>
    <div class="field">
      <label for="${f}-name">Имя <span class="req">(обязательно)</span></label>
      <input id="${f}-name" name="name" type="text" autocomplete="name" required aria-describedby="${f}-name-err" data-label="Имя">
      <p class="field__err" id="${f}-name-err" data-err></p>
    </div>
    <div class="field">
      <label for="${f}-tel">Телефон <span class="req">(обязательно)</span></label>
      <input id="${f}-tel" name="phone" type="tel" inputmode="tel" autocomplete="tel" required aria-describedby="${f}-tel-hint ${f}-tel-err" data-label="Телефон">
      <p class="field__hint" id="${f}-tel-hint">Например, +7 900 000-00-00</p>
      <p class="field__err" id="${f}-tel-err" data-err></p>
    </div>
    <div class="field">
      <label for="${f}-mail">Эл. почта <span class="opt">(необязательно)</span></label>
      <input id="${f}-mail" name="email" type="email" autocomplete="email" aria-describedby="${f}-mail-err" data-label="Эл. почта">
      <p class="field__err" id="${f}-mail-err" data-err></p>
    </div>
    <div class="field">
      <label for="${f}-msg">Коротко о задаче <span class="opt">(необязательно)</span></label>
      <textarea id="${f}-msg" name="message" rows="3"></textarea>
    </div>
    <div class="field field--check">
      <input id="${f}-ok" name="consent" type="checkbox" required aria-describedby="${f}-ok-doc ${f}-ok-err" data-label="Согласие на обработку данных">
      <label for="${f}-ok">Согласен(на) на обработку персональных данных <span class="req">(обязательно)</span></label>
      <a class="field__doc" id="${f}-ok-doc" href="${u('dokumenty/soglasie-na-obrabotku/')}">Текст согласия на обработку персональных данных</a>
      <p class="field__err" id="${f}-ok-err" data-err></p>
    </div>
    <button class="btn btn--accent btn--block" type="submit">Отправить заявку ${icon('arrow-up-right')}</button>
  </form>
</div>`;
}

const ctaBand = (title = 'Расскажите о задаче — предложим решение', text = 'Первая встреча и выезд на площадку бесплатны. Ответим в течение рабочего дня.') => `<section class="sec cta-band" aria-labelledby="cta-band-t">
  <div class="wrap">
    <div class="cta-band__in" data-reveal>
      <h2 class="h2" id="cta-band-t">${title}</h2>
      <div class="cta-band__r">
        <p>${text}</p>
        <div class="btns">
          <a class="btn btn--dark" href="${u('kontakty/')}#form">Оставить заявку ${icon('arrow-up-right')}</a>
          <a class="btn btn--ghost" href="tel:${site.phoneHref}">${site.phone}</a>
        </div>
      </div>
    </div>
  </div>
</section>`;

const formSection = (id = 'form') => `<section class="sec formsec" id="${id}" aria-labelledby="${id}-h">
  <div class="wrap formsec__grid">
    <div class="formsec__l">
      <p class="kicker">Заявка</p>
      <h2 class="h2" id="${id}-h" data-reveal>Расскажите о&nbsp;задаче — инженер перезвонит в&nbsp;течение рабочего дня</h2>
      <ul class="contacts" role="list">
        <li>${icon('phone')}<span><span class="contacts__l">Телефон</span><a href="tel:${site.phoneHref}">${site.phone}</a></span></li>
        <li>${icon('mail')}<span><span class="contacts__l">Почта</span><a href="mailto:${site.email}">${site.email}</a></span></li>
        <li>${icon('map-pin')}<span><span class="contacts__l">Офис</span>${site.address}</span></li>
        <li>${icon('clock')}<span><span class="contacts__l">Часы работы</span>${site.hours}</span></li>
      </ul>
    </div>
    ${leadForm()}
  </div>
</section>`;

// --- карточки ---
const dirCard = (d, i, size = 'sm') => `<li class="tile tile--${size}" data-reveal style="--d:${(i % 3) * 90}ms">
  <div class="tile__media media">${img(d.img, { alt: '', ar: size === 'lg' ? 16 / 9 : size === 'wide' ? 16 / 9 : 4 / 3, sizes: size === 'sm' ? '(min-width: 1100px) 33vw, (min-width: 768px) 50vw, 100vw' : '(min-width: 1100px) 60vw, 100vw' })}</div>
  <div class="tile__body">
    <div class="tile__top"><span class="tile__idx" aria-hidden="true">${pad2(directions.indexOf(d) + 1)}</span>${icon(d.icon, 'i tile__ic')}</div>
    <h3 class="h3"><a class="stretch" href="${u(`napravleniya/${d.slug}/`)}">${d.title}</a></h3>
    <p>${d.short}</p>
    <span class="tile__go" aria-hidden="true">${icon('arrow-up-right')}</span>
    ${size === 'wide' ? `<ul class="tile__facts" role="list">${d.facts.map((f) => `<li><b>${f.v}</b><span>${f.l}</span></li>`).join('')}</ul>` : ''}
  </div>
</li>`;

const projCard = (p, i = 0, opts = {}) => `<li class="pcard" data-reveal style="--d:${(i % 2) * 100}ms" data-dirs="${p.dirs.join(' ')}">
  <div class="pcard__media media">${img(p.img, { alt: '', ar: 4 / 3, sizes: '(min-width: 768px) 50vw, 100vw' })}</div>
  <div class="pcard__meta"><span>${p.type}</span><span>${p.city}</span><span>${p.year}</span></div>
  <h3 class="h3"><a class="stretch" href="${u(`proekty/${p.slug}/`)}">${p.title}</a></h3>
  ${opts.lead ? `<p class="pcard__lead">${p.lead}</p>` : ''}
  <p class="pcard__area">${p.area} · ${p.role}</p>
</li>`;

const articleCard = (a, i = 0, size = '') => `<li class="acard${size ? ` acard--${size}` : ''}" data-reveal style="--d:${(i % 3) * 90}ms">
  <div class="acard__media media">${img(a.img, { alt: '', ar: size === 'feat' ? 16 / 10 : 3 / 2, sizes: size === 'feat' ? '(min-width: 1100px) 50vw, 100vw' : '(min-width: 1100px) 33vw, (min-width: 768px) 50vw, 100vw' })}</div>
  <p class="acard__meta"><span class="tag">${rubricTitle(a.rubric)}</span><time datetime="${a.date}">${fmtDate(a.date)}</time><span>${a.read} мин чтения</span></p>
  <h3 class="${size === 'feat' ? 'h3 acard__t--feat' : 'h3'}"><a class="stretch" href="${u(`zhurnal/${a.slug}/`)}">${a.title}</a></h3>
  ${size === 'feat' ? `<p class="acard__lead">${a.lead}</p>` : ''}
</li>`;

const reviewCard = (r, i = 0) => {
  const p = projBySlug[r.project];
  return `<li class="rcard" data-reveal style="--d:${(i % 3) * 90}ms"><figure>
  ${icon('quote', 'i rcard__q')}
  <blockquote><p>${r.text}</p></blockquote>
  <figcaption>
    <span class="rcard__ava" aria-hidden="true">${initials(r.name)}</span>
    <span><span class="rcard__name">${r.name}</span><span class="rcard__role">${r.role}, ${r.company}</span></span>
  </figcaption>
  ${p ? `<a class="rcard__proj" href="${u(`proekty/${p.slug}/`)}">Проект: ${p.title}</a>` : ''}
</figure></li>`;
};

const faqList = (items) => `<div class="faq">${items.map(([q, a]) => `<details class="faq__item"><summary>${q}</summary><div class="faq__a"><p>${a}</p></div></details>`).join('')}</div>`;

const licenseGrid = (withLink = true) => `<ul class="lic" role="list">${licenses.map((l, i) => `<li class="lic__item" data-reveal style="--d:${(i % 4) * 70}ms">${icon(l.icon, 'i lic__ic')}<h3 class="lic__t">${l.title}</h3><p>${l.text}</p></li>`).join('')}${withLink ? `<li class="lic__item lic__item--more" data-reveal><h3 class="lic__t">Все документы</h3><p>Выписки СРО, сертификаты, лицензии и реквизиты компании.</p><a class="arrow-link stretch" href="${u('dokumenty/')}">Открыть раздел «Документы»${icon('arrow-up-right')}</a></li>` : ''}</ul>`;

const stepsList = () => `<ol class="steps" role="list">${steps.map((s, i) => `<li class="step" data-reveal style="--d:${i * 80}ms"><span class="step__n" aria-hidden="true">${pad2(i + 1)}</span><h3 class="h3">${s.title}</h3><p>${s.text}</p><p class="step__time">${icon('clock')}${s.time}</p></li>`).join('')}</ol>`;

const projectRows = (list) => `<ul class="prows" role="list" data-peek>${list.map((p) => `<li><a class="prow" href="${u(`proekty/${p.slug}/`)}" data-img="${unsplash(p.img, 560, 4 / 3).replace(/&amp;/g, '&')}">
  <span class="prow__year">${p.year}</span>
  <span class="prow__title">${p.title}</span>
  <span class="prow__city">${p.city}</span>
  <span class="prow__type">${p.type}</span>
  <span class="prow__area">${p.area}</span>
  <span class="prow__go" aria-hidden="true">${icon('arrow-up-right')}</span>
</a></li>`).join('')}</ul>`;

// ---------- layout ----------
const pages = [];
function layout(page) {
  const title = page.path === '' ? `${site.name} — ${page.title}` : `${page.title} — ${site.name}`;
  const ld = (page.ld || []).map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  const ogImg = page.ogImg ? unsplash(page.ogImg, 1200, 1200 / 630) : abs('assets/og.png');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(page.desc)}">
${NOINDEX ? '<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="canonical" href="${abs(page.path)}">
<meta property="og:type" content="${page.ogType || 'website'}">
<meta property="og:site_name" content="${site.name}">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.desc)}">
<meta property="og:url" content="${abs(page.path)}">
<meta property="og:image" content="${ogImg}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="${u('assets/favicon.svg')}" type="image/svg+xml">
<link rel="preload" href="${u('assets/fonts/geist-cyr.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://images.unsplash.com">
<link rel="stylesheet" href="${u('assets/style.css')}?v=${ASSET_V}">
<script>document.documentElement.classList.add('js');setTimeout(function(){if(!window.__tk)document.documentElement.classList.remove('js')},3000)</script>
<script src="${u('assets/app.js')}?v=${ASSET_V}" defer></script>
${ld}
</head>
<body class="p-${page.key}">
<a class="skip" href="#main">Перейти к содержанию</a>
${header(page)}
<main id="main" tabindex="-1">
${fixLinks(page.body)}
</main>
${footer()}
${menu(page)}
${cookieBar()}
${page.body.includes('data-peek') ? '<div class="peek" aria-hidden="true"><img alt="" decoding="async"></div>' : ''}
</body>
</html>
`;
}
function addPage(p) { pages.push(p); }

const ORG_LD = {
  '@context': 'https://schema.org', '@type': 'Organization', '@id': abs('#org'),
  name: site.name, legalName: site.legal, url: abs(), logo: abs('assets/favicon.svg'),
  telephone: site.phone, email: site.email, foundingDate: String(site.founded),
  address: { '@type': 'PostalAddress', streetAddress: site.street, addressLocality: site.city, postalCode: site.postal, addressCountry: 'RU' },
};
const faqLd = (items) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

// ================= ГЛАВНАЯ =================
{
  const words = ['Строим', '__pill__', 'объекты,', 'которые', 'работают', 'десятилетиями'];
  let wi = 0;
  const split = words.map((w) => w === '__pill__'
    ? `<span class="w w--pill" style="--i:${wi++}"><span class="pill">${img('photo-1608783424912-392157b94f59', { alt: '', ar: 2.4, widths: [240, 480], sizes: '240px', eager: true })}</span></span>`
    : `<span class="w"><span style="--i:${wi++}">${w}</span></span>`).join(' ');

  const dirSizes = ['md', 'lg', 'sm', 'sm', 'sm', 'wide'];
  const feat = projects[0];

  const body = `
<section class="hero">
  <div class="wrap">
    <div class="hero__top">
      <p class="kicker kicker--dot">${site.tagline}</p>
      <p class="hero__since">с ${site.founded} года · 12 регионов России</p>
    </div>
    <h1 class="display hero__title"><span class="sr-only">Строим объекты, которые работают десятилетиями</span><span class="split" aria-hidden="true">${split}</span></h1>
    <div class="hero__grid">
      <div class="hero__side">
        <p class="lead">Полный цикл в одних руках: изыскания, проект, строительство и ввод в эксплуатацию. Офисы, жильё, логистика, социальные и промышленные объекты.</p>
        <div class="btns">
          <a class="btn btn--accent" href="${u('kontakty/')}#form">Обсудить проект ${icon('arrow-up-right')}</a>
          <a class="btn btn--ghost" href="${u('proekty/')}">Смотреть проекты</a>
        </div>
        ${statsList('stats--hero')}
      </div>
      <figure class="hero__media media media--hero">
        ${img(ongoing.img, { alt: ongoing.alt, ar: 16 / 11, eager: true, sizes: '(min-width: 1100px) 60vw, 100vw', widths: [640, 960, 1400, 1900] })}
        <figcaption class="now">
          <span class="now__tag"><span class="pulse" aria-hidden="true"></span>Сейчас строим</span>
          <span class="now__title">${ongoing.title}</span>
          <span class="now__meta">${ongoing.city} · сдача ${ongoing.deadline}</span>
          <span class="now__bar" aria-hidden="true"><span style="--p:${ongoing.progress}%"></span></span>
          <span class="now__pct">Готовность ${ongoing.progress}%</span>
        </figcaption>
      </figure>
    </div>
  </div>
  <div class="wrap">
    <ul class="dirstrip" role="list" aria-label="Направления">
      ${directions.map((d, i) => `<li><a href="${u(`napravleniya/${d.slug}/`)}"><span class="dirstrip__n" aria-hidden="true">${pad2(i + 1)}</span>${icon(d.icon)}<span class="dirstrip__t">${d.title}</span></a></li>`).join('')}
    </ul>
  </div>
</section>

<section class="sec about" aria-labelledby="about-h">
  <div class="wrap about__grid">
    <h2 class="kicker about__k" id="about-h"><span class="kicker__idx" aria-hidden="true">01</span>О компании</h2>
    <div class="about__main">
      <p class="about__text" data-words>«Тектоника» — это 1&nbsp;400 инженеров, архитекторов и строителей, которые отвечают за результат целиком: от первого эскиза до ключей от готового здания. Проектный институт, BIM-центр, собственная техника и бригады работают внутри группы, поэтому мы держим и сроки, и цену.</p>
      <div class="about__links">
        <a class="arrow-link" href="${u('kompaniya/')}">О компании${icon('arrow-up-right')}</a>
        <a class="arrow-link" href="${u('principy/')}">Принципы работы${icon('arrow-up-right')}</a>
      </div>
    </div>
  </div>
  <div class="wrap about__media">
    <figure class="media about__m1 plx" data-reveal>${img('photo-1694521787162-5373b598945c', { alt: 'Строители на монолитном перекрытии, вид сверху', ar: 16 / 10, sizes: '(min-width: 768px) 58vw, 100vw' })}</figure>
    <div class="about__card" data-reveal style="--d:120ms">
      <p class="about__num">1&nbsp;400</p>
      <p>специалистов в штате: проектировщики, инженеры, прорабы, монтажники и сервисная служба</p>
    </div>
    <figure class="media about__m2 plx" data-reveal style="--d:200ms">${img('photo-1602128110234-2d11c0aaadfe', { alt: 'Белая бетонная стена здания и два дерева у входа', ar: 3 / 4, sizes: '(min-width: 768px) 28vw, 100vw' })}</figure>
  </div>
</section>

<section class="sec" aria-labelledby="dirs-h">
  <div class="wrap">
    ${secHead({ idx: '02', kicker: 'Направления', title: 'Шесть направлений — одна ответственность', id: 'dirs-h', text: 'Каждое работает и как отдельная услуга, и как часть полного цикла — от участка до ключей.', link: 'napravleniya/', linkText: 'Все направления' })}
    <ul class="bento" role="list">
      ${directions.map((d, i) => dirCard(d, i, dirSizes[i])).join('')}
      <li class="tile tile--cta" data-reveal style="--d:90ms">
        <div class="tile__body">
          <h3 class="h3">Не нашли свою задачу?</h3>
          <p>Расскажите, что нужно построить или перестроить. Подберём команду под проект.</p>
          <a class="btn btn--dark" href="${u('kontakty/')}#form">Обсудить задачу ${icon('arrow-up-right')}</a>
        </div>
      </li>
    </ul>
  </div>
</section>

<section class="sec dark projects" aria-labelledby="proj-h">
  <div class="wrap">
    ${secHead({ idx: '03', kicker: 'Проекты', title: '146 объектов. Вот некоторые из них', id: 'proj-h', text: 'Офисы, жильё, склады, школы, клиники и дата-центры в 12 регионах России.', link: 'proekty/', linkText: 'Все проекты' })}
    <article class="feat" data-reveal aria-labelledby="feat-t">
      <div class="feat__media media plx">${img(feat.img, { alt: feat.alt, ar: 16 / 10, sizes: '(min-width: 1100px) 60vw, 100vw' })}</div>
      <div class="feat__body">
        <p class="kicker kicker--light">${feat.type} · ${feat.year}</p>
        <h3 class="h2 feat__t" id="feat-t"><a class="stretch" href="${u(`proekty/${feat.slug}/`)}">${feat.title}</a></h3>
        <p>${feat.lead}</p>
        <dl class="facts facts--dark">
          <div><dt>Город</dt><dd>${feat.city}</dd></div>
          <div><dt>Площадь</dt><dd>${feat.area}</dd></div>
          <div><dt>Срок</dt><dd>${feat.duration}</dd></div>
          <div><dt>Роль</dt><dd>${feat.role}</dd></div>
        </dl>
        <span class="arrow-link arrow-link--light" aria-hidden="true">Смотреть проект${icon('arrow-up-right')}</span>
      </div>
    </article>
    ${projectRows(projects.slice(1))}
  </div>
</section>

<section class="sec principles-home" aria-labelledby="pr-h">
  <div class="wrap pr__grid">
    <div class="pr__l">
      <p class="kicker"><span class="kicker__idx" aria-hidden="true">04</span>Принципы</p>
      <h2 class="h2" id="pr-h" data-reveal>Как мы работаем</h2>
      <p class="lead" data-reveal style="--d:100ms">Шесть правил, которые не меняются от объекта к объекту — и которые заказчики проверяют на практике.</p>
      <a class="arrow-link" href="${u('principy/')}">Принципы и этапы работы${icon('arrow-up-right')}</a>
      <figure class="media pr__img plx" data-reveal>${img('photo-1612090078171-9e1e933e2bcc', { alt: '', ar: 4 / 3, sizes: '(min-width: 1100px) 36vw, 100vw' })}</figure>
    </div>
    <ol class="pr__list" role="list">
      ${principles.map((p, i) => `<li data-reveal style="--d:${(i % 2) * 80}ms"><span class="pr__n" aria-hidden="true">${pad2(i + 1)}</span><div><h3 class="h3">${p.title}</h3><p>${p.text}</p></div></li>`).join('')}
    </ol>
  </div>
</section>

<section class="sec sec--surface" aria-labelledby="lic-h">
  <div class="wrap">
    ${secHead({ idx: '05', kicker: 'Допуски и сертификаты', title: 'Работаем по правилам, которые можно проверить', id: 'lic-h', text: 'Членство в СРО с 4-м уровнем ответственности, лицензии Минкультуры и МЧС, международные стандарты качества и охраны труда.' })}
    ${licenseGrid()}
  </div>
</section>

<section class="sec" aria-labelledby="rev-h">
  <div class="wrap">
    ${secHead({ idx: '06', kicker: 'Отзывы', title: 'Что говорят заказчики', id: 'rev-h', link: 'otzyvy/', linkText: 'Все отзывы' })}
    <ul class="reviews" role="list">${reviews.slice(0, 3).map(reviewCard).join('')}</ul>
  </div>
</section>

<section class="sec sec--top0" aria-labelledby="jr-h">
  <div class="wrap">
    ${secHead({ idx: '07', kicker: 'Журнал', title: 'Статьи и новости', id: 'jr-h', text: 'Пишем о том, что знаем на практике: проектирование, стройка, реконструкция, управление проектами.', link: 'zhurnal/', linkText: 'Все материалы' })}
    <ul class="jgrid" role="list">
      ${articleCard(sortedArticles[0], 0, 'feat')}
      ${sortedArticles.slice(1, 4).map((a, i) => articleCard(a, i + 1, 'row')).join('')}
    </ul>
  </div>
</section>

<section class="sec sec--top0" aria-labelledby="faq-h">
  <div class="wrap faq-home">
    <div>
      <p class="kicker"><span class="kicker__idx" aria-hidden="true">08</span>Вопросы и ответы</p>
      <h2 class="h2" id="faq-h" data-reveal>Частые вопросы</h2>
      <p class="lead">Не нашли ответ — позвоните или напишите, ответим в течение рабочего дня.</p>
      <a class="arrow-link" href="${u('voprosy/')}">Все вопросы и ответы${icon('arrow-up-right')}</a>
    </div>
    ${faqList([...faqGroups[0].items.slice(0, 2), ...faqGroups[1].items.slice(0, 2), faqGroups[2].items[1]])}
  </div>
</section>

${formSection()}
`;
  addPage({
    key: 'home', path: '', section: 'home',
    title: 'инженерно-строительная группа полного цикла',
    desc: 'Проектирование, генеральный подряд, инженерные системы, реконструкция и девелопмент. 146 объектов в 12 регионах России с 2009 года.',
    body,
    ld: [ORG_LD, { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: abs(), inLanguage: 'ru' }],
  });
}

// ================= О КОМПАНИИ =================
{
  const trail = [['kompaniya/', 'О компании']];
  const body = `
${pageHero({ trail, kicker: `С ${site.founded} года`, title: 'Строим то, за что потом не стыдно', lead: '«Тектоника» — инженерно-строительная группа полного цикла. 1 400 специалистов, собственный проектный институт, BIM-центр и парк техники. Мы отвечаем за объект целиком: от первого эскиза до ключей.' })}
<section class="sec sec--top0">
  <div class="wrap">
    <figure class="media media--wide plx" data-reveal>${img('photo-1565262353342-6e919eab5b58', { alt: 'Светлый атриум современного офисного здания со стеклянной кровлей', ar: 21 / 9, sizes: '100vw', widths: [800, 1200, 1800, 2400] })}</figure>
    ${statsList('stats--band')}
  </div>
</section>

<section class="sec" aria-labelledby="hist-h">
  <div class="wrap two">
    <div class="two__l">
      <p class="kicker">История</p>
      <h2 class="h2" id="hist-h" data-reveal>17 лет — от одного склада до 146 объектов</h2>
    </div>
    <ol class="tline" role="list">
      ${timeline.map((t, i) => `<li data-reveal style="--d:${(i % 3) * 60}ms"><time class="tline__y" datetime="${t.year}">${t.year}</time><p>${t.text}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="sec dark mission" aria-labelledby="mis-h">
  <div class="wrap">
    <p class="kicker kicker--light">Миссия</p>
    <h2 class="sr-only" id="mis-h">Миссия компании</h2>
    <p class="mission__text" data-words>Мы строим здания, которые будут работать дольше, чем мы сами. Поэтому считаем конструкции с запасом, выбираем системы под реальную эксплуатацию и говорим заказчику правду — даже когда она неудобна.</p>
    <a class="arrow-link arrow-link--light" href="${u('principy/')}">Принципы работы${icon('arrow-up-right')}</a>
  </div>
</section>

<section class="sec" aria-labelledby="team-h">
  <div class="wrap">
    ${secHead({ kicker: 'Команда', title: 'Руководство', id: 'team-h', text: 'Средний стаж руководителей группы в «Тектонике» — 11 лет. Каждый из них начинал с площадки или проектного стола.' })}
    <ul class="team" role="list">
      ${team.map((m, i) => `<li class="team__item" data-reveal style="--d:${(i % 3) * 80}ms"><span class="team__ava" aria-hidden="true">${initials(m.name)}</span><h3 class="h3">${m.name}</h3><p class="team__role">${m.role}</p><p class="team__since">${m.since}</p></li>`).join('')}
    </ul>
  </div>
</section>

<section class="sec sec--surface" aria-labelledby="lic-h">
  <div class="wrap">
    ${secHead({ kicker: 'Документы', title: 'Лицензии и допуски', id: 'lic-h', text: 'Копии документов предоставим по запросу, реквизиты — в разделе «Документы».' })}
    ${licenseGrid()}
  </div>
</section>
${ctaBand()}
`;
  addPage({ key: 'about', path: 'kompaniya/', section: 'kompaniya', title: 'О компании', desc: 'Инженерно-строительная группа «Тектоника»: история с 2009 года, 1 400 специалистов, собственный проектный институт, руководство, лицензии и допуски СРО.', body, ld: [crumbsLd(trail), ORG_LD] });
}

// ================= НАПРАВЛЕНИЯ =================
{
  const trail = [['napravleniya/', 'Направления']];
  const body = `
${pageHero({ trail, kicker: 'Шесть направлений', title: 'Полный цикл: от участка до ключей', lead: 'Каждое направление работает и как самостоятельная услуга, и как часть полного цикла. Когда весь цикл в одних руках, проект идёт быстрее и обходится дешевле.' })}
<section class="sec sec--top0">
  <div class="wrap">
    <ol class="dlist" role="list">
      ${directions.map((d, i) => `<li class="drow" data-reveal>
        <div class="drow__media media plx">${img(d.img, { alt: '', ar: 4 / 3, sizes: '(min-width: 1100px) 45vw, 100vw' })}</div>
        <div class="drow__body">
          <p class="drow__n"><span aria-hidden="true">${pad2(i + 1)}</span>${icon(d.icon)}</p>
          <h2 class="h2"><a class="stretch" href="${u(`napravleniya/${d.slug}/`)}">${d.title}</a></h2>
          <p class="lead">${d.short}</p>
          <ul class="checks" role="list">${d.includes.slice(0, 4).map((x) => `<li>${icon('check')}${x}</li>`).join('')}</ul>
          <span class="arrow-link" aria-hidden="true">Подробнее о направлении${icon('arrow-up-right')}</span>
        </div>
      </li>`).join('')}
    </ol>
  </div>
</section>
${ctaBand()}
`;
  addPage({ key: 'dirs', path: 'napravleniya/', section: 'napravleniya', title: 'Направления деятельности', desc: 'Проектирование, генеральный подряд, инженерные системы, реконструкция, услуги технического заказчика и девелопмент — направления группы «Тектоника».', body, ld: [crumbsLd(trail)] });

  directions.forEach((d, i) => {
    const trail2 = [['napravleniya/', 'Направления'], [`napravleniya/${d.slug}/`, d.title]];
    const rel = projects.filter((p) => p.dirs.includes(d.slug)).slice(0, 4);
    const others = directions.filter((x) => x !== d);
    const bodyD = `
${pageHero({ trail: trail2, kicker: `Направление ${pad2(i + 1)}`, title: d.title, lead: d.lead, aside: `<div class="phero__cta"><a class="btn btn--accent" href="#form">Обсудить проект ${icon('arrow-down')}</a><a class="btn btn--ghost" href="tel:${site.phoneHref}">${site.phone}</a></div>` })}
<section class="sec sec--top0">
  <div class="wrap">
    <figure class="media media--wide plx" data-reveal>${img(d.img, { alt: d.alt, ar: 21 / 9, sizes: '100vw', widths: [800, 1200, 1800, 2400], eager: true })}</figure>
    <ul class="stats stats--band" role="list">${d.facts.map((f, k) => `<li class="stat" data-reveal style="--d:${k * 80}ms"><span class="stat__num">${f.v}</span><span class="stat__label">${f.l}</span></li>`).join('')}</ul>
  </div>
</section>
<section class="sec" aria-labelledby="inc-h">
  <div class="wrap two">
    <div class="two__l">
      <p class="kicker">Что входит</p>
      <h2 class="h2" id="inc-h" data-reveal>Состав работ</h2>
    </div>
    <div class="two__r">
      <div class="prose prose--lead">${d.body.map((p) => `<p>${p}</p>`).join('')}</div>
      <ul class="checks checks--grid" role="list">${d.includes.map((x) => `<li data-reveal>${icon('check')}${x}</li>`).join('')}</ul>
    </div>
  </div>
</section>
<section class="sec sec--surface" aria-labelledby="st-h">
  <div class="wrap">
    ${secHead({ kicker: 'Этапы', title: 'Как идёт работа', id: 'st-h', text: 'Сроки ориентировочные и зависят от масштаба объекта.' })}
    ${stepsList()}
  </div>
</section>
${rel.length ? `<section class="sec" aria-labelledby="rp-h">
  <div class="wrap">
    ${secHead({ kicker: 'Проекты', title: 'Объекты по направлению', id: 'rp-h', link: 'proekty/', linkText: 'Все проекты' })}
    <ul class="pgrid" role="list">${rel.slice(0, 2).map((p, k) => projCard(p, k)).join('')}</ul>
  </div>
</section>` : ''}
<section class="sec sec--top0" aria-labelledby="dfaq-h">
  <div class="wrap faq-home">
    <div>
      <p class="kicker">Вопросы и ответы</p>
      <h2 class="h2" id="dfaq-h">Частые вопросы</h2>
      <a class="arrow-link" href="${u('voprosy/')}">Все вопросы и ответы${icon('arrow-up-right')}</a>
    </div>
    ${faqList(d.faq)}
  </div>
</section>
<section class="sec sec--top0" aria-labelledby="od-h">
  <div class="wrap">
    <h2 class="kicker" id="od-h">Другие направления</h2>
    <ul class="dirstrip dirstrip--5" role="list">${others.map((x) => `<li><a href="${u(`napravleniya/${x.slug}/`)}"><span class="dirstrip__n" aria-hidden="true">${pad2(directions.indexOf(x) + 1)}</span>${icon(x.icon)}<span class="dirstrip__t">${x.title}</span></a></li>`).join('')}</ul>
  </div>
</section>
${formSection()}
`;
    addPage({
      key: 'dir', path: `napravleniya/${d.slug}/`, section: 'napravleniya', title: d.seoTitle, desc: d.seoDesc, body: bodyD, ogImg: d.img,
      ld: [crumbsLd(trail2), faqLd(d.faq), { '@context': 'https://schema.org', '@type': 'Service', name: d.title, serviceType: d.title, description: d.seoDesc, provider: { '@id': abs('#org'), '@type': 'Organization', name: site.name }, areaServed: { '@type': 'Country', name: 'Россия' } }],
    });
  });
}

// ================= ПРОЕКТЫ =================
{
  const trail = [['proekty/', 'Проекты']];
  const chips = [['all', 'Все проекты'], ...directions.map((d) => [d.slug, d.title])];
  const body = `
${pageHero({ trail, kicker: '146 сданных объектов', title: 'Проекты', lead: 'Офисы, жильё, логистика, школы, медицина, спорт и дата-центры. Здесь — объекты, о которых заказчики разрешили рассказать подробно.' })}
<section class="sec sec--top0" aria-labelledby="flt-l">
  <div class="wrap">
    <div class="filter" data-filter>
      <p class="filter__l" id="flt-l">Направление:</p>
      <div class="chips" role="group" aria-labelledby="flt-l">
        ${chips.map(([v, t], i) => `<button class="chip" type="button" data-value="${v}" aria-pressed="${i === 0}">${icon('check', 'i chip__ic')}${t}</button>`).join('')}
      </div>
      <p class="filter__count" role="status" data-count-status>Показано ${projects.length} ${plural(projects.length, ['проект', 'проекта', 'проектов'])}</p>
    </div>
    <h2 class="sr-only">Список проектов</h2>
    <ul class="pgrid" role="list" data-filter-list>${projects.map((p, i) => projCard(p, i, { lead: true })).join('')}</ul>
  </div>
</section>
${ctaBand('Хотите такой же результат на своём объекте?')}
`;
  addPage({ key: 'projects', path: 'proekty/', section: 'proekty', title: 'Проекты', desc: 'Портфолио группы «Тектоника»: бизнес-центры, жилые кварталы, логистические парки, школы, клиники, спортивные объекты и дата-центры.', body, ld: [crumbsLd(trail)] });

  projects.forEach((p, i) => {
    const trail2 = [['proekty/', 'Проекты'], [`proekty/${p.slug}/`, p.title]];
    const next = projects[(i + 1) % projects.length];
    const rev = reviews.find((r) => r.project === p.slug);
    const bodyP = `
${pageHero({ trail: trail2, kicker: `${p.type} · ${p.city} · ${p.year}`, title: p.title, lead: p.lead })}
<section class="sec sec--top0">
  <div class="wrap">
    <figure class="media media--wide plx" data-reveal>${img(p.img, { alt: p.alt, ar: 21 / 9, sizes: '100vw', widths: [800, 1200, 1800, 2400], eager: true })}</figure>
    <dl class="facts facts--band">
      <div><dt>Город</dt><dd>${p.city}</dd></div>
      <div><dt>Год ввода</dt><dd>${p.year}</dd></div>
      <div><dt>Площадь</dt><dd>${p.area}</dd></div>
      <div><dt>Срок</dt><dd>${p.duration}</dd></div>
      <div><dt>Наша роль</dt><dd>${p.role}</dd></div>
    </dl>
  </div>
</section>
<section class="sec" aria-labelledby="task-h">
  <div class="wrap two">
    <div class="two__l"><p class="kicker">Задача</p><h2 class="h2" id="task-h" data-reveal>Что нужно было сделать</h2></div>
    <div class="two__r prose prose--lead"><p>${p.task}</p></div>
  </div>
</section>
<section class="sec sec--top0" aria-labelledby="sol-h">
  <div class="wrap two">
    <div class="two__l"><p class="kicker">Решение</p><h2 class="h2" id="sol-h" data-reveal>Как мы это сделали</h2></div>
    <div class="two__r prose">${p.solution.map((s) => `<p>${s}</p>`).join('')}</div>
  </div>
</section>
<section class="sec sec--top0" aria-labelledby="gal-h">
  <div class="wrap">
    <h2 class="sr-only" id="gal-h">Фотографии объекта</h2>
    <ul class="gallery" role="list">${p.gallery.map(([id, alt], k) => `<li data-reveal style="--d:${k * 100}ms"><figure class="media plx">${img(id, { alt, ar: 4 / 3, sizes: '(min-width: 768px) 50vw, 100vw' })}</figure></li>`).join('')}</ul>
  </div>
</section>
<section class="sec dark" aria-labelledby="res-h">
  <div class="wrap">
    <p class="kicker kicker--light">Результат</p>
    <h2 class="h2" id="res-h" data-reveal>Итоги проекта</h2>
    <ul class="results" role="list">${p.results.map((r, k) => `<li data-reveal style="--d:${k * 90}ms"><span class="results__n" aria-hidden="true">${pad2(k + 1)}</span>${r}</li>`).join('')}</ul>
    ${rev ? `<figure class="pquote" data-reveal><blockquote><p>${rev.text}</p></blockquote><figcaption><span class="rcard__name">${rev.name}</span><span class="rcard__role">${rev.role}, ${rev.company}</span></figcaption></figure>` : ''}
  </div>
</section>
<section class="sec" aria-labelledby="pd-h">
  <div class="wrap">
    <h2 class="kicker" id="pd-h">Направления в проекте</h2>
    <ul class="tags" role="list">${p.dirs.map((s) => `<li><a class="tagl" href="${u(`napravleniya/${s}/`)}">${dirBySlug[s].title}</a></li>`).join('')}</ul>
    <a class="next" href="${u(`proekty/${next.slug}/`)}">
      <span class="next__l">Следующий проект</span>
      <span class="next__t">${next.title}</span>
      <span class="next__m">${next.type} · ${next.city}</span>
      ${icon('arrow-right', 'i next__ic')}
    </a>
  </div>
</section>
${ctaBand('Обсудим ваш объект?')}
`;
    addPage({ key: 'project', path: `proekty/${p.slug}/`, section: 'proekty', title: `${p.title} — ${p.city}`, desc: `${p.lead.slice(0, 150)}`, body: bodyP, ogImg: p.img, ld: [crumbsLd(trail2)] });
  });
}

// ================= ПРИНЦИПЫ =================
{
  const trail = [['principy/', 'Принципы работы']];
  const body = `
${pageHero({ trail, kicker: 'Принципы и преимущества', title: 'Шесть правил, которые мы не нарушаем', lead: 'Это не лозунги со стены переговорной, а условия, которые записаны в наших договорах и регламентах. Заказчики проверяют их на практике.' })}
<section class="sec sec--top0" aria-label="Принципы">
  <div class="wrap">
    <ol class="stack" role="list">
      ${principles.map((p, i) => `<li class="stack__item" style="--i:${i}"><div class="stack__card"><span class="stack__n" aria-hidden="true">${pad2(i + 1)}</span><div><h2 class="h2">${p.title}</h2><p class="lead">${p.text}</p></div></div></li>`).join('')}
    </ol>
  </div>
</section>
<section class="sec sec--surface" aria-labelledby="st-h">
  <div class="wrap">
    ${secHead({ kicker: 'Этапы работы', title: 'Путь от задачи до ключей', id: 'st-h', text: 'Пять этапов, у каждого — свой результат, который заказчик принимает перед переходом к следующему.' })}
    ${stepsList()}
  </div>
</section>
<section class="sec" aria-labelledby="adv-h">
  <div class="wrap">
    ${secHead({ kicker: 'Преимущества', title: 'Почему нас выбирают', id: 'adv-h' })}
    ${statsList('stats--band')}
  </div>
</section>
${ctaBand()}
`;
  addPage({ key: 'principles', path: 'principy/', section: 'principy', title: 'Принципы работы и преимущества', desc: 'Принципы работы «Тектоники»: твёрдая цена и срок в договоре, еженедельная отчётность, безопасность по ISO 45001, этапы работы от задачи до ввода.', body, ld: [crumbsLd(trail)] });
}

// ================= ВОПРОСЫ =================
{
  const trail = [['voprosy/', 'Вопросы и ответы']];
  const all = faqGroups.flatMap((g) => g.items);
  const body = `
${pageHero({ trail, kicker: `${all.length} ${plural(all.length, ['вопрос', 'вопроса', 'вопросов'])}`, title: 'Вопросы и ответы', lead: 'Собрали то, о чём заказчики спрашивают чаще всего на первой встрече. Если вашего вопроса здесь нет — задайте его нам напрямую.' })}
<section class="sec sec--top0">
  <div class="wrap faqpage">
    <nav class="faqnav" aria-label="Разделы вопросов"><ul>${faqGroups.map((g, i) => `<li><a href="#faq-${i + 1}">${g.title}</a></li>`).join('')}</ul></nav>
    <div class="faqpage__groups">
      ${faqGroups.map((g, i) => `<section class="faqgroup" aria-labelledby="faq-${i + 1}"><h2 class="h3 faqgroup__t" id="faq-${i + 1}">${g.title}</h2>${faqList(g.items)}</section>`).join('')}
    </div>
  </div>
</section>
${ctaBand('Не нашли ответ на свой вопрос?', 'Позвоните или оставьте заявку — руководитель направления ответит в течение рабочего дня.')}
`;
  addPage({ key: 'faq', path: 'voprosy/', section: 'voprosy', title: 'Вопросы и ответы', desc: 'Ответы на частые вопросы о сотрудничестве с «Тектоникой»: сроки и стоимость строительства, договор, гарантии, лицензии и работа по 44-ФЗ и 223-ФЗ.', body, ld: [crumbsLd(trail), faqLd(all)] });
}

// ================= ОТЗЫВЫ =================
{
  const trail = [['otzyvy/', 'Отзывы']];
  const body = `
${pageHero({ trail, kicker: 'Отзывы заказчиков', title: 'Нас рекомендуют те, с кем мы уже строили', lead: 'Больше половины новых проектов приходят к нам по рекомендации. Вот что говорят заказчики о совместной работе.' })}
<section class="sec sec--top0" aria-label="Отзывы">
  <div class="wrap">
    <ul class="reviews reviews--page" role="list">${reviews.map(reviewCard).join('')}</ul>
  </div>
</section>
${ctaBand('Станьте следующим заказчиком, который нас порекомендует')}
`;
  addPage({ key: 'reviews', path: 'otzyvy/', section: 'otzyvy', title: 'Отзывы заказчиков', desc: 'Отзывы заказчиков о работе группы «Тектоника»: девелоперы, инвесторы и управляющие компании о проектировании, генподряде и реконструкции.', body, ld: [crumbsLd(trail)] });
}

// ================= ЖУРНАЛ =================
{
  const tabs = (cur) => `<nav class="rtabs" aria-label="Рубрики журнала"><ul>
    <li><a href="${u('zhurnal/')}"${cur === '' ? ' aria-current="page"' : ''}>Все материалы</a></li>
    ${rubrics.map((r) => `<li><a href="${u(`zhurnal/${r.slug}/`)}"${cur === r.slug ? ' aria-current="page"' : ''}>${r.title}</a></li>`).join('')}
  </ul></nav>`;
  const listing = (list) => `<h2 class="sr-only">Материалы журнала</h2><ul class="jlist" role="list">${list.map((a, i) => articleCard(a, i, i === 0 ? 'feat' : '')).join('')}</ul>`;

  const trail = [['zhurnal/', 'Журнал']];
  addPage({
    key: 'journal', path: 'zhurnal/', section: 'zhurnal', title: 'Журнал: статьи и новости',
    desc: 'Журнал «Тектоники»: статьи о проектировании, строительстве и реконструкции, разборы для заказчиков и новости компании.',
    body: `${pageHero({ trail, kicker: 'Журнал', title: 'Статьи и новости', lead: 'Пишем о том, что знаем на практике: как выбирать подрядчиков, считать бюджет, проектировать в BIM и реконструировать сложные здания.' })}
<section class="sec sec--top0" aria-label="Материалы журнала"><div class="wrap">${tabs('')}${listing(sortedArticles)}</div></section>
${ctaBand()}`,
    ld: [crumbsLd(trail)],
  });
  rubrics.forEach((r) => {
    const trail2 = [['zhurnal/', 'Журнал'], [`zhurnal/${r.slug}/`, r.title]];
    const list = sortedArticles.filter((a) => a.rubric === r.slug);
    addPage({
      key: 'journal', path: `zhurnal/${r.slug}/`, section: 'zhurnal', title: `${r.title} — журнал`,
      desc: r.slug === 'stati' ? 'Полезные статьи для заказчиков строительства: выбор генподрядчика, BIM-проектирование, технический заказчик, реконструкция.' : 'Новости группы «Тектоника»: сданные объекты, сертификаты, новые проекты.',
      body: `${pageHero({ trail: trail2, kicker: 'Журнал', title: r.title, lead: `${list.length} ${plural(list.length, ['материал', 'материала', 'материалов'])} в рубрике.` })}
<section class="sec sec--top0" aria-label="Материалы рубрики"><div class="wrap">${tabs(r.slug)}${listing(list)}</div></section>
${ctaBand()}`,
      ld: [crumbsLd(trail2)],
    });
  });

  sortedArticles.forEach((a) => {
    const trail2 = [['zhurnal/', 'Журнал'], [`zhurnal/${a.rubric}/`, rubricTitle(a.rubric)], [`zhurnal/${a.slug}/`, a.title]];
    const secs = a.sections.map((s, i) => ({ ...s, id: `s${i + 1}` }));
    const related = sortedArticles.filter((x) => x !== a).sort((x, y) => (y.rubric === a.rubric) - (x.rubric === a.rubric)).slice(0, 3);
    const body = `
<article class="art" aria-labelledby="art-t">
  <header class="art__head">
    <div class="wrap">
      ${breadcrumbs(trail2)}
      <p class="acard__meta art__meta"><span class="tag">${rubricTitle(a.rubric)}</span><time datetime="${a.date}">${fmtDate(a.date)}</time><span>${a.read} мин чтения</span></p>
      <h1 class="h1 art__t" id="art-t">${a.title}</h1>
      <p class="lead art__lead">${a.lead}</p>
      <p class="art__author">${icon('user')}${a.author}</p>
    </div>
  </header>
  <div class="wrap">
    <figure class="media media--wide art__cover">${img(a.img, { alt: a.alt, ar: 21 / 9, sizes: '100vw', widths: [800, 1200, 1800, 2400], eager: true })}</figure>
  </div>
  <div class="wrap art__grid">
    <aside class="art__aside">
      <nav class="toc" aria-labelledby="toc-h">
        <h2 class="toc__h" id="toc-h">Содержание статьи</h2>
        <ol>${secs.map((s) => `<li><a href="#${s.id}">${s.h}</a></li>`).join('')}</ol>
      </nav>
    </aside>
    <div class="prose art__body">
      ${secs.map((s) => `<h2 id="${s.id}">${s.h}</h2>${fixLinks(s.html)}`).join('\n')}
      <div class="art__cta">
        <p class="h3">Обсудим ваш проект?</p>
        <p>Первая консультация и выезд на площадку бесплатны.</p>
        <a class="btn btn--dark" href="${u('kontakty/')}#form">Оставить заявку ${icon('arrow-up-right')}</a>
      </div>
    </div>
  </div>
</article>
<section class="sec sec--surface" aria-labelledby="rel-h">
  <div class="wrap">
    ${secHead({ kicker: 'Журнал', title: 'Читайте также', id: 'rel-h', link: 'zhurnal/', linkText: 'Все материалы' })}
    <ul class="jlist jlist--3" role="list">${related.map((x, i) => articleCard(x, i)).join('')}</ul>
  </div>
</section>
`;
    addPage({
      key: 'article', path: `zhurnal/${a.slug}/`, section: 'zhurnal', title: a.title, desc: a.desc, body, ogType: 'article', ogImg: a.img,
      ld: [crumbsLd(trail2), {
        '@context': 'https://schema.org', '@type': a.rubric === 'novosti' ? 'NewsArticle' : 'Article',
        headline: a.title, description: a.desc, image: unsplash(a.img, 1200, 1200 / 630).replace(/&amp;/g, '&'),
        datePublished: a.date, dateModified: a.date, inLanguage: 'ru',
        author: { '@type': a.author.startsWith('Пресс') ? 'Organization' : 'Person', name: a.author.split(',')[0] },
        publisher: { '@id': abs('#org'), '@type': 'Organization', name: site.name, logo: { '@type': 'ImageObject', url: abs('assets/favicon.svg') } },
        mainEntityOfPage: abs(`zhurnal/${a.slug}/`),
      }],
    });
  });
}

// ================= КОНТАКТЫ =================
{
  const trail = [['kontakty/', 'Контакты']];
  const { lat, lon } = site.geo;
  const bbox = `${lon - 0.012},${lat - 0.005},${lon + 0.012},${lat + 0.005}`;
  const body = `
${pageHero({ trail, kicker: 'Контакты', title: 'Приезжайте, звоните, пишите', lead: 'Головной офис в Москве, проектные и строительные управления — в Санкт-Петербурге, Казани и Екатеринбурге.' })}
<section class="sec sec--top0" aria-labelledby="office-h">
  <div class="wrap contacts-grid">
    <div class="contacts-card">
      <h2 class="h3" id="office-h">Головной офис</h2>
      <ul class="contacts" role="list">
        <li>${icon('phone')}<span><span class="contacts__l">Телефон</span><a href="tel:${site.phoneHref}">${site.phone}</a></span></li>
        <li>${icon('mail')}<span><span class="contacts__l">Почта</span><a href="mailto:${site.email}">${site.email}</a></span></li>
        <li>${icon('map-pin')}<span><span class="contacts__l">Адрес</span><address>${site.address}</address></span></li>
        <li>${icon('clock')}<span><span class="contacts__l">Часы работы</span>${site.hours}</span></li>
      </ul>
      <h2 class="h3 contacts-card__h2">Региональные офисы</h2>
      <ul class="offices" role="list">
        <li><span>Санкт-Петербург</span><span>проектный институт</span></li>
        <li><span>Казань</span><span>строительное управление</span></li>
        <li><span>Екатеринбург</span><span>строительное управление</span></li>
      </ul>
    </div>
    <div class="map">
      <iframe title="Карта: головной офис «Тектоники», ${esc(site.address)}" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${lat},${lon}" loading="lazy"></iframe>
      <a class="map__link" href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=16/${lat}/${lon}">Открыть карту на OpenStreetMap</a>
    </div>
  </div>
</section>
${formSection()}
<section class="sec" aria-labelledby="req-h">
  <div class="wrap two">
    <div class="two__l"><p class="kicker">Для документов</p><h2 class="h2" id="req-h">Реквизиты</h2></div>
    <div class="two__r">
      <dl class="req">
        <div><dt>Полное наименование</dt><dd>Общество с ограниченной ответственностью «Тектоника»</dd></div>
        <div><dt>ИНН / КПП</dt><dd>${site.inn} / ${site.kpp}</dd></div>
        <div><dt>ОГРН</dt><dd>${site.ogrn}</dd></div>
        <div><dt>Юридический адрес</dt><dd>${site.postal}, ${site.address}</dd></div>
      </dl>
      <a class="arrow-link" href="${u('dokumenty/')}">Все реквизиты и документы${icon('arrow-up-right')}</a>
    </div>
  </div>
</section>
`;
  addPage({
    key: 'contacts', path: 'kontakty/', section: 'kontakty', title: 'Контакты', desc: `Контакты «Тектоники»: телефон ${site.phone}, адрес головного офиса в Москве, региональные офисы, форма заявки и реквизиты компании.`, body,
    ld: [crumbsLd(trail), { ...ORG_LD, '@type': 'GeneralContractor', geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lon }, openingHours: 'Mo-Fr 09:00-19:00' }],
  });
}

// ================= ДОКУМЕНТЫ =================
const LEGAL = {
  'politika-konfidencialnosti': [
    ['Общие положения', `Настоящая политика определяет порядок обработки и защиты персональных данных пользователей сайта ${site.name} (далее — Сайт) в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных». Оператор — ${site.legal}, ИНН ${site.inn}, адрес: ${site.address}.`],
    ['Какие данные мы обрабатываем', 'Имя, номер телефона, адрес электронной почты и текст сообщения, которые пользователь указывает в форме заявки, а также технические данные: cookie, IP-адрес, сведения о браузере и действиях на Сайте.'],
    ['Цели обработки', 'Связь с пользователем по его заявке, подготовка коммерческого предложения, заключение и исполнение договора, улучшение работы Сайта.'],
    ['Правовые основания', 'Согласие пользователя на обработку персональных данных, а также необходимость заключения и исполнения договора, стороной которого является пользователь.'],
    ['Сроки и порядок обработки', 'Данные обрабатываются до достижения целей обработки или до отзыва согласия. Оператор не передаёт данные третьим лицам, за исключением случаев, предусмотренных законодательством РФ. Данные хранятся на серверах, расположенных на территории Российской Федерации.'],
    ['Права пользователя', `Пользователь вправе получить сведения об обработке своих данных, потребовать их уточнения, блокирования или уничтожения, а также отозвать согласие, направив запрос на ${site.email}.`],
  ],
  'soglasie-na-obrabotku': [
    ['Согласие', `Отправляя форму на Сайте, я свободно, своей волей и в своём интересе даю согласие ${site.legal} (ИНН ${site.inn}) на обработку моих персональных данных: имени, номера телефона, адреса электронной почты и иных данных, указанных мной в форме.`],
    ['Цели', 'Обработка моей заявки, обратная связь, подготовка коммерческого предложения и заключение договора.'],
    ['Действия с данными', 'Сбор, запись, систематизация, накопление, хранение, уточнение, использование, обезличивание, блокирование, удаление и уничтожение — с использованием средств автоматизации и без них.'],
    ['Срок действия и отзыв', `Согласие действует до достижения целей обработки или до его отзыва. Отозвать согласие можно, направив письмо на ${site.email}.`],
  ],
  'polzovatelskoe-soglashenie': [
    ['Предмет соглашения', `Соглашение регулирует отношения между ${site.legal} и пользователем при использовании Сайта. Пользуясь Сайтом, пользователь принимает условия соглашения.`],
    ['Информация на Сайте', 'Материалы Сайта носят информационный характер и не являются публичной офертой. Стоимость и сроки работ определяются договором.'],
    ['Интеллектуальная собственность', 'Тексты, изображения, логотипы и другие материалы Сайта охраняются законодательством. Копирование возможно только с письменного согласия правообладателя.'],
    ['Ответственность', 'Администрация Сайта не несёт ответственности за временную недоступность Сайта и за решения, принятые пользователем на основе информации с Сайта.'],
  ],
  cookie: [
    ['Что такое cookie', 'Cookie — небольшие файлы, которые Сайт сохраняет в браузере пользователя, чтобы запоминать настройки и понимать, как используется Сайт.'],
    ['Какие cookie мы используем', 'Технические — необходимы для работы Сайта (например, чтобы не показывать уведомление о cookie повторно). Аналитические — помогают понять, какие страницы полезны пользователям; подключаются после запуска Сайта.'],
    ['Как отключить cookie', 'Пользователь может удалить cookie или запретить их сохранение в настройках браузера. Некоторые функции Сайта при этом могут работать некорректно.'],
  ],
};
{
  const trail = [['dokumenty/', 'Документы']];
  const body = `
${pageHero({ trail, kicker: 'Юридическая информация', title: 'Документы и реквизиты', lead: 'Реквизиты компании, допуски, лицензии и сертификаты, а также правовые документы сайта.' })}
<section class="sec sec--top0" aria-labelledby="req-h">
  <div class="wrap two">
    <div class="two__l"><h2 class="h2" id="req-h">Реквизиты</h2></div>
    <dl class="req two__r">
      <div><dt>Полное наименование</dt><dd>Общество с ограниченной ответственностью «Тектоника»</dd></div>
      <div><dt>Сокращённое наименование</dt><dd>${site.legal}</dd></div>
      <div><dt>ИНН / КПП</dt><dd>${site.inn} / ${site.kpp}</dd></div>
      <div><dt>ОГРН</dt><dd>${site.ogrn}</dd></div>
      <div><dt>Юридический адрес</dt><dd>${site.postal}, ${site.address}</dd></div>
      <div><dt>Расчётный счёт</dt><dd>${site.account}</dd></div>
      <div><dt>Банк</dt><dd>${site.bank}</dd></div>
      <div><dt>Корр. счёт / БИК</dt><dd>${site.corr} / ${site.bik}</dd></div>
      <div><dt>Генеральный директор</dt><dd>${team[0].name}</dd></div>
    </dl>
  </div>
</section>
<section class="sec sec--surface" aria-labelledby="lic-h">
  <div class="wrap">
    ${secHead({ kicker: 'Допуски', title: 'Лицензии и сертификаты', id: 'lic-h', text: 'Копии документов направим по запросу на почту.' })}
    ${licenseGrid(false)}
  </div>
</section>
<section class="sec" aria-labelledby="legal-h">
  <div class="wrap two">
    <div class="two__l"><h2 class="h2" id="legal-h">Правовые документы сайта</h2></div>
    <ul class="doclist two__r" role="list">${legalDocs.map((d) => `<li><a href="${u(`dokumenty/${d.slug}/`)}">${icon('file-text')}<span>${d.title}</span>${icon('arrow-up-right', 'i doclist__go')}</a></li>`).join('')}</ul>
  </div>
</section>
`;
  addPage({ key: 'docs', path: 'dokumenty/', section: 'dokumenty', title: 'Документы и реквизиты', desc: 'Реквизиты ООО «Тектоника», допуски СРО, лицензии Минкультуры и МЧС, сертификаты ISO, политика обработки персональных данных.', body, ld: [crumbsLd(trail)] });

  legalDocs.forEach((d) => {
    const trail2 = [['dokumenty/', 'Документы'], [`dokumenty/${d.slug}/`, d.title]];
    const bodyL = `
${pageHero({ trail: trail2, kicker: 'Редакция от 1 октября 2026 года', title: d.title })}
<section class="sec sec--top0">
  <div class="wrap two">
    <nav class="two__l toc toc--static" aria-labelledby="ltoc-h"><h2 class="toc__h" id="ltoc-h">Разделы документа</h2><ol>${LEGAL[d.slug].map(([h], i) => `<li><a href="#p${i + 1}">${h}</a></li>`).join('')}</ol></nav>
    <div class="two__r prose">${LEGAL[d.slug].map(([h, t], i) => `<h2 id="p${i + 1}">${i + 1}. ${h}</h2><p>${t}</p>`).join('')}</div>
  </div>
</section>`;
    addPage({ key: 'legal', path: `dokumenty/${d.slug}/`, section: 'dokumenty', title: d.title, desc: `${d.title} — ${site.legal}.`, body: bodyL, ld: [crumbsLd(trail2)] });
  });
}

// ================= 404 =================
const page404 = {
  key: 'e404', path: '404.html', section: '', title: 'Страница не найдена', desc: 'Такой страницы нет на сайте.',
  body: `<section class="e404">
  <div class="wrap e404__in">
    <p class="e404__code" aria-hidden="true">404</p>
    <h1 class="h1">Такой страницы нет</h1>
    <p class="lead">Возможно, её перенесли или в адресе опечатка. Начните с главной или загляните в основные разделы.</p>
    <div class="btns"><a class="btn btn--dark" href="${u()}">На главную ${icon('arrow-up-right')}</a><a class="btn btn--ghost" href="${u('proekty/')}">Проекты</a><a class="btn btn--ghost" href="${u('kontakty/')}">Контакты</a></div>
  </div>
</section>`,
};

// ---------- write ----------
function hashFiles(files) {
  const h = crypto.createHash('sha1');
  for (const f of files) h.update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 8);
}
const SRC = path.join(ROOT, 'src');
const ASSET_V = hashFiles([path.join(SRC, 'style.css'), path.join(SRC, 'app.js')]);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(SRC, path.join(OUT, 'assets'), { recursive: true });

for (const p of [...pages, page404]) {
  const file = p.path.endsWith('.html') ? path.join(OUT, p.path) : path.join(OUT, p.path, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, layout(p));
}

const lastmod = (p) => (p.key === 'article' ? articles.find((a) => `zhurnal/${a.slug}/` === p.path)?.date : null) || TODAY;
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${lastmod(p)}</lastmod><priority>${p.path === '' ? '1.0' : p.key === 'dir' ? '0.9' : p.key === 'legal' ? '0.3' : '0.7'}</priority></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\n${NOINDEX ? 'Disallow: /' : 'Allow: /'}\n\nSitemap: ${abs('sitemap.xml')}\n`);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log(`Готово: ${pages.length + 1} страниц → ${path.relative(ROOT, OUT)}/ (BASE=${BASE}, noindex=${NOINDEX}, v=${ASSET_V})`);
