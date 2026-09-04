// Настоящий писатель (решение владельца 2026-09-04): главный редактор Лена пишет тексты
// моделью через OfoxAI. Промт собирается из профиля проекта, брифа исследователя и правил
// честности; ядро получает готовый текст и остаётся без сети.
                                                                           
import { generateText, parseModelJson } from './llm.js?v=mtmlkoru';

const MAX_RETURN_NOTE = 300;

export async function draftWithModel(state              , task      )                                 {
  const editor = state.agents.find((a) => a.roleId === 'chief-editor');
  const model = editor?.model;
  if (!model) return null;
  const p = state.project;
  const research = [...task.handoffs].reverse().find((h) => h.from === 'market-researcher');
  const facts = (research?.facts ?? []).slice(0, 6).map((f) => `- ${f.text}${f.source ? ` (источник: ${f.source})` : ''}`).join('\n');
  const returnNote = task.returnNotes.at(-1)?.slice(0, MAX_RETURN_NOTE);
  const lang = p.language === 'en' ? 'английском' : 'русском';

  const system = [
    `Ты — Лена, главный редактор маркетингового проекта «${p.name}». Пишешь на ${lang} языке.`,
    `Аудитория: ${p.audience || 'не задана — пиши для обычных клиентов проекта'}.`,
    p.geography ? `География: ${p.geography}.` : '',
    p.brand?.tone ? `Тон: ${p.brand.tone}.` : 'Тон: дружелюбно и по делу, без давления.',
    p.brand?.forbiddenPhrases?.length ? `Запрещённые формулировки (никогда не используй): ${p.brand.forbiddenPhrases.join('; ')}.` : '',
    'Жёсткие правила честности:',
    '- никаких категорических обещаний результата («гарантируем», «100%», «самый лучший»);',
    '- никаких выдуманных фактов, цифр и отзывов — используй только факты из брифа;',
    '- никаких персональных данных (имена клиентов, телефоны);',
    '- каждый значимый факт должен опираться на бриф.',
    'Ответь СТРОГО одним JSON-объектом без пояснений: {"body": "текст поста с абзацами", "cta": "короткий призыв к действию", "hashtags": ["#тег1", "#тег2"]}.',
  ].filter(Boolean).join('\n');

  const user = [
    `Напиши ${task.kind === 'seo_page' ? 'текст SEO-страницы' : task.kind === 'reels' ? 'сценарную основу для короткого видео' : 'пост для соцсетей'} на тему: «${task.title}».`,
    task.goal && task.goal !== task.title ? `Пожелание владельца: ${task.goal}.` : '',
    facts ? `Факты из брифа исследователя:\n${facts}` : 'Брифа с фактами нет — пиши сдержанно, без конкретных цифр.',
    returnNote ? `Материал вернули на доработку с замечанием: ${returnNote}. Обязательно учти его.` : '',
    'Объём: 400–900 знаков, короткие абзацы, без канцелярита.',
  ].filter(Boolean).join('\n\n');

  const out = await generateText(model, system, user, 1600);
  const parsed = parseModelJson(out.text);
  const body = typeof parsed?.body === 'string' && parsed.body.trim() ? parsed.body.trim() : out.text.trim();
  if (!body) return null;
  return {
    body,
    cta: typeof parsed?.cta === 'string' ? parsed.cta.trim() : undefined,
    hashtags: Array.isArray(parsed?.hashtags) ? parsed.hashtags.filter((x     ) => typeof x === 'string').slice(0, 6) : undefined,
    costUsd: out.costUsd,
    model: out.model,
  };
}
