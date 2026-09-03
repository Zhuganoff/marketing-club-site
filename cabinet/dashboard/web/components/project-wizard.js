// Мастер создания проекта: шесть шагов, локальный mock-режим. Поля — только профиль (без ключей, аккаунтов, ссылок и сети).
// Данные для шагов (площадки, роли, модели, лимиты, значения по умолчанию) приходят с сервера: GET /api/projects/template.
                                     
import { api, ApiError } from '../api.js?v=mtlth9b9';
import { h, modal, toast, badge, usd, chipEditor, PLATFORM_LABEL, TEAM_LABEL } from '../ui.js?v=mtlth9b9';

              
                                                                                       
                                                                                                         
                                                                    
                                                               
                                                     
  
                                                                                       

const ID_RULE = /^[a-z][a-z0-9-]{1,40}$/;
const TZ_RULE = /^[A-Za-z_]+(\/[A-Za-z_+-]+){1,2}$/;
const HOUR_RULE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Латинский slug из названия: кириллица транслитерируется, остальное — дефисы.
const TR                         = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
export function slugify(name        )         {
  const s = name.toLowerCase().split('').map((ch) => TR[ch] ?? ch).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^[^a-z]+/, '').slice(0, 41);
  return s.length >= 2 ? s : '';
}

function sameRoles(a          , b          )          { return a.length === b.length && a.every((x) => b.includes(x)); }

// Доступность маршрутов для состава: маршрут доступен, если все его роли выбраны (то же правило, что на сервере в planTask).
export function coverageNodes(tpl     , roles          )                           {
  const nameOf = (id        ) => tpl.roles.find((r     ) => r.id === id)?.name ?? id;
  const available = tpl.routes.filter((r     ) => r.roles.every((id        ) => roles.includes(id)));
  const missing = tpl.routes.filter((r     ) => !r.roles.every((id        ) => roles.includes(id)));
  const out                           = [];
  if (!available.length) out.push(h('b', null, 'С этим составом нельзя запустить ни один маршрут. '), 'Сервер не создаст такой проект — добавьте роли или выберите набор.');
  else out.push(h('b', null, 'Доступные маршруты: '), available.map((r     ) => r.label).join(', '), '.');
  if (missing.length) out.push(' ', h('span', { class: 'muted' }, 'Недоступны: ', missing.map((r     ) => `${r.label} — нет: ${r.roles.filter((id        ) => !roles.includes(id)).map(nameOf).join(', ')}`).join('; '), '.'));
  return out;
}

// Замечание владельца 03.09: простому пользователю технические пояснения не нужны —
// никаких плашек про mock-режим, папки и чек-листы в мастере.

export function openProjectWizard(app     ) {
  const holder = h('div', { class: 'wizard' }, h('div', { class: 'empty' }, 'Загрузка описания шаблона…'));
  const m = modal('Новый проект', holder, { wide: true });
  api.projectTemplate().then((tpl) => build(app, tpl, holder, m)).catch((e) => { holder.innerHTML = ''; holder.appendChild(h('div', { class: 'callout err' }, `Не удалось загрузить шаблон: ${e instanceof Error ? e.message : String(e)}`)); });
}

function build(app     , tpl     , holder             , m                       ) {
  const d        = {
    // Часовой пояс берём из браузера пользователя автоматически (замечание владельца 03.09).
    id: '', name: '', language: tpl.defaults.language, timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || tpl.defaults.timezone; } catch { return tpl.defaults.timezone; } })(), geography: '',
    goals: [], audience: '', channels: [], tone: '', forbiddenPhrases: [], evidenceRules: [],
    // Состав по умолчанию — стартовый набор сервера (минимальный), а не весь каталог.
    roles: [...(tpl.presets.find((p     ) => p.id === tpl.defaultPreset)?.roles ?? tpl.presets[0].roles)], weeklyLimitUsd: tpl.defaults.weeklyLimitUsd, approvers: [...tpl.defaults.approvers],
    frequencyPerWeek: tpl.defaults.frequencyPerWeek, preferredHours: [...tpl.defaults.preferredHours],
  };
  let current = 0;
  let analyzing = false;
  const expertCollects                          = [];
  let pendingNext = false;
  const error = h('div', { class: 'callout err', hidden: true });
  const showError = (msg               ) => { error.hidden = !msg; error.textContent = msg ?? ''; };

  const steps         = [
    // Шаг «Сайт» (указание владельца 2026-09-03): первым делом можно вставить сайт —
    // сервер по-настоящему читает публичные страницы (POST /api/analyze-site, разрешение
    // владельца) и предлагает название, направление, аудиторию и площадки; пользователь
    // добавляет своё, а при недоступном сайте остаётся честный локальный черновик.
    { title: 'Сайт и анализ', render: () => {
      const url = h('input', { value: (d       ).websiteUrl ?? '', placeholder: 'https://ваш-сайт.ru (необязательно)', class: 'mono' })                    ;
      const own = h('textarea', { rows: 3, placeholder: 'Добавьте от себя: что продвигаем, для кого, что важно не упустить…' }, (d       ).ownerNote ?? '')                       ;
      const out = h('div', { class: 'stack', hidden: true });
      const applySuggestions = (nameGuess               , description               , geography                , lang                , audienceGuess                , niche                ) => {
        const note = own.value.trim();
        if (nameGuess && !d.name) { d.name = nameGuess; d.id = slugify(nameGuess); }
        if (geography && !d.geography) d.geography = geography;
        if (lang === 'en' || lang === 'ru') d.language = lang;
        const wantsVideo = /видео|reels|рилс|tiktok|тикток|ролик/i.test(note + ' ' + (description ?? ''));
        const preset = tpl.presets.find((p     ) => p.id === (wantsVideo ? 'reels' : 'social')) ?? tpl.presets[0];
        d.roles = [...preset.roles];
        if (niche) (d       ).niche = niche;
        if (!d.audience) d.audience = audienceGuess
          ? `${audienceGuess.charAt(0).toUpperCase()}${audienceGuess.slice(1)}. Подобрали по тематике сайта${niche ? ` («${niche}»)` : ''} — уточните под себя.`
          : description
          ? `По описанию сайта: ${description.slice(0, 220)}${description.length > 220 ? '…' : ''} — уточните, кто именно ваш клиент.`
          : `Черновик: клиенты «${d.name || 'проекта'}»${d.geography ? ` в ${d.geography}` : ''}, которые ищут эту услугу рядом и сравнивают по отзывам. Уточните своими словами.`;
        if (!d.tone) d.tone = 'Дружелюбно и по делу: объясняем, показываем работу, не давим скидками (черновик — поправьте под себя)';
        // Площадки по географии (решение владельца 03.09): в России Instagram заблокирован,
        // Telegram с 02.2026 ограничен РКН и запрещён для рекламы (ФАС) — не предлагаем;
        // работают ВКонтакте, TikTok, Дзен, Одноклассники.
        const isRu = d.language === 'ru' || !!d.geography;
        const socials = isRu ? ['vk', 'tiktok', 'dzen', 'ok'] : ['instagram', 'tiktok', 'facebook'];
        d.channels = socials
          .map((pl) => tpl.platforms.find((p     ) => p.platform === pl))
          .filter(Boolean)
          .map((p     ) => ({ platform: p.platform, name: `${PLATFORM_LABEL[p.platform] ?? p.platform} проекта (пока не подключено)`, connectorId: p.connectorId }));
        if (note && !d.goals.includes(note)) d.goals = [note, ...d.goals];
        return preset;
      };
      // Настоящий анализ сайта (разрешение владельца 2026-09-03): сервер читает публичные
      // страницы и возвращает проверки; при недоступности сайта — честный локальный черновик.
      // «Далее» во время анализа не открывает пустой шаг — ждёт результата и продолжает сам.
      const analyze = async () => {
        const raw = url.value.trim();
        (d       ).websiteUrl = raw; (d       ).ownerNote = own.value.trim();
        analyzing = true;
        next.disabled = true;
        const nextLabel = next.textContent;
        next.textContent = 'Анализируем…';
        out.hidden = false; out.innerHTML = '';
        let host = raw.replace(/^https?:\/\//i, '').split(/[\/?#]/)[0];
        try { if (host.startsWith('xn--')) host = new URL(/^https?:/i.test(raw) ? raw : 'https://' + raw).hostname; } catch {}
        out.appendChild(h('div', { class: 'analyze-wait' },
          h('div', { class: 'analyze-wait__bar' }, h('i')),
          h('div', { class: 'analyze-wait__steps' }, `Читаем ${host}: страница → заголовки → ссылки → robots → карта сайта`)));
        try {
          const { audit } = await api.analyzeSite(raw);
          (d       ).audit = audit;
          const preset = applySuggestions(audit.suggest.name, audit.suggest.description, audit.suggest.geography, audit.suggest.lang, audit.suggest.audience, audit.suggest.niche);
          const issues = audit.checks.filter((c     ) => c.status !== 'ok');
          const issueBox = h('input', { type: 'checkbox', checked: issues.length > 0 })                    ;
          (d       ).issueBox = issueBox;
          out.innerHTML = '';
          out.appendChild(h('div', { class: 'card', style: { padding: '14px 16px' } },
            h('div', { class: 'row', style: { alignItems: 'baseline', gap: '14px' } },
              h('span', { style: { font: '800 34px/1 var(--font-display)' } }, String(audit.score)),
              h('span', { class: 'muted' }, 'из 100 — готовность сайта'),
              h('span', { class: 'badge ok' }, `${audit.okCount} без ошибок`),
              audit.warnCount ? h('span', { class: 'badge warn' }, `${audit.warnCount} предупреждений`) : null,
              audit.errCount ? h('span', { class: 'badge err' }, `${audit.errCount} ошибок`) : null,
              h('span', { class: 'muted small mono' }, `${(audit.tookMs / 1000).toFixed(1)} с`)),
            h('div', { class: 'small', style: { marginTop: '8px' } },
              issues.length
                ? `Главное словами: ${issues.slice(0, 3).map((c     ) => `${c.name.toLowerCase()} — ${c.message.toLowerCase()}`).join('; ')}.`
                : 'Технически сайт в порядке — можно сосредоточиться на содержании.'),
            h('details', { style: { marginTop: '8px' } }, h('summary', { class: 'muted small' }, 'Подробнее для специалистов'),
              h('div', { class: 'stack', style: { marginTop: '8px' } }, ...audit.checks.map((c     ) =>
                h('div', { class: 'check-line ' + (c.status === 'ok' ? 'pass' : c.status === 'warn' ? 'warn' : 'fail') },
                  h('span', { class: 'code' }, c.name), h('span', null, c.message))))),
            issues.length ? h('label', { class: 'check', style: { marginTop: '10px' } }, issueBox,
              `после создания поручить ${Math.min(issues.length, 6)} замечаний команде (идеи для SEO-стратега Сони)`) : null));
          out.appendChild(h('div', { class: 'callout human' }, h('b', null, 'Как предлагаем вести проект: '),
            (d       ).niche ? h('div', { style: { marginTop: '4px' } }, h('b', null, 'Тематика: '), (d       ).niche) : null,
            h('div', { style: { marginTop: '4px' } }, h('b', null, 'Кто ваш клиент: '), d.audience),
            h('div', { style: { marginTop: '4px' } }, h('b', null, 'Направление: '), `«${preset.name}» — ${preset.kindLabels.join(', ')}; команда из ${d.roles.length} специалистов.`),
            h('div', { style: { marginTop: '4px' } }, h('b', null, 'Площадки: '),
              d.channels.map((c) => PLATFORM_LABEL[c.platform] ?? c.platform).join(', ') + ' + статьи на сайт под поисковый спрос.',
              (d.language === 'ru' || d.geography) ? ' Instagram и Telegram не предлагаем — в России заблокированы для продвижения.' : ''),
            d.geography ? h('div', { style: { marginTop: '4px' } }, h('b', null, 'География: '), `${d.geography} — нашли на сайте, поправьте если не так.`) : null,
            h('div', { style: { marginTop: '4px' } }, h('b', null, 'Ритм: '), `${tpl.defaults.frequencyPerWeek} выхода в неделю; первые шаги — пост-знакомство, серия про услуги${issues.length ? ' и исправление замечаний по сайту' : ''}.`),
            audit.platform ? h('div', { style: { marginTop: '4px' } }, h('b', null, `Сайт на ${audit.platform.name}: `), `${audit.platform.publishNote}.`) : null,
            h('div', { class: 'muted small', style: { marginTop: '6px' } }, 'Это черновик стратегии — дополните ниже своими словами, всё правится на следующих шагах.')));
        } catch (e) {
          const preset = applySuggestions(null, null);
          out.innerHTML = '';
          out.appendChild(h('div', { class: 'callout err' }, `Сайт проверить не удалось: ${e instanceof ApiError ? e.message : String(e)}.`));
          out.appendChild(h('div', { class: 'callout human' }, h('b', null, 'Заполнили черновиком: '),
            `направление «${preset.name}», команда из ${d.roles.length} ролей, площадки и тон — поправьте на следующих шагах.`));
        } finally {
          analyzing = false;
          next.disabled = false;
          next.textContent = nextLabel;
          if (pendingNext && current === 0) { pendingNext = false; showError(null); steps[0].collect(); current = 1; draw(); }
          pendingNext = false;
        }
      };
      steps[0].collect = () => { (d       ).websiteUrl = url.value.trim(); (d       ).ownerNote = own.value.trim(); if (own.value.trim() && !d.goals.includes(own.value.trim())) d.goals = [own.value.trim(), ...d.goals]; return null; };
      const step0Next = () => {
        const v = url.value.trim();
        if (analyzing) { pendingNext = true; return 'Дочитываем сайт — через пару секунд продолжим сами…'; }
        if (v && analyzedFor !== v && /.\../.test(v.replace(/^https?:\/\//i, ''))) { pendingNext = true; analyzedFor = v; void analyze(); return 'Читаем сайт — через пару секунд продолжим сами…'; }
        return null;
      };
      const baseCollect = steps[0].collect;
      steps[0].collect = () => { const wait = step0Next(); if (wait) return wait; return baseCollect(); };
      // Автозапуск (замечание владельца 03.09): вставили адрес — анализ начинается сам,
      // пользователь дополняет уже после того, как система разобралась и предложила стратегию.
      let analyzedFor = '';
      let timer                                       = null;
      const maybeAnalyze = (delay        ) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          const v = url.value.trim();
          if (v && v !== analyzedFor && /.\../.test(v.replace(/^https?:\/\//i, ''))) { analyzedFor = v; void analyze(); }
        }, delay);
      };
      url.addEventListener('input', () => maybeAnalyze(700));
      url.addEventListener('paste', () => maybeAnalyze(80));
      url.addEventListener('keydown', (e               ) => { if (e.key === 'Enter') { e.preventDefault(); maybeAnalyze(0); } });
      return h('div', { class: 'form' },
        h('label', null, 'Вставьте адрес сайта — анализ начнётся сам', url),
        h('div', { class: 'muted small' }, 'Система прочитает сайт, поймёт аудиторию и предложит, как его вести. Нет сайта — просто нажмите «Далее».'),
        out,
        h('label', null, 'Дополните от себя (после анализа)', own));
    }, collect: () => null },

    // Шаг 2 из 3 (решение владельца 03.09 «как в айфоне»): всё уже заполнено анализом,
    // человек только проверяет. Тонкие настройки — свёрнуты на последнем шаге.
    { title: 'Проверьте — мы всё заполнили', render: () => {
      const name = h('input', { value: d.name, placeholder: 'Название проекта или бренда', required: true })                    ;
      const language = h('select', null, h('option', { value: 'ru', selected: d.language === 'ru' }, 'ru — русский'), h('option', { value: 'en', selected: d.language === 'en' }, 'en — English'))                     ;
      const geography = h('input', { value: d.geography, placeholder: 'город или регион — подставим из сайта, можно поправить' })                    ;
      const audience = h('textarea', { rows: 3, placeholder: 'кто ваши клиенты — подставим из анализа, можно уточнить' }, d.audience)                       ;
      if (!d.goals.length) d.goals = ['Привлечение аудитории и заявок'];
      steps[1].collect = () => {
        d.name = name.value.trim(); d.language = language.value               ; d.geography = geography.value.trim(); d.audience = audience.value.trim();
        if (!d.name) return 'Укажите название проекта';
        let id = slugify(d.name) || 'project';
        if (id.length < 2) id = 'project';
        let unique = id; let n = 2;
        while (app.projects.some((p) => p.id === unique)) unique = `${id}-${n++}`.slice(0, 41);
        d.id = unique;
        if (!TZ_RULE.test(d.timezone)) d.timezone = tpl.defaults.timezone;
        return null;
      };
      return h('div', { class: 'form' },
        h('label', null, d.name ? 'Название (взяли из сайта — можно поправить)' : 'Название', name),
        h('div', { class: 'grid two' },
          h('label', null, 'Язык публикаций', language),
          h('label', null, d.geography ? 'География (нашли на сайте)' : 'География', geography)),
        h('label', null, 'Кто ваши клиенты', audience),
        h('div', { class: 'muted small' }, d.channels.length
          ? `Площадки: ${d.channels.map((c) => PLATFORM_LABEL[c.platform] ?? c.platform).join(', ')} — поменять можно на следующем шаге или после создания в «Настройках».`
          : 'Площадки подберём по географии — поменять можно после создания в «Настройках».'));
    }, collect: () => null },

    { title: 'Создание', render: () => {
      // Человеческая сводка + свёртка «Для специалистов» (бывшие шаги 3–6: каналы, голос
      // бренда, состав команды, лимит, правила публикаций). Их проверки выполняются при создании.
      expertCollects.length = 0;

      // --- Каналы ---
      const rows                                                                                                           = [];
      const list = h('div', { class: 'stack wizard-channels' });
      const connectorsFor = (platform        ) => (tpl.platforms.find((p     ) => p.platform === platform)?.connectors ?? [])            ;
      const addRow = (init                                                         ) => {
        const platform = h('select', null, ...tpl.platforms.map((p     ) => h('option', { value: p.platform, selected: p.platform === init.platform }, PLATFORM_LABEL[p.platform] ?? p.platform)))                     ;
        const connector = h('select')                     ;
        const fill = (pl        , sel        ) => { connector.innerHTML = ''; const def = tpl.platforms.find((p     ) => p.platform === pl)?.connectorId; for (const c of connectorsFor(pl)) connector.appendChild(h('option', { value: c, selected: c === (sel || def) }, `${c} (mock)`)); };
        fill(init.platform, init.connectorId);
        platform.addEventListener('change', () => fill(platform.value, ''));
        const nameI = h('input', { value: init.name, placeholder: 'рабочее название канала, без ссылок и логинов' })                    ;
        const row = { platform, name: nameI, connector, el: h('div', { class: 'wizard-channel' }, platform, nameI, connector, h('button', { type: 'button', class: 'btn ghost sm', 'aria-label': 'убрать канал', onClick: () => { rows.splice(rows.indexOf(row), 1); row.el.remove(); } }, '×')) };
        rows.push(row); list.appendChild(row.el);
      };
      for (const c of d.channels) addRow(c);
      expertCollects.push(() => {
        d.channels = rows.map((r) => ({ platform: r.platform.value, name: r.name.value.trim(), connectorId: r.connector.value }));
        for (const c of d.channels) { if (!c.name) return 'У каждого канала должно быть название'; if (/(https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{3,})/i.test(c.name)) return `Канал «${c.name}»: ссылки и имена учётных записей не вводятся`; }
        return null;
      });
      const channelsSec = h('div', { class: 'form' },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'muted small' }, 'Площадки проекта (аккаунты подключаются отдельным решением)'), h('button', { type: 'button', class: 'btn sm', onClick: () => addRow({ platform: tpl.platforms[0].platform, name: '', connectorId: tpl.platforms[0].connectorId }) }, '＋ Площадка')), list);

      // --- Голос бренда ---
      const tone = h('textarea', { rows: 2, placeholder: 'как проект говорит с аудиторией' }, d.tone)                       ;
      const phrases = chipEditor(d.forbiddenPhrases, 'запрещённая формулировка и Enter');
      const rules = chipEditor(d.evidenceRules, 'правило и Enter — например: каждый факт со ссылкой на утверждённый источник');
      expertCollects.push(() => { d.tone = tone.value.trim(); d.forbiddenPhrases = phrases.values(); d.evidenceRules = rules.values(); return null; });
      const brandSec = h('div', { class: 'form' },
        h('label', null, 'Тон общения', tone),
        h('label', null, 'Запрещённые формулировки (контролёр вернёт материал)', phrases.el),
        h('label', null, 'Правила доказательств', rules.el));

      // --- Состав команды, лимит, согласующие ---
      const boxes                                          = [];
      const selected = () => boxes.filter((b) => b.box.checked || tpl.lockedRoles.includes(b.id)).map((b) => b.id);
      const presetLabel = h('span', { class: 'muted small' });
      const coverage = h('div', { class: 'callout coverage', 'aria-live': 'polite' });
      const presetButtons                      = [];
      const refresh = () => {
        const roles = selected();
        const current = tpl.presets.find((p     ) => sameRoles(p.roles, roles));
        presetButtons.forEach((b) => b.classList.toggle('primary', b.dataset.preset === current?.id));
        presetLabel.textContent = current ? `Набор «${current.name}»: ${roles.length} ролей` : `Свой состав: ${roles.length} ролей`;
        coverage.innerHTML = ''; coverage.append(...coverageNodes(tpl, roles));
      };
      const presetBar = h('div', { class: 'preset-bar', role: 'group', 'aria-label': 'Стартовые наборы команды' },
        ...tpl.presets.map((p     ) => {
          const b = h('button', { type: 'button', class: 'btn sm', dataset: { preset: p.id }, title: `${p.roles.length} ролей`, onClick: () => { for (const x of boxes) x.box.checked = p.roles.includes(x.id); refresh(); } }, `${p.name} · ${p.kindLabels.join(', ')}`)                     ;
          presetButtons.push(b); return b;
        }), presetLabel);
      const grid = h('div', { class: 'teams-grid' }, ...Object.keys(TEAM_LABEL).map((teamId) => {
        const roles = tpl.roles.filter((r     ) => r.team === teamId);
        return h('div', { class: 'callout team-box' }, h('b', null, TEAM_LABEL[teamId]), teamId === 'control' ? h('div', { class: 'muted small' }, '+ человек-согласующий') : null,
          h('div', { class: 'stack', style: { gap: '6px', marginTop: '6px' } }, ...roles.map((r     ) => {
            const box = h('input', { type: 'checkbox', checked: d.roles.includes(r.id) || r.locked, disabled: r.locked, onChange: refresh })                    ;
            boxes.push({ id: r.id, box });
            return h('label', { class: 'check role-line', title: r.locked ? 'Обязательная роль — всегда в составе' : '' }, box, h('span', { class: 'role-name' }, r.name, h('span', { class: 'muted small mono' }, ` ${r.id}`)),
              h('span', { class: 'muted small role-meta' }, r.purpose, h('br'), r.isLlm ? `${r.modelLabel ?? r.model ?? '—'} · ${usd(r.weeklyLimitUsd)}/нед` : 'сервисная роль, не LLM'));
          })));
      }));
      const limit = h('input', { type: 'number', min: 0, max: 100000, step: 1, value: String(d.weeklyLimitUsd), style: { width: '140px' } })                    ;
      const approvers = chipEditor(d.approvers, 'имя или роль согласующего и Enter');
      expertCollects.push(() => {
        d.roles = selected();
        if (!tpl.routes.some((r     ) => r.roles.every((id        ) => d.roles.includes(id)))) return 'С этим составом нельзя запустить ни один маршрут — добавьте роли или выберите набор';
        const v = Number(limit.value); if (!Number.isFinite(v) || v < 0 || v > 100000) return 'Лимит проекта — число от 0 до 100000'; d.weeklyLimitUsd = v;
        d.approvers = approvers.values(); if (!d.approvers.length) return 'Нужен хотя бы один согласующий человек';
        return null;
      });
      refresh();
      const teamSec = h('div', { class: 'form' },
        presetBar, grid, coverage,
        h('div', { class: 'grid two' },
          h('label', null, 'Контрольный потолок проекта, $/нед', limit),
          h('label', null, 'Согласующие (только люди; агенты не одобряют)', approvers.el)));

      // --- Правила публикаций ---
      const freq = h('input', { type: 'number', min: 0, max: 50, step: 1, value: String(d.frequencyPerWeek), style: { width: '140px' } })                    ;
      const hours = chipEditor(d.preferredHours, 'ЧЧ:ММ и Enter');
      expertCollects.push(() => {
        const v = Number(freq.value); if (!Number.isInteger(v) || v < 0 || v > 50) return 'Частота — целое число от 0 до 50'; d.frequencyPerWeek = v;
        d.preferredHours = hours.values(); for (const hh of d.preferredHours) if (!HOUR_RULE.test(hh)) return `Время «${hh}» — нужен формат ЧЧ:ММ`;
        return null;
      });
      const publishSec = h('div', { class: 'form' },
        h('label', null, 'Выходов в неделю', freq),
        h('label', null, 'Удобное время публикаций', hours.el),
        h('div', { class: 'muted small' }, 'Автопубликации нет: каждый материал утверждаете вы.'));

      // --- Человеческая сводка ---
      const roleNames = tpl.roles.filter((r     ) => d.roles.includes(r.id)).map((r     ) => r.name);
      const preset = tpl.presets.find((p     ) => sameRoles(p.roles, d.roles));
      const kv = (k        , v        ) => h('div', { class: 'wizard-kv' }, h('span', { class: 'k' }, k), h('span', { class: 'v' }, v || '—'));
      const expert = (title        , el             ) => h('details', { style: { marginTop: '8px' } }, h('summary', { class: 'muted small' }, title), h('div', { style: { marginTop: '8px' } }, el));
      return h('div', { class: 'stack' },
        h('div', { class: 'wizard-summary' },
          kv('Проект', d.name),
          kv('Язык и география', `${d.language === 'ru' ? 'русский' : 'английский'} · ${d.geography || 'вся аудитория'}`),
          kv('Кто ваши клиенты', d.audience),
          kv('Площадки', d.channels.map((c) => PLATFORM_LABEL[c.platform] ?? c.platform).join(', ') + ' + статьи на сайт'),
          kv('Команда', `${preset ? `набор «${preset.name}»` : 'Свой состав'}: ${roleNames.join(', ')} — создаётся ровно этот список`),
          kv('Ритм', `${d.frequencyPerWeek} выхода в неделю · без автопубликации — решаете вы`)),
        h('div', { class: 'callout human' }, h('b', null, 'Всё готово. '), 'Нажмите «Создать проект» — команда соберётся и предложит первые материалы. Любую настройку можно поменять потом в «Настройках».'),
        expert('Для специалистов: площадки', channelsSec),
        expert('Для специалистов: голос бренда', brandSec),
        expert('Для специалистов: состав команды и лимит', teamSec),
        expert('Для специалистов: правила публикаций', publishSec));
    }, collect: () => { for (const c of expertCollects) { const err = c(); if (err) return err; } return null; } },
  ];

  const stepsBar = h('ol', { class: 'wizard-steps' });
  const body = h('div', { class: 'wizard-body' });
  const back = h('button', { type: 'button', class: 'btn', onClick: () => { showError(null); current = Math.max(0, current - 1); draw(); } }, '← Назад')                     ;
  const next = h('button', { type: 'button', class: 'btn primary', onClick: () => { const err = steps[current].collect(); if (err) { showError(err); return; } showError(null); current++; draw(); } }, 'Далее →')                     ;
  const create = h('button', { type: 'button', class: 'btn human', onClick: () => submit() }, 'Создать проект')                     ;
  const footer = h('div', { class: 'wizard-footer' }, back, h('span', { class: 'spacer' }), next, create);

  const draw = () => {
    stepsBar.innerHTML = '';
    steps.forEach((s, i) => stepsBar.appendChild(h('li', { class: i === current ? 'active' : i < current ? 'done' : '' }, h('span', { class: 'n' }, String(i + 1)), s.title)));
    body.innerHTML = ''; body.appendChild(steps[current].render());
    back.disabled = current === 0; next.hidden = current === steps.length - 1; create.hidden = current !== steps.length - 1;
    (body.querySelector('input, textarea, select')                      )?.focus();
  };

  const submit = async () => {
    create.disabled = true;
    try {
      const out = await api.createProject(d, app.actor());
      m.close();
      app.projects = out.projects;
      app.pid = out.project.id;
      try { localStorage.setItem('mc.pid', app.pid); } catch {}
      app.state = null; app.sel = {};
      app.go('settings');
      await app.refresh();
      toast(`Проект «${out.project.name}» создан в projects/${out.project.id}/ (локально, mock)`, 'human');
      // Замечания из анализа сайта → идеи для SEO-стратега (без запуска маршрутов, решение за человеком).
      const audit = (d       ).audit;
      const issueBox = (d       ).issueBox                                ;
      if (audit && issueBox?.checked) {
        const issues = audit.checks.filter((c     ) => c.status !== 'ok').slice(0, 6);
        let made = 0;
        for (const c of issues) {
          try {
            await api.createTask(out.project.id, { title: `SEO: ${c.name} — ${c.message}`, kind: 'seo_page', goal: `Замечание из анализа ${audit.url}: ${c.message}. Решить и подготовить правку.`, asIdea: true });
            made++;
          } catch { break; }
        }
        if (made) { await app.refresh(); toast(`${made} замечаний из анализа сайта добавлены идеями — команда возьмёт их после вашего решения`, ''); }
      }
    } catch (e) {
      showError(e instanceof ApiError ? `${e.message} (${e.code})` : String(e));
      create.disabled = false;
    }
  };

  holder.innerHTML = '';
  holder.append(stepsBar, error, body, footer);
  draw();
}
