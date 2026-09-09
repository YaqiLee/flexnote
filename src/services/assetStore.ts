const DB_NAME = 'flexnote-assets'
const STORE_NAME = 'images'
const DB_VERSION = 1

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveAsset(id: string, data: ArrayBuffer | Blob): Promise<void> {
  if (isTauri()) {
    const { writeFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    try {
      await mkdir('assets', { baseDir: BaseDirectory.AppData, recursive: true })
    } catch { /* dir may exist */ }
    const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data)
    await writeFile(`assets/${id}`, bytes, { baseDir: BaseDirectory.AppData })
  } else {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(data, id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export async function loadAsset(id: string): Promise<Blob | null> {
  if (isTauri()) {
    try {
      const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      const bytes = await readFile(`assets/${id}`, { baseDir: BaseDirectory.AppData })
      return new Blob([bytes])
    } catch {
      return null
    }
  } else {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(id)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  }
}

export async function deleteAsset(id: string): Promise<void> {
  if (isTauri()) {
    try {
      const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      await remove(`assets/${id}`, { baseDir: BaseDirectory.AppData })
    } catch { /* ignore */ }
  } else {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export function assetUrl(id: string): string {
  return `asset://${id}`
}

export function isAssetRef(src: string | undefined): boolean {
  return !!src && src.startsWith('asset://')
}

export function getAssetId(src: string): string {
  return src.replace('asset://', '')
}
