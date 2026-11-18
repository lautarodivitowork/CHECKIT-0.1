import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyData, dateKey, shiftDate, weekday, occursOn, createTask, editTask,
  visibleOccurrences, toggleComplete, deleteOnlyOn, deleteFrom, orderedOccurrences,
  rememberManualOrder, moveTask, parseBackup, setSortMode
} from '../src/domain.ts';

const on = (data, date) => visibleOccurrences(data, date);
const fields = (title, schedule = { kind: 'daily' }, categoryId = null) => ({ title, schedule, categoryId });

// Fijar hora local. No se usan fechas UTC para navegar el calendario.
test('navegación de fechas y días de semana en hora local', () => {
  assert.equal(dateKey(new Date(2026, 10, 18, 0, 1)), '2026-11-18');
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2027-03-01', -1), '2027-02-28');
  assert.equal(weekday('2026-11-18'), 3); // miércoles
});

test('una vez, todos los días, lunes/miércoles/viernes y fechas sueltas', () => {
  assert.equal(occursOn({ kind: 'once', date: '2026-11-18' }, '2026-11-19'), false);
  assert.equal(occursOn({ kind: 'daily' }, '2026-11-19'), true);
  const schedule = { kind: 'weekly', weekdays: [1, 3, 5] };
  assert.equal(occursOn(schedule, '2026-11-18'), true); // miércoles
  assert.equal(occursOn(schedule, '2026-11-19'), false);
  assert.equal(occursOn(schedule, '2026-11-20'), true); // viernes
  const dates = { kind: 'dates', dates: ['2026-11-18', '2026-11-27'] };
  assert.equal(occursOn(dates, '2026-11-27'), true);
  assert.equal(occursOn(dates, '2026-11-20'), false);
});

test('recurrentes comienzan en la fecha seleccionada, no antes', () => {
  const data = createTask(emptyData(), '2026-11-18', fields('Rutina'));
  assert.equal(on(data, '2026-11-17').length, 0);
  assert.equal(on(data, '2026-11-18').length, 1);
  assert.equal(on(data, '2027-01-18').length, 1);
});

test('completar una aparición no completa las siguientes', () => {
  let data = createTask(emptyData(), '2026-11-18', fields('Leer'));
  const id = data.tasks[0].id;
  data = toggleComplete(data, id, '2026-11-18');
  assert.equal(on(data, '2026-11-18')[0].completed, true);
  assert.equal(on(data, '2026-11-19')[0].completed, false);
  data = toggleComplete(data, id, '2026-11-18');
  assert.equal(on(data, '2026-11-18')[0].completed, false);
});

test('edición desde un día conserva títulos, categorías y reglas históricos', () => {
  let data = createTask(emptyData(), '2026-11-18', fields('Correr', { kind: 'daily' }, 'old-cat'));
  const id = data.tasks[0].id;
  data = editTask(data, id, '2026-11-20', fields('Caminar', { kind: 'weekly', weekdays: [1, 3, 5] }, 'new-cat'));
  assert.equal(on(data, '2026-11-19')[0].revision.title, 'Correr');
  assert.equal(on(data, '2026-11-19')[0].revision.categoryId, 'old-cat');
  assert.equal(on(data, '2026-11-20')[0].revision.title, 'Caminar');
  assert.equal(on(data, '2026-11-20')[0].revision.categoryId, 'new-cat');
  assert.equal(on(data, '2026-11-21').length, 0);
  assert.equal(data.tasks[0].revisions.length, 2);
});

test('editar desde una fecha descarta revisiones futuras superadas', () => {
  let data = createTask(emptyData(), '2026-11-18', fields('Original'));
  const id = data.tasks[0].id;
  data = editTask(data, id, '2026-11-25', fields('Versión futura'));
  data = editTask(data, id, '2026-11-20', fields('Nueva versión desde el 20'));
  assert.equal(on(data, '2026-11-19')[0].revision.title, 'Original');
  assert.equal(on(data, '2026-11-26')[0].revision.title, 'Nueva versión desde el 20');
});

test('eliminar solo un día no altera otros; eliminar desde un día conserva pasado', () => {
  let data = createTask(emptyData(), '2026-11-18', fields('Práctica'));
  const id = data.tasks[0].id;
  data = deleteOnlyOn(data, id, '2026-11-19');
  assert.equal(on(data, '2026-11-19').length, 0);
  assert.equal(on(data, '2026-11-18').length, 1);
  assert.equal(on(data, '2026-11-20').length, 1);
  data = deleteFrom(data, id, '2026-11-20');
  assert.equal(on(data, '2026-11-18').length, 1);
  assert.equal(on(data, '2026-11-20').length, 0);
  assert.equal(on(data, '2028-01-01').length, 0);
});

test('completadas siempre abajo, incluso con orden manual', () => {
  let data = createTask(emptyData(), '2026-11-18', fields('Primera'));
  data = createTask(data, '2026-11-18', fields('Segunda'));
  data = createTask(data, '2026-11-18', fields('Tercera'));
  const [id1, id2, id3] = data.tasks.map(t => t.id);
  data = rememberManualOrder(data, '2026-11-18', [id3, id2, id1]);
  data = toggleComplete(data, id3, '2026-11-18');
  assert.deepEqual(orderedOccurrences(data, '2026-11-18').map(o => o.task.id), [id2, id1, id3]);
  data = moveTask(data, '2026-11-18', id1, id2);
  assert.deepEqual(orderedOccurrences(data, '2026-11-18').map(o => o.task.id), [id1, id2, id3]);
  assert.equal(orderedOccurrences(data, '2026-11-19').every(o => !o.completed), true);
});

test('orden por categoría mantiene identidades separadas aun con el mismo color', () => {
  let data = emptyData();
  data = { ...data, categories: [
    { id: 'cat-a', color: '#efd8ae', emoji: '🏋️', createdAt: 1 },
    { id: 'cat-b', color: '#efd8ae', emoji: '📚', createdAt: 2 }
  ] };
  data = createTask(data, '2026-11-18', fields('A1', { kind: 'daily' }, 'cat-a'));
  data = createTask(data, '2026-11-18', fields('B1', { kind: 'daily' }, 'cat-b'));
  data = createTask(data, '2026-11-18', fields('A2', { kind: 'daily' }, 'cat-a'));
  data = setSortMode(data, 'category');
  assert.deepEqual(orderedOccurrences(data, '2026-11-18').map(o => o.revision.title), ['A1', 'A2', 'B1']);
});

test('copias JSON: ida/vuelta y rechazo de contenido inválido', () => {
  let data = createTask(emptyData(), '2026-11-18', fields('Comida', { kind: 'once', date: '2026-11-18' }));
  data = toggleComplete(data, data.tasks[0].id, '2026-11-18');
  assert.deepEqual(parseBackup(JSON.stringify(data)), data);
  assert.throws(() => parseBackup('{bad'), SyntaxError);
  assert.throws(() => parseBackup(JSON.stringify({ ...data, schemaVersion: 999 })), /no compatible/i);
  assert.throws(() => parseBackup(JSON.stringify({ ...data, tasks: [{ ...data.tasks[0], revisions: [{ ...data.tasks[0].revisions[0], schedule: { kind: 'daily-something' } }] }] })), /inválid/i);
});

test('fechas puntuales: eliminar un día no elimina las otras fechas del conjunto', () => {
  let data = createTask(emptyData(), '2026-11-18', fields('Concierto', {
    kind: 'dates', dates: ['2026-11-18', '2026-11-22', '2026-12-01']
  }));
  const id = data.tasks[0].id;
  data = deleteOnlyOn(data, id, '2026-11-22');
  assert.equal(on(data, '2026-11-18').length, 1);
  assert.equal(on(data, '2026-11-22').length, 0);
  assert.equal(on(data, '2026-12-01').length, 1);
});

test('cambiar un evento único desde su fecha no crea apariciones antiguas', () => {
  let data = createTask(emptyData(), '2026-11-18', fields('Trámite', { kind: 'once', date: '2026-11-18' }));
  data = editTask(data, data.tasks[0].id, '2026-11-18', fields('Nuevo trámite', { kind: 'once', date: '2026-11-18' }));
  assert.equal(on(data, '2026-11-17').length, 0);
  assert.equal(on(data, '2026-11-18')[0].revision.title, 'Nuevo trámite');
  assert.equal(on(data, '2026-11-19').length, 0);
});

test('las completadas quedan al final en los tres criterios', () => {
  let data = emptyData();
  data = createTask(data, '2026-11-18', fields('Incompleta'));
  data = createTask(data, '2026-11-18', fields('Completa'));
  data = toggleComplete(data, data.tasks[1].id, '2026-11-18');
  for (const sort of ['manual', 'newest', 'category']) {
    data = setSortMode(data, sort);
    assert.deepEqual(orderedOccurrences(data, '2026-11-18').map(o => o.completed), [false, true]);
  }
});
