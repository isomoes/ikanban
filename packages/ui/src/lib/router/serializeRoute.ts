import type { SidebarSection } from '@/constants/sidebar';
import type { MainTab } from '@/stores/useUIStore';
import { ROUTE_PARAMS } from './types';

/**
 * Application state relevant for URL serialization.
 */
export interface AppRouteState {
  sessionId: string | null;
  tab: MainTab;
  isSettingsOpen: boolean;
  settingsSection: SidebarSection;
  diffFile: string | null;
  /** Active project ID - written to URL so each tab can track its own project */
  activeProjectId: string | null;
}

/**
 * Default tab when none is specified.
 */
const DEFAULT_TAB: MainTab = 'chat';

/**
 * Serialize application state to URL search parameters.
 * Only includes parameters that differ from defaults to keep URLs clean.
 */
export function serializeRoute(state: AppRouteState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.activeProjectId && state.activeProjectId.trim().length > 0) {
    params.set(ROUTE_PARAMS.PROJECT, state.activeProjectId);
  }

  if (state.sessionId && state.sessionId.trim().length > 0) {
    params.set(ROUTE_PARAMS.SESSION, state.sessionId);
  }

  // Settings takes precedence - if open, include settings section
  if (state.isSettingsOpen) {
    const settingsSection = state.settingsSection === 'sessions' ? 'settings' : state.settingsSection;
    params.set(ROUTE_PARAMS.SETTINGS, settingsSection);
    // Don't include tab when settings is open (it's a full-screen overlay)
    return params;
  }

  // Tab - only include if not the default
  if (state.tab !== DEFAULT_TAB) {
    params.set(ROUTE_PARAMS.TAB, state.tab);
  }

  // Diff file - only include when on diff tab
  if (state.tab === 'diff' && state.diffFile && state.diffFile.trim().length > 0) {
    params.set(ROUTE_PARAMS.FILE, state.diffFile);
  }

  return params;
}

/**
 * Convert URLSearchParams to a URL string.
 * Returns just the pathname if no params, otherwise pathname + search string.
 */
export function buildURL(
  params: URLSearchParams,
  pathname?: string,
  route?: Pick<AppRouteState, 'activeProjectId' | 'sessionId'>
): string {
  const project = route?.activeProjectId?.trim() || params.get(ROUTE_PARAMS.PROJECT)?.trim() || '';
  const session = route?.sessionId?.trim() || params.get(ROUTE_PARAMS.SESSION)?.trim() || '';

  const searchParams = new URLSearchParams(params);
  searchParams.delete(ROUTE_PARAMS.PROJECT);
  searchParams.delete(ROUTE_PARAMS.SESSION);

  const path = buildRoutePath(pathname, project, session);
  const search = searchParams.toString();

  if (!search) {
    return path;
  }

  return `${path}?${search}`;
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value.trim());
}

function buildRoutePath(pathname: string | undefined, project: string, session: string): string {
  const fallbackPathname = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');

  if (typeof window === 'undefined' && typeof pathname === 'undefined') {
    return '/';
  }

  if (project && session) {
    return `/${encodePathPart(project)}/${encodePathPart(session)}`;
  }
  if (project) {
    return `/${encodePathPart(project)}`;
  }

  return fallbackPathname || '/';
}

/**
 * Check if the current URL matches the given route state.
 * Used to avoid unnecessary URL updates.
 */
export function routeMatchesURL(state: AppRouteState): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const newParams = serializeRoute(state);
    const nextUrl = buildURL(newParams, undefined, {
      activeProjectId: state.activeProjectId,
      sessionId: state.sessionId,
    });
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    return nextUrl === currentUrl;
  } catch {
    return true;
  }
}

/**
 * Update the browser URL using pushState or replaceState.
 * Does nothing if URL already matches or in VS Code context.
 */
export function updateBrowserURL(
  state: AppRouteState,
  options: { replace?: boolean; force?: boolean } = {}
): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Skip URL updates in VS Code webview
  if (isVSCodeContext()) {
    return;
  }

  // Skip if URL already matches (unless forced)
  if (!options.force && routeMatchesURL(state)) {
    return;
  }

  try {
    const params = serializeRoute(state);
    const url = buildURL(params, undefined, {
      activeProjectId: state.activeProjectId,
      sessionId: state.sessionId,
    });

    if (options.replace) {
      window.history.replaceState({ ...window.history.state, route: state }, '', url);
    } else {
      window.history.pushState({ route: state }, '', url);
    }
  } catch {
    // Silently fail - URL updates are non-critical
  }
}

/**
 * Check if running in VS Code webview context.
 */
function isVSCodeContext(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check for VS Code config object
  const win = window as { __VSCODE_CONFIG__?: unknown };
  return win.__VSCODE_CONFIG__ !== undefined;
}
