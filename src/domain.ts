import type { AppData, Category, DateKey, Occurrence, Schedule, SortMode, Task, TaskFormValue, TaskRevision } from './types.ts';

export const COLORS = ['#efd8ae', '#d9e7be', '#cce6dd', '#cfe0f3', '#ddd7f0', '#f1d5db', '#e8ddcf', '#d8dce0'];

export function emptyData(): AppData {
  return { schemaVersion: 1, tasks: [], categories: [], completions: {}, hiddenDates: {}, dayOrder: {}, settings: { sortMode: 'manual' } };
}

export function dateKey(date: Date = new Date()): DateKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateFromKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export function isValidDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = dateFromKey(value);
  return !Number.isNaN(d.getTime()) && dateKey(d) === value;
}

export function shiftDate(key: DateKey, days: number): DateKey {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function weekday(key: DateKey): number {
  return (dateFromKey(key).getDay() + 6) % 7 + 1;
}

export function formatDisplayDate(key: DateKey, today: DateKey): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  if (key.slice(0, 4) !== today.slice(0, 4)) options.year = 'numeric';
  const formatted = new Intl.DateTimeFormat('es-AR', options).format(dateFromKey(key));
  return formatted.charAt(0).toLocaleUpperCase('es-AR') + formatted.slice(1);
}

export function newId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function occursOn(schedule: Schedule, date: DateKey): boolean {
  switch (schedule.kind) {
    case 'once': return date === schedule.date;
    case 'daily': return true;
    case 'weekly': return schedule.weekdays.includes(weekday(date));
    case 'dates': return schedule.dates.includes(date);
  }
}

export function revisionAt(task: Task, date: DateKey): TaskRevision | null {
  // Las fechas ISO locales se ordenan alfabéticamente.
  const revisions = task.revisions.filter(r => r.effectiveFrom <= date)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return revisions.length ? revisions[revisions.length - 1] : null;
}

export function completionKey(taskId: string, date: DateKey): string {
  return `${taskId}|${date}`;
}

export function visibleOccurrences(data: AppData, date: DateKey): Occurrence[] {
  const categories = new Map(data.categories.map(c => [c.id, c]));
  return data.tasks.flatMap(task => {
    if (task.cutoffDate && date >= task.cutoffDate) return [];
    if ((data.hiddenDates[task.id] || []).includes(date)) return [];
    const revision = revisionAt(task, date);
    if (!revision || !occursOn(revision.schedule, date)) return [];
    return [{ task, revision, category: categories.get(revision.categoryId || '') || null,
      completed: data.completions[completionKey(task.id, date)] === true }];
  });
}

export function orderedOccurrences(data: AppData, date: DateKey): Occurrence[] {
  const occurrences = visibleOccurrences(data, date);
  const sort = data.settings.sortMode;
  const dayOrder = data.dayOrder[date] || [];
  const position = new Map(dayOrder.map((id, index) => [id, index]));
  const taskIndex = new Map(data.tasks.map((task, index) => [task.id, index]));
  const catIndex = new Map(data.categories.map((c, index) => [c.id, index]));
  return [...occurrences].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (sort === 'newest') return b.task.createdAt - a.task.createdAt || (taskIndex.get(b.task.id) ?? 0) - (taskIndex.get(a.task.id) ?? 0);
    if (sort === 'category') {
      const catA = a.category;
      const catB = b.category;
      const colorA = catA ? COLORS.indexOf(catA.color) : 999;
      const colorB = catB ? COLORS.indexOf(catB.color) : 999;
      if (colorA !== colorB) return colorA - colorB;
      // Misma categoría junta; el color nunca fusiona identidades.
      if (catA?.id !== catB?.id) return (catIndex.get(catA?.id || '') ?? 999) - (catIndex.get(catB?.id || '') ?? 999);
      return a.task.createdAt - b.task.createdAt || (taskIndex.get(a.task.id) ?? 0) - (taskIndex.get(b.task.id) ?? 0);
    }
    const aPos = position.get(a.task.id) ?? Number.MAX_SAFE_INTEGER;
    const bPos = position.get(b.task.id) ?? Number.MAX_SAFE_INTEGER;
    return aPos - bPos || a.task.createdAt - b.task.createdAt || (taskIndex.get(a.task.id) ?? 0) - (taskIndex.get(b.task.id) ?? 0);
  });
}

export function createTask(data: AppData, date: DateKey, fields: TaskFormValue): AppData {
  const task: Task = { id: newId(), createdAt: Date.now(), revisions: [
    { id: newId(), effectiveFrom: date, ...fields }
  ] };
  return { ...data, tasks: [...data.tasks, task] };
}

export function editTask(data: AppData, id: string, from: DateKey, fields: TaskFormValue): AppData {
  return {
    ...data,
    tasks: data.tasks.map(task => task.id !== id ? task : {
      ...task,
      // La nueva versión reemplaza cualquier modificación futura previamente programada.
      revisions: [
        ...task.revisions.filter(rev => rev.effectiveFrom < from),
        { id: newId(), effectiveFrom: from, ...fields }
      ]
    })
  };
}

export function toggleComplete(data: AppData, id: string, date: DateKey): AppData {
  const key = completionKey(id, date);
  return { ...data, completions: { ...data.completions, [key]: !data.completions[key] } };
}

export function deleteOnlyOn(data: AppData, id: string, date: DateKey): AppData {
  const dates = data.hiddenDates[id] || [];
  return { ...data, hiddenDates: { ...data.hiddenDates, [id]: [...new Set([...dates, date])] } };
}

export function deleteFrom(data: AppData, id: string, date: DateKey): AppData {
  return { ...data, tasks: data.tasks.map(t => t.id !== id ? t : {
    ...t, cutoffDate: t.cutoffDate && t.cutoffDate < date ? t.cutoffDate : date
  }) };
}

export function setSortMode(data: AppData, sortMode: SortMode): AppData {
  return { ...data, settings: { ...data.settings, sortMode } };
}

export function rememberManualOrder(data: AppData, date: DateKey, ids: string[]): AppData {
  return { ...data, dayOrder: { ...data.dayOrder, [date]: ids }, settings: { sortMode: 'manual' } };
}

export function moveTask(data: AppData, date: DateKey, movingId: string, targetId: string): AppData {
  const occurrences = orderedOccurrences(data, date);
  const source = occurrences.find(o => o.task.id === movingId);
  const target = occurrences.find(o => o.task.id === targetId);
  if (!source || !target || source.completed !== target.completed || movingId === targetId) return data;
  const ids = occurrences.map(o => o.task.id);
  const sourceIndex = ids.indexOf(movingId);
  const targetIndex = ids.indexOf(targetId);
  ids.splice(sourceIndex, 1);
  ids.splice(targetIndex, 0, movingId);
  return rememberManualOrder(data, date, ids);
}

function isSchedule(value: unknown): value is Schedule {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  if (s.kind === 'daily') return true;
  if (s.kind === 'once') return isValidDateKey(s.date);
  if (s.kind === 'weekly') return Array.isArray(s.weekdays) && s.weekdays.length > 0 && s.weekdays.every(d => Number.isInteger(d) && d >= 1 && d <= 7);
  if (s.kind === 'dates') return Array.isArray(s.dates) && s.dates.length > 0 && s.dates.every(isValidDateKey);
  return false;
}

/** Las copias se tratan como datos no confiables; nunca se evalúa código importado. */
export function parseBackup(json: string): AppData {
  const value: unknown = JSON.parse(json);
  if (!value || typeof value !== 'object') throw new Error('El archivo no contiene una copia válida.');
  const d = value as Record<string, unknown>;
  if (d.schemaVersion !== 1 || !Array.isArray(d.categories) || !Array.isArray(d.tasks)) {
    throw new Error('Formato de copia no compatible.');
  }
  const categories = d.categories as Record<string, unknown>[];
  const tasks = d.tasks as Record<string, unknown>[];
  if (!categories.every(c => c && typeof c.id === 'string' && typeof c.emoji === 'string' && c.emoji.length <= 32 && typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color) && typeof c.createdAt === 'number') ||
      !tasks.every(t => t && typeof t.id === 'string' && typeof t.createdAt === 'number' && (t.cutoffDate === undefined || isValidDateKey(t.cutoffDate)) &&
        Array.isArray(t.revisions) && t.revisions.length > 0 && t.revisions.every((r: unknown) => {
          if (!r || typeof r !== 'object') return false;
          const rev = r as Record<string, unknown>;
          return typeof rev.id === 'string' && isValidDateKey(rev.effectiveFrom) &&
            typeof rev.title === 'string' && rev.title.trim().length > 0 && rev.title.length <= 500 &&
            (rev.categoryId === null || typeof rev.categoryId === 'string') && isSchedule(rev.schedule);
        }))) {
    throw new Error('La copia contiene tareas o categorías inválidas.');
  }
  if (new Set(tasks.map(t => t.id)).size !== tasks.length || new Set(categories.map(c => c.id)).size !== categories.length) {
    throw new Error('La copia contiene identificadores duplicados.');
  }
  const completions = d.completions;
  const hiddenDates = d.hiddenDates;
  const dayOrder = d.dayOrder;
  const settings = d.settings;
  if (!completions || typeof completions !== 'object' || Array.isArray(completions) ||
      !Object.entries(completions).every(([k, v]) => /^.+\|\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'boolean') ||
      !hiddenDates || typeof hiddenDates !== 'object' || Array.isArray(hiddenDates) ||
      !Object.values(hiddenDates).every(v => Array.isArray(v) && v.every(isValidDateKey)) ||
      !dayOrder || typeof dayOrder !== 'object' || Array.isArray(dayOrder) ||
      !Object.entries(dayOrder).every(([k, v]) => isValidDateKey(k) && Array.isArray(v) && v.every(id => typeof id === 'string')) ||
      !settings || typeof settings !== 'object' || !['manual', 'newest', 'category'].includes((settings as Record<string, unknown>).sortMode as string)) {
    throw new Error('La copia tiene una estructura incompleta.');
  }
  // Crear exclusivamente los campos conocidos (evita arrastrar datos extraños).
  return {
    schemaVersion: 1,
    categories: categories as unknown as Category[],
    tasks: tasks as unknown as Task[],
    completions: completions as Record<string, boolean>,
    hiddenDates: hiddenDates as Record<string, DateKey[]>,
    dayOrder: dayOrder as Record<DateKey, string[]>,
    settings: { sortMode: (settings as { sortMode: SortMode }).sortMode }
  };
}
