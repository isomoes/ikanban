import { useSessionStore } from '@/stores/useSessionStore';
import { useUIStore } from '@/stores/useUIStore';

declare const __APP_VERSION__: string | undefined;

type ProbeResult = {
  ok: boolean;
  status: number;
  elapsedMs: number;
  summary: string;
};

type IKanbanHealthSnapshot = {
  openCodePort?: unknown;
  openCodeRunning?: unknown;
  isOpenCodeReady?: unknown;
  lastOpenCodeError?: unknown;
  opencodeBinaryResolved?: unknown;
  opencodeBinarySource?: unknown;
  opencodeShimInterpreter?: unknown;
  nodeBinaryResolved?: unknown;
  bunBinaryResolved?: unknown;
};

type IKanbanOpencodeResolution = {
  configured?: unknown;
  resolved?: unknown;
  resolvedDir?: unknown;
  source?: unknown;
  detectedNow?: unknown;
  detectedSourceNow?: unknown;
  shim?: unknown;
  node?: unknown;
  bun?: unknown;
};

const getCurrentDirectory = (): string => {
  const state = useSessionStore.getState();
  const currentSessionId = state.currentSessionId;
  if (!currentSessionId) return '';
  const session = state.sessions.find((s) => s.id === currentSessionId);
  return typeof session?.directory === 'string' ? session.directory : '';
};

const safeFetch = async (input: string, timeoutMs = 6000): Promise<ProbeResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const resp = await fetch(input, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    const elapsedMs = Date.now() - startedAt;
    const contentType = resp.headers.get('content-type') || '';
    const lower = contentType.toLowerCase();
    const isJson = lower.includes('json') && !lower.includes('text/html');

    let summary = '';
    if (isJson) {
      const json = await resp.json().catch(() => null);
      if (Array.isArray(json)) {
        summary = `json[array] len=${json.length}`;
      } else if (json && typeof json === 'object') {
        const keys = Object.keys(json).slice(0, 8);
        summary = `json[object] keys=${keys.join(',')}${Object.keys(json).length > keys.length ? ',…' : ''}`;
      } else {
        summary = `json[${typeof json}]`;
      }
    } else {
      summary = contentType ? `content-type=${contentType}` : 'no content-type';
    }

    return { ok: resp.ok && isJson, status: resp.status, elapsedMs, summary };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const isAbort =
      controller.signal.aborted ||
      (error instanceof Error && (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')));
    const message = isAbort
      ? `timeout after ${timeoutMs}ms`
      : error instanceof Error
        ? error.message
        : String(error);
    return { ok: false, status: 0, elapsedMs, summary: `error=${message}` };
  } finally {
    clearTimeout(timeout);
  }
};

const formatIso = (timestamp: number | null | undefined): string => {
  if (!timestamp || !Number.isFinite(timestamp)) return '(n/a)';
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return '(invalid)';
  }
};

export const buildOpenCodeStatusReport = async (): Promise<string> => {
  const now = new Date();
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '(unknown)';
  const platform = typeof navigator !== 'undefined' ? navigator.userAgent : '(no navigator)';
  const directory = getCurrentDirectory();
  const eventStreamStatus = useUIStore.getState().eventStreamStatus;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const apiBase = origin ? `${origin.replace(/\/+$/, '')}/api/` : '';

  const iKanbanHealth: IKanbanHealthSnapshot | null = await (async () => {
    if (!origin) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const resp = await fetch(`${origin.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!resp.ok) return null;
      const json = (await resp.json().catch(() => null)) as unknown;
      if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
      return json as IKanbanHealthSnapshot;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  })();

  const iKanbanOpencodeResolutionResult: {
    data: IKanbanOpencodeResolution | null;
    status: number | null;
    error: string | null;
  } = await (async () => {
    if (!origin) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const resp = await fetch(`${origin.replace(/\/+$/, '')}/api/config/opencode-resolution`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const contentType = resp.headers.get('content-type') || '(none)';
      if (!resp.ok) {
        return { data: null, status: resp.status, error: `http ${resp.status} content-type=${contentType}` };
      }
      const raw = await resp.text();
      let json: unknown = null;
      try {
        json = JSON.parse(raw);
      } catch {
        const snippet = raw.replace(/\s+/g, ' ').slice(0, 120);
        return {
          data: null,
          status: resp.status,
          error: `invalid json content-type=${contentType} body=${snippet || '(empty)'}`,
        };
      }
      if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return { data: null, status: resp.status, error: `invalid json-shape content-type=${contentType}` };
      }
      return { data: json as IKanbanOpencodeResolution, status: resp.status, error: null };
    } catch (error) {
      return {
        data: null,
        status: null,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  })() || { data: null, status: null, error: null };

  const buildProbeUrl = (pathname: string, includeDirectory = true): string | null => {
    if (!apiBase) return null;
    const url = new URL(pathname.replace(/^\/+/, ''), apiBase);
    if (includeDirectory && directory) {
      url.searchParams.set('directory', directory);
    }
    return url.toString();
  };

  const probeTargets: Array<{ label: string; path: string; includeDirectory?: boolean; timeoutMs?: number }> = [
    { label: 'health', path: '/global/health', includeDirectory: false },
    { label: 'config', path: '/config', includeDirectory: true },
    { label: 'providers', path: '/config/providers', includeDirectory: true },
    { label: 'agents', path: '/agent', includeDirectory: true, timeoutMs: 12000 },
    { label: 'commands', path: '/command', includeDirectory: true, timeoutMs: 10000 },
    { label: 'project', path: '/project/current', includeDirectory: true },
    { label: 'path', path: '/path', includeDirectory: true },
    { label: 'sessions', path: '/session', includeDirectory: true, timeoutMs: 12000 },
    { label: 'sessionStatus', path: '/session/status', includeDirectory: true },
  ];

  const probes = apiBase
    ? await Promise.all(
        probeTargets.map(async (entry) => {
          const url = buildProbeUrl(entry.path, entry.includeDirectory !== false);
          if (!url) return { label: entry.label, url: '(none)', result: null as ProbeResult | null };
          const result = await safeFetch(url, typeof entry.timeoutMs === 'number' ? entry.timeoutMs : undefined);
          return { label: entry.label, url, result };
        })
      )
    : [];

  const lines: string[] = [];
  lines.push(`Time: ${now.toISOString()}`);
  lines.push(`IKanban version: ${appVersion}`);
  lines.push(`Runtime: ${origin || '(unknown)'} (api=${origin ? origin + '/api' : '(unknown)'})`);
  lines.push(`Event stream: ${eventStreamStatus}`);
  lines.push(`Directory: ${directory || '(none)'}`);
  lines.push(`Platform: ${platform}`);

  if (typeof window !== 'undefined') {
    const injected = (window as unknown as { __IKANBAN_MACOS_MAJOR__?: unknown }).__IKANBAN_MACOS_MAJOR__;
    if (typeof injected === 'number' && Number.isFinite(injected) && injected > 0) {
      lines.push(`macOS major: ${injected}`);
    }
  }

  const isLikelyMac = /Mac OS X|Macintosh/.test(platform);
  if (isLikelyMac) {
    lines.push('');
    lines.push('OpenCode CLI resolution:');

    const iKanbanOpencodeResolution = iKanbanOpencodeResolutionResult.data;
    const configured =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.configured === 'string'
        ? iKanbanOpencodeResolution.configured
        : null;
    const resolved =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.resolved === 'string'
        ? iKanbanOpencodeResolution.resolved
        : (iKanbanHealth && typeof iKanbanHealth.opencodeBinaryResolved === 'string' ? iKanbanHealth.opencodeBinaryResolved : '');
    const resolvedDir =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.resolvedDir === 'string'
        ? iKanbanOpencodeResolution.resolvedDir
        : '';
    const source =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.source === 'string'
        ? iKanbanOpencodeResolution.source
        : (iKanbanHealth && typeof iKanbanHealth.opencodeBinarySource === 'string' ? iKanbanHealth.opencodeBinarySource : '');
    const shim =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.shim === 'string'
        ? iKanbanOpencodeResolution.shim
        : (iKanbanHealth && typeof iKanbanHealth.opencodeShimInterpreter === 'string' ? iKanbanHealth.opencodeShimInterpreter : '');
    const node =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.node === 'string'
        ? iKanbanOpencodeResolution.node
        : (iKanbanHealth && typeof iKanbanHealth.nodeBinaryResolved === 'string' ? iKanbanHealth.nodeBinaryResolved : '');
    const bun =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.bun === 'string'
        ? iKanbanOpencodeResolution.bun
        : (iKanbanHealth && typeof iKanbanHealth.bunBinaryResolved === 'string' ? iKanbanHealth.bunBinaryResolved : '');
    const detectedNow =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.detectedNow === 'string'
        ? iKanbanOpencodeResolution.detectedNow
        : '';
    const detectedSourceNow =
      iKanbanOpencodeResolution && typeof iKanbanOpencodeResolution.detectedSourceNow === 'string'
        ? iKanbanOpencodeResolution.detectedSourceNow
        : '';

    if (configured !== null) {
      lines.push(`- configured: ${configured.trim().length === 0 ? '(cleared)' : configured}`);
    }

    if (resolved) {
      const dir = resolvedDir || (resolved.includes('/') ? resolved.split('/').slice(0, -1).join('/') || '/' : '');
      lines.push(`- opencode: ${resolved}${dir ? ` (dir=${dir})` : ''}`);
    } else {
      lines.push('- opencode: (n/a)');
    }

    lines.push(`- source: ${source || '(n/a)'}`);
    if (detectedNow) {
      lines.push(`- detected-now: ${detectedNow}`);
      lines.push(`- detected-source: ${detectedSourceNow || '(n/a)'}`);
    }
    lines.push(`- shim: ${shim || '(n/a)'}`);
    lines.push(`- node: ${node || '(n/a)'}`);
    lines.push(`- bun: ${bun || '(n/a)'}`);
    if (!iKanbanOpencodeResolution && iKanbanOpencodeResolutionResult.error) {
      lines.push(`- resolution-endpoint: ${iKanbanOpencodeResolutionResult.error}`);
    }
  }

  lines.push('');
  if (probes.length) {
    lines.push('OpenCode API probes:');
    for (const probe of probes) {
      if (!probe.result) {
        lines.push(`- ${probe.label}: (no url)`);
        continue;
      }
      const { ok, status, elapsedMs, summary } = probe.result;
      const suffix = ok ? '' : ` url=${probe.url}`;
      lines.push(`- ${probe.label}: ${ok ? 'ok' : 'fail'} status=${status} time=${elapsedMs}ms ${summary}${suffix}`);
    }
  } else {
    lines.push('OpenCode API probes: (skipped)');
  }

  lines.push('');
  lines.push(`Generated: ${formatIso(Date.now())}`);
  return lines.join('\n');
};

export const showOpenCodeStatus = async (): Promise<void> => {
  const text = await buildOpenCodeStatusReport();
  const ui = useUIStore.getState();
  ui.setOpenCodeStatusText(text);
  ui.setOpenCodeStatusDialogOpen(true);
};
