#!/usr/bin/env node

/**
 * Script to erase/reset Vercel Redis (KV) database for Mission App Requirements Checklist.
 * Sends a reset request to the API or directly to Upstash / Vercel KV REST API.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Try to read local env file if present
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = resolve(process.cwd(), file);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {
        console.warn(`[reset-redis] Could not load ${file}:`, err.message);
      }
    }
  }
}

loadEnv();

const API_URL =
  process.env.CHECKLIST_API_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/checklist` : 'https://mission-app-requirements-checklist.vercel.app/api/checklist');

const KV_REST_API_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_KEY = 'mission-app:checklist-state:v1';

async function resetViaApi() {
  console.log(`[reset-redis] Sending reset request to endpoint: ${API_URL}`);
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reset: true }),
  });

  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  console.log('[reset-redis] ✅ Successfully reset Vercel KV state via API:', JSON.stringify(data));
}

async function resetViaKvRest() {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return false;
  console.log(`[reset-redis] Resetting directly via Upstash KV REST at: ${KV_REST_API_URL}`);
  const emptyState = JSON.stringify({ back: {}, full: {} });
  const response = await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(KV_KEY)}/${encodeURIComponent(emptyState)}`, {
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`KV REST returned HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  console.log('[reset-redis] ✅ Successfully set empty state in Upstash KV:', data);
  return true;
}

async function main() {
  console.log('--- Erasing Vercel Redis / KV Checklist Database ---');
  let success = false;

  // Try direct Upstash REST if credentials exist
  try {
    const directOk = await resetViaKvRest();
    if (directOk) success = true;
  } catch (err) {
    console.warn('[reset-redis] Direct Upstash REST reset failed:', err.message);
  }

  // Always also call the API endpoint
  try {
    await resetViaApi();
    success = true;
  } catch (err) {
    console.error('[reset-redis] API reset failed:', err.message);
  }

  if (!success) {
    console.error('[reset-redis] ❌ Could not erase Vercel Redis memory database.');
    process.exit(1);
  } else {
    console.log('[reset-redis] 🎉 Vercel Redis memory database cleared. Checklist starts clean!');
  }
}

main().catch((err) => {
  console.error('[reset-redis] Fatal error:', err);
  process.exit(1);
});
