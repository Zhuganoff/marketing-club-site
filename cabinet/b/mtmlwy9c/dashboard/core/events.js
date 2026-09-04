                                                                               
import { nextId } from './ids.js?v=mtmlwy9c';

export function pushEvent(
  state              ,
  ts        ,
  actor       ,
  type        ,
  message        ,
  refs                        = {},
  level           = 'info',
)                {
  const ev                = { id: nextId(state, 'ev'), projectId: state.project.id, ts, actor, level, type, message, refs };
  state.events.unshift(ev);
  if (state.events.length > 500) state.events.length = 500;
  return ev;
}
