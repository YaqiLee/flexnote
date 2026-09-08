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
    groups: [
      {
        id: 'g1',
        name: '01 基础知识',
        collapsed: false,
        items: [
          { id: 'n1', title: '01-01 电的基本概念', starred: true },
          { id: 'n2', title: '01-02 导体与绝缘体', starred: false },
          { id: 'n3', title: '01-03 电流、电压、电阻', starred: false },
        ],
      },
      {
        id: 'g2',
        name: '02 电路基础',
        collapsed: false,
        items: [
          { id: 'n4', title: '02-01 串联与并联电路', starred: false },
          { id: 'n5', title: '02-02 基尔霍夫定律', starred: true },
          { id: 'n6', title: '02-03 欧姆定律与安全电压', starred: true },
        ],
      },
      {
        id: 'g3',
        name: '03 电气安全',
        collapsed: false,
        items: [
          { id: 'n7', title: '03-01 触电急救措施', starred: false },
          { id: 'n8', title: '03-02 接地与接零保护', starred: false },
        ],
      },
    ],
    notes,
    activeNoteId: 'n6',
  }
}
