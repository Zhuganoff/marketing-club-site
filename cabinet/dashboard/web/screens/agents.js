                                     
import { h, badge, statusBadge, avatar, usd, fmtDate, TEAM_LABEL, ART_KIND, STATUS_LABEL } from '../ui.js?v=mtlshmqq';
import { agentMap } from '../components/agent-map.js?v=mtlshmqq';
import { teamStudio, AGENT_NAME } from '../components/team-studio.js?v=mtlshmqq';

// Лента офиса (направление Teamly, 2026-09-03): журнал проекта в виде переписки команды
// + поле «поручить». Честность: это существующие события ActivityEvent, а поручение
// открывает обычную форму задачи — координатор без модели ничего сам не сочиняет.
function officeFeed(app     )              {
  const st = app.state;
  const events = [...st.events].slice(-14).reverse();
  const nameOf = (ev     )                                                     => {
    const a = ev.actor ?? {};
    if (a.kind === 'agent' && a.roleId) {
      const def = app.catalog.find((d     ) => d.id === a.roleId);
      const nm = AGENT_NAME[a.roleId] ?? def?.name ?? a.roleId;
      return { ini: nm.slice(0, 2).toUpperCase(), label: `${nm} · ${def?.name ?? a.roleId}`, hue: def?.avatar?.hue ?? null };
    }
    if (a.kind === 'human') return { ini: 'ВЫ', label: a.name ?? st.project.approvers?.[0] ?? 'Владелец', hue: null };
    return { ini: 'СС', label: 'Система', hue: null };
  };
  const input = h('input', { class: 'office-input', placeholder: 'Поручить команде… (станет задачей по маршруту)' })                    ;
  const submit = () => { const v = input.value.trim(); app.newTask('post', false, null, v || undefined); input.value = ''; };
  input.addEventListener('keydown', (e               ) => { if (e.key === 'Enter') submit(); });
  return h('aside', { class: 'office-feed card flush', 'aria-label': 'Лента офиса' },
    h('div', { class: 'office-feed-head' }, h('h3', null, 'Лента офиса'), h('span', { class: 'crew-online' }, 'ONLINE')),
    h('div', { class: 'office-feed-body' },
      events.length ? events.map((ev     ) => {
        const who = nameOf(ev);
        return h('div', { class: `office-msg${ev.actor?.kind === 'human' ? ' human' : ''}${ev.level === 'error' ? ' err' : ''}` },
          h('span', { class: 'crew-ava', style: { background: who.hue != null ? `hsl(${who.hue} 32% 38%)` : ev.actor?.kind === 'human' ? 'var(--human)' : 'var(--ink-3)' } }, who.ini),
          h('div', { class: 'office-msg-body' },
            h('div', { class: 'office-msg-who' }, who.label, h('time', { class: 'office-msg-time' }, fmtDate(ev.ts))),
            h('div', { class: 'office-msg-text' }, ev.message)));
      }) : h('div', { class: 'empty' }, 'Событий пока нет — поручите команде первую задачу.')),
    h('div', { class: 'office-compose' },
      input,
      h('button', { class: 'btn human sm', onClick: submit }, 'Поручить'),
      h('div', { class: 'office-compose-hint' }, 'Координатор пока без модели: поручение откроет обычную задачу и пойдёт по маршруту')));
}

// Один вид команды — карточки с портретами по иерархии проекта (решение владельца 2026-08-28; 3D-офис отклонён).
export function render(app     )              {
  const st = app.state;
  const selId = app.sel.agent ?? st.agents[0]?.roleId;
  const tab = app.sel.tab ?? 'instructions';
  const grid = h('div', { class: 'agents-grid' }, ...app.catalog.map((def     ) => {
    const ag = st.agents.find((a     ) => a.roleId === def.id);
    const share = ag && ag.budget.limitUsd ? Math.min(100, ag.budget.spentUsd / ag.budget.limitUsd * 100) : 0;
    return h('button', { type: 'button', class: `card acard${def.id === selId ? ' selected' : ''}`, onClick: () => app.go('agents', { agent: def.id, tab, technical: '1' }) },
      avatar(def.avatar),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'name' }, def.name), badge(TEAM_LABEL[def.team])),
        h('div', { class: 'purpose' }, def.purpose),
        ag ? [h('div', { class: 'row' }, h('span', { class: `status ${ag.status}` }, STATUS_LABEL[ag.status]), h('span', { class: 'muted small' }, ag.modelLabel)),
          h('div', { class: `mini-meter${share > 80 ? ' hot' : ''}` }, h('i', { style: { width: `${share}%` } })),
          h('div', { class: 'muted small mono' }, `${usd(ag.budget.spentUsd)} / ${usd(ag.budget.limitUsd)} в нед.`)]
          : h('div', { class: 'muted small' }, 'не включён в этом проекте')));
  }));
  const def = app.catalog.find((d     ) => d.id === selId);
  const ag = st.agents.find((a     ) => a.roleId === selId);
  const detail = def ? agentDetail(app, def, ag, tab) : h('div', { class: 'empty' }, 'Выберите роль');
  return h('div', { class: 'agents-page' },
    h('div', { class: 'office-layout' }, officeFeed(app), teamStudio(app)),
    h('details', { class: 'team-technical', open: app.sel.technical === '1' },
      h('summary', null, 'Технические сведения о команде'),
      h('div', { class: 'team-technical-body' },
        h('div', { class: 'muted small team-technical-intro' }, `Каталог из ${app.catalog.length} ролей; в проекте включено ${st.agents.filter((a     ) => a.status !== 'disabled').length}. Здесь находятся схема маршрута, модели, лимиты, инструкции и история.`),
        h('div', { class: 'card', style: { marginBottom: '16px' } }, h('div', { class: 'head' }, h('h3', null, 'Техническая схема маршрута'), h('span', { class: 'muted small' }, 'Вспомогательный вид для проверки передач')), agentMap(app)),
        grid,
        h('div', { style: { marginTop: '16px' } }, detail))));
}

function agentDetail(app     , def     , ag     , tab        )              {
  const st = app.state;
  const tabs = [['instructions', 'Инструкции'], ['runs', 'История запусков'], ['results', 'Результаты'], ['access', 'Доступы']];
  const tabBar = h('div', { class: 'tabs' }, ...tabs.map(([id, label]) => h('button', { class: id === tab ? 'active' : '', onClick: () => app.go('agents', { agent: def.id, tab: id, technical: '1' }) }, label)));
  let body             ;
  if (tab === 'instructions') {
    body = h('div', { class: 'grid two' },
      h('div', null, h('h3', null, 'SOUL.md'), h('pre', { class: 'doc' }, def.soul ?? 'нет файла')),
      h('div', null, h('h3', null, 'RULES.md'), h('pre', { class: 'doc' }, def.rules ?? 'нет файла'),
        h('h3', { style: { marginTop: '12px' } }, 'Контракт'), h('div', { class: 'small stack' },
          h('div', null, h('b', null, 'Вход: '), def.input.accepts.join(', '), ' · поля: ', def.input.requiredFields.join(', ')),
          h('div', null, h('b', null, 'Выход: '), ART_KIND[def.output.artifactKind] ?? def.output.artifactKind, def.output.template ? ` · шаблон ${def.output.template}` : ''),
          h('div', null, h('b', null, 'Запреты: '), def.forbidden.join('; ')),
          h('div', null, h('b', null, 'Модель: '), def.modelPolicy.primary ?? '— (не LLM)', def.modelPolicy.fallback ? `, резерв ${def.modelPolicy.fallback}` : '', ' · ', badge(def.modelPolicy.origin === 'approved' ? `утверждено владельцем ${def.modelPolicy.approvedAt ?? ''}` : def.modelPolicy.origin === 'brief' ? 'из брифа' : def.modelPolicy.origin === 'proposed' ? 'предложено, TODO утвердить' : 'не применимо', def.modelPolicy.origin === 'approved' ? 'ok' : def.modelPolicy.origin === 'proposed' ? 'warn' : '')),
          h('div', null, h('b', null, 'Лимит каталога: '), `${usd(def.budget.perWeekUsd)}/нед · ${usd(def.budget.perTaskUsd)}/задача`))));
  } else if (tab === 'runs') {
    const runs = st.tasks.flatMap((t     ) => t.handoffs.filter((ho     ) => ho.from === def.id).map((ho     ) => ({ ho, t }))).sort((a     , b     ) => b.ho.createdAt.localeCompare(a.ho.createdAt));
    body = runs.length ? h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Время'), h('th', null, 'Задача'), h('th', null, 'Кому'), h('th', null, 'Статус'), h('th', null, 'Стоимость'), h('th', null, 'Итог'))),
      h('tbody', null, ...runs.map(({ ho, t }     ) => h('tr', null, h('td', { class: 'mono' }, fmtDate(ho.createdAt)), h('td', null, h('a', { href: '#', onClick: (e       ) => { e.preventDefault(); app.go('tasks', { task: t.id }); } }, t.title)), h('td', null, ho.to), h('td', null, statusBadge(ho.status)), h('td', { class: 'mono' }, usd(ho.costUsd)), h('td', null, ho.summary)))))
      : h('div', { class: 'empty' }, 'Запусков в этом проекте ещё не было');
  } else if (tab === 'results') {
    const arts = st.artifacts.filter((a     ) => a.authorRoleId === def.id);
    body = arts.length ? h('div', { class: 'list' }, ...arts.map((a     ) => h('div', { class: 'item' }, h('div', { class: 'body' }, h('a', { href: '#', onClick: (e       ) => { e.preventDefault(); app.go('content', { artifact: a.id }); } }, a.title), ' ', badge(ART_KIND[a.kind] ?? a.kind), ' ', statusBadge(a.status), h('div', { class: 'sub' }, `v${a.version} · источников ${a.sources.length} · ${fmtDate(a.updatedAt)}`)))))
      : h('div', { class: 'empty' }, 'Результатов пока нет');
  } else {
    body = h('div', { class: 'stack' },
      h('div', { class: 'callout ok' }, 'Внешние интеграции для этой роли выключены. Нет ключей, сети, соцсетей, CRM, почты и браузерной автоматизации.'),
      h('table', { class: 'table' }, h('tbody', null,
        row('Провайдер модели', 'mock (реальный API не подключён)'), row('API-ключ', 'отсутствует'), row('Сеть', 'запрещена'),
        row('Разрешённые инструменты', def.allowedTools.join(', ') || '—'), row('Соцсети / публикация', def.id === 'publisher-executor' ? 'только mock-коннекторы' : 'нет'),
        row('Персональные данные', 'запрещены'), row('Чужие проекты', 'изолированы — данных других проектов не видит'))));
  }
  return h('div', { class: 'card' },
    h('div', { class: 'head' }, h('div', { class: 'row' }, avatar(def.avatar, true), h('div', null, h('h2', null, def.name), h('div', { class: 'muted small mono' }, `${def.id} · ${TEAM_LABEL[def.team]} · ${def.isLlm ? 'LLM-роль' : 'сервисная роль, не LLM'}`))),
      ag ? h('div', { class: 'row' }, h('span', { class: `status ${ag.status}` }, STATUS_LABEL[ag.status]), badge(ag.modelLabel, 'agent'), ag.currentTaskId ? badge(`задача ${ag.currentTaskId}`) : null, h('span', { class: 'muted small mono' }, `${usd(ag.budget.spentUsd)} / ${usd(ag.budget.limitUsd)} · запусков ${ag.runs}`), ag.errorMessage ? badge(ag.errorMessage, 'err') : null) : badge('не включён в проекте')),
    tabBar, body);
}
function row(k        , v        ) { return h('tr', null, h('td', { class: 'muted' }, k), h('td', null, v)); }
