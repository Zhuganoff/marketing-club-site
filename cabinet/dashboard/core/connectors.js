// Mock-коннекторы публикации. Ничего не отправляют наружу: нет импортов node:http/https/net и вызовов fetch.
// См. docs/PUBLISHING_CONTRACT.md §5.
                                                                                                                                   

                                                    

function wait(ms        )                {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockPublish(id             , options                  ) {
  return async (job            , payload                , mockMode          )                           => {
    const delay = options.delayMs ?? 900;
    switch (mockMode) {
      case 'success':
        return { ok: true, externalId: `${id}-mock-${job.id}`, publishedAt: new Date().toISOString() };
      case 'delay':
        await wait(delay * 3);
        return { ok: true, externalId: `${id}-mock-${job.id}`, publishedAt: new Date().toISOString() };
      case 'technical_failure':
        await wait(delay);
        return { ok: false, code: 'CONNECTOR_5XX', message: `mock: ${id} вернул техническую ошибку (HTTP 502, имитация)`, retryable: true };
      case 'network_error':
        await wait(delay);
        return { ok: false, code: 'NETWORK_UNREACHABLE', message: `mock: сеть недоступна — запрос к ${id} не выполнялся (имитация)`, retryable: true };
      default:
        return { ok: false, code: 'UNKNOWN_MOCK_MODE', message: `неизвестный mock-режим: ${String(mockMode)}`, retryable: false };
    }
  };
}

export function createConnectors(options                   = {})                                          {
  const make = (id             , name        , platforms            )                     => ({
    id, name, platforms, mode: 'mock', publish: mockPublish(id, options),
  });
  return {
    'wumu': make('wumu', 'WŬMÙ Office (mock)', ['vk', 'telegram', 'facebook', 'instagram', 'tiktok']),
    'postu': make('postu', 'Postu (mock)', ['vk', 'telegram', 'facebook', 'instagram']),
    'native-vk': make('native-vk', 'VK API (mock)', ['vk']),
    'meta': make('meta', 'Meta Graph API (mock)', ['facebook', 'instagram']),
    'tiktok': make('tiktok', 'TikTok Content API (mock)', ['tiktok']),
  };
}

export const MOCK_MODES             = ['success', 'delay', 'technical_failure', 'network_error'];
