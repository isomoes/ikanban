export const APP_ROUTES = ["project-selector", "task-board"] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

export type AppRouteDescriptor = {
  id: AppRoute;
  title: string;
  description: string;
};

export const ROUTE_DESCRIPTORS: Record<AppRoute, AppRouteDescriptor> = {
  "project-selector": {
    id: "project-selector",
    title: "Project Selector",
    description: "Choose the active repository.",
  },
  "task-board": {
    id: "task-board",
    title: "Task Board",
    description: "Run and monitor orchestrated tasks.",
  },
};

const routeOrder = [...APP_ROUTES];
const FIRST_ROUTE: AppRoute = APP_ROUTES[0];

export function nextRoute(current: AppRoute): AppRoute {
  const index = routeOrder.indexOf(current);
  if (index === -1) {
    return FIRST_ROUTE;
  }

  const nextIndex = (index + 1) % routeOrder.length;
  return routeOrder[nextIndex] ?? FIRST_ROUTE;
}

export function isAppRoute(value: string): value is AppRoute {
  return APP_ROUTES.includes(value as AppRoute);
}
