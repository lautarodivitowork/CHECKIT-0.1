export type DateKey = string; // AAAA-MM-DD en hora local
export type SortMode = 'manual' | 'newest' | 'category';

export interface Category {
  id: string;
  color: string; // #RRGGBB
  emoji: string;
  createdAt: number;
}

export type Schedule =
  | { kind: 'once'; date: DateKey }
  | { kind: 'daily' }
  | { kind: 'weekly'; weekdays: number[] } // lunes=1 ... domingo=7
  | { kind: 'dates'; dates: DateKey[] };

export interface TaskRevision {
  id: string;
  effectiveFrom: DateKey;
  title: string;
  categoryId: string | null;
  schedule: Schedule;
}

export interface Task {
  id: string;
  createdAt: number;
  revisions: TaskRevision[];
  cutoffDate?: DateKey; // oculta esta fecha y todas las siguientes
}

export interface AppData {
  schemaVersion: 1;
  categories: Category[];
  tasks: Task[];
  completions: Record<string, boolean>; // id-tarea|fecha
  hiddenDates: Record<string, DateKey[]>; // id-tarea => fechas excluidas
  dayOrder: Record<DateKey, string[]>; // orden manual independiente por fecha
  settings: { sortMode: SortMode };
}

export interface Occurrence {
  task: Task;
  revision: TaskRevision;
  category: Category | null;
  completed: boolean;
}

export interface TaskFormValue {
  title: string;
  categoryId: string | null;
  schedule: Schedule;
}
