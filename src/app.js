/* Тектоника — интерактив без зависимостей */
(() => {
  'use strict';
  window.__tk = 1;
  const d = document;
  const html = d.documentElement;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Панель предпросмотра открывает страницы скрытыми — там rAF и IntersectionObserver молчат.
  const hiddenStart = d.visibilityState === 'hidden';
  const canIO = 'IntersectionObserver' in window;

  /* ---------- шапка: прячется при прокрутке вниз ---------- */
  const hdr = $('#hdr');
  if (hdr) {
    let last = scrollY;
    const onScroll = () => {
      const y = scrollY;
      hdr.classList.toggle('is-scrolled', y > 4);
      if (y > last + 4 && y > 220 && !hdr.contains(d.activeElement) && !html.classList.contains('menu-open')) {
        hdr.classList.add('is-hidden');
      } else if (y < last - 4 || y < 220) {
        hdr.classList.remove('is-hidden');
      }
      last = y;
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    // 2.4.11: если видимая шапка перекрывает элемент с фокусом — сдвигаем страницу
    d.addEventListener('focusin', (e) => {
      const t = e.target;
      if (hdr.contains(t) || t === d.body || t.id === 'main' || t.closest('dialog, .cookie')) return;
      const h = hdr.offsetHeight;
      const r = t.getBoundingClientRect();
      if (!hdr.classList.contains('is-hidden') && r.top < h + 8 && r.bottom > 0) {
        scrollBy({ top: r.top - h - 16, behavior: 'instant' });
      }
    });
  }

  /* ---------- мобильное меню (<dialog>) ---------- */
  const dlg = $('#menu');
  const burger = $('.burger--js');
  if (dlg && burger) {
    if (typeof dlg.showModal !== 'function') {
      burger.addEventListener('click', () => { location.hash = '#ftr-nav'; });
    } else {
      const closeMenu = (ret = true) => {
        if (dlg.open) dlg.close();
        html.classList.remove('menu-open');
        if (hdr) hdr.classList.remove('is-hidden');
        if (ret) burger.focus();
      };
      burger.addEventListener('click', () => {
        dlg.showModal();
        html.classList.add('menu-open');
        $('.menu__close', dlg).focus();
      });
      $('.menu__close', dlg).addEventListener('click', () => closeMenu());
      dlg.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
      });
      dlg.addEventListener('click', (e) => {
        if (e.target === dlg) closeMenu();
        else if (e.target.closest('a')) closeMenu(false);
      });
      dlg.addEventListener('close', () => html.classList.remove('menu-open'));
      matchMedia('(min-width: 1100px)').addEventListener('change', (e) => { if (e.matches) closeMenu(false); });
      addEventListener('pageshow', (e) => { if (e.persisted) closeMenu(false); });
    }
  }

  /* ---------- появление блоков при прокрутке ---------- */
  const reveals = $$('[data-reveal]');
  const showAll = () => reveals.forEach((el) => el.classList.add('is-in'));
  if (reduce || hiddenStart || !canIO) {
    showAll();
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    reveals.forEach((el) => io.observe(el));
  }
  d.addEventListener('visibilitychange', () => { if (d.visibilityState === 'hidden') showAll(); });

  /* ---------- счётчики ---------- */
  const fmt = (v, dec) => (dec ? v.toFixed(dec).replace('.', ',') : Math.round(v).toLocaleString('ru-RU'));
  const counters = $$('[data-count]');
  if (counters.length && !reduce && !hiddenStart && canIO) {
    const run = (el) => {
      const end = parseFloat(el.dataset.count);
      const dec = +el.dataset.dec || 0;
      const t0 = performance.now();
      const dur = 1500;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = fmt(end * (1 - Math.pow(1 - p, 3)), dec);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io2 = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { io2.unobserve(en.target); run(en.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach((el) => { el.textContent = fmt(0, +el.dataset.dec || 0); io2.observe(el); });
  }

  /* ---------- текст «проявляется» по словам при прокрутке ---------- */
  if (!reduce) {
    $$('[data-words]').forEach((p) => {
      const text = p.textContent;
      const sr = d.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = text;
      const vis = d.createElement('span');
      vis.setAttribute('aria-hidden', 'true');
      text.split(/(\s+)/).forEach((t) => {
        if (!t) return;
        if (/^\s+$/.test(t)) { vis.append(t); return; }
        const s = d.createElement('span');
        s.className = 'wd';
        s.textContent = t;
        vis.append(s);
      });
      p.textContent = '';
      p.append(sr, vis);
      const words = $$('.wd', vis);
      const update = () => {
        const r = p.getBoundingClientRect();
        const vh = innerHeight;
        const prog = Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.3)));
        const n = Math.round(prog * words.length);
        words.forEach((w, i) => w.classList.toggle('on', i < n));
      };
      addEventListener('scroll', update, { passive: true });
      addEventListener('resize', update);
      update();
    });
  }

  /* ---------- превью проекта за курсором ---------- */
  const peek = $('.peek');
  if (peek && !reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const pimg = $('img', peek);
    let x = 0, y = 0, on = false, raf = 0;
    const place = () => {
      raf = 0;
      const h = peek.offsetHeight;
      const top = Math.max(12, y - h - 24);
      const left = Math.min(innerWidth - peek.offsetWidth - 12, x + 24);
      peek.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    };
    const rows = $$('[data-peek] .prow');
    rows.forEach((row) => {
      row.addEventListener('mouseenter', () => {
        if (pimg.getAttribute('src') !== row.dataset.img) pimg.src = row.dataset.img;
        on = true;
        place();
        peek.classList.add('is-on');
      });
      row.addEventListener('mouseleave', () => { on = false; peek.classList.remove('is-on'); });
    });
    addEventListener('mousemove', (e) => {
      x = e.clientX; y = e.clientY;
      if (on && !raf) raf = requestAnimationFrame(place);
    }, { passive: true });
    addEventListener('keydown', () => { on = false; peek.classList.remove('is-on'); });
    addEventListener('load', () => rows.forEach((r) => { const i = new Image(); i.src = r.dataset.img; }));
  }

  /* ---------- фильтр проектов ---------- */
  const fw = $('[data-filter]');
  if (fw) {
    const chips = $$('.chip', fw);
    const items = $$('[data-filter-list] > li');
    const status = $('[data-count-status]', fw);
    const pr = new Intl.PluralRules('ru');
    const forms = { one: 'проект', few: 'проекта', many: 'проектов', other: 'проекта' };
    let tmr = 0;
    chips.forEach((chip) => chip.addEventListener('click', () => {
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      const v = chip.dataset.value;
      let n = 0;
      items.forEach((it) => {
        const ok = v === 'all' || it.dataset.dirs.split(' ').includes(v);
        it.hidden = !ok;
        if (ok) { n += 1; it.classList.add('is-in'); }
      });
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        status.textContent = n ? `Показано ${n} ${forms[pr.select(n)]}` : 'Проекты не найдены';
      }, 400);
    }));
  }

  /* ---------- оглавление статьи: подсветка текущего раздела ---------- */
  const toc = $('.art__aside .toc');
  if (toc) {
    const links = $$('a[href^="#"]', toc);
    const heads = links.map((a) => d.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    let cur = '';
    const update = () => {
      let id = heads[0] && heads[0].id;
      heads.forEach((h) => { if (h.getBoundingClientRect().top < innerHeight * 0.3) id = h.id; });
      if (id === cur) return;
      cur = id;
      links.forEach((a) => {
        if (a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------- формы заявки ---------- */
  $$('[data-form]').forEach((form) => {
    const wrap = form.closest('[data-form-wrap]');
    const sum = $('[data-errsum]', form);
    const sumT = $('[data-errsum-title]', form);
    const sumL = $('[data-errsum-list]', form);
    const fields = $$('input[required], input[type="email"]', form);
    let submitted = false;

    const check = (el) => {
      const v = el.value.trim();
      let msg = '';
      if (el.type === 'checkbox') {
        if (!el.checked) msg = 'отметьте согласие на обработку персональных данных.';
      } else if (el.required && !v) {
        msg = el.type === 'tel' ? 'введите номер телефона.' : 'введите имя.';
      } else if (el.type === 'tel' && v.replace(/\D/g, '').length < 10) {
        msg = 'в номере должно быть не меньше 10 цифр, например +7 900 000-00-00.';
      } else if (el.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        msg = 'введите адрес в формате name@example.ru.';
      }
      const err = d.getElementById(`${el.id}-err`);
      if (msg) {
        el.setAttribute('aria-invalid', 'true');
        err.textContent = msg.charAt(0).toUpperCase() + msg.slice(1);
      } else {
        el.removeAttribute('aria-invalid');
        err.textContent = '';
      }
      return msg;
    };

    fields.forEach((el) => {
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => { if (submitted) check(el); });
      el.addEventListener('blur', () => { if (submitted) check(el); });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitted = true;
      const errs = fields.map((el) => [el, check(el)]).filter(([, m]) => m);
      if (errs.length) {
        const n = errs.length;
        sumT.textContent = n === 1 ? 'Исправьте 1 ошибку' : `Исправьте ${n} ${n < 5 ? 'ошибки' : 'ошибок'}`;
        sumL.replaceChildren(...errs.map(([el, m]) => {
          const li = d.createElement('li');
          const a = d.createElement('a');
          a.href = `#${el.id}`;
          a.textContent = `${el.dataset.label}: ${m}`;
          a.addEventListener('click', (ev) => { ev.preventDefault(); el.focus(); });
          li.append(a);
          return li;
        }));
        sum.hidden = false;
        sum.focus();
        return;
      }
      sum.hidden = true;
      const ok = d.createElement('div');
      ok.className = 'formcard__ok';
      ok.innerHTML = '<h3 class="h3" tabindex="-1">Заявка отправлена</h3>'
        + '<p>Спасибо! Инженер свяжется с вами в течение рабочего дня.</p>'
        + '<p class="formcard__note" style="margin-top:12px">Это демо-версия сайта: на рабочем сайте заявка сразу придёт менеджеру в Telegram и на почту.</p>';
      wrap.replaceChildren(ok);
      $('h3', ok).focus();
    });
  });

  /* ---------- уведомление о cookie ---------- */
  const ck = $('#cookie');
  if (ck) {
    let seen = false;
    try { seen = localStorage.getItem('tk-cookie') === '1'; } catch (e) { /* storage недоступен */ }
    if (!seen) {
      ck.hidden = false;
      html.style.scrollPaddingBottom = `${ck.offsetHeight + 24}px`;
    }
    $('[data-cookie-ok]', ck).addEventListener('click', () => {
      try { localStorage.setItem('tk-cookie', '1'); } catch (e) { /* ignore */ }
      ck.hidden = true;
      html.style.scrollPaddingBottom = '';
      const main = $('#main');
      if (main) main.focus({ preventScroll: true });
    });
  }
})();
