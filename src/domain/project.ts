export type ProjectRef = {
  id: string;
  rootDirectory: string;
  name: string;
  createdAt: number;
};

export type CreateProjectRefInput = {
  id: string;
  rootDirectory: string;
  name: string;
  createdAt?: number;
};

export function createProjectRef(input: CreateProjectRefInput): ProjectRef {
  const project: ProjectRef = {
    id: input.id.trim(),
    rootDirectory: input.rootDirectory,
    name: input.name.trim(),
    createdAt: input.createdAt ?? Date.now(),
  };

  assertProjectRefInvariants(project);

  return project;
}

export function validateProjectRefInvariants(project: ProjectRef): string[] {
  const errors: string[] = [];

  if (project.id.trim().length === 0) {
    errors.push("Project id must be a non-empty string.");
  }

  if (project.name.trim().length === 0) {
    errors.push("Project name must be a non-empty string.");
  }

  if (project.rootDirectory.trim().length === 0) {
    errors.push("Project rootDirectory must be a non-empty string.");
  } else if (!isLikelyAbsolutePath(project.rootDirectory)) {
    errors.push("Project rootDirectory must be an absolute path.");
  }

  if (!Number.isFinite(project.createdAt) || project.createdAt <= 0) {
    errors.push("Project createdAt must be a positive timestamp.");
  }

  return errors;
}

export function assertProjectRefInvariants(project: ProjectRef): void {
  const errors = validateProjectRefInvariants(project);
  if (errors.length === 0) {
    return;
  }

  throw new Error(`Invalid ProjectRef: ${errors.join(" ")}`);
}

function isLikelyAbsolutePath(path: string): boolean {
  return path.startsWith("/") || /^[A-Za-z]:\\/.test(path);
}
