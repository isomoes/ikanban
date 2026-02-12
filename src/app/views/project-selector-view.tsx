import { Text } from "ink";

import type { ProjectRef } from "../../domain/project";

type ProjectSelectorViewProps = {
  projects: ProjectRef[];
  selectedProjectIndex: number;
};

export function ProjectSelectorView({ projects, selectedProjectIndex }: ProjectSelectorViewProps) {
  if (projects.length === 0) {
    return <Text color="yellow">No projects registered.</Text>;
  }

  return (
    <>
      {projects.map((project, index) => (
        <Text key={project.id} color={index === selectedProjectIndex ? "green" : undefined}>
          {index === selectedProjectIndex ? ">" : " "} {project.name} ({project.id})
        </Text>
      ))}
    </>
  );
}
