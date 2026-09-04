// Настройки проекта: mock-редактирование профиля, стиля, команд, лимита и mock-статусов каналов.
                                     
import { api } from '../api.js?v=mtmm058h';
import { h, badge, statusBadge, modal, usd, chipEditor, fmtDate, STATUS_LABEL, TEAM_LABEL, PLATFORM_LABEL } from '../ui.js?v=mtmm058h';
import { openProjectWizard } from '../components/project-wizard.js?v=mtmm058h';

function dirtyMark()              { return h('span', { class: 'badge warn dirty', hidden: true }, 'изменено'); }
function watch(card             , mark             ) { card.addEventListener('input', () => { mark.hidden = false; }); card.addEventListener('change', () => { mark.hidden = false; }); }

function profileCard(app     )              {
  const p = app.state.project;
  const name = h('input', { value: p.name })                    ;
  const language = h('select', null, h('option', { value: 'ru', selected: p.language === 'ru' }, 'ru — русский'), h('option', { value: 'en', selected: p.language === 'en' }, 'en — English'))                     ;
  const timezone = h('input', { value: p.timezone, placeholder: 'Region/City', pattern: '[A-Za-z_]+/[A-Za-z_]+' })                    ;
  const audience = h('textarea', { rows: 3 }, p.audience)                       ;
  const mark = dirtyMark();
  const save = () => {
    const patch      = {};
    if (name.value.trim() !== p.name) patch.name = name.value;
    if (language.value !== p.language) patch.language = language.value;
    if (timezone.value.trim() !== p.timezone) patch.timezone = timezone.value.trim();
    if (audience.value !== p.audience) patch.audience = audience.value;
    if (!Object.keys(patch).length) { mark.hidden = true; return; }
    app.act(() => api.settings(app.pid, patch, app.actor()), 'Профиль сохранён');
  };
  const card = h('div', { class: 'card' }, h('div', { class: 'head' }, h('h3', null, 'Профиль'), mark),
    h('div', { class: 'form' },
      h('label', null, 'Название', name),
      h('div', { class: 'grid two' }, h('label', null, 'Язык', language), h('label', null, 'Часовой пояс (Region/City)', timezone)),
      h('label', null, 'Аудитория', audience),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary sm', onClick: save }, 'Сохранить профиль'))));
  watch(card, mark);
  return card;
}

function styleCard(app     )              {
  const p = app.state.project;
  const tone = h('textarea', { rows: 3 }, p.brand.tone)                       ;
  const phrases = chipEditor(p.brand.forbiddenPhrases);
  const mark = dirtyMark();
  const save = () => {
    const patch      = {};
    if (tone.value !== p.brand.tone) patch.tone = tone.value;
    const next = phrases.values();
    if (JSON.stringify(next) !== JSON.stringify(p.brand.forbiddenPhrases)) patch.forbiddenPhrases = next;
    if (!Object.keys(patch).length) { mark.hidden = true; return; }
    app.act(() => api.settings(app.pid, patch, app.actor()), 'Стиль сохранён');
  };
  const card = h('div', { class: 'card' }, h('div', { class: 'head' }, h('h3', null, 'Стиль'), mark),
    h('div', { class: 'form' },
      h('label', null, 'Тон общения', tone),
      h('label', null, 'Запрещённые формулировки (контролёр вернёт материал)', phrases.el),
      h('div', { class: 'muted small' }, h('b', null, 'Правила доказательств: '), (p.brand.evidenceRules ?? []).join('; ') || '—', ' · ', h('b', null, 'Доказательства: '), p.brand.proofs.join('; ') || '—', ' · ', h('b', null, 'Визуал: '), p.brand.visual || '—', ' — правятся в brand.md.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary sm', onClick: save }, 'Сохранить стиль'))));
  watch(card, mark);
  return card;
}

function teamsCard(app     )              {
  const st = app.state;
  const enabled = (roleId        ) => { const a = st.agents.find((x     ) => x.roleId === roleId); return Boolean(a && a.status !== 'disabled'); };
  const boxes                                                            = [];
  const mark = dirtyMark();
  const teams = Object.keys(TEAM_LABEL);
  const grid = h('div', { class: 'teams-grid' }, ...teams.map((teamId) => {
    const defs = app.catalog.filter((d     ) => d.team === teamId);
    return h('div', { class: 'callout team-box' }, h('b', null, TEAM_LABEL[teamId]), teamId === 'control' ? h('div', { class: 'muted small' }, '+ человек-согласующий') : null,
      h('div', { class: 'stack', style: { gap: '6px', marginTop: '6px' } }, ...defs.map((d     ) => {
        const was = enabled(d.id);
        const locked = d.id === 'marketing-director' || d.id === 'publisher-executor';
        const box = h('input', { type: 'checkbox', checked: was, disabled: locked })                    ;
        boxes.push({ roleId: d.id, box, was });
        const ag = st.agents.find((x     ) => x.roleId === d.id);
        const modelLabel = ag ? ag.modelLabel : (d.modelPolicy.primary ?? '—');
        return h('label', { class: 'check role-line', title: locked ? (d.id === 'publisher-executor' ? 'Сервисная роль, не LLM — всегда включена' : 'Оркестратор нельзя выключить') : '' }, box,
          h('span', { class: 'role-name' }, d.name, h('span', { class: 'muted small mono' }, ` ${d.id}`)),
          h('span', { class: 'muted small role-meta' }, d.isLlm ? `${modelLabel} · ${usd(ag ? ag.budget.limitUsd : d.budget.perWeekUsd)}/нед` : 'сервисная роль'));
      })));
  }));
  const save = () => {
    const roles                          = {};
    for (const b of boxes) if (b.box.checked !== b.was) roles[b.roleId] = b.box.checked;
    if (!Object.keys(roles).length) { mark.hidden = true; return; }
    app.act(() => api.settings(app.pid, { roles }, app.actor()), 'Состав команд сохранён');
  };
  // Доступность маршрутов текущему (в том числе ещё не сохранённому) составу — то же правило, что в planTask.
  const coverage = h('div', { class: 'callout coverage', 'aria-live': 'polite' });
  const refreshCoverage = () => {
    const roles = boxes.filter((b) => b.box.checked).map((b) => b.roleId);
    const nameOf = (id        ) => app.catalog.find((d     ) => d.id === id)?.name ?? id;
    const available = st.kinds.filter((k     ) => k.route.every((id        ) => roles.includes(id)));
    const missing = st.kinds.filter((k     ) => !k.route.every((id        ) => roles.includes(id)));
    coverage.innerHTML = '';
    coverage.append(available.length ? h('b', null, 'Доступные маршруты: ') : h('b', null, 'Ни один маршрут не доступен: '), available.length ? available.map((k     ) => k.label).join(', ') + '.' : 'задачи не запустятся, пока не включены роли.',
      missing.length ? h('span', { class: 'muted' }, ' Недоступны: ', missing.map((k     ) => `${k.label} — нет: ${k.route.filter((id        ) => !roles.includes(id)).map(nameOf).join(', ')}`).join('; '), '.') : '');
  };
  grid.addEventListener('change', refreshCoverage);
  refreshCoverage();
  // Стартовые наборы (те же, что в мастере): расставляют чекбоксы, сохранение — прежним POST /settings только с разницей.
  const presetLabel = h('span', { class: 'muted small' });
  const presetButtons                      = [];
  const refreshPreset = () => {
    const roles = boxes.filter((b) => b.box.checked).map((b) => b.roleId);
    const current = (st.teamPresets ?? []).find((p     ) => p.roles.length === roles.length && p.roles.every((r        ) => roles.includes(r)));
    presetButtons.forEach((b) => b.classList.toggle('primary', b.dataset.preset === current?.id));
    presetLabel.textContent = current ? `Набор «${current.name}»: ${roles.length} ролей` : `Свой состав: ${roles.length} ролей`;
  };
  const presetBar = h('div', { class: 'preset-bar', role: 'group', 'aria-label': 'Стартовые наборы команды', style: { marginBottom: '10px' } },
    ...(st.teamPresets ?? []).map((p     ) => {
      const b = h('button', { type: 'button', class: 'btn sm', dataset: { preset: p.id }, title: `${p.roles.length} ролей`, onClick: () => {
        for (const x of boxes) if (!x.box.disabled) x.box.checked = p.roles.includes(x.roleId);
        refreshCoverage(); refreshPreset(); mark.hidden = false;
      } }, `${p.name} · ${p.kindLabels.join(', ')}`)                     ;
      presetButtons.push(b); return b;
    }), presetLabel);
  grid.addEventListener('change', refreshPreset);
  refreshPreset();
  const card = h('div', { class: 'card' }, h('div', { class: 'head' }, h('h3', null, 'Команды'), mark),
    h('div', { class: 'muted small', style: { marginBottom: '8px' } }, 'Выберите набор или отметьте роли по одной. Оркестратор и исполнитель публикации выключить нельзя; занятую задачей роль — тоже (сервер ответит ROLE_BUSY, ничего не сохранив).'),
    presetBar, grid, coverage, h('div', { class: 'actions', style: { marginTop: '10px' } }, h('button', { class: 'btn primary sm', onClick: save }, 'Сохранить команды')));
  watch(card, mark);
  return card;
}

function limitCard(app     )              {
  const st = app.state;
  const input = h('input', { type: 'number', min: 0, step: 1, value: String(st.project.weeklyLimitUsd), style: { width: '140px' } })                    ;
  const mark = dirtyMark();
  const save = () => { const v = Number(input.value); if (v === st.project.weeklyLimitUsd) { mark.hidden = true; return; } app.act(() => api.settings(app.pid, { weeklyLimitUsd: v }, app.actor()), 'Потолок проекта сохранён'); };
  const card = h('div', { class: 'card' }, h('div', { class: 'head' }, h('h3', null, 'Недельный лимит'), mark),
    h('div', { class: 'row' }, input, h('span', { class: 'muted small' }, '$ / нед'), h('button', { class: 'btn primary sm', onClick: save }, 'Сохранить'), h('span', { class: 'muted small mono' }, `потрачено ${usd(st.budget.spentUsd)}`)),
    h('div', { class: 'muted small', style: { marginTop: '8px' } }, 'Контрольный потолок для условных стоимостей, не разрешение на реальные расходы. По умолчанию $60. Лимиты ролей — демонстрационные, из project.json.'));
  watch(card, mark);
  return card;
}

function channelsCard(app     )              {
  const st = app.state;
  return h('div', { class: 'card' }, h('h3', null, 'Каналы и mock-статусы'),
    st.channels.length ? h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Канал'), h('th', null, 'Площадка'), h('th', null, 'Коннектор'), h('th', null, 'Статус'), h('th', null, 'Режим mock'))),
      h('tbody', null, ...st.channels.map((c     ) => h('tr', null, h('td', null, c.name, h('div', { class: 'muted small mono' }, c.timezone)), h('td', null, PLATFORM_LABEL[c.platform] ?? c.platform), h('td', { class: 'mono' }, c.connectorId), h('td', null, statusBadge(c.status)),
        h('td', null, h('select', { onChange: (e       ) => app.act(() => api.settings(app.pid, { channels: { [c.id]: (e.target                     ).value } }, app.actor()), 'Режим канала изменён') }, ...st.mockModes.map((m        ) => h('option', { value: m, selected: m === c.mockMode }, STATUS_LABEL[m] ?? m))))))))
      : h('div', { class: 'empty' }, 'Каналов нет — они добавляются в seed.json проекта как mock'),
    h('div', { class: 'muted small', style: { marginTop: '8px' } }, 'OAuth, токены и реальные аккаунты не подключены и не хранятся. Режим задаёт имитируемый ответ коннектора.'));
}

// Локальная выгрузка в файл: Blob + a[download], без внешних адресов и сети.
function downloadJson(name        , data         ) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function archiveCard(app     )              {
  const st = app.state; const p = st.project;
  const list = h('div', { class: 'stack', style: { marginTop: '10px' } }, h('div', { class: 'muted small' }, 'Загрузка архива…'));
  const drawArchives = (archives       , ttlDays        ) => {
    list.innerHTML = '';
    list.appendChild(h('h3', null, `Архив удалённых проектов (${archives.length})`));
    if (!archives.length) { list.appendChild(h('div', { class: 'muted small' }, `Пусто. Удалённые проекты хранятся здесь ${ttlDays} дней и могут быть возвращены.`)); return; }
    list.appendChild(h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Проект'), h('th', null, 'Удалён'), h('th', null, 'Осталось'), h('th', null, ''))),
      h('tbody', null, ...archives.map((e     ) => h('tr', null,
        h('td', null, e.projectName, h('div', { class: 'muted small mono' }, `${e.id} · задач ${e.counts.tasks}, материалов ${e.counts.artifacts}`)),
        h('td', null, fmtDate(e.archivedAt), h('div', { class: 'muted small' }, e.by)),
        h('td', null, `${e.daysLeft} дн.`),
        h('td', null, h('button', { class: 'btn sm', onClick: () => app.act(async () => {
          const out = await api.restoreArchive(e.name);
          app.projects = out.projects; app.pid = out.project.id; try { localStorage.setItem('mc.pid', app.pid); } catch {}
          app.sel = {}; app.go('settings'); return {};
        }, `Проект «${e.projectName}» возвращён из архива`, 'human') }, 'Вернуть')))))));
  };
  api.archives().then((out) => drawArchives(out.archives, out.ttlDays)).catch((e) => { list.innerHTML = ''; list.appendChild(h('div', { class: 'callout err small' }, `Архив недоступен: ${e instanceof Error ? e.message : String(e)}`)); });
  const exportNow = () => app.act(async () => { const data = await api.exportProject(app.pid); downloadJson(`${app.pid}-${new Date().toISOString().slice(0, 10)}.json`, data); return { state: st }; }, 'Выгрузка сохранена в файл');
  const removeProject = () => {
    const input = h('input', { placeholder: p.id, class: 'mono', 'aria-label': 'Введите id проекта для подтверждения' })                    ;
    const confirmBtn = h('button', { class: 'btn danger', disabled: true }, 'Удалить проект в архив')                     ;
    input.addEventListener('input', () => { confirmBtn.disabled = input.value.trim() !== p.id; });
    const m = modal('Удалить проект?', h('div', { class: 'stack' },
      h('div', null, `Проект «${p.name}» (${p.id}) будет перенесён в архив projects/_archive/ вместе с состоянием: задач ${st.tasks.length}, материалов ${st.artifacts.length}, согласований ${st.approvals.length}, публикаций ${st.jobs.length}. Из панели он исчезнет.`),
      h('div', { class: 'callout' }, 'Архив хранится 30 дней — до этого срока проект можно вернуть кнопкой «Вернуть» на этой странице. Затем запись удаляется при запуске сервера безвозвратно. Перед удалением можно скачать выгрузку.'),
      h('label', { class: 'small' }, `Для подтверждения введите id проекта: ${p.id}`, input),
      h('div', { class: 'actions' }, confirmBtn, h('button', { class: 'btn', onClick: () => { m.close(); exportNow(); } }, 'Сначала скачать выгрузку'), h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Отмена'))));
    confirmBtn.addEventListener('click', async () => {
      m.close();
      await app.act(async () => {
        const out = await api.archiveProject(app.pid, app.actor());
        app.projects = out.projects; app.pid = out.projects[0].id; try { localStorage.setItem('mc.pid', app.pid); } catch {}
        app.state = null; app.sel = {}; app.go('settings'); return {};
      }, `Проект «${p.name}» перенесён в архив на 30 дней`, 'human');
    });
  };
  return h('div', { class: 'card' }, h('h3', null, 'Выгрузка и удаление'),
    h('div', { class: 'muted small', style: { marginBottom: '8px' } }, 'Выгрузка — один JSON с профилем и полным состоянием проекта, сохраняется на этот компьютер. Удаление переносит проект в архив на 30 дней, не стирая файлы сразу.'),
    h('div', { class: 'actions' }, h('button', { class: 'btn sm', onClick: exportNow }, 'Скачать выгрузку (JSON)'), h('button', { class: 'btn danger sm', onClick: removeProject }, 'Удалить проект…')),
    list);
}

export function render(app     )              {
  const st = app.state;
  const resetDemo = () => {
    const m = modal('Сбросить демо-состояние?', h('div', { class: 'stack' },
      h('div', null, `Проект «${st.project.name}» вернётся к значениям из projects/${st.project.id}/. Задачи, материалы, согласования и изменения настроек в runtime/ будут удалены.`),
      h('div', { class: 'actions' }, h('button', { class: 'btn danger', onClick: async () => { m.close(); await app.act(() => api.reset(app.pid), 'Состояние сброшено'); } }, 'Сбросить'), h('button', { class: 'btn', onClick: () => m.close() }, 'Отмена'))));
  };
  return h('div', null,
    h('div', { class: 'page-head' }, h('div', null, h('h1', null, 'Настройки проекта'),
      h('div', { class: 'sub' }, 'Mock-редактирование: изменения хранятся в runtime/, файл projects/<id>/project.json не переписывается; «Сбросить демо» возвращает значения файла. Реальные данные, ключи и интеграции не подключаются.')),
      h('div', { class: 'row' }, badge(`согласующие: ${st.project.approvers.join(', ')}`), badge(`неделя ${st.project.currentWeek}`))),
    h('div', { class: 'grid two' }, profileCard(app), styleCard(app)),
    h('div', { style: { marginTop: '16px' } }, teamsCard(app)),
    h('div', { class: 'grid two', style: { marginTop: '16px' } }, limitCard(app), channelsCard(app)),
    h('div', { style: { marginTop: '16px' } }, archiveCard(app)),
    h('div', { class: 'settings-footer' }, h('button', { class: 'btn sm', onClick: () => openProjectWizard(app) }, '＋ Новый проект (мастер)'), h('button', { class: 'btn ghost sm', onClick: resetDemo }, 'Сбросить демо')));
}
