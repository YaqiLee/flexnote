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
const LS_KEY = 'flexnote-data'
const BACKUP_DIR = 'backups'
const MAX_BACKUPS = 10
const BACKUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

let lastBackupTime = 0

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
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

export async function saveAppData(data: AppData): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  if (isTauri()) {
    const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(FILE_NAME, json, { baseDir: BaseDirectory.AppData })
  } else {
    localStorage.setItem(LS_KEY, json)
  }
  // Fire-and-forget backup
  createBackup(json).catch(() => {})
}

export async function loadAppData(): Promise<AppData | null> {
  try {
    if (isTauri()) {
      const { readTextFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs')
      const fileExists = await exists(FILE_NAME, { baseDir: BaseDirectory.AppData })
      if (!fileExists) return null
      const content = await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppData })
      const data = JSON.parse(content) as AppData
      if (data.version !== DATA_VERSION) {
        console.warn('Data version mismatch, may need migration')
      }
      return data
    } else {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return null
      const data = JSON.parse(raw) as AppData
      if (data.version !== DATA_VERSION) {
        console.warn('Data version mismatch, may need migration')
      }
      return data
    }
  } catch (e) {
    console.error('Failed to load app data:', e)
    return null
  }
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
