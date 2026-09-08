import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppData } from '../services/storage'

export interface NavItem {
  id: string
  title: string
  starred: boolean
  updatedAt?: number
}

export interface NavGroup {
  id: string
  name: string
  collapsed: boolean
  items: NavItem[]
}

export const useNavStore = defineStore('nav', () => {
  const groups = ref<NavGroup[]>([
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
  ])

  const activeNoteId = ref<string | null>('n6')

  function toggleGroup(groupId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) group.collapsed = !group.collapsed
  }

  function setActiveNote(id: string) {
    const oldId = activeNoteId.value
    console.log('[NavStore] setActiveNote:', id, 'prev:', oldId)
    if (id === oldId) return

    activeNoteId.value = id
    console.log('[NavStore] after set, activeNoteId.value =', activeNoteId.value)
  }

  function toggleStar(noteId: string) {
    for (const group of groups.value) {
      const item = group.items.find(i => i.id === noteId)
      if (item) {
        item.starred = !item.starred
        return
      }
    }
  }

  function getNoteTitle(noteId: string): string | null {
    for (const group of groups.value) {
      const item = group.items.find(i => i.id === noteId)
      if (item) return item.title
    }
    return null
  }

  function isNoteStarred(noteId: string): boolean {
    for (const group of groups.value) {
      const item = group.items.find(i => i.id === noteId)
      if (item) return item.starred
    }
    return false
  }

  function loadFromData(data: AppData) {
    groups.value = data.groups
    activeNoteId.value = data.activeNoteId || null
    // Sync updatedAt from notes data to nav items
    if (data.notes) {
      for (const group of groups.value) {
        for (const item of group.items) {
          const noteData = data.notes[item.id]
          if (noteData && noteData.updatedAt) {
            item.updatedAt = noteData.updatedAt
          }
        }
      }
    }
  }

  function updateNoteTimestamp(noteId: string, timestamp: number) {
    for (const group of groups.value) {
      const item = group.items.find(i => i.id === noteId)
      if (item) {
        item.updatedAt = timestamp
        return
      }
    }
  }

  function addGroup(name: string) {
    const id = 'g' + crypto.randomUUID().slice(0, 8)
    groups.value.push({ id, name, collapsed: false, items: [] })
  }

  function renameGroup(groupId: string, newName: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) group.name = newName
  }

  function deleteGroup(groupId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return
    // If active note is in this group, clear selection
    if (activeNoteId.value && group.items.some(i => i.id === activeNoteId.value)) {
      activeNoteId.value = null
    }
    groups.value = groups.value.filter(g => g.id !== groupId)
  }

  function addNote(groupId: string, title: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (!group) return
    const id = 'n' + crypto.randomUUID().slice(0, 8)
    group.items.push({ id, title, starred: false })
    return id
  }

  function renameNote(noteId: string, newTitle: string) {
    for (const group of groups.value) {
      const item = group.items.find(i => i.id === noteId)
      if (item) {
        item.title = newTitle
        return
      }
    }
  }

  function deleteNote(noteId: string) {
    for (const group of groups.value) {
      const idx = group.items.findIndex(i => i.id === noteId)
      if (idx !== -1) {
        group.items.splice(idx, 1)
        if (activeNoteId.value === noteId) {
          activeNoteId.value = null
        }
        return
      }
    }
  }

  return {
    groups,
    activeNoteId,
    toggleGroup,
    setActiveNote,
    toggleStar,
    getNoteTitle,
    isNoteStarred,
    loadFromData,
    updateNoteTimestamp,
    addGroup,
    renameGroup,
    deleteGroup,
    addNote,
    renameNote,
    deleteNote,
  }
})
