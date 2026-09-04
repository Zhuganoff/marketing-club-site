// Раздел «SEO» — этап 1 SEO-модуля (решение владельца 2026-09-03): повторный аудит сайта
// по кнопке, история оценок, сравнение с прошлой проверкой, замечания → задачи SEO-стратегу.
// Сеть — только на сервере (POST /api/projects/:id/seo-audit → dashboard/api/site-audit.ts).
                                     
import { api } from '../api.js?v=mtmlukrw';
import { h, fmtDate } from '../ui.js?v=mtmlukrw';

function checkLine(c                                                   , action                     )              {
  return h('div', { class: 'check-line ' + (c.status === 'ok' ? 'pass' : c.status === 'warn' ? 'warn' : 'fail') },
    h('span', { class: 'code' }, c.name), h('span', { style: { flex: '1' } }, c.message), action ?? null);
}

function issueTaskTitle(c                                   )         { return `SEO: ${c.name} — ${c.message}`; }

// Анкета SEO и контакты (решение владельца 03.09, по образцу анкеты OptiAI):
// ключи и гео попадают в брифы Сони, контакты — в CTA-блок в конце SEO-страниц.
function seoProfileCard(app     , st     )              {
  const p = st.seoProfile ?? { keywords: [], cities: [], allRussia: false, mobility: null, metro: '', district: '', segment: null, audience: null, urgent: false, authorName: '', authorTitle: '', contacts: {} };
  const ta = (v          , ph        ) => h('textarea', { rows: 3, placeholder: ph }, v.join('\n'))                       ;
  const inp = (v        , ph        ) => h('input', { value: v ?? '', placeholder: ph })                    ;
  const sel = (v               , opts                    ) => {
    const el = h('select', null, h('option', { value: '' }, '— не выбрано —'), ...opts.map(([val, label]) => h('option', { value: val, selected: v === val ? '' : undefined }, label)))                     ;
    if (v) el.value = v;
    return el;
  };
  const chk = (v         , label        ) => { const b = h('input', { type: 'checkbox', checked: v || undefined })                    ; return { box: b, el: h('label', { class: 'check' }, b, label) }; };

  const keywords = ta(p.keywords, 'Каждая услуга или запрос — с новой строки, 2–5 слов. Например: ремонт квартир');
  const cities = ta(p.cities, 'Каждый город — с новой строки. Для Москвы и СПб можно указать метро в отдельном поле');
  const allRussia = chk(p.allRussia, 'Работаем по всей России');
  const urgent = chk(p.urgent, 'Срочная услуга (круглосуточно / выезд в любое время)');
  const mobility = sel(p.mobility, [['near', 'Клиент выбирает рядом с домом'], ['cross_city', 'Клиент готов ехать через весь город'], ['onsite', 'Мы сами выезжаем к клиенту']]);
  const segment = sel(p.segment, [['economy', 'Эконом / бюджетный'], ['mid', 'Средний'], ['premium', 'Премиум / люкс']]);
  const audience = sel(p.audience, [['b2c', 'Частные клиенты (B2C)'], ['b2b', 'Бизнес (B2B)'], ['both', 'И те, и другие']]);
  const metro = inp(p.metro, 'Ближайшее метро (если есть)');
  const district = inp(p.district, 'Район или часть города');
  const authorName = inp(p.authorName, 'Имя автора статей');
  const authorTitle = inp(p.authorTitle, 'Должность / титул автора');
  const phone = inp(p.contacts.phone ?? '', 'Телефон');
  const email = inp(p.contacts.email ?? '', 'Почта');
  const telegram = inp(p.contacts.telegram ?? '', 'Telegram: @имя или ссылка');
  const whatsapp = inp(p.contacts.whatsapp ?? '', 'WhatsApp: номер с кодом страны');
  const vk = inp(p.contacts.vk ?? '', 'ВКонтакте: @группа или ссылка');

  const save = h('button', {
    class: 'btn human', onClick: () => app.act(() => api.saveSeoProfile(st.project.id, {
      keywords: keywords.value, cities: cities.value, allRussia: allRussia.box.checked, urgent: urgent.box.checked,
      mobility: mobility.value || null, segment: segment.value || null, audience: audience.value || null,
      metro: metro.value, district: district.value, authorName: authorName.value, authorTitle: authorTitle.value,
      contacts: { phone: phone.value, email: email.value, telegram: telegram.value, whatsapp: whatsapp.value, vk: vk.value },
    }, app.actor()), 'Анкета SEO сохранена — Соня будет использовать её в брифах', 'human'),
  }, 'Сохранить анкету');

  return h('div', { class: 'card' }, h('h3', null, 'Анкета SEO и контакты'),
    h('div', { class: 'muted small' }, 'Ключи и география попадают в брифы SEO-стратега Сони; контакты — в блок связи в конце каждой SEO-страницы. Всё хранится только на этом компьютере.'),
    h('div', { class: 'grid two', style: { marginTop: '10px', gap: '12px' } },
      h('label', null, 'Услуги и запросы (по одному в строке)', keywords),
      h('label', null, 'Города работы (по одному в строке)', cities)),
    h('div', { class: 'row', style: { gap: '18px', flexWrap: 'wrap', marginTop: '8px' } }, allRussia.el, urgent.el),
    h('div', { class: 'grid two', style: { marginTop: '8px', gap: '12px' } },
      h('label', null, 'Как клиент добирается', mobility),
      h('label', null, 'Ценовой сегмент', segment),
      h('label', null, 'Аудитория', audience),
      h('label', null, 'Гиперлокация', h('div', { class: 'row', style: { gap: '8px' } }, metro, district))),
    h('div', { class: 'grid two', style: { marginTop: '8px', gap: '12px' } },
      h('label', null, 'Автор статей', h('div', { class: 'row', style: { gap: '8px' } }, authorName, authorTitle)),
      h('label', null, 'Контакты для блока связи', h('div', { class: 'stack', style: { gap: '6px' } }, phone, telegram, whatsapp, email, vk))),
    st.seoCtaPreview ? h('div', { class: 'callout human', style: { marginTop: '10px', whiteSpace: 'pre-line' } }, h('b', null, 'Так будет выглядеть блок связи в конце статей: '), '\n' + st.seoCtaPreview) : h('div', { class: 'muted small', style: { marginTop: '10px' } }, 'Заполните хотя бы один контакт — и в конце каждой SEO-страницы появится блок связи (предпросмотр покажется здесь).'),
    h('div', { class: 'actions', style: { marginTop: '10px' } }, save));
}

// Гиды по аналитике (решение владельца 03.09): свои краткие инструкции — без подключений,
// всё выполняется владельцем в его аккаунтах; синхронизация данных — этап 2, по разрешению.
function guidesCard()              {
  const guide = (title        , steps          , note         ) => h('details', { style: { marginTop: '8px' } },
    h('summary', null, h('b', null, title)),
    h('ol', { class: 'small', style: { margin: '8px 0 4px 18px' } }, ...steps.map((s) => h('li', { style: { margin: '3px 0' } }, s))),
    note ? h('div', { class: 'muted small' }, note) : null);
  return h('div', { class: 'card' }, h('h3', null, 'Подключение аналитики — пошаговые гиды'),
    h('div', { class: 'muted small' }, 'Четыре бесплатных сервиса, которые показывают, кто и по каким запросам находит ваш сайт. Всё делается в ваших аккаунтах — панель никуда не подключается. Когда решите, по отдельному разрешению добавим синхронизацию: реальные показы, клики и позиции появятся прямо здесь.'),
    guide('Яндекс Вебмастер (индексация в Яндексе)', [
      'Откройте webmaster.yandex.ru и войдите в Яндекс-аккаунт.',
      'Нажмите «+», введите адрес сайта.',
      'Подтвердите владение удобным способом (мета-тег или файл на хостинге).',
      'В разделе «Индексирование → Файлы Sitemap» отправьте адрес карты сайта (обычно /sitemap.xml).',
    ], 'После подтверждения новые статьи будут попадать в поиск Яндекса быстрее.'),
    guide('Яндекс Метрика (посетители и поведение)', [
      'Откройте metrika.yandex.ru, нажмите «Добавить счётчик», укажите название и адрес сайта.',
      'Скопируйте код счётчика и поставьте его на сайт (на WordPress — плагином, на других платформах — в шаблон страницы).',
      'Данные появятся в течение нескольких часов.',
    ]),
    guide('Google Search Console (индексация в Google)', [
      'Откройте search.google.com/search-console и войдите в Google-аккаунт.',
      'Добавьте ресурс «URL-префикс» с адресом сайта и подтвердите владение (HTML-файл или мета-тег).',
      'В разделе «Файлы Sitemap» отправьте адрес карты сайта.',
    ], 'Первые данные появляются через 1–3 дня.'),
    guide('Google Analytics (счётчик посещений)', [
      'Откройте analytics.google.com, создайте аккаунт и веб-поток с адресом сайта.',
      'Поставьте выданный код на сайт (на WordPress удобнее всего плагином Site Kit by Google).',
    ]));
}

export function render(app     )              {
  const st = app.state;
  if (!st) return h('div', { class: 'empty' }, 'Загрузка…');
  const audits = (st.seoAudits ?? [])         ;
  const latest = audits[0] ?? null;
  const prev = audits[1] ?? null;

  const head = h('div', { class: 'page-head' },
    h('div', null, h('h1', null, 'SEO-продвижение'),
      h('div', { class: 'sub' }, 'Дополнительное продвижение: здоровье сайта, замечания для Сони и статьи под поисковый спрос.')));

  // Проверка сайта
  const url = h('input', { class: 'mono', value: latest?.url ?? '', placeholder: 'https://ваш-сайт.ru' })                    ;
  const runBtn = h('button', {
    class: 'btn human', onClick: async () => {
      (runBtn                     ).disabled = true;
      await app.act(() => api.seoAudit(st.project.id, url.value.trim(), app.actor()), 'Аудит сайта выполнен и сохранён в историю', 'human');
      (runBtn                     ).disabled = false;
    },
  }, latest ? 'Проверить ещё раз' : 'Проверить сайт')                     ;
  const checkCard = h('div', { class: 'card' }, h('h3', null, 'Проверка сайта'),
    h('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } }, url, runBtn),
    h('div', { class: 'muted small', style: { marginTop: '8px' } }, 'Читаются только публичные страницы вашего сайта; ничего никуда не отправляется. Занимает несколько секунд.'));

  if (!latest) {
    return h('div', null, head, checkCard, seoProfileCard(app, st),
      h('div', { class: 'card' }, h('h3', null, 'SEO-страницы'),
        h('div', { class: 'small' }, 'SEO-стратег Соня готовит тексты страниц под поисковый спрос — по маршруту с исследователем, редактором и контролёром. Публикация на сайт появится после подключения платформы (см. анализ выше).'),
        h('div', { class: 'actions', style: { marginTop: '10px' } },
          h('button', { class: 'btn', onClick: () => app.newTask('seo_page', true) }, 'Идея для Сони'),
          h('button', { class: 'btn primary', onClick: () => app.newTask('seo_page', false) }, 'Новая SEO-страница'))),
      guidesCard());
  }

  // Свежий аудит
  const issues = latest.checks.filter((c     ) => c.status !== 'ok');
  const existingTitles = new Set(st.tasks.map((t     ) => t.title));
  const issueRows = issues.map((c     ) => {
    const title = issueTaskTitle(c);
    const already = existingTitles.has(title);
    const btn = already
      ? h('span', { class: 'muted small mono' }, 'уже в задачах')
      : h('button', {
        class: 'btn sm', onClick: (e       ) => {
          (e.target                     ).disabled = true;
          void app.act(() => api.createTask(st.project.id, { title, kind: 'seo_page', goal: `Замечание аудита ${latest.url} от ${fmtDate(latest.at)}: ${c.message}. Решить и подготовить правку.`, asIdea: true, actor: app.actor() }), `Идея для Сони создана: ${c.name}`);
        },
      }, 'Поручить Соне');
    return checkLine(c, btn);
  });
  const delta = prev ? latest.score - prev.score : null;
  const latestCard = h('div', { class: 'card' },
    h('div', { class: 'row', style: { alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' } },
      h('span', { style: { font: '800 40px/1 var(--font-display)' } }, String(latest.score)),
      h('span', { class: 'muted' }, 'из 100 — готовность сайта'),
      delta !== null ? h('span', { class: 'badge ' + (delta > 0 ? 'ok' : delta < 0 ? 'err' : '') }, delta === 0 ? 'без изменений' : `${delta > 0 ? '+' : ''}${delta} к прошлой`) : null,
      h('span', { class: 'badge ok' }, `${latest.okCount} без ошибок`),
      latest.warnCount ? h('span', { class: 'badge warn' }, `${latest.warnCount} предупреждений`) : null,
      latest.errCount ? h('span', { class: 'badge err' }, `${latest.errCount} ошибок`) : null,
      h('span', { class: 'muted small mono' }, fmtDate(latest.at))),
    latest.platform ? h('div', { class: 'small', style: { marginTop: '8px' } }, h('b', null, `Сайт на ${latest.platform.name}: `), `${latest.platform.publishNote} — когда подключим публикацию.`) : null,
    h('h3', { style: { marginTop: '14px' } }, issues.length ? `Замечания (${issues.length})` : 'Замечаний нет'),
    issues.length ? h('div', { class: 'stack' }, ...issueRows) : h('div', { class: 'small' }, 'Технически сайт в порядке — можно сосредоточиться на статьях под спрос.'),
    h('details', { style: { marginTop: '10px' } }, h('summary', { class: 'muted small' }, `Все проверки (${latest.checks.length})`),
      h('div', { class: 'stack', style: { marginTop: '8px' } }, ...latest.checks.map((c     ) => checkLine(c)))));

  // Сравнение с прошлой проверкой (ключ «группа/имя», как в core/seo.ts)
  let diffCard                     = null;
  if (prev) {
    const key = (c     ) => `${c.group}/${c.name}`;
    const prevBad = new Set(prev.checks.filter((c     ) => c.status !== 'ok').map(key));
    const fixed = latest.checks.filter((c     ) => c.status === 'ok' && prevBad.has(key(c)));
    const appeared = issues.filter((c     ) => !prevBad.has(key(c)));
    if (fixed.length || appeared.length) {
      diffCard = h('div', { class: 'card' }, h('h3', null, `Что изменилось с ${fmtDate(prev.at)}`),
        fixed.length ? h('div', { class: 'small', style: { marginTop: '6px' } }, h('b', null, `Исправлено (${fixed.length}): `), fixed.map((c     ) => c.name).join(', ')) : null,
        appeared.length ? h('div', { class: 'small', style: { marginTop: '6px' } }, h('b', null, `Новые замечания (${appeared.length}): `), appeared.map((c     ) => c.name).join(', ')) : null);
    }
  }

  // История оценок
  const historyCard = h('div', { class: 'card' }, h('h3', null, `История проверок (${audits.length})`),
    h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, 'Когда'), h('th', null, 'Оценка'), h('th', null, 'Замечания'), h('th', null, 'Адрес'))),
      h('tbody', null, ...audits.map((a     , i        ) => {
        const older = audits[i + 1];
        const d = older ? a.score - older.score : null;
        return h('tr', null,
          h('td', null, fmtDate(a.at)),
          h('td', { class: 'mono' }, `${a.score}/100`, d === null || d === 0 ? '' : h('span', { class: d > 0 ? 'badge ok' : 'badge err', style: { marginLeft: '6px' } }, `${d > 0 ? '+' : ''}${d}`)),
          h('td', { class: 'mono small' }, `${a.errCount} ош · ${a.warnCount} пред`),
          h('td', { class: 'mono small' }, a.url));
      }))));

  const pagesCard = h('div', { class: 'card' }, h('h3', null, 'SEO-страницы'),
    h('div', { class: 'small' }, 'Соня готовит тексты страниц под поисковый спрос — по маршруту с исследователем, редактором и контролёром. Публикация на сайт появится после подключения платформы.'),
    h('div', { class: 'actions', style: { marginTop: '10px' } },
      h('button', { class: 'btn', onClick: () => app.newTask('seo_page', true) }, 'Идея для Сони'),
      h('button', { class: 'btn primary', onClick: () => app.newTask('seo_page', false) }, 'Новая SEO-страница')));

  return h('div', null, head, checkCard, latestCard, diffCard, seoProfileCard(app, st), pagesCard, guidesCard(), historyCard);
}
