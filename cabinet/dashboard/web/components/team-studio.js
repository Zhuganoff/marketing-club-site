// «Редакционная мастерская»: одна открытая сцена команды вокруг реальных материалов.
// Движение здесь означает только локальный повтор сохранённых handoff-событий или
// подтверждённое состояние working из проекции. Никаких запросов компонент не делает.
                                     
import { buildTeamActivity } from '../agent-activity.js?v=mtmjsdom';
import { reduceMotion } from '../motion.js?v=mtmjsdom';
import { fmtDate, h } from '../ui.js?v=mtmjsdom';

                                                                                     

                   
             
                
               
                 
                    
                     
                  
                               
  

                      
             
                 
                     
               
             
                 
                  
                               
                    
  

                    
                 
               
                  
               
                    
                    
                      
                 
                          
                                    
                               
                        
                        
  

                     
                     
                
                 
                    
  

                       
                        
                          
                                      
                                     
  

                   
             
                
                     
                            
  

const SVG_NS = 'http://www.w3.org/2000/svg';

const STATE_LABEL                             = {
  disabled: 'не включён в проект',
  error: 'ошибка',
  blocked: 'работа остановлена',
  working: 'работает',
  received: 'получил материал',
  idle: 'свободен',
};

// Что делает роль — простыми словами, для человека без маркетингового опыта. Полное назначение — в contract.json.
// Имена сотрудников (направление Teamly, указание владельца 2026-09-03): агент — «сотрудник»
// с именем и профессией. Только визуальный слой панели; контракты ролей не меняются.
const AGENT_NAME                         = {
  'marketing-director': 'Марк',
  'brand-strategist': 'Вера',
  'market-researcher': 'Игорь',
  'seo-strategist': 'Соня',
  'chief-editor': 'Лена',
  'creative-director': 'Артём',
  'reels-producer': 'Кира',
  'channel-editor': 'Паша',
  'quality-controller': 'Нина',
  'funnel-analyst': 'Глеб',
  'publisher-executor': 'Тим',
};

const SHORT_PURPOSE                         = {
  'marketing-director': 'Получает вашу задачу, решает, кто и в каком порядке её делает, и собирает результат',
  'brand-strategist': 'Определяет, как проект говорит о себе и чем отличается от других',
  'market-researcher': 'Узнаёт, что волнует клиентов, и находит проверяемые источники',
  'seo-strategist': 'Подбирает слова, по которым вас найдут в поиске',
  'funnel-analyst': 'Смотрит, что принесло заявки, и предлагает, что проверить дальше',
  'chief-editor': 'Пишет текст только по проверенным фактам',
  'reels-producer': 'Готовит сценарий короткого видео',
  'creative-director': 'Придумывает, как материал будет выглядеть',
  'channel-editor': 'Подгоняет материал под Instagram, TikTok и другие площадки',
  'quality-controller': 'Проверяет факты, обещания и стиль до того, как материал попадёт к вам',
  'publisher-executor': 'Публикует только то, что вы утвердили',
};

// Ярусы сцены: согласующая проекта → Маркетинг-директор → команды. Порядок ролей внутри команд — как в каталоге.
const TEAM_ORDER = ['strategy', 'content', 'growth', 'control', 'publishing'];
const TEAM_TITLE                         = { strategy: 'Стратегия и исследование', content: 'Тексты, видео и оформление', growth: 'Поиск и аналитика', control: 'Проверка', publishing: 'Публикация' };
const TEAM_HINT                         = {
  strategy: 'Разбираются, о чём и для кого говорить',
  content: 'Делают сам материал',
  growth: 'Помогают, чтобы вас находили, и считают результат',
  control: 'Ничего не пропускает к вам без проверки',
  publishing: 'Выкладывает после вашего утверждения',
};
const ROLE_VISUAL_ORDER = ['marketing-director', 'brand-strategist', 'market-researcher', 'seo-strategist', 'chief-editor', 'creative-director', 'reels-producer', 'channel-editor', 'quality-controller', 'funnel-analyst', 'publisher-executor'];

// «Кто я» — первый абзац одноимённого раздела SOUL.md роли: это её собственная инструкция, а не подпись из панели.
function soulIntro(soul                           )                {
  if (!soul) return null;
  const m = soul.match(/##\s*Кто я\s*\n+([\s\S]*?)(?:\n\s*\n|$)/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function svgElement(tag        , attrs                        )             {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

// Портрет — плоская DOM-картинка без картинок, шрифтов и 3D: лицо, причёска, рубашка цвета команды, аксессуар роли.
// Черты выводятся из id роли детерминированно, чтобы у каждого было своё узнаваемое лицо. Портрет ничего не «делает»:
// движения в нём нет, состояние показывает подпись рядом.
                                                                                    
const ACCESSORY                            = {
  'marketing-director': 'badge', 'brand-strategist': 'scarf', 'market-researcher': 'glasses', 'seo-strategist': 'glasses', 'funnel-analyst': 'glasses',
  'chief-editor': 'pen', 'creative-director': 'scarf', 'reels-producer': 'headset', 'channel-editor': 'none', 'quality-controller': 'glasses', 'publisher-executor': 'tie',
};
const SKIN = ['#f3cfae', '#e8b892', '#d9a377'];
const HAIR = ['#6b4a2f', '#8c6a3f', '#3b2a1e', '#a3773f', '#5a3d2b', '#b5894a'];
const TEAM_SHIRT                         = { strategy: '#3f6ea5', content: '#2f8a8f', growth: '#5c8b3a', control: '#8a6d2b', publishing: '#6d5a9c', human: '#b4610e' };
function hash(s        )         { let x = 0; for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; }

export function portrait(seedKey        , team        , accessory           , opts                     = {})              {
  const seed = hash(seedKey);
  const style = opts.long ? 1 : (seed >>> 4) % 4;
  const i = (cls        , ...children                        ) => h('i', { class: cls }, ...children);
  const el = h('span', { class: `team-studio__portrait hair-${style} team-${team}`, 'aria-hidden': 'true' },
    i('pt-shoulders',
      accessory === 'badge' ? i('pt-badge') : null,
      accessory === 'tie' ? i('pt-tie') : null,
      accessory === 'pen' ? i('pt-pen') : null,
      accessory === 'scarf' ? i('pt-scarf') : null),
    i('pt-neck'),
    i('pt-head',
      i('pt-ear pt-ear--l'), i('pt-ear pt-ear--r'),
      i('pt-hair'),
      i('pt-brow pt-brow--l'), i('pt-brow pt-brow--r'),
      i('pt-eye pt-eye--l'), i('pt-eye pt-eye--r'),
      i('pt-mouth'),
      accessory === 'glasses' ? i('pt-glasses') : null,
      accessory === 'headset' ? i('pt-headset') : null));
  el.style.setProperty('--skin', SKIN[seed % SKIN.length]);
  el.style.setProperty('--hair', HAIR[(seed >>> 2) % HAIR.length]);
  el.style.setProperty('--shirt', TEAM_SHIRT[team] ?? TEAM_SHIRT.strategy);
  return el;
}

function plural(n        , one        , few        , many        )         {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export { TEAM_TITLE, TEAM_HINT, TEAM_ORDER, SHORT_PURPOSE, ROLE_VISUAL_ORDER, AGENT_NAME };
                                                           

export function honestSummary(projection                , approver        )         {
  const { counts } = projection;
  const sentences           = [];
  if (counts.working > 0) {
    sentences.push(`Сейчас ${counts.working} ${plural(counts.working, 'агент работает', 'агента работают', 'агентов работают')}.`);
  } else {
    sentences.push('Сейчас агенты не работают.');
  }
  sentences.push(`Свободных агентов: ${counts.idle}. Не включено в проект: ${counts.disabled}.`);
  if (counts.received > 0) {
    sentences.push(`У ${counts.received} ${plural(counts.received, 'агента', 'агентов', 'агентов')} есть материал, ожидающий запуска.`);
  }
  if (projection.reviews.length > 0) {
    const n = projection.reviews.length;
    sentences.push(`${n} ${plural(n, 'материал ждёт', 'материала ждут', 'материалов ждут')} решения. Согласующая: ${approver}.`);
  }
  const stopped = counts.blocked + counts.error;
  if (stopped > 0) sentences.push(`${stopped} ${plural(stopped, 'работа остановлена', 'работы остановлены', 'работ остановлено')}.`);
  return sentences.join(' ');
}

function recipientName(roleId               , names                     , approver        )                {
  if (!roleId) return null;
  if (roleId === 'approval_queue' || roleId === '__human') return approver;
  return names.get(roleId) ?? roleId;
}

function taskTitle(task                   )                {
  return task?.title?.trim() || null;
}

function stateLabel(agent             )         {
  return agent.stateLabel?.trim() || STATE_LABEL[agent.state];
}

function isEnabled(agent             )          {
  return agent.enabled ?? agent.state !== 'disabled';
}

export function agentNote(agent             , names                     , approver        , app     )              {
  const next = agent.task ? recipientName(agent.nextRecipient, names, approver) : null;
  const handoffTo = recipientName(agent.lastHandoff?.to ?? null, names, approver);
  const lastAt = agent.lastAt ?? agent.lastHandoff?.createdAt ?? null;
  const detailRepeatsState = agent.detail.trim().toLocaleLowerCase('ru') === stateLabel(agent).trim().toLocaleLowerCase('ru');
  const def = (app.catalog ?? []).find((d     ) => d.id === agent.roleId);
  const who = soulIntro(def?.soul);
  return h('section', {
    class: `team-studio__agent-note state-${agent.state}`,
    'aria-label': `Сведения: ${agent.name}`,
  },
  h('div', { class: 'team-studio__note-heading' },
    h('div', null, h('h2', null, AGENT_NAME[agent.roleId] ? `${AGENT_NAME[agent.roleId]} — ${agent.name}` : agent.name), h('p', { class: 'team-studio__note-purpose' }, SHORT_PURPOSE[agent.roleId] ?? agent.purpose)),
    h('strong', { class: 'team-studio__note-state' }, stateLabel(agent))),
  detailRepeatsState ? null : h('p', { class: 'team-studio__note-detail' }, agent.detail),
  def?.allowedTools?.length ? h('p', { class: 'team-studio__note-skills' },
    h('span', null, 'Навыки и инструменты: '),
    ...def.allowedTools.map((t        ) => h('code', { class: 'skill-tag' }, t))) : null,
  def?.forbidden?.length ? h('p', { class: 'team-studio__note-skills team-studio__note-forbidden' },
    h('span', null, 'Никогда не делает: '), def.forbidden.slice(0, 2).join('; ')) : null,
  who ? h('p', { class: 'team-studio__who' }, h('span', null, 'Кто я (из инструкции роли): '), `«${who}»`) : null,
  h('div', { class: 'team-studio__note-actions' },
    h('button', { type: 'button', class: 'btn sm', onClick: () => app.go('agents', { agent: agent.roleId, tab: 'instructions', technical: '1' }) }, 'Полная инструкция роли'),
    h('span', { class: 'team-studio__note-hint' }, `agents/${agent.roleId}/SOUL.md и RULES.md — это и есть промт роли; модели пока не подключены`)),
  taskTitle(agent.task) ? h('p', { class: 'team-studio__note-task' }, h('span', null, 'Материал'), h('b', null, taskTitle(agent.task) )) : null,
  next ? h('p', { class: 'team-studio__note-next' }, h('span', null, 'После завершения передаст'), h('b', null, next)) : null,
  agent.lastHandoff ? h('p', { class: 'team-studio__note-last' },
    h('span', null, `Последняя передача: ${agent.name} → ${handoffTo ?? 'дальше'}`),
    h('b', null, agent.lastHandoff.summary),
    h('time', { dateTime: lastAt ?? '' }, fmtDate(lastAt))) : lastAt ? h('p', { class: 'team-studio__note-last' },
      h('span', null, 'Последнее действие'), h('time', { dateTime: lastAt }, fmtDate(lastAt))) : null,
  agent.state === 'error' ? h('p', { class: 'team-studio__note-error', role: 'alert' }, agent.error ?? agent.detail) : null);
}

function reviewTray(app     , reviews                , approver        )              {
  const visible = reviews.slice(0, 3);
  const sheets = visible.map((review, index) => {
    const sheet = h('button', {
      type: 'button',
      class: 'team-studio__review-sheet',
      'aria-label': `Открыть материал «${review.title}», ждёт решения с ${fmtDate(review.updatedAt)}`,
      onClick: () => app.go('approvals', { filter: 'pending', artifact: review.artifactId }),
    }, h('span', null, review.title), h('time', { dateTime: review.updatedAt }, fmtDate(review.updatedAt)));
    sheet.style.setProperty('--review-index', String(index));
    return sheet;
  });
  const tray = h('section', {
    class: `team-studio__approval-tray${reviews.length ? ' has-reviews' : ''}`,
    dataset: { teamRole: 'approval_queue' },
    'aria-label': reviews.length
      ? `${reviews.length} ${plural(reviews.length, 'материал ждёт', 'материала ждут', 'материалов ждут')} решения. Согласующая: ${approver}`
      : `${approver}: ничего не ждёт решения`,
  },
  h('div', { class: 'team-studio__approver' },
    h('span', { class: 'team-studio__approver-mark', 'aria-hidden': 'true' }, portrait(approver, 'human', 'none', { long: true })),
    h('div', null, h('b', null, approver), h('span', null, 'принимает все решения по проекту'), h('span', { class: 'team-studio__approver-hint' }, 'Утверждать, возвращать, публиковать и снимать блокировки может только человек — агенты этого не делают'))),
  h('div', { class: 'team-studio__review-stack' },
    ...sheets,
    reviews.length > visible.length ? h('span', { class: 'team-studio__review-more' }, `ещё ${reviews.length - visible.length}`) : null),
  reviews.length ? h('button', {
    type: 'button',
    class: 'btn human team-studio__review-action',
    onClick: () => app.go('approvals', { filter: 'pending', artifact: reviews[0].artifactId }),
  }, `Открыть ${reviews.length} ${plural(reviews.length, 'решение', 'решения', 'решений')}`) : h('span', { class: 'team-studio__review-empty' }, 'Ничего не ждёт решения'));
  return tray;
}

function stationButton(agent             , selected         , select                          )                    {
  const stateClass = isEnabled(agent) ? `state-${agent.state}` : 'state-disabled';
  const button = h('button', {
    type: 'button',
    class: `team-studio__station team-${agent.team} ${stateClass}${selected ? ' is-selected' : ''}`,
    dataset: { teamRole: agent.roleId, state: agent.state },
    'aria-pressed': selected,
    'aria-label': `${agent.name}. ${stateLabel(agent)}. ${agent.detail}`,
    onClick: () => select(agent.roleId),
    onFocus: () => select(agent.roleId),
  },
  portrait(agent.roleId, agent.team, ACCESSORY[agent.roleId] ?? 'none'),
  h('span', { class: 'team-studio__station-copy' },
    h('b', { class: 'team-studio__station-name' }, AGENT_NAME[agent.roleId] ? `${AGENT_NAME[agent.roleId]}` : agent.name),
    h('span', { class: 'team-studio__station-job' }, agent.name),
    h('span', { class: 'team-studio__station-purpose' }, SHORT_PURPOSE[agent.roleId] ?? agent.purpose),
    h('span', { class: 'team-studio__station-state' }, h('i', { class: 'dot', 'aria-hidden': 'true' }), stateLabel(agent))))                     ;
  return button;
}

export function howItWorks(approver        )              {
  return h('ol', { class: 'team-studio__how', 'aria-label': 'Как это работает' },
    h('li', { class: 'human' }, 'Вы ставите задачу'),
    h('li', null, 'Маркетинг-директор назначает, кто её делает'),
    h('li', null, 'Команда готовит материал'),
    h('li', null, 'Проверка ищет ошибки и обещания'),
    h('li', { class: 'human' }, `${approver} утверждает или возвращает`),
    h('li', null, 'Публикация — только после утверждения'));
}

function newestReplayTasks(state     )               {
  return [...(state?.tasks ?? [])]
    .filter((task     ) => !task.archived && Array.isArray(task.handoffs) && task.handoffs.length > 0)
    .sort((a     , b     ) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
    .map((task     ) => ({ id: task.id, title: task.title, updatedAt: task.updatedAt, handoffs: task.handoffs }));
}

function centerInScene(target         , scene             )                           {
  const sceneRect = scene.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if ((target               ).dataset.teamRole === 'approval_queue') {
    // Точка «у человека» — метка согласующей, а не угол лотка: так лист не ложится на текст.
    const mark = target.querySelector('.team-studio__approver-mark');
    const markRect = mark ? mark.getBoundingClientRect() : targetRect;
    return {
      x: markRect.left - sceneRect.left + markRect.width / 2,
      y: markRect.top - sceneRect.top + markRect.height / 2,
    };
  }
  return {
    x: targetRect.left - sceneRect.left + targetRect.width / 2,
    y: targetRect.top - sceneRect.top + targetRect.height / 2,
  };
}

function setTokenPosition(token             , point                          , animate         )       {
  token.style.transition = animate ? 'transform 560ms cubic-bezier(.22,.68,.25,1)' : 'none';
  token.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
}

function waitForTransition(el             )                {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
      resolve();
    };
    const onEnd = (event                 ) => { if (event.target === el && event.propertyName === 'transform') finish(); };
    const fallback = window.setTimeout(finish, 720);
    el.addEventListener('transitionend', onEnd);
  });
}

function clearReplayStations(scene             )       {
  for (const el of scene.querySelectorAll('.is-replay-from, .is-replay-to')) {
    el.classList.remove('is-replay-from', 'is-replay-to');
  }
}

function replayName(roleId        , names                     , approver        )         {
  return recipientName(roleId, names, approver) ?? roleId;
}

function updateReplayLine(line                , from                          , to                          )       {
  line.setAttribute('x1', String(from.x));
  line.setAttribute('y1', String(from.y));
  line.setAttribute('x2', String(to.x));
  line.setAttribute('y2', String(to.y));
}

function latestCaption(handoff                      , names                     , approver        )              {
  if (!handoff) return h('p', { class: 'team-studio__latest' }, 'Передач в журнале пока нет.');
  return h('p', { class: 'team-studio__latest' },
    h('time', { dateTime: handoff.createdAt }, fmtDate(handoff.createdAt)),
    h('span', { 'aria-hidden': 'true' }, ' · '),
    h('b', null, `${replayName(handoff.from, names, approver)} → ${replayName(handoff.to, names, approver)}`),
    h('span', { 'aria-hidden': 'true' }, ' · '), handoff.summary);
}

export function teamStudio(app     )              {
  const projection = buildTeamActivity(app.state, app.catalog, app.activeStep)                  ;
  const approver = app.state?.project?.approvers?.[0] ?? 'Согласующий';
  const names = new Map(projection.agents.map((agent) => [agent.roleId, agent.name]));
  const replayTasks = newestReplayTasks(app.state);
  let selectedTaskId = replayTasks.some((task) => task.id === app.sel.task) ? app.sel.task  : replayTasks[0]?.id ?? '';
  let selectedAgentId = projection.agents.some((agent) => agent.roleId === app.sel.agent)
    ? app.sel.agent 
    : projection.agents.find((agent) => agent.state === 'working' || agent.state === 'error' || agent.state === 'blocked' || agent.state === 'received')?.roleId
      ?? (projection.latestHandoff?.to === 'approval_queue' ? projection.latestHandoff.from : undefined)
      ?? projection.agents.find((agent) => isEnabled(agent))?.roleId
      ?? projection.agents[0]?.roleId
      ?? '';
  let replayGeneration = 0;

  const heading = h('div', { class: 'team-studio__heading' },
    h('h1', null, 'Офис'),
    h('p', { class: 'team-studio__summary' }, honestSummary(projection, approver)),
    howItWorks(approver));

  const taskSelect = h('select', {
    class: 'team-studio__task-select',
    'aria-label': 'Материал для показа пути',
    disabled: replayTasks.length === 0,
    onChange: (event       ) => { selectedTaskId = (event.target                     ).value; },
  }, ...(replayTasks.length ? replayTasks.map((task) => h('option', {
    value: task.id,
    selected: task.id === selectedTaskId,
  }, task.title)) : [h('option', { value: '' }, 'Передач пока нет')]))                     ;

  const replayStatus = h('span', {
    class: 'team-studio__replay-status',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
    hidden: true,
  })                   ;

  const replayButton = h('button', {
    type: 'button',
    class: 'btn team-studio__replay-button',
    disabled: replayTasks.length === 0,
  }, 'Показать путь')                     ;

  const controls = h('div', { class: 'team-studio__controls' },
    h('label', { class: 'team-studio__task-field' }, h('span', null, 'Материал для пути'), taskSelect),
    replayButton,
    replayStatus);

  const noteHost = h('div', {
    class: 'team-studio__note-host',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });

  const scene = h('div', {
    class: 'team-studio__scene',
    role: 'group',
    'aria-label': 'Редакционная мастерская. Выберите участника, чтобы прочитать подробности.',
  });

  const routeSvg = svgElement('svg', {
    class: 'team-studio__replay-line',
    width: '100%',
    height: '100%',
    'aria-hidden': 'true',
    preserveAspectRatio: 'none',
  })                 ;
  const routeLine = svgElement('line', { x1: '0', y1: '0', x2: '0', y2: '0' })                  ;
  routeSvg.appendChild(routeLine);
  scene.appendChild(routeSvg                   );

  const lastRouteSvg = svgElement('svg', {
    class: 'team-studio__last-line',
    width: '100%',
    height: '100%',
    'aria-hidden': 'true',
    preserveAspectRatio: 'none',
  })                 ;
  const lastRouteLine = svgElement('line', { x1: '0', y1: '0', x2: '0', y2: '0' })                  ;
  lastRouteSvg.appendChild(lastRouteLine);
  scene.appendChild(lastRouteSvg                   );

  const stationByRole = new Map                           ();
  const selectAgent = (roleId        ) => {
    const agent = projection.agents.find((candidate) => candidate.roleId === roleId);
    if (!agent) return;
    selectedAgentId = roleId;
    app.sel.agent = roleId;
    for (const [id, station] of stationByRole) {
      const selected = id === roleId;
      station.classList.toggle('is-selected', selected);
      station.setAttribute('aria-pressed', String(selected));
    }
    noteHost.replaceChildren(agentNote(agent, names, approver, app));
  };

  const byVisualOrder = [...projection.agents].sort((a, b) => ROLE_VISUAL_ORDER.indexOf(a.roleId) - ROLE_VISUAL_ORDER.indexOf(b.roleId));
  for (const agent of byVisualOrder) stationByRole.set(agent.roleId, stationButton(agent, agent.roleId === selectedAgentId, selectAgent));

  // Ярус 1 — согласующая проекта (человек), ярус 2 — Маркетинг-директор, ярус 3 — команды.
  const tray = reviewTray(app, projection.reviews, approver);
  const tierHuman = h('div', { class: 'team-studio__tier team-studio__tier--human' }, h('div', { class: 'team-studio__tier-label' }, 'Решает'), tray);
  const director = stationByRole.get('marketing-director');
  const tierDirector = h('div', { class: 'team-studio__tier team-studio__tier--director' }, h('div', { class: 'team-studio__tier-label' }, 'Руководит работой агентов'),
    director ?? h('div', { class: 'team-studio__missing' }, 'Маркетинг-директор не включён в проект'));
  const groups = h('div', { class: 'team-studio__groups' }, ...TEAM_ORDER.map((teamId) => {
    const members = byVisualOrder.filter((agent) => agent.team === teamId && agent.roleId !== 'marketing-director');
    if (!members.length) return null;
    return h('section', { class: `team-studio__group team-${teamId}`, 'aria-label': TEAM_TITLE[teamId] ?? teamId },
      h('div', { class: 'team-studio__group-title' }, TEAM_TITLE[teamId] ?? teamId),
      h('div', { class: 'team-studio__group-hint' }, TEAM_HINT[teamId] ?? ''),
      h('div', { class: 'team-studio__group-body' }, ...members.map((agent) => stationByRole.get(agent.roleId) )));
  }));
  const tierTeams = h('div', { class: 'team-studio__tier team-studio__tier--teams' }, h('div', { class: 'team-studio__tier-label' }, 'Команды агентов'), groups);
  scene.append(tierHuman, tierDirector, tierTeams, noteHost);
  const lastToken = h('span', {
    class: 'team-studio__last-token',
    title: 'Последняя сохранённая передача, не текущая работа',
    'aria-hidden': 'true',
    hidden: true,
  });
  scene.appendChild(lastToken);
  const token = h('span', {
    class: 'team-studio__document-token',
    'aria-hidden': 'true',
    hidden: true,
  }, h('span', null, ''));
  scene.appendChild(token);

  const initialAgent = projection.agents.find((agent) => agent.roleId === selectedAgentId);
  if (initialAgent) noteHost.appendChild(agentNote(initialAgent, names, approver, app));

  const root = h('section', { class: 'team-studio team-studio--tiers team-studio--cards' },
    h('header', { class: 'team-studio__header' }, heading, controls),
    scene,
    latestCaption(projection.latestHandoff, names, approver));

  if (projection.latestHandoff) {
    let lastRouteObserver                        = null;
    const positionLastRoute = () => {
      if (!root.isConnected || !projection.latestHandoff) {
        lastRouteObserver?.disconnect();
        return;
      }
      const fromTarget = scene.querySelector(`[data-team-role="${projection.latestHandoff.from}"]`);
      const toTarget = scene.querySelector(`[data-team-role="${projection.latestHandoff.to}"]`);
      if (!fromTarget || !toTarget) return;
      const from = centerInScene(fromTarget, scene);
      const to = centerInScene(toTarget, scene);
      updateReplayLine(lastRouteLine, from, to);
      lastToken.style.left = `${to.x}px`;
      lastToken.style.top = `${to.y}px`;
      lastToken.hidden = false;
      root.classList.add('has-last-route');
    };
    window.requestAnimationFrame(positionLastRoute);
    if (typeof ResizeObserver !== 'undefined') {
      lastRouteObserver = new ResizeObserver(positionLastRoute);
      lastRouteObserver.observe(scene);
    }
  }

  replayButton.addEventListener('click', async () => {
    const task = replayTasks.find((candidate) => candidate.id === selectedTaskId);
    if (!task?.handoffs.length) return;
    const generation = ++replayGeneration;
    const reduced = reduceMotion();
    replayButton.disabled = true;
    taskSelect.disabled = true;
    root.classList.add('is-replaying');
    root.setAttribute('aria-busy', 'true');
    replayStatus.hidden = false;
    replayStatus.textContent = 'Повтор журнала, не сейчас';
    token.hidden = false;

    try {
      const steps = reduced ? [task.handoffs[task.handoffs.length - 1]] : task.handoffs;
      for (const handoff of steps) {
        if (!root.isConnected || generation !== replayGeneration) break;
        const fromTarget = scene.querySelector(`[data-team-role="${handoff.from}"]`);
        const toTarget = scene.querySelector(`[data-team-role="${handoff.to}"]`);
        if (!fromTarget || !toTarget) continue;
        clearReplayStations(scene);
        fromTarget.classList.add('is-replay-from');
        toTarget.classList.add('is-replay-to');
        const from = centerInScene(fromTarget, scene);
        const to = centerInScene(toTarget, scene);
        updateReplayLine(routeLine, from, to);
        replayStatus.textContent = `Повтор журнала, не сейчас · ${replayName(handoff.from, names, approver)} → ${replayName(handoff.to, names, approver)} · ${fmtDate(handoff.createdAt)} · ${handoff.summary}`;
        if (reduced) {
          setTokenPosition(token, to, false);
          continue;
        }
        setTokenPosition(token, from, false);
        // Синхронное измерение отделяет начальную точку от CSS-перехода к получателю.
        void token.offsetWidth;
        setTokenPosition(token, to, true);
        await waitForTransition(token);
      }
      if (root.isConnected && generation === replayGeneration) {
        replayStatus.textContent = reduced
          ? `Повтор журнала, не сейчас · маршрут показан без движения · передач: ${task.handoffs.length}`
          : 'Повтор журнала, не сейчас · путь завершён';
      }
    } finally {
      if (root.isConnected && generation === replayGeneration) {
        root.classList.remove('is-replaying');
        root.setAttribute('aria-busy', 'false');
        replayButton.disabled = false;
        taskSelect.disabled = false;
        // Лист-токен — только на время повтора; итог остаётся в строке статуса и подписи последней передачи.
        token.hidden = true;
        clearReplayStations(scene);
      }
    }
  });

  return root;
}

export const renderTeamStudio = teamStudio;
