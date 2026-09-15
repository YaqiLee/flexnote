import type { BlockData } from '../stores/canvas'
import type { NavGroup } from '../stores/nav'

export interface NoteData {
  id: string
  title: string
  starred: boolean
  blocks: BlockData[]
  updatedAt: number
}

export interface AppData {
  version: number
  groups: NavGroup[]
  notes: Record<string, NoteData>
  activeNoteId: string | null
}

const DATA_VERSION = 1
const FILE_NAME = 'flexnote-data.json'
const FILE_TMP_NAME = 'flexnote-data.json.tmp'
const LS_KEY = 'flexnote-data'
const BACKUP_DIR = 'backups'
const MAX_BACKUPS = 10
const BACKUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

let lastBackupTime = 0

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// All storage mutations are serialized through this queue so that
// read-modify-write cycles can never interleave and lose updates.
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task)
  writeQueue = run.catch(() => {})
  return run
}

function isValidAppData(data: any): data is AppData {
  return !!data && typeof data === 'object'
    && typeof data.version === 'number'
    && Array.isArray(data.groups)
    && !!data.notes && typeof data.notes === 'object'
}

async function createBackup(json: string): Promise<void> {
  const now = Date.now()
  if (now - lastBackupTime < BACKUP_INTERVAL_MS) return
  lastBackupTime = now

  try {
    if (isTauri()) {
      const { writeTextFile, mkdir, readDir, remove, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      const timestamp = new Date(now).toISOString().replace(/[:.]/g, '-')
      const backupName = `backup-${timestamp}.json`

      try {
        await mkdir(BACKUP_DIR, { baseDir: BaseDirectory.AppData, recursive: true })
      } catch { /* dir may already exist */ }
      await writeTextFile(`${BACKUP_DIR}/${backupName}`, json, { baseDir: BaseDirectory.AppData })

      // Prune old backups beyond MAX_BACKUPS
      try {
        const entries = await readDir(BACKUP_DIR, { baseDir: BaseDirectory.AppData })
        const backups = entries
          .filter(e => e.name?.startsWith('backup-') && e.name?.endsWith('.json'))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        while (backups.length > MAX_BACKUPS) {
          const oldest = backups.shift()!
          await remove(`${BACKUP_DIR}/${oldest.name!}`, { baseDir: BaseDirectory.AppData })
        }
      } catch {
        // Backup dir may not exist yet, ignore prune errors
      }
    } else {
      // Web: keep rolling backups in localStorage
      const timestamp = new Date(now).toISOString().replace(/[:.]/g, '-')
      const backupKey = `${LS_KEY}-backup-${timestamp}`
      localStorage.setItem(backupKey, json)

      // Prune old backups
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(`${LS_KEY}-backup-`)) keys.push(k)
      }
      keys.sort()
      while (keys.length > MAX_BACKUPS) {
        localStorage.removeItem(keys.shift()!)
      }
    }
  } catch (e) {
    console.warn('[Storage] Backup failed:', e)
  }
}

async function readAppDataRaw(): Promise<AppData | null> {
  if (isTauri()) {
    const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    const fileExists = await exists(FILE_NAME, { baseDir: BaseDirectory.AppData })
    if (!fileExists) return null
    const content = await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppData })
    const data = JSON.parse(content)
    return isValidAppData(data) ? data : null
  }
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return null
  const data = JSON.parse(raw)
  return isValidAppData(data) ? data : null
}

async function writeAppDataRaw(data: AppData): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  if (isTauri()) {
    const { writeTextFile, rename, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    // Write to a temp file first so an interrupted write can never corrupt the
    // main file. If rename is unavailable (missing capability), fall back to a
    // direct write so saving never breaks.
    try {
      await writeTextFile(FILE_TMP_NAME, json, { baseDir: BaseDirectory.AppData })
      await rename(FILE_TMP_NAME, FILE_NAME, {
        oldPathBaseDir: BaseDirectory.AppData,
        newPathBaseDir: BaseDirectory.AppData,
      })
    } catch (e) {
      console.warn('[Storage] Atomic write unavailable, falling back to direct write:', e)
      await writeTextFile(FILE_NAME, json, { baseDir: BaseDirectory.AppData })
    }
  } else {
    localStorage.setItem(LS_KEY, json)
  }
  createBackup(json).catch(() => {})
}

export async function saveAppData(data: AppData): Promise<void> {
  await enqueueWrite(() => writeAppDataRaw(data))
}

/**
 * Runs a read-modify-write cycle against the persisted data atomically with
 * respect to every other storage mutation. The mutator may edit `data` in
 * place; if it returns `false` the result is discarded without writing.
 */
export async function mutateAppData(
  mutator: (data: AppData) => void | boolean | Promise<void | boolean>,
): Promise<AppData | null> {
  return enqueueWrite(async () => {
    let data: AppData | null = null
    try {
      data = await readAppDataRaw()
    } catch (e) {
      console.error('[Storage] Read failed during mutation:', e)
    }
    if (!data) return null
    const result = await mutator(data)
    if (result === false) return data
    await writeAppDataRaw(data)
    return data
  })
}

export async function loadAppData(): Promise<AppData | null> {
  // Wait for any in-flight write so callers never observe a stale snapshot
  await writeQueue.catch(() => {})
  try {
    const data = await readAppDataRaw()
    if (data && data.version !== DATA_VERSION) {
      console.warn('Data version mismatch, may need migration')
    }
    return data
  } catch (e) {
    console.error('[Storage] Failed to load app data, attempting backup recovery:', e)
    return recoverFromBackup()
  }
}

/**
 * Recovers the newest readable backup when the primary file is missing or corrupt.
 */
async function recoverFromBackup(): Promise<AppData | null> {
  try {
    if (isTauri()) {
      const { readTextFile, readDir, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      const dirExists = await exists(BACKUP_DIR, { baseDir: BaseDirectory.AppData })
      if (!dirExists) return null
      const entries = await readDir(BACKUP_DIR, { baseDir: BaseDirectory.AppData })
      const backups = entries
        .filter(e => e.name?.startsWith('backup-') && e.name?.endsWith('.json'))
        .sort((a, b) => (b.name || '').localeCompare(a.name || ''))
      for (const entry of backups) {
        try {
          const content = await readTextFile(`${BACKUP_DIR}/${entry.name!}`, { baseDir: BaseDirectory.AppData })
          const data = JSON.parse(content)
          if (isValidAppData(data)) {
            console.warn('[Storage] Recovered data from backup:', entry.name)
            return data
          }
        } catch {
          // Try the next older backup
        }
      }
    } else {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(`${LS_KEY}-backup-`)) keys.push(k)
      }
      keys.sort().reverse()
      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '')
          if (isValidAppData(data)) {
            console.warn('[Storage] Recovered data from backup:', key)
            return data
          }
        } catch {
          // Try the next older backup
        }
      }
    }
  } catch (e) {
    console.error('[Storage] Backup recovery failed:', e)
  }
  return null
}

export function createDefaultData(): AppData {
  const noteIds = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8']
  const notes: Record<string, NoteData> = {}
  for (const id of noteIds) {
    notes[id] = {
      id,
      title: '', // Will be filled by group items
      starred: false,
      blocks: [], // Each note gets its own empty array
      updatedAt: Date.now(),
    }
  }
  return {
    version: DATA_VERSION,
    groups: [],
    notes,
    activeNoteId: 'n6',
  }
}

export async function exportData(): Promise<void> {
  const data = await loadAppData()
  if (!data) return
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const timestamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `flexnote-backup-${timestamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importData(file: File): Promise<AppData | null> {
  try {
    const text = await file.text()
    const data = JSON.parse(text) as AppData
    if (!data.version || !data.groups || !data.notes) {
      throw new Error('Invalid FlexNote backup file')
    }
    return data
  } catch (e) {
    console.error('[Storage] Import failed:', e)
    return null
  }
}
