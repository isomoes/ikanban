type Environment = Readonly<Record<string, string | undefined>>;

export function apiProxyTarget(environment: Environment): string {
  return `http://127.0.0.1:${environment.PORT ?? "4098"}`;
}
