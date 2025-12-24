import { Project, CanvasItem } from '../types';
import { generateId } from '../utils/id';

const STORAGE_KEY = 'canvasai_projects';

export function getProjects(): Project[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function getProject(id: string): Project | null {
  const projects = getProjects();
  return projects.find(p => p.id === id) || null;
}

export function saveProject(project: Project): void {
  const projects = getProjects();
  const index = projects.findIndex(p => p.id === project.id);

  // Generate thumbnail from first image if available
  if (project.items.length > 0 && !project.thumbnail) {
    project.thumbnail = project.items[0].src;
  }

  project.updatedAt = Date.now();

  if (index >= 0) {
    projects[index] = project;
  } else {
    projects.unshift(project);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function createProject(name: string = '未命名画布'): Project {
  const project: Project = {
    id: generateId(),
    name,
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    viewport: {
      scale: 1,
      pan: { x: 0, y: 0 }
    }
  };

  saveProject(project);
  return project;
}

export function deleteProject(id: string): void {
  const projects = getProjects().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function updateProjectName(id: string, name: string): void {
  const projects = getProjects();
  const project = projects.find(p => p.id === id);
  if (project) {
    project.name = name;
    project.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }
}

export function duplicateProject(id: string): Project | null {
  const original = getProject(id);
  if (!original) return null;

  const duplicate: Project = {
    ...original,
    id: generateId(),
    name: `${original.name} 副本`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveProject(duplicate);
  return duplicate;
}
