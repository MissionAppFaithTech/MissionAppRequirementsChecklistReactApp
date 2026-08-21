import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

export type TimestampedItem = {
  value: boolean;
  timestamp: number;
};

export type CloudState = {
  back: Record<string, TimestampedItem>;
  full: Record<string, TimestampedItem>;
};

export type UpdateItem = {
  id: string;
  type: 'back' | 'full';
  value: boolean;
  timestamp: number;
};

const KV_KEY = 'mission-app:checklist-state:v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasKv = Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );

  if (req.method === 'GET') {
    if (!hasKv) {
      return res.status(200).json({ back: {}, full: {}, warning: 'Vercel KV not configured' });
    }
    try {
      const state = (await kv.get<CloudState>(KV_KEY)) || { back: {}, full: {} };
      return res.status(200).json(state);
    } catch (err) {
      console.error('KV GET error:', err);
      return res.status(500).json({ error: 'Failed to fetch checklist state' });
    }
  }

  if (req.method === 'POST') {
    if (!hasKv) {
      return res.status(200).json({ back: {}, full: {}, warning: 'Vercel KV not configured' });
    }

    try {
      const body = (req.body ?? {}) as {
        reset?: boolean;
        updates?: UpdateItem[];
      };

      if (body.reset) {
        const emptyState: CloudState = { back: {}, full: {} };
        await kv.set(KV_KEY, emptyState);
        return res.status(200).json(emptyState);
      }

      if (!body.updates || !Array.isArray(body.updates)) {
        return res.status(400).json({ error: 'Invalid updates payload' });
      }

      const currentState = (await kv.get<CloudState>(KV_KEY)) || { back: {}, full: {} };
      const nextBack = { ...(currentState.back ?? {}) };
      const nextFull = { ...(currentState.full ?? {}) };

      for (const update of body.updates) {
        const targetMap = update.type === 'back' ? nextBack : nextFull;
        const existing = targetMap[update.id];

        // Per-item conflict resolution: "latest update wins"
        if (!existing || update.timestamp > existing.timestamp) {
          targetMap[update.id] = {
            value: update.value,
            timestamp: update.timestamp,
          };
        }
      }

      const updatedState: CloudState = { back: nextBack, full: nextFull };
      await kv.set(KV_KEY, updatedState);
      return res.status(200).json(updatedState);
    } catch (err) {
      console.error('KV POST error:', err);
      return res.status(500).json({ error: 'Failed to update checklist state' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
