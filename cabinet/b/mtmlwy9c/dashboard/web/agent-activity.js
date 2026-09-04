             
                  
               
               
                
               
         
       
             
           
         
                          

                                                                                                
                                                                                                                        

export const TEAM_AGENT_STATE_LABELS                                              = {
  disabled: 'Не включён',
  error: 'Ошибка',
  blocked: 'Остановлен',
  working: 'Работает',
  received: 'Материал получен',
  idle: 'Свободен',
};

                               
                 
                 
  

                                
             
                
                 
                     
                    
                     
                  
                               
  

                                   
             
                 
                    
               
                                
                        
                  
                               
                                
                    
  

                                 
             
                 
               
                  
               
                   
                        
                                  
                       
                                
                                          
                                                  
                 
                        
  

                          
             
                     
                 
                    
                
                       
                  
                    
                                
  

                                                                

                                      
                              
                        
                                            
                             
  

                                                                                              
                                                                                                    

                                                          
                          
                    
             
                                
                                       
  

function catalogDefinitions(catalog                     )                    {
  const definitions = Array.isArray(catalog)
    ? [...catalog]                     
    : [...(catalog                                        ).values()];
  const seen = new Set        ();
  return definitions.filter((definition) => {
    if (seen.has(definition.id)) return false;
    seen.add(definition.id);
    return true;
  });
}

function timeValue(value                           )         {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function compareText(a        , b        )         {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareHandoffs(a              , b              )         {
  const byTime = timeValue(a.handoff.createdAt) - timeValue(b.handoff.createdAt);
  if (byTime) return byTime;
  const byId = compareText(a.handoff.id, b.handoff.id);
  return byId || compareText(a.task.id, b.task.id);
}

function latestEntry(entries                         )                      {
  let latest                      = null;
  for (const entry of entries) if (!latest || compareHandoffs(entry, latest) > 0) latest = entry;
  return latest;
}

function latestCandidate(candidates                              )                           {
  let latest                           = null;
  for (const candidate of candidates) {
    if (!latest) { latest = candidate; continue; }
    const byTime = timeValue(candidate.at) - timeValue(latest.at);
    if (byTime > 0) { latest = candidate; continue; }
    if (byTime === 0 && compareText(candidate.task?.id ?? '', latest.task?.id ?? '') > 0) latest = candidate;
  }
  return latest;
}

function cloneTask(task                         )                          {
  if (!task) return null;
  return {
    id: task.id,
    title: task.title,
    kind: task.kind,
    column: task.column,
    stepIndex: task.stepIndex,
    totalSteps: task.route.length,
    route: [...task.route],
    blockedReason: task.blockedReason,
  };
}

function cloneHandoff(entry                     )                             {
  if (!entry) return null;
  const handoff = entry.handoff;
  return {
    id: handoff.id,
    taskId: handoff.taskId,
    taskTitle: entry.task.title,
    from: handoff.from,
    to: handoff.to,
    status: handoff.status,
    summary: handoff.summary,
    deliverableId: handoff.deliverableId,
    deliverableKind: handoff.deliverableKind,
    createdAt: handoff.createdAt,
  };
}

function newestTime(values                               )                {
  let latest                = null;
  for (const value of values) {
    if (!value) continue;
    const byTime = timeValue(value) - timeValue(latest);
    if (latest === null || byTime > 0 || (byTime === 0 && value > latest)) latest = value;
  }
  return latest;
}

function nextOnRoute(task             , roleId        )                                   {
  if (!task) return null;
  let index = task.route[task.stepIndex] === roleId ? task.stepIndex : task.route.indexOf(roleId, Math.max(0, task.stepIndex));
  if (index < 0 && roleId === 'marketing-director') return task.route[task.stepIndex] ?? task.route[0] ?? null;
  if (index < 0) return null;
  return index + 1 < task.route.length ? task.route[index + 1] : 'approval_queue';
}

function taskAwaitsRole(task                         , roleId        )               {
  if (!task || task.archived || task.blockedReason || task.stepIndex >= task.route.length) return false;
  if (task.column !== 'planned' && task.column !== 'in_progress' && task.column !== 'quality_control') return false;
  return task.route[task.stepIndex] === roleId;
}

/**
 * Builds a read-only UI projection from factual project data. It deliberately
 * ignores `busyUntil` as proof of work: ordinary mock steps set it after the
 * synchronous work has already finished. Browser `activeStep` and a publisher
 * run (`working` + task id + null busyUntil) are the only live-work signals.
 */
export function buildTeamActivity(
  state                   ,
  catalog                     ,
  activeStep                         = null,
)                         {
  const definitions = catalogDefinitions(catalog);
  const tasksById = new Map(state.tasks.map((task) => [task.id, task]));
  const artifactsById = new Map(state.artifacts.map((artifact) => [artifact.id, artifact]));
  const instancesByRole = new Map(state.agents.map((agent) => [agent.roleId, agent]));
  const handoffs                 = [];
  const handoffsByTask = new Map                        ();

  for (const task of state.tasks) {
    const entries = task.handoffs.map((handoff) => ({ handoff, task }));
    handoffs.push(...entries);
    handoffsByTask.set(task.id, entries);
  }

  const latestHandoffEntry = latestEntry(handoffs);
  const latestByTask = new Map                             ();
  for (const task of state.tasks) latestByTask.set(task.id, latestEntry(handoffsByTask.get(task.id) ?? []));

  const routeReceivedByRole = new Map                             ();
  for (const task of state.tasks) {
    if (task.archived || task.blockedReason || task.stepIndex >= task.route.length) continue;
    const roleId = task.route[task.stepIndex];
    if (!taskAwaitsRole(task, roleId)) continue;
    const incoming = latestByTask.get(task.id) ?? null;
    if (!incoming) continue;
    const candidates = routeReceivedByRole.get(roleId) ?? [];
    if (incoming.handoff.to === roleId) {
      candidates.push({ task, at: incoming.handoff.createdAt, incoming, kind: 'route' });
    } else if (task.column === 'in_progress' || task.column === 'quality_control') {
      // Возврат человеком, quality.return, снятие блокировки и повторная
      // проверка двигают stepIndex назад без искусственного AgentHandoff.
      candidates.push({ task, at: task.updatedAt, incoming: null, kind: 'return' });
    }
    routeReceivedByRole.set(roleId, candidates);
  }

  const publishReceived                      = [];
  for (const job of state.jobs) {
    if (job.status !== 'QUEUED') continue;
    const artifact = artifactsById.get(job.artifactId);
    publishReceived.push({
      task: artifact ? tasksById.get(artifact.taskId) ?? null : null,
      at: job.createdAt,
      incoming: null,
      kind: 'publish',
    });
  }

  const reviews = state.artifacts
    .filter((artifact) => artifact.status === 'IN_REVIEW')
    .map((artifact)             => {
      const task = tasksById.get(artifact.taskId) ?? null;
      return {
        id: artifact.id,
        artifactId: artifact.id,
        taskId: artifact.taskId,
        taskTitle: task?.title ?? artifact.title,
        title: artifact.title,
        authorRoleId: artifact.authorRoleId,
        version: artifact.version,
        updatedAt: artifact.updatedAt,
        task: cloneTask(task),
      };
    })
    .sort((a, b) => timeValue(b.updatedAt) - timeValue(a.updatedAt) || compareText(b.id, a.id));

  const counts                     = { disabled: 0, error: 0, blocked: 0, working: 0, received: 0, idle: 0 };
  const agents                      = definitions.map((definition) => {
    const instance = instancesByRole.get(definition.id);
    const outgoing = latestEntry(handoffs.filter((entry) => entry.handoff.from === definition.id));
    const blockedEntries = state.tasks
      .filter((task) => !task.archived && Boolean(task.blockedReason))
      .map((task) => ({ task, latest: latestByTask.get(task.id) ?? null }))
      .filter(({ task, latest }) => task.route[task.stepIndex] === definition.id
        || (latest?.handoff.status === 'blocked' && latest.handoff.from === definition.id));
    const blocked = blockedEntries.reduce                                        ((latest, candidate) => {
      if (!latest) return candidate;
      const candidateAt = candidate.latest?.handoff.createdAt ?? candidate.task.updatedAt;
      const latestAt = latest.latest?.handoff.createdAt ?? latest.task.updatedAt;
      const byTime = timeValue(candidateAt) - timeValue(latestAt);
      return byTime > 0 || (byTime === 0 && candidate.task.id > latest.task.id) ? candidate : latest;
    }, null);
    const activeTask = activeStep?.roleId === definition.id ? tasksById.get(activeStep.taskId) ?? null : null;
    const browserWorking = taskAwaitsRole(activeTask, definition.id);
    const serverTask = instance?.currentTaskId ? tasksById.get(instance.currentTaskId) ?? null : null;
    const serverWorking = definition.id === 'publisher-executor'
      && instance?.status === 'working'
      && instance.busyUntil === null
      && Boolean(serverTask && !serverTask.archived);
    const received = definition.id === 'publisher-executor'
      ? latestCandidate(publishReceived)
      : latestCandidate(routeReceivedByRole.get(definition.id) ?? []);

    let agentState                ;
    let task              = null;
    if (!instance || instance.status === 'disabled') {
      agentState = 'disabled';
    } else if (instance.status === 'error') {
      agentState = 'error';
      task = instance.currentTaskId ? tasksById.get(instance.currentTaskId) ?? null : null;
    } else if (browserWorking || serverWorking) {
      // Подтверждённая текущая работа важнее остановленной другой задачи роли.
      agentState = 'working';
      task = browserWorking ? activeTask : serverTask;
    } else if (blocked) {
      agentState = 'blocked';
      task = blocked.task;
    } else if (received) {
      agentState = 'received';
      task = received.task;
    } else {
      // waiting_approval describes a task at the human review desk, not agent work.
      agentState = 'idle';
    }

    let detail        ;
    if (agentState === 'disabled') detail = 'Не включён в проект';
    else if (agentState === 'error') detail = instance?.errorMessage ?? 'Ошибка выполнения';
    else if (agentState === 'blocked') detail = task?.blockedReason ?? blocked?.latest?.handoff.summary ?? 'Работа заблокирована';
    else if (agentState === 'working') detail = task ? `Работает: ${task.title}` : 'Работает';
    else if (agentState === 'received') detail = received?.kind === 'publish'
      ? (task ? `Получил публикацию: ${task.title}` : 'Получил публикацию')
      : received?.kind === 'return'
        ? (task ? `Материал возвращён: ${task.title}` : 'Материал возвращён')
        : (task ? `Получил задачу: ${task.title}` : 'Получил задачу');
    else detail = 'Свободен';

    const nextRecipient = agentState === 'blocked'
      ? null
      : (agentState === 'working' || agentState === 'received')
        ? nextOnRoute(task, definition.id)
        : outgoing?.handoff.to ?? null;
    const lastAt = newestTime([
      instance?.lastRunAt,
      outgoing?.handoff.createdAt,
      received?.at,
      blocked?.latest?.handoff.createdAt,
    ]);

    counts[agentState] += 1;
    return {
      id: definition.id,
      roleId: definition.id,
      name: definition.name,
      purpose: definition.purpose,
      team: definition.team,
      enabled: Boolean(instance && instance.status !== 'disabled'),
      state: agentState,
      stateLabel: TEAM_AGENT_STATE_LABELS[agentState],
      error: agentState === 'error' ? instance?.errorMessage ?? null
        : agentState === 'blocked' ? task?.blockedReason ?? null
          : null,
      task: cloneTask(task),
      lastHandoff: cloneHandoff(outgoing),
      nextRecipient,
      detail,
      lastAt,
    };
  });

  return { agents, reviews, latestHandoff: cloneHandoff(latestHandoffEntry), counts };
}
