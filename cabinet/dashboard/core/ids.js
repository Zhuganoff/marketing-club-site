                                               

                                      
export const systemClock        = { now: () => new Date().toISOString() };

export function nextId(state              , prefix        )         {
  const n = (state.counters[prefix] ?? 0) + 1;
  state.counters[prefix] = n;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

export function taskId(state              , dateIso        )         {
  const day = dateIso.slice(0, 10);
  const key = `task-${day}`;
  const n = (state.counters[key] ?? 0) + 1;
  state.counters[key] = n;
  return `${state.project.id}-${day}-${String(n).padStart(3, '0')}`;
}
