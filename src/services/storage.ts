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

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function saveAppData(data: AppData): Promise<void> {
  const json = JSON.stringify(data, null, 2)
  if (isTauri()) {
    const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(FILE_NAME, json, { baseDir: BaseDirectory.AppData })
  } else {
    localStorage.setItem(LS_KEY, json)
  }
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
