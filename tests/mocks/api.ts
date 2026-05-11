import { vi } from 'vitest';

export function mockFetch(response?: unknown, status = 200) {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    blob: () => Promise.resolve(new Blob()),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

export function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>) {
  let callCount = 0;
  const mock = vi.fn().mockImplementation(() => {
    const res = responses[callCount++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: (res.status ?? 200) >= 200 && (res.status ?? 200) < 300,
      status: res.status ?? 200,
      json: () => Promise.resolve(res.body),
      blob: () => Promise.resolve(new Blob()),
      text: () => Promise.resolve(JSON.stringify(res.body)),
    });
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

export function resetFetch() {
  vi.unstubAllGlobals();
}
