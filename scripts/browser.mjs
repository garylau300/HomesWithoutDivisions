/**
 * Shared Chromium launcher for the build-time and verification scripts.
 *
 * Prefers a Chromium provided by the environment (CHROMIUM_PATH, or the one
 * Playwright's own image installs at /opt/pw-browsers/chromium) so that CI
 * containers do not have to download a browser. Falls back to whatever
 * Playwright resolves on its own.
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const CANDIDATES = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].filter(Boolean);

export function launch(options = {}) {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  return chromium.launch({ ...options, ...(executablePath ? { executablePath } : {}) });
}
