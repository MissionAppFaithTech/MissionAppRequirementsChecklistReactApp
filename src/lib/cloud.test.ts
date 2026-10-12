import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCloudState, resetCloudState, syncCloudItems, type UpdatePayloadItem } from './checklist';

const fetchMock = vi.fn();

const jsonResponse = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  json: async () => body,
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const update: UpdatePayloadItem = { id: 'rf-1', type: 'back', value: true, timestamp: 5 };

describe('fetchCloudState', () => {
  it('GETs /api/checklist asking for JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ back: {}, full: {} }));
    await fetchCloudState();
    expect(fetchMock).toHaveBeenCalledWith('/api/checklist', { headers: { Accept: 'application/json' } });
  });

  it('returns back and full from a normal response', async () => {
    const back = { 'rf-1': { value: true, timestamp: 1 } };
    const full = { 'rf-2': { value: true, timestamp: 2 } };
    fetchMock.mockResolvedValue(jsonResponse({ back, full }));
    expect(await fetchCloudState()).toEqual({ back, full });
  });

  it('strips extra fields such as the "KV not configured" warning', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ back: {}, full: {}, warning: 'Vercel KV not configured' }));
    expect(await fetchCloudState()).toEqual({ back: {}, full: {} });
  });

  it('defaults a missing side to {}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ full: { a: { value: true, timestamp: 1 } } }));
    expect(await fetchCloudState()).toEqual({ back: {}, full: { a: { value: true, timestamp: 1 } } });
    fetchMock.mockResolvedValue(jsonResponse({ back: { a: { value: true, timestamp: 1 } } }));
    expect(await fetchCloudState()).toEqual({ back: { a: { value: true, timestamp: 1 } }, full: {} });
  });

  it.each([
    ['an HTTP error', jsonResponse({ back: {}, full: {} }, { ok: false, status: 500 })],
    ['a null body', jsonResponse(null)],
    ['an array body', jsonResponse([])],
    ['a string body', jsonResponse('oops')],
    ['a number body', jsonResponse(7)],
    ['an object with neither side', jsonResponse({ hello: 'world' })],
  ])('returns null on %s', async (_name, response) => {
    fetchMock.mockResolvedValue(response);
    expect(await fetchCloudState()).toBeNull();
  });

  it('returns null when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    expect(await fetchCloudState()).toBeNull();
  });

  it('returns null when the body is not valid JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('bad json'); } });
    expect(await fetchCloudState()).toBeNull();
  });
});

describe('syncCloudItems', () => {
  it('does not call the network for an empty update list', async () => {
    expect(await syncCloudItems([])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs only the updates as JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ back: {}, full: {} }));
    await syncCloudItems([update]);
    expect(fetchMock).toHaveBeenCalledWith('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates: [update] }),
    });
  });

  it('returns the server state', async () => {
    const state = { back: { 'rf-1': { value: true, timestamp: 5 } }, full: {} };
    fetchMock.mockResolvedValue(jsonResponse(state));
    expect(await syncCloudItems([update])).toEqual(state);
  });

  it('returns null on HTTP errors and network failures without throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 400 }));
    expect(await syncCloudItems([update])).toBeNull();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await syncCloudItems([update])).toBeNull();
  });
});

describe('resetCloudState', () => {
  it('POSTs {reset:true}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ back: {}, full: {} }));
    await resetCloudState();
    expect(fetchMock).toHaveBeenCalledWith('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
  });

  it('returns the empty state and swallows failures', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ back: {}, full: {} }));
    expect(await resetCloudState()).toEqual({ back: {}, full: {} });
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));
    expect(await resetCloudState()).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await resetCloudState()).toBeNull();
  });
});
