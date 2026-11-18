import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent, KeyboardEvent, TouchEvent, MouseEvent, ReactNode } from 'react';
import {
  COLORS, createTask, dateKey, deleteFrom, deleteOnlyOn, editTask, formatDisplayDate,
  moveTask, orderedOccurrences, parseBackup, rememberManualOrder, setSortMode,
  shiftDate, toggleComplete, visibleOccurrences
} from './domain.ts';
import { createBackup, loadData, saveData } from './storage.ts';
import type { AppData, Category, DateKey, Schedule, SortMode, TaskFormValue } from './types.ts';

type IconName = 'left' | 'right' | 'sort' | 'plus' | 'x' | 'check' | 'download' | 'upload' | 'archive' | 'trash' | 'pencil';

function Icon({ name, size = 21 }: { name: IconName; size?: number }) {
  const contents: Record<IconName, ReactNode> = {
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    sort: <><path d="M4 7h16M7 12h10m-7 5h4" /><circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" /></>,
    upload: <><path d="M12 21V9m-4 4 4-4 4 4M4 7V4h16v3" /></>,
    archive: <><rect x="4" y="4" width="16" height="5" rx="1" /><path d="M5 9v11h14V9m-9 5h4" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></>,
    pencil: <><path d="m4 20 4.3-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z" /><path d="m14.5 6.5 3 3" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{contents[name]}</svg>;
}

function Modal({ children, onClose, compact = false }: { children: ReactNode; onClose: () => void; compact?: boolean }) {
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    // iPhone: no mover el documento detrás de la hoja.
    document.body.classList.add('modal-open');
    return () => { document.removeEventListener('keydown', escape); document.body.classList.remove('modal-open'); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" className={`sheet ${compact ? 'sheet--compact' : ''}`}>{children}</section>
  </div>;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function CategoryDot({ category, selected = false, onClick, name }: {
  category: Category; selected?: boolean; onClick?: () => void; name?: string;
}) {
  return <button type="button" className={`category-dot ${selected ? 'category-dot--selected' : ''}`}
    style={{ '--dot-color': category.color } as CSSProperties} title={name || `Categoría ${category.emoji}`}
    aria-label={`Categoría ${category.emoji}${selected ? ', seleccionada' : ''}`} aria-pressed={selected}
    onClick={onClick}><span aria-hidden="true">{category.emoji}</span></button>;
}

function TaskEditor({ selectedDate, categories, initial, onSave, onCreateCategory, onClose }: {
  selectedDate: DateKey;
  categories: Category[];
  initial?: TaskFormValue;
  onSave: (fields: TaskFormValue) => void;
  onCreateCategory: (color: string, emoji: string) => string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [kind, setKind] = useState<Schedule['kind']>(initial?.schedule.kind ?? 'once');
  const [weekdays, setWeekdays] = useState<number[]>(initial?.schedule.kind === 'weekly' ? initial.schedule.weekdays : [1, 2, 3, 4, 5, 6, 7]);
  const [dates, setDates] = useState<DateKey[]>(initial?.schedule.kind === 'dates' ? initial.schedule.dates.filter(d => d >= selectedDate) : [selectedDate]);
  const [dateToAdd, setDateToAdd] = useState(selectedDate);
  const [categoryCreator, setCategoryCreator] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [emoji, setEmoji] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) { setError('Escribí un título para la tarea.'); return; }
    if (kind === 'weekly' && !weekdays.length) { setError('Elegí al menos un día de la semana.'); return; }
    if (kind === 'dates' && !dates.length) { setError('Elegí al menos una fecha.'); return; }
    const schedule: Schedule = kind === 'once' ? { kind: 'once', date: selectedDate } :
      kind === 'daily' ? { kind: 'daily' } : kind === 'weekly' ? { kind: 'weekly', weekdays: [...weekdays].sort() } :
      { kind: 'dates', dates: [...dates].sort() };
    onSave({ title: cleanTitle, categoryId, schedule });
  }

  function addCategory() {
    if (!emoji.trim()) { setError('Elegí un emoji para la categoría.'); return; }
    // Los emoji compuestos (por ejemplo, con tono de piel) también son válidos.
    const id = onCreateCategory(color, emoji.trim().slice(0, 32));
    setCategoryId(id);
    setCategoryCreator(false);
    setError('');
  }

  return <>
    <header className="sheet-header">
      <div><p className="eyebrow">{initial ? 'MODIFICAR' : 'NUEVA'}</p><h2>{initial ? 'Editar tarea' : 'Crear tarea'}</h2></div>
      <button className="icon-button close-button" aria-label="Cerrar" onClick={onClose}><Icon name="x" /></button>
    </header>
    <form className="editor-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor="task-title">Título</label>
        <input id="task-title" className="title-input" type="text" autoFocus maxLength={500} autoComplete="off"
          placeholder="¿Qué vas a hacer?" value={title} onChange={e => { setTitle(e.target.value); setError(''); }} />
      </div>
      <div className="field">
        <div className="field-heading"><span>Categoría</span><span className="field-subtitle">Color + emoji</span></div>
        <div className="category-list">
          <button type="button" className={`category-none ${categoryId === null ? 'category-none--selected' : ''}`}
            aria-label="Sin categoría" aria-pressed={categoryId === null} onClick={() => setCategoryId(null)}><span className="category-none-symbol" /></button>
          {categories.map(category => <CategoryDot key={category.id} category={category} selected={category.id === categoryId} onClick={() => setCategoryId(category.id)} />)}
          <button type="button" className="category-add" title="Nueva categoría" aria-label="Crear categoría" onClick={() => setCategoryCreator(!categoryCreator)}><Icon name="plus" size={20} /></button>
        </div>
        {categoryCreator && <div className="category-creator">
          <div className="creator-heading"><span>Crear categoría</span><button type="button" className="text-button" onClick={() => setCategoryCreator(false)}>Cancelar</button></div>
          <div className="color-list" aria-label="Elegir color">
            {COLORS.map(c => <button key={c} type="button" className={`color-swatch ${color === c ? 'color-swatch--selected' : ''}`}
              style={{ backgroundColor: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} aria-pressed={color === c}>{color === c && <Icon name="check" size={17} />}</button>)}
          </div>
          <div className="emoji-create-row">
            <div className="emoji-preview" style={{ backgroundColor: color }}>{emoji || '＋'}</div>
            <input className="emoji-input" type="text" aria-label="Emoji de categoría" placeholder="Elegí un emoji 😀" value={emoji} maxLength={32}
              onChange={e => { setEmoji(e.target.value); setError(''); }} />
            <button type="button" className="small-solid-button" onClick={addCategory}>Crear</button>
          </div>
        </div>}
      </div>
      <div className="field">
        <label>Frecuencia</label>
        <div className="frequency-options" role="radiogroup" aria-label="Frecuencia de la tarea">
          {([['once', 'Una sola vez'], ['daily', 'Todos los días'], ['weekly', 'Días de la semana'], ['dates', 'Fechas puntuales']] as const).map(([value, label]) =>
            <button key={value} type="button" role="radio" aria-checked={kind === value}
              className={`frequency-item ${kind === value ? 'frequency-item--active' : ''}`}
              onClick={() => { setKind(value); setError(''); }}>
              <span className="frequency-radio" />{label}
            </button>)}
        </div>
        {kind === 'weekly' && <div className="weekday-panel"><p>Elegí los días</p><div className="weekday-list">
          {WEEKDAYS.map((day, i) => <button type="button" key={i} className={`weekday-button ${weekdays.includes(i + 1) ? 'weekday-button--active' : ''}`}
            aria-label={WEEKDAY_LABELS[i]} aria-pressed={weekdays.includes(i + 1)}
            onClick={() => { setWeekdays(prev => prev.includes(i + 1) ? prev.filter(d => d !== i + 1) : [...prev, i + 1]); setError(''); }}>{day}</button>)}
        </div></div>}
        {kind === 'dates' && <div className="dates-panel">
          <p>Fechas seleccionadas</p>
          <div className="date-chips">{[...dates].sort().map(d => <button type="button" className="date-chip" key={d} onClick={() => setDates(prev => prev.filter(x => x !== d))}
            aria-label={`Quitar ${new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${d}T12:00:00`))}`}>
            {new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00`))} <Icon name="x" size={13} /></button>)}</div>
          <div className="add-specific-date"><input type="date" min={selectedDate} value={dateToAdd} aria-label="Elegir una fecha puntual"
            onChange={e => setDateToAdd(e.target.value)} /><button type="button" className="secondary-small" onClick={() => {
              if (dateToAdd >= selectedDate && !dates.includes(dateToAdd)) setDates(prev => [...prev, dateToAdd]);
              setError('');
            }}><Icon name="plus" size={17} /> Añadir</button></div>
        </div>}
        <p className="hint">{kind === 'once' ? 'Solo para la fecha seleccionada.' : `Comienza el ${new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(new Date(`${selectedDate}T12:00:00`))}.`}</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" className="primary-button">{initial ? 'Guardar cambios' : 'Guardar tarea'}</button>
    </form>
  </>;
}

function BackupSheet({ data, onImport, onClose, onToast }: {
  data: AppData; onImport: (data: AppData) => void; onClose: () => void; onToast: (s: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  async function exportData() {
    const filename = `tareas-respaldo-${dateKey()}.json`;
    const blob = new Blob([createBackup(data)], { type: 'application/json' });
    const file = new File([blob], filename, { type: 'application/json' });
    try {
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Copia de seguridad de Tareas' });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
      onToast('Copia de seguridad preparada');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('No se pudo exportar. Probá desde Safari.');
    }
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('El archivo es demasiado grande.');
      const parsed = parseBackup(await file.text());
      if (!window.confirm('¿Reemplazar todas las tareas y categorías actuales con esta copia? Esta acción no se puede deshacer.')) return;
      onImport(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el archivo.');
    } finally {
      event.target.value = '';
    }
  }

  return <>
    <header className="sheet-header"><div><p className="eyebrow">ALMACENAMIENTO LOCAL</p><h2>Tus datos</h2></div>
      <button className="icon-button close-button" aria-label="Cerrar" onClick={onClose}><Icon name="x" /></button></header>
    <div className="backup-body">
      <p>Las tareas se guardan en este dispositivo. No se sincronizan entre el iPhone y otros equipos.</p>
      <button type="button" className="backup-action" onClick={exportData}><span className="backup-action-icon"><Icon name="download" /></span><span><strong>Exportar copia</strong><small>Guardar o compartir un archivo JSON.</small></span><Icon name="right" size={18} /></button>
      <button type="button" className="backup-action" onClick={() => fileRef.current?.click()}><span className="backup-action-icon"><Icon name="upload" /></span><span><strong>Importar copia</strong><small>Reemplaza los datos actuales.</small></span><Icon name="right" size={18} /></button>
      <input type="file" accept=".json,application/json" ref={fileRef} hidden onChange={importData} />
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </>;
}

type Gesture = {
  taskId: string; input: 'touch' | 'mouse'; startX: number; startY: number;
  armed: boolean; dragging: boolean; timeoutId: number; lastReorder: number;
};

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [selectedDate, setSelectedDate] = useState<DateKey>(() => dateKey());
  const [today, setToday] = useState<DateKey>(() => dateKey());
  const [modal, setModal] = useState<'editor' | 'delete' | 'backup' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [context, setContext] = useState<{ taskId: string; x: number; y: number } | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const [toast, setToast] = useState('');
  const [saveProblem, setSaveProblem] = useState(false);
  const toastTimeout = useRef<number>(0);
  const gesture = useRef<Gesture | null>(null);
  const lastTouchAt = useRef(0);
  const suppressClickBefore = useRef(0);
  const positions = useRef<Map<string, DOMRect>>(new Map());
  const initialized = useRef(false);

  const occurrences = useMemo(() => data ? orderedOccurrences(data, selectedDate) : [], [data, selectedDate]);
  const live = useRef({ date: selectedDate, occurrences });
  live.current = { date: selectedDate, occurrences };

  useEffect(() => {
    let active = true;
    loadData().then(result => { if (active) { initialized.current = true; setData(result); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!initialized.current || !data) return;
    saveData(data).then(() => setSaveProblem(false)).catch(() => setSaveProblem(true));
  }, [data]);

  useEffect(() => {
    const syncToday = () => setToday(dateKey());
    document.addEventListener('visibilitychange', syncToday);
    window.addEventListener('focus', syncToday);
    return () => { document.removeEventListener('visibilitychange', syncToday); window.removeEventListener('focus', syncToday); };
  }, []);

  const toastMessage = useCallback((message: string) => {
    window.clearTimeout(toastTimeout.current);
    setToast(message);
    toastTimeout.current = window.setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimeout.current), []);

  // FLIP: animación real de reordenamiento (no depende del número de tareas).
  const layoutSignature = occurrences.map(o => `${o.task.id}:${o.completed}`).join(',');
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLElement>('[data-task-id]').forEach(node => {
      const id = node.dataset.taskId || '';
      const rect = node.getBoundingClientRect();
      next.set(id, rect);
      const previous = positions.current.get(id);
      const delta = previous ? previous.top - rect.top : 0;
      if (previous && Math.abs(delta) > 2 && Math.abs(delta) < 1200 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        node.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], { duration: 240, easing: 'cubic-bezier(.2,.75,.25,1)' });
      }
    });
    positions.current = next;
  }, [layoutSignature, selectedDate]);

  const openContext = useCallback((taskId: string, x: number, y: number) => {
    setSortOpen(false);
    const width = 205;
    setContext({ taskId, x: Math.max(12, Math.min(window.innerWidth - width - 12, x - 28)),
      y: Math.max(74, Math.min(window.innerHeight - 154, y + 13)) });
  }, []);

  const cancelGesture = useCallback(() => {
    if (gesture.current) window.clearTimeout(gesture.current.timeoutId);
    gesture.current = null;
    setGhost(null);
  }, []);

  const startGesture = useCallback((id: string, x: number, y: number, input: 'touch' | 'mouse') => {
    if (gesture.current) window.clearTimeout(gesture.current.timeoutId);
    const next: Gesture = { taskId: id, input, startX: x, startY: y, armed: false, dragging: false, timeoutId: 0, lastReorder: 0 };
    next.timeoutId = window.setTimeout(() => {
      if (gesture.current !== next) return;
      next.armed = true;
      suppressClickBefore.current = Date.now() + 850;
      openContext(id, x, y);
    }, 440);
    gesture.current = next;
  }, [openContext]);

  const moveGesture = useCallback((x: number, y: number) => {
    const active = gesture.current;
    if (!active) return false;
    const traveled = Math.hypot(x - active.startX, y - active.startY);
    if (!active.armed) {
      if (traveled > 9) cancelGesture(); // desplazamiento normal del listado
      return false;
    }
    if (!active.dragging && traveled >= 9) {
      active.dragging = true;
      setContext(null);
      const { occurrences: current, date } = live.current;
      setData(prev => prev ? rememberManualOrder(prev, date, current.map(o => o.task.id)) : prev);
    }
    if (!active.dragging) return true;
    setGhost({ id: active.taskId, x, y });
    const now = performance.now();
    if (now - active.lastReorder < 65) return true;
    const target = Array.from(document.querySelectorAll<HTMLElement>('[data-task-id]'))
      .find(node => { const r = node.getBoundingClientRect(); return y >= r.top && y <= r.bottom; });
    const targetId = target?.dataset.taskId;
    if (targetId && targetId !== active.taskId) {
      const date = live.current.date;
      setData(prev => prev ? moveTask(prev, date, active.taskId, targetId) : prev);
      active.lastReorder = now;
    }
    return true;
  }, [cancelGesture]);

  const endGesture = useCallback(() => {
    const active = gesture.current;
    if (!active) return;
    window.clearTimeout(active.timeoutId);
    if (active.armed) suppressClickBefore.current = Date.now() + 850;
    if (active.dragging) { setGhost(null); setContext(null); }
    gesture.current = null;
  }, []);

  // Registramos touchmove como no pasivo: solo bloqueamos el scroll una vez
  // transcurrida la pulsación prolongada y comenzado el gesto de arrastre.
  useEffect(() => {
    const onTouchMove = (event: globalThis.TouchEvent) => {
      if (gesture.current?.input !== 'touch') return;
      const t = event.touches[0];
      if (t && moveGesture(t.clientX, t.clientY)) event.preventDefault();
    };
    const onTouchEnd = () => { if (gesture.current?.input === 'touch') endGesture(); };
    const onMouseMove = (event: globalThis.MouseEvent) => {
      if (gesture.current?.input === 'mouse') moveGesture(event.clientX, event.clientY);
    };
    const onMouseUp = () => { if (gesture.current?.input === 'mouse') endGesture(); };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [moveGesture, endGesture]);

  function touchStart(event: TouchEvent<HTMLDivElement>, id: string) {
    if (event.touches.length !== 1) return;
    lastTouchAt.current = Date.now();
    startGesture(id, event.touches[0].clientX, event.touches[0].clientY, 'touch');
  }

  function mouseDown(event: MouseEvent<HTMLDivElement>, id: string) {
    if (event.button !== 0 || Date.now() - lastTouchAt.current < 1000) return;
    startGesture(id, event.clientX, event.clientY, 'mouse');
  }

  function taskClick(id: string) {
    if (Date.now() < suppressClickBefore.current || context || ghost) return;
    setData(prev => prev ? toggleComplete(prev, id, selectedDate) : prev);
  }

  function taskKeyDown(event: KeyboardEvent<HTMLDivElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); taskClick(id);
    } else if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault();
      const r = event.currentTarget.getBoundingClientRect();
      openContext(id, r.right - 30, r.bottom);
    }
  }

  function openEditor(id: string | null) {
    cancelGesture(); setContext(null); setSortOpen(false);
    setEditingId(id);
    setModal('editor');
  }

  function saveTask(fields: TaskFormValue) {
    setData(prev => prev ? (editingId ? editTask(prev, editingId, selectedDate, fields) : createTask(prev, selectedDate, fields)) : prev);
    setModal(null);
    toastMessage(editingId ? 'Tarea actualizada' : 'Tarea creada');
  }

  function addCategory(color: string, emoji: string): string {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `category-${Date.now()}-${Math.random()}`;
    setData(prev => prev ? { ...prev, categories: [...prev.categories, { id, color, emoji, createdAt: Date.now() }] } : prev);
    return id;
  }

  function deleteTask(onlyToday: boolean) {
    if (!deleteId) return;
    setData(prev => prev ? onlyToday ? deleteOnlyOn(prev, deleteId, selectedDate) : deleteFrom(prev, deleteId, selectedDate) : prev);
    setModal(null); setDeleteId(null);
    toastMessage('Tarea eliminada');
  }

  const sortedTitle = data?.settings.sortMode === 'manual' ? 'Orden manual' : data?.settings.sortMode === 'newest' ? 'Más recientes primero' : 'Por categoría';
  const modalRevision = editingId && data ? visibleOccurrences(data, selectedDate).find(o => o.task.id === editingId)?.revision : undefined;
  const ghostOccurrence = ghost && data ? occurrences.find(o => o.task.id === ghost.id) : null;

  return <main className="app-shell">
    <div className="app-content">
      <header className="app-header">
        <div className="date-toolbar">
          <button className="nav-button" aria-label="Día anterior" onClick={() => { setSelectedDate(prev => shiftDate(prev, -1)); setContext(null); setSortOpen(false); }}><Icon name="left" /></button>
          <button className="date-button" aria-label={`Fecha seleccionada: ${formatDisplayDate(selectedDate, today)}. Volver a hoy.`}
            onClick={() => { setSelectedDate(dateKey()); setToday(dateKey()); setContext(null); }}>
            <span className="date-weekday">{formatDisplayDate(selectedDate, today).split(',')[0]}</span>
            <span className="date-main">{formatDisplayDate(selectedDate, today).split(',').slice(1).join(',').trim()}</span>
            {selectedDate === today && <span className="today-indicator">HOY</span>}
          </button>
          <button className="nav-button" aria-label="Día siguiente" onClick={() => { setSelectedDate(prev => shiftDate(prev, 1)); setContext(null); setSortOpen(false); }}><Icon name="right" /></button>
          <div className="sort-wrapper">
            <button className={`sort-button ${sortOpen ? 'sort-button--active' : ''}`} aria-label={`Ordenar tareas. ${sortedTitle}`} aria-expanded={sortOpen}
              onClick={() => { setSortOpen(prev => !prev); setContext(null); }}><Icon name="sort" size={23} /></button>
            {sortOpen && <>
              <button className="popover-dismiss" aria-label="Cerrar opciones de ordenamiento" onClick={() => setSortOpen(false)} />
              <div className="sort-popover" role="menu" aria-label="Ordenamiento">
                {([['manual', 'Orden manual'], ['newest', 'Más recientes primero'], ['category', 'Por categoría']] as const).map(([mode, label]) =>
                  <button key={mode} type="button" role="menuitemradio" aria-checked={data?.settings.sortMode === mode}
                    onClick={() => { setData(prev => prev ? setSortMode(prev, mode as SortMode) : prev); setSortOpen(false); }}>
                    {label}{data?.settings.sortMode === mode && <Icon name="check" size={17} />}
                  </button>)}
              </div>
            </>}
          </div>
        </div>
      </header>

      {!data ? <div className="loading-space" aria-label="Cargando tareas" /> : <>
        <section className={`task-section ${!occurrences.length ? 'task-section--empty' : ''}`} aria-label="Tareas del día">
          {occurrences.length > 0 && <div className="task-list" key={selectedDate}>
            {occurrences.map(o => <div key={o.task.id} data-task-id={o.task.id} role="button" tabIndex={0}
              aria-pressed={o.completed} aria-label={`${o.revision.title}${o.completed ? ', completada' : ', pendiente'}`}
              className={`task-item ${o.completed ? 'task-item--complete' : ''} ${ghost?.id === o.task.id ? 'task-item--drag-source' : ''}`}
              style={{ '--task-color': o.category?.color || '#ebe9e5' } as CSSProperties}
              onTouchStart={event => touchStart(event, o.task.id)}
              onMouseDown={event => mouseDown(event, o.task.id)}
              onClick={() => taskClick(o.task.id)}
              onKeyDown={event => taskKeyDown(event, o.task.id)}
              onContextMenu={event => { event.preventDefault(); cancelGesture(); openContext(o.task.id, event.clientX, event.clientY); }}>
              <span className="task-title">{o.revision.title}</span>
              {o.category ? <span className="task-emoji" style={{ backgroundColor: o.category.color }} aria-hidden="true">{o.category.emoji}</span>
                : <span className="task-empty-category" aria-hidden="true" />}
            </div>)}
          </div>}
          <div className={`add-holder ${!occurrences.length ? 'add-holder--empty' : ''}`}>
            <button className="add-button" aria-label="Añadir tarea" onClick={() => openEditor(null)}><Icon name="plus" size={30} /></button>
          </div>
        </section>
        <footer className="app-footer"><button type="button" className="data-button" onClick={() => { setModal('backup'); setContext(null); setSortOpen(false); }}
          aria-label="Copias de seguridad y datos"><Icon name="archive" size={19} /></button></footer>
      </>}
    </div>

    {context && <>
      <button className="context-dismiss" aria-label="Cerrar menú contextual" onClick={() => setContext(null)} />
      <div className="context-popover" style={{ left: context.x, top: context.y }} role="menu">
        <button type="button" role="menuitem" onClick={() => openEditor(context.taskId)}><Icon name="pencil" size={18} /> Editar tarea</button>
        <button type="button" className="destructive-option" role="menuitem" onClick={() => { setDeleteId(context.taskId); setContext(null); setModal('delete'); }}><Icon name="trash" size={18} /> Eliminar tarea</button>
      </div>
    </>}
    {ghostOccurrence && <div className="drag-ghost" style={{ left: ghost!.x, top: ghost!.y, '--task-color': ghostOccurrence.category?.color || '#ebe9e5' } as CSSProperties} aria-hidden="true">
      <span className="task-title">{ghostOccurrence.revision.title}</span>
      {ghostOccurrence.category && <span className="task-emoji">{ghostOccurrence.category.emoji}</span>}
    </div>}
    {modal === 'editor' && data && <Modal onClose={() => setModal(null)}>
      <TaskEditor key={`${editingId || 'new'}-${selectedDate}`} selectedDate={selectedDate} categories={data.categories}
        initial={modalRevision ? { title: modalRevision.title, categoryId: modalRevision.categoryId, schedule: modalRevision.schedule } : undefined}
        onSave={saveTask} onCreateCategory={addCategory} onClose={() => setModal(null)} />
    </Modal>}
    {modal === 'delete' && <Modal compact onClose={() => setModal(null)}>
      <header className="sheet-header"><div><p className="eyebrow">CONFIRMAR</p><h2>Eliminar tarea</h2></div><button className="icon-button close-button" aria-label="Cerrar" onClick={() => setModal(null)}><Icon name="x" /></button></header>
      <div className="delete-options">
        <p>¿Desde cuándo querés eliminarla?</p>
        <button type="button" onClick={() => deleteTask(true)}><strong>Solo de este día</strong><span>Las demás fechas no se modifican.</span></button>
        <button type="button" onClick={() => deleteTask(false)}><strong>Desde este día</strong><span>Se conserva todo lo anterior.</span></button>
        <button type="button" className="cancel-button" onClick={() => setModal(null)}>Cancelar</button>
      </div>
    </Modal>}
    {modal === 'backup' && data && <Modal compact onClose={() => setModal(null)}>
      <BackupSheet data={data} onClose={() => setModal(null)} onToast={toastMessage}
        onImport={imported => { setData(imported); setModal(null); toastMessage('Datos importados'); }} />
    </Modal>}
    {toast && <div className="toast" role="status">{toast}</div>}
    {saveProblem && <div className="save-error" role="alert">No se pudieron guardar los cambios. Exportá una copia.</div>}
  </main>;
}
