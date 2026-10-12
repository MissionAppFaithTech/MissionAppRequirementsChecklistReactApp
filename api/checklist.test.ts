import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mergeTimestampedStates, type TimestampedChecklistState } from '../src/lib/checklist';

const kvMock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('@vercel/kv', () => ({ kv: kvMock }));

import handler from './checklist';

type FakeRes = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  ended: boolean;
  setHeader: (key: string, value: string) => FakeRes;
  status: (code: number) => FakeRes;
  json: (body: unknown) => FakeRes;
  end: () => FakeRes;
};

const makeRes = (): FakeRes => {
  const res: FakeRes = {
    statusCode: 0,
    body: undefined,
    headers: {},
    ended: false,
    setHeader: (key, value) => { res.headers[key] = value; return res; },
    status: (code) => { res.statusCode = code; return res; },
    json: (body) => { res.body = body; return res; },
    end: () => { res.ended = true; return res; },
  };
  return res;
};

const call = async (method: string, body?: unknown) => {
  const res = makeRes();
  await handler({ method, body } as unknown as VercelRequest, res as unknown as VercelResponse);
  return res;
};

const item = (value: boolean, timestamp: number) => ({ value, timestamp });

const configureKv = () => {
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
};

beforeEach(() => {
  kvMock.get.mockReset();
  kvMock.set.mockReset();
  for (const name of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
    vi.stubEnv(name, '');
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('CORS and routing', () => {
  it('answers OPTIONS with 200 and CORS headers, without touching the store', async () => {
    const res = await call('OPTIONS');
    expect(res.statusCode).toBe(200);
    expect(res.ended).toBe(true);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    expect(res.headers['Access-Control-Allow-Headers']).toBe('Content-Type');
    expect(kvMock.get).not.toHaveBeenCalled();
  });

  it.each(['PUT', 'DELETE', 'PATCH'])('rejects %s with 405', async (method) => {
    configureKv();
    const res = await call(method);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });
});

describe('KV configuration detection', () => {
  it('GET without env vars returns an empty state plus a warning (status 200)', async () => {
    const res = await call('GET');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ back: {}, full: {}, warning: 'Vercel KV not configured' });
    expect(kvMock.get).not.toHaveBeenCalled();
  });

  it('POST without env vars returns the warning and writes nothing', async () => {
    const res = await call('POST', { updates: [{ id: 'a', type: 'back', value: true, timestamp: 1 }] });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ back: {}, full: {}, warning: 'Vercel KV not configured' });
    expect(kvMock.set).not.toHaveBeenCalled();
  });

  it('is not configured with only a URL, or only a token', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
    expect((await call('GET')).body).toMatchObject({ warning: 'Vercel KV not configured' });
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', 'token');
    expect((await call('GET')).body).toMatchObject({ warning: 'Vercel KV not configured' });
  });

  it('accepts the UPSTASH_REDIS_REST_* variables', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://up.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    kvMock.get.mockResolvedValue({ back: {}, full: {} });
    const res = await call('GET');
    expect(kvMock.get).toHaveBeenCalled();
    expect(res.body).toEqual({ back: {}, full: {} });
  });

  it('accepts a URL from one provider and a token from the other (documents the loose check)', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'token');
    kvMock.get.mockResolvedValue(null);
    await call('GET');
    expect(kvMock.get).toHaveBeenCalled();
  });
});

describe('GET', () => {
  beforeEach(configureKv);

  it('returns the stored state under the versioned key', async () => {
    const state = { back: { a: item(true, 1) }, full: { b: item(false, 2) } };
    kvMock.get.mockResolvedValue(state);
    const res = await call('GET');
    expect(kvMock.get).toHaveBeenCalledWith('mission-app:checklist-state:v1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(state);
  });

  it('returns an empty state when nothing is stored yet', async () => {
    kvMock.get.mockResolvedValue(null);
    expect((await call('GET')).body).toEqual({ back: {}, full: {} });
  });

  it('returns 500 when the store fails', async () => {
    kvMock.get.mockRejectedValue(new Error('kv down'));
    const res = await call('GET');
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch checklist state' });
  });
});

describe('POST reset', () => {
  beforeEach(configureKv);

  it('overwrites the store with an empty state and returns it', async () => {
    const res = await call('POST', { reset: true });
    expect(kvMock.set).toHaveBeenCalledWith('mission-app:checklist-state:v1', { back: {}, full: {} });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ back: {}, full: {} });
  });

  it('takes precedence over updates sent in the same body', async () => {
    await call('POST', { reset: true, updates: [{ id: 'a', type: 'back', value: true, timestamp: 1 }] });
    expect(kvMock.set).toHaveBeenCalledTimes(1);
    expect(kvMock.set).toHaveBeenCalledWith('mission-app:checklist-state:v1', { back: {}, full: {} });
  });

  it('returns 500 when the store fails', async () => {
    kvMock.set.mockRejectedValue(new Error('kv down'));
    expect((await call('POST', { reset: true })).statusCode).toBe(500);
  });
});

describe('POST updates — validation', () => {
  beforeEach(configureKv);

  it.each([
    ['no body', undefined],
    ['an empty body', {}],
    ['updates that are not an array', { updates: 'nope' }],
    ['updates as an object', { updates: { id: 'a' } }],
    ['updates as null', { updates: null }],
    ['reset: false and no updates', { reset: false }],
  ])('returns 400 for %s and writes nothing', async (_name, body) => {
    const res = await call('POST', body);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid updates payload' });
    expect(kvMock.set).not.toHaveBeenCalled();
  });

  it('accepts an empty updates array and echoes the current state', async () => {
    kvMock.get.mockResolvedValue({ back: { a: item(true, 1) }, full: {} });
    const res = await call('POST', { updates: [] });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ back: { a: item(true, 1) }, full: {} });
  });
});

describe('POST updates — latest timestamp wins', () => {
  beforeEach(configureKv);

  const post = async (current: unknown, updates: unknown[]) => {
    kvMock.get.mockResolvedValue(current);
    const res = await call('POST', { updates });
    return res;
  };

  it('inserts an item that does not exist yet', async () => {
    const res = await post({ back: {}, full: {} }, [{ id: 'a', type: 'back', value: true, timestamp: 5 }]);
    expect(res.body).toEqual({ back: { a: item(true, 5) }, full: {} });
  });

  it('routes back and full updates to their own list', async () => {
    const res = await post(null, [
      { id: 'a', type: 'back', value: true, timestamp: 5 },
      { id: 'a', type: 'full', value: true, timestamp: 6 },
    ]);
    expect(res.body).toEqual({ back: { a: item(true, 5) }, full: { a: item(true, 6) } });
  });

  it('replaces an older value', async () => {
    const res = await post({ back: { a: item(true, 5) }, full: {} }, [{ id: 'a', type: 'back', value: false, timestamp: 6 }]);
    expect(res.body).toEqual({ back: { a: item(false, 6) }, full: {} });
  });

  it('ignores an older update', async () => {
    const res = await post({ back: { a: item(true, 5) }, full: {} }, [{ id: 'a', type: 'back', value: false, timestamp: 4 }]);
    expect(res.body).toEqual({ back: { a: item(true, 5) }, full: {} });
  });

  it('ignores an update with an EQUAL timestamp (first writer wins on ties)', async () => {
    const res = await post({ back: { a: item(true, 5) }, full: {} }, [{ id: 'a', type: 'back', value: false, timestamp: 5 }]);
    expect(res.body).toEqual({ back: { a: item(true, 5) }, full: {} });
  });

  it('inside one batch the highest timestamp wins regardless of order', async () => {
    const forward = await post(null, [
      { id: 'a', type: 'back', value: false, timestamp: 3 },
      { id: 'a', type: 'back', value: true, timestamp: 5 },
    ]);
    const backward = await post(null, [
      { id: 'a', type: 'back', value: true, timestamp: 5 },
      { id: 'a', type: 'back', value: false, timestamp: 3 },
    ]);
    expect(forward.body).toEqual({ back: { a: item(true, 5) }, full: {} });
    expect(backward.body).toEqual({ back: { a: item(true, 5) }, full: {} });
  });

  it('copes with a stored state that lacks one side', async () => {
    const res = await post({ full: { b: item(true, 1) } }, [{ id: 'a', type: 'back', value: true, timestamp: 2 }]);
    expect(res.body).toEqual({ back: { a: item(true, 2) }, full: { b: item(true, 1) } });
  });

  it('persists exactly what it returns', async () => {
    const res = await post({ back: {}, full: {} }, [{ id: 'a', type: 'full', value: true, timestamp: 2 }]);
    expect(kvMock.set).toHaveBeenCalledWith('mission-app:checklist-state:v1', res.body);
  });

  it('keeps unrelated stored items untouched', async () => {
    const res = await post({ back: { x: item(true, 1) }, full: { y: item(true, 1) } }, [{ id: 'a', type: 'back', value: true, timestamp: 9 }]);
    expect(res.body).toEqual({ back: { x: item(true, 1), a: item(true, 9) }, full: { y: item(true, 1) } });
  });

  it('returns 500 when reading or writing fails', async () => {
    kvMock.get.mockRejectedValue(new Error('kv down'));
    expect((await call('POST', { updates: [] })).statusCode).toBe(500);
    kvMock.get.mockResolvedValue(null);
    kvMock.set.mockRejectedValue(new Error('kv down'));
    const res = await call('POST', { updates: [] });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to update checklist state' });
  });

  it('does not validate the shape of each update: a type other than "back" lands in the full list (characterization)', async () => {
    const res = await post(null, [{ id: 'a', type: 'weird', value: true, timestamp: 1 }]);
    expect(res.body).toEqual({ back: {}, full: { a: item(true, 1) } });
  });
});

describe('client and server conflict rules stay mirrored', () => {
  beforeEach(configureKv);

  const cases: Array<[string, TimestampedChecklistState, TimestampedChecklistState]> = [
    ['newer update', { a: item(true, 5) }, { a: item(false, 9) }],
    ['older update', { a: item(true, 5) }, { a: item(false, 1) }],
    ['equal timestamp', { a: item(true, 5) }, { a: item(false, 5) }],
    ['new id', { a: item(true, 5) }, { b: item(true, 2) }],
    ['legacy timestamp 0 stored', { a: item(true, 0) }, { a: item(false, 1) }],
    ['both legacy', { a: item(true, 0) }, { a: item(false, 0) }],
    ['mixed', { a: item(true, 5), b: item(false, 5) }, { a: item(false, 4), b: item(true, 6), c: item(true, 1) }],
  ];

  it.each(cases)('%s: server result equals mergeTimestampedStates', async (_name, stored, incoming) => {
    kvMock.get.mockResolvedValue({ back: stored, full: {} });
    const updates = Object.entries(incoming).map(([id, entry]) => ({ id, type: 'back', ...entry }));
    const res = await call('POST', { updates });
    expect((res.body as { back: TimestampedChecklistState }).back).toEqual(mergeTimestampedStates(stored, incoming));
  });
});
