// IndexedDB wrapper for IronLog
const DB_NAME = 'ironlog';
const DB_VER = 1;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      // Workouts store: { id, date (YYYY-MM-DD), clientId, notes, exercises: [{exerciseId, name, sets:[{reps,weight,done}]}] }
      if (!db.objectStoreNames.contains('workouts')) {
        const ws = db.createObjectStore('workouts', { keyPath: 'id' });
        ws.createIndex('date', 'date');
        ws.createIndex('clientId', 'clientId');
      }
      // Clients store
      if (!db.objectStoreNames.contains('clients')) {
        const cs = db.createObjectStore('clients', { keyPath: 'id' });
        cs.createIndex('name', 'name');
      }
      // Custom exercises
      if (!db.objectStoreNames.contains('customExercises')) {
        db.createObjectStore('customExercises', { keyPath: 'id' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = e => rej(e.target.error);
  });
}

function tx(store, mode = 'readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

function idbGet(store, key) {
  return tx(store).then(s => new Promise((res, rej) => {
    const r = s.get(key); r.onsuccess = () => res(r.result); r.onerror = e => rej(e);
  }));
}
function idbGetAll(store) {
  return tx(store).then(s => new Promise((res, rej) => {
    const r = s.getAll(); r.onsuccess = () => res(r.result); r.onerror = e => rej(e);
  }));
}
function idbPut(store, val) {
  return tx(store, 'readwrite').then(s => new Promise((res, rej) => {
    const r = s.put(val); r.onsuccess = () => res(r.result); r.onerror = e => rej(e);
  }));
}
function idbDelete(store, key) {
  return tx(store, 'readwrite').then(s => new Promise((res, rej) => {
    const r = s.delete(key); r.onsuccess = () => res(); r.onerror = e => rej(e);
  }));
}
function idbGetByIndex(store, index, val) {
  return tx(store).then(s => new Promise((res, rej) => {
    const r = s.index(index).getAll(val);
    r.onsuccess = () => res(r.result); r.onerror = e => rej(e);
  }));
}

const DB = {
  // Workouts
  saveWorkout: w => idbPut('workouts', w),
  getWorkout: id => idbGet('workouts', id),
  getAllWorkouts: () => idbGetAll('workouts'),
  getWorkoutsByDate: date => idbGetByIndex('workouts', 'date', date),
  getWorkoutsByClient: clientId => idbGetByIndex('workouts', 'clientId', clientId),
  deleteWorkout: id => idbDelete('workouts', id),
  // Clients
  saveClient: c => idbPut('clients', c),
  getClient: id => idbGet('clients', id),
  getAllClients: () => idbGetAll('clients'),
  deleteClient: id => idbDelete('clients', id),
  // Custom exercises
  saveCustomExercise: e => idbPut('customExercises', e),
  getAllCustomExercises: () => idbGetAll('customExercises'),
  deleteCustomExercise: id => idbDelete('customExercises', id),
};
