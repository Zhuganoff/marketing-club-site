// Экран «Проекты» (направление Teamly «Your teams», указание владельца 2026-09-03):
// карточки проектов с командой и меню «Архив/Удалить», вкладка «Архив» с возвратом.
                                     
import { api } from '../api.js?v=mtmlkoru';
import { h, modal, fmtDate } from '../ui.js?v=mtmlkoru';
import { AGENT_NAME } from '../components/team-studio.js?v=mtmlkoru';
import { openProjectWizard } from '../components/project-wizard.js?v=mtmlkoru';
import { pendingDecisions } from '../app.js?v=mtmlkoru';

function openProject(app     , pid        ) {
  if (app.pid !== pid) {
    app.pid = pid;
    try { localStorage.setItem('mc.pid', pid); } catch {}
    app.state = null; app.sel = {};
    void app.refresh();
  }
  app.go('today');
}

function archiveFlow(app     , p                              , strict         ) {
  const archive = async ()                         => {
    let name                = null;
    await app.act(async () => {
      const out = await api.archiveProject(p.id, app.actor());
      name = out.archive?.name ?? null;
      app.projects = out.projects;
      if (!out.projects.some((x     ) => x.id === app.pid)) { app.pid = out.projects[0].id; app.state = null; app.sel = {}; }
      try { localStorage.setItem('mc.pid', app.pid); } catch {}
      await app.refresh(); return {};
    }, strict ? undefined : `Проект «${p.name}» перенесён в архив на 30 дней`, 'human');
    return name;
  };
  if (!strict) {
    const m = modal('Перенести проект в архив?', h('div', { class: 'stack' },
      h('div', null, `«${p.name}» уйдёт в архив на 30 дней; всё это время его можно вернуть на вкладке «Архив». Файлы не стираются.`),
      h('div', { class: 'actions' }, h('button', { class: 'btn human', onClick: () => { m.close(); void archive(); } }, 'В архив на 30 дней'), h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Отмена'))));
    return;
  }
  // Настоящее удаление (указание владельца 2026-09-03): безвозвратно, без ввода id.
  const m = modal('Удалить проект безвозвратно?', h('div', { class: 'stack' },
    h('div', null, `Проект «${p.name}» и все его файлы будут удалены насовсем. Отменить это будет нельзя.`),
    h('div', { class: 'callout' }, 'Если хотите оставить путь назад — выберите «В архив»: там проект хранится 30 дней.'),
    h('div', { class: 'actions' },
      h('button', { class: 'btn danger', onClick: async () => {
        m.close();
        const name = await archive();
        if (name) await app.act(async () => { await api.deleteArchive(name); return {}; }, `Проект «${p.name}» удалён безвозвратно`, 'err');
      } }, 'Удалить навсегда'),
      h('button', { class: 'btn ghost', onClick: () => m.close() }, 'Отмена'))));
}

export function render(app     )              {
  const tab = app.sel.ptab ?? 'active';
  const head = h('div', { class: 'page-head' },
    h('div', null, h('h1', null, 'Проекты'), h('div', { class: 'sub' }, 'Каждый проект — отдельный офис со своей командой. Нажмите, чтобы провалиться внутрь.')),
    h('div', { class: 'seg' },
      h('button', { class: tab === 'active' ? 'active' : '', onClick: () => app.go('projects', { ptab: 'active' }) }, `Активные (${app.projects.length})`),
      h('button', { class: tab === 'archive' ? 'active' : '', onClick: () => app.go('projects', { ptab: 'archive' }) }, 'Архив')));

  if (tab === 'archive') {
    const list = h('div', { class: 'card' }, h('div', { class: 'muted small' }, 'Загрузка архива…'));
    api.archives().then((out) => {
      list.innerHTML = '';
      list.appendChild(h('h3', null, `Архив удалённых проектов (${out.archives.length}) · хранится ${out.ttlDays} дней`));
      if (!out.archives.length) { list.appendChild(h('div', { class: 'empty' }, 'Архив пуст.')); return; }
      list.appendChild(h('table', { class: 'table' },
        h('thead', null, h('tr', null, h('th', null, 'Проект'), h('th', null, 'Удалён'), h('th', null, 'Осталось'), h('th', null, ''))),
        h('tbody', null, ...out.archives.map((e     ) => h('tr', null,
          h('td', null, h('b', null, e.projectName), h('div', { class: 'muted small mono' }, e.id)),
          h('td', null, fmtDate(e.archivedAt), h('div', { class: 'muted small' }, e.by)),
          h('td', { class: 'mono' }, `${e.daysLeft} дн`),
          h('td', null, h('button', {
            class: 'btn sm', onClick: () => app.act(async () => {
              await api.restoreArchive(e.name);
              app.projects = await api.projects();
              await app.refresh(); return {};
            }, `Проект «${e.projectName}» возвращён из архива`),
          }, 'Вернуть')))))));
    }).catch((err) => { list.innerHTML = ''; list.appendChild(h('div', { class: 'callout err' }, `Архив недоступен: ${err instanceof Error ? err.message : String(err)}`)); });
    return h('div', null, head, list);
  }

  const grid = h('div', { class: 'projects-grid' });
  grid.appendChild(h('button', { class: 'proj-card proj-card--new', onClick: () => openProjectWizard(app) },
    h('span', { class: 'proj-card-plus' }, '＋'),
    h('b', null, 'Создать новый проект'),
    h('span', { class: 'muted small' }, 'Мастер соберёт команду под задачи — всё локально')));
  for (const p of app.projects) {
    const isCur = p.id === app.pid;
    const st = isCur ? app.state : null;
    const name = st ? st.project.name : p.name;
    const crew = st ? st.agents.filter((a     ) => a.status !== 'disabled') : [];
    const pending = st ? pendingDecisions(st) : 0;
    const menu = h('div', { class: 'proj-menu', hidden: true },
      h('button', { class: 'btn sm', onClick: (e       ) => { e.stopPropagation(); menu.hidden = true; archiveFlow(app, { id: p.id, name }, false); } }, 'В архив'),
      h('button', { class: 'btn danger sm', onClick: (e       ) => { e.stopPropagation(); menu.hidden = true; archiveFlow(app, { id: p.id, name }, true); } }, 'Удалить…'));
    const card = h('div', { class: `proj-card${isCur ? ' current' : ''}`, role: 'button', tabindex: '0',
      onClick: () => openProject(app, p.id),
      onKeydown: (e               ) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(app, p.id); } } },
      h('div', { class: 'proj-card-head' },
        h('b', { class: 'proj-card-name' }, name),
        h('button', { class: 'proj-more', 'aria-label': `Действия с проектом ${name}`, onClick: (e       ) => { e.stopPropagation(); const open = menu.hidden; document.querySelectorAll('.proj-menu').forEach((el) => ((el               ).hidden = true)); menu.hidden = !open ? true : false; } }, '⋯')),
      crew.length ? h('div', { class: 'proj-card-crew' },
        ...crew.slice(0, 6).map((a     ) => {
          const def = app.catalog.find((d     ) => d.id === a.roleId);
          return h('span', { class: 'crew-ava', title: `${AGENT_NAME[a.roleId] ?? ''} · ${def?.name ?? a.roleId}`, style: { background: def?.avatar?.hue != null ? `hsl(${def.avatar.hue} 32% 38%)` : 'var(--ink-3)' } }, (AGENT_NAME[a.roleId] ?? def?.name ?? '?').slice(0, 2).toUpperCase());
        }),
        crew.length > 6 ? h('span', { class: 'crew-ava crew-ava--more' }, `+${crew.length - 6}`) : null)
        : h('div', { class: 'muted small' }, 'Откройте, чтобы увидеть команду'),
      h('div', { class: 'proj-card-meta mono' },
        st ? `${crew.length} сотрудников` : (p.language === 'en' ? 'EN' : 'RU'),
        pending ? h('span', { class: 'proj-card-pending' }, ` · ждут решения: ${pending}`) : (st ? ' · всё спокойно' : ''),
        isCur ? h('span', { class: 'proj-card-cur' }, 'ОТКРЫТ') : null),
      menu);
    grid.appendChild(card);
  }
  return h('div', null, head, grid);
}
