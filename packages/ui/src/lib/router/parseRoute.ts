import type { SidebarSection } from '@/constants/sidebar';
import type { MainTab } from '@/stores/useUIStore';
import {
  type RouteState,
  VALID_TABS,
  VALID_SETTINGS_SECTIONS,
  ROUTE_PARAMS,
} from './types';

/**
 * Parse the current URL search parameters into a RouteState.
 * Returns null values for any parameter that is missing or invalid.
 */
export function parseRoute(searchParams?: URLSearchParams): RouteState {
  const params = searchParams ?? getSearchParams();
  const path = getPathRouteParts();

  return {
    sessionId: parseSessionId(params, path),
    tab: parseTab(params),
    settingsSection: parseSettingsSection(params),
    diffFile: parseDiffFile(params),
    projectId: parseProjectId(params, path),
  };
}

/**
 * Safely get URLSearchParams from the current location.
 */
function getSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

type PathRouteParts = {
  projectId: string | null;
  sessionId: string | null;
};

function getPathRouteParts(): PathRouteParts {
  if (typeof window === 'undefined') {
    return { projectId: null, sessionId: null };
  }

  try {
    const segments = window.location.pathname
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          return segment;
        }
      });

    if (segments.length === 0) {
      return { projectId: null, sessionId: null };
    }

    return {
      projectId: segments[0] || null,
      sessionId: segments[1] || null,
    };
  } catch {
    return { projectId: null, sessionId: null };
  }
}

/**
 * Parse session ID from URL parameters.
 * Returns null if missing or empty.
 */
function parseSessionId(params: URLSearchParams, path: PathRouteParts): string | null {
  const value = params.get(ROUTE_PARAMS.SESSION);
  if (value && value.trim().length > 0) {
    return value.trim();
  }

  return path.sessionId;
}

/**
 * Parse main tab from URL parameters.
 * Returns null if missing or invalid.
 */
function parseTab(params: URLSearchParams): MainTab | null {
  const value = params.get(ROUTE_PARAMS.TAB);
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase().trim() as MainTab;
  if (VALID_TABS.includes(normalized)) {
    return normalized;
  }

  return null;
}

/**
 * Parse settings section from URL parameters.
 * Returns null if missing or invalid.
 */
function parseSettingsSection(params: URLSearchParams): SidebarSection | null {
  const value = params.get(ROUTE_PARAMS.SETTINGS);
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase().trim();

  // Check if it's a valid section
  if ((VALID_SETTINGS_SECTIONS as readonly string[]).includes(normalized)) {
    return normalized as SidebarSection;
  }

  // Handle common aliases
  if (normalized === 'ikanban' || normalized === 'general' || normalized === 'preferences') {
    return 'settings';
  }

  return null;
}

/**
 * Parse diff file path from URL parameters.
 * Returns null if missing or empty.
 */
function parseDiffFile(params: URLSearchParams): string | null {
  const value = params.get(ROUTE_PARAMS.FILE);
  if (!value || value.trim().length === 0) {
    return null;
  }

  // URL decode the file path
  try {
    return decodeURIComponent(value.trim());
  } catch {
    // If decoding fails, return the raw value
    return value.trim();
  }
}

/**
 * Parse project ID from URL parameters.
 * Returns null if missing or empty.
 */
function parseProjectId(params: URLSearchParams, path: PathRouteParts): string | null {
  const value = params.get(ROUTE_PARAMS.PROJECT);
  if (value && value.trim().length > 0) {
    return value.trim();
  }

  return path.projectId;
}

/**
 * Check if the current URL has any route parameters.
 */
export function hasRouteParams(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const path = getPathRouteParts();
    return (
      Boolean(path.projectId) ||
      Boolean(path.sessionId) ||
      params.has(ROUTE_PARAMS.SESSION) ||
      params.has(ROUTE_PARAMS.TAB) ||
      params.has(ROUTE_PARAMS.SETTINGS) ||
      params.has(ROUTE_PARAMS.FILE) ||
      params.has(ROUTE_PARAMS.PROJECT)
    );
  } catch {
    return false;
  }
}
