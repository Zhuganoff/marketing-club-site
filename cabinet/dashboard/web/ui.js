// DOM-помощники, форматирование, всплывающие подсказки, уведомления.
                                                                                

export function h(tag        , attrs                             = null, ...children         )              {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') (el       )[k] = v;
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

export function append(el      , children         ) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag        , attrs                             = null, ...children         )             {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

export function fmtTime(iso                           )         {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function fmtDate(iso                           )         {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function usd(n        )         { return `$${n.toFixed(2)}`; }
export function short(hash                           , n = 8)         { return hash ? hash.slice(0, n) : '—'; }

export const STATUS_LABEL                         = {
  idle: 'ждёт задачу', working: 'работает', waiting_approval: 'ждёт согласования', error: 'ошибка', disabled: 'выключен',
  DRAFT: 'черновик', IN_REVIEW: 'на согласовании', APPROVED: 'одобрен', SCHEDULED: 'в очереди', PUBLISHING: 'публикуется', PUBLISHED: 'опубликован', FAILED: 'ошибка публикации',
  QUEUED: 'в очереди', active: 'действует', revoked: 'отозвано',
  pass: 'пройден', return: 'возврат', block: 'блокировка',
  success: 'успех', delay: 'задержка', technical_failure: 'технический отказ', network_error: 'сетевая ошибка',
  mock_ready: 'mock: готов', mock_disconnected: 'mock: отказ',
};
export const COLUMN_LABEL                         = { ideas: 'Идеи', planned: 'Запланировано', in_progress: 'В работе', quality_control: 'Контроль качества', in_review: 'На согласовании', approved: 'Одобрено', published: 'Опубликовано' };
export const COLUMNS = Object.keys(COLUMN_LABEL);
export const KIND_LABEL                         = { post: 'Пост', reels: 'Reels', seo_page: 'SEO-страница', weekly_report: 'Недельный отчёт' };
export const ART_KIND                         = { task_plan: 'план', strategy_brief: 'стратегический бриф', research_brief: 'исследовательский бриф', seo_task: 'SEO-задание', draft: 'текст', creative_concept: 'визуальная концепция', reel_brief: 'раскадровка Reels', channel_versions: 'версии под каналы', quality_report: 'отчёт контролёра', weekly_report: 'недельный отчёт', publish_job: 'задание публикации' };
export const KIND_COLOR                         = { post: 'var(--kind-post)', reels: 'var(--kind-reels)', seo_page: 'var(--kind-article)', weekly_report: 'var(--kind-report)', campaign: 'var(--kind-campaign)' };
export const PLATFORM_LABEL                         = { vk: 'VK', telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', site: 'Сайт' };
export const PLATFORMS = ['vk', 'telegram', 'instagram', 'facebook', 'tiktok', 'youtube'];
export const ART_STATUS_SHORT                         = { DRAFT: 'черновик', IN_REVIEW: 'на согласовании', APPROVED: 'запланировано', SCHEDULED: 'запланировано', PUBLISHING: 'публикуется', PUBLISHED: 'опубликовано', FAILED: 'ошибка' };
export function dateKey(iso                           )         { return iso ? String(iso).slice(0, 10) : ''; }
export function timeOf(iso                           )         { return iso && String(iso).length >= 16 ? String(iso).slice(11, 16) : '—'; }
export function fmtDay(key        )         { const d = new Date(key + 'T00:00:00'); return d.toLocaleDateString('ru-RU', { weekday: 'short', day: '2-digit', month: '2-digit' }); }
export function localKey(d      )         { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function addDays(key        , n        )         { const d = new Date(key + 'T00:00:00'); d.setDate(d.getDate() + n); return localKey(d); }
export function todayKey()         { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function mondayOf(key        )         { const d = new Date(key + 'T00:00:00'); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function kindChip(kind        , label         )              { const el = h('span', { class: 'kind-chip' }, label ?? KIND_LABEL[kind] ?? kind); el.style.setProperty('--chip', KIND_COLOR[kind] ?? 'var(--ink-3)'); return el; }

// Модальное окно: одно за раз, закрывается по Esc, крестику и кнопке в содержимом.
export function modal(title        , content       , opts                     = {})                        {
  document.querySelector('.modal-back')?.remove();
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e               ) => { if (e.key === 'Escape') close(); };
  const back = h('div', { class: 'modal-back', onClick: (e       ) => { if (e.target === back) close(); } },
    h('div', { class: `modal${opts.wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'btn ghost sm', 'aria-label': 'Закрыть', onClick: close }, '✕')),
      h('div', { class: 'modal-body' }, content)));
  document.body.appendChild(back);
  document.addEventListener('keydown', onKey);
  (back.querySelector('input, textarea, select, button')                      )?.focus();
  return { close };
}

// Редактор тегов: Enter или запятая добавляет, Backspace убирает последний; событие change всплывает наружу.
export function chipEditor(initial          , placeholder = 'добавить и нажать Enter')                                              {
  const tags = [...initial];
  const input = h('input', { placeholder })                    ;
  const box = h('div', { class: 'chip-input' });
  const changed = () => box.dispatchEvent(new Event('change', { bubbles: true }));
  const draw = () => {
    box.innerHTML = '';
    tags.forEach((t, i) => box.appendChild(h('span', { class: 'tag' }, t, h('button', { type: 'button', 'aria-label': `убрать ${t}`, onClick: () => { tags.splice(i, 1); draw(); changed(); } }, '×'))));
    box.appendChild(input);
  };
  const add = () => { const v = input.value.replace(/,/g, '').trim(); if (v && !tags.includes(v)) { tags.push(v); draw(); changed(); } input.value = ''; };
  input.addEventListener('keydown', (e               ) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); draw(); changed(); } });
  input.addEventListener('blur', add);
  box.addEventListener('click', () => input.focus());
  draw();
  return { el: box, values: () => { add(); return [...tags]; } };
}

export const TEAM_LABEL                         = { strategy: 'Strategy', content: 'Content', growth: 'Growth', control: 'Control', publishing: 'Publishing' };

export function badge(text        , kind = '')              { return h('span', { class: `badge ${kind}` }, text); }
export function statusBadge(status        )              {
  const kind = ['PUBLISHED', 'pass', 'active', 'success', 'mock_ready'].includes(status) ? 'ok'
    : ['FAILED', 'error', 'block', 'revoked', 'technical_failure', 'network_error', 'mock_disconnected'].includes(status) ? 'err'
    : ['IN_REVIEW', 'APPROVED', 'waiting_approval', 'return'].includes(status) ? 'human'
    : ['working', 'PUBLISHING', 'SCHEDULED', 'QUEUED', 'delay'].includes(status) ? 'agent' : '';
  return badge(STATUS_LABEL[status] ?? status, kind);
}
export function avatar(a                                   , lg = false)              {
  return h('span', { class: `avatar${lg ? ' lg' : ''}`, style: { background: `hsl(${a.hue} 30% 32%)` } }, a.initials);
}

const tip = () => document.getElementById('tooltip') ;
export function tooltip(el         , content             ) {
  el.addEventListener('mouseenter', () => { const t = tip(); t.innerHTML = ''; append(t, [content()]); t.hidden = false; });
  el.addEventListener('mousemove', (e       ) => { const me = e              ; const t = tip(); const x = Math.min(me.clientX + 14, window.innerWidth - t.offsetWidth - 8); t.style.left = `${x}px`; t.style.top = `${me.clientY + 14}px`; });
  el.addEventListener('mouseleave', () => { tip().hidden = true; });
}

export function toast(message        , kind = '') {
  const box = document.getElementById('toasts') ;
  const el = h('div', { class: `toast ${kind}` }, message);
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

export function sleep(ms        )                { return new Promise((r) => setTimeout(r, ms)); }
