// 목업 모드 전용: 발표 자료 파일을 브라우저 IndexedDB에 보관한다 (localStorage는 용량이 작아서).
const DB_NAME = 'scoreroom-mock-files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putFile = (key: string, blob: Blob) => tx('readwrite', s => s.put(blob, key)).then(() => undefined);
export const getFile = (key: string) => tx<Blob | undefined>('readonly', s => s.get(key));
export const deleteFile = (key: string) => tx('readwrite', s => s.delete(key)).then(() => undefined);
export const clearFiles = () => tx('readwrite', s => s.clear()).then(() => undefined);
