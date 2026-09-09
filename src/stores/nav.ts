import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppData } from '../services/storage'

export interface NavItem {
  id: string
  title: string
  starred: boolean
  updatedAt?: number
  children?: NavItem[]
  collapsed?: boolean
}

export interface NavGroup {
  id: string
  name: string
  collapsed: boolean
  items: NavItem[]
}

export const useNavStore = defineStore('nav', () => {
  const groups = ref<NavGroup[]>([])

  const activeNoteId = ref<string | null>('n6')

  // Recursive helper: find item in nested tree
  function findItemInTree(items: NavItem[], id: string): NavItem | null {
    for (const item of items) {
      if (item.id === id) return item
      if (item.children) {
        const found = findItemInTree(item.children, id)
        if (found) return found
      }
    }
    return null
  }

  // Recursive helper: find parent array containing the item
  function findParentArray(items: NavItem[], id: string): NavItem[] | null {
    for (let i = 0; i < items.length; i++) {
      if (items[i].id === id) return items
      if (items[i].children) {
        const found = findParentArray(items[i].children!, id)
        if (found) return found
      }
    }
    return null
  }

  // Recursive helper: remove item from tree, return removed item
  function removeItemFromTree(items: NavItem[], id: string): NavItem | null {
    const idx = items.findIndex(i => i.id === id)
    if (idx !== -1) return items.splice(idx, 1)[0]
    for (const item of items) {
      if (item.children) {
        const removed = removeItemFromTree(item.children, id)
        if (removed) return removed
      }
    }
    return null
  }

  function toggleGroup(groupId: string) {
    const group = groups.value.find(g => g.id === groupId)
    if (group) group.collapsed = !group.collapsed
  }

  function toggleItemCollapsed(itemId: string) {
    for (const group of groups.value) {
      const item = findItemInTree(group.items, itemId)
      if (item) {
        item.collapsed = !item.collapsed
        return
      }
    }
  }

  function setActiveNote(id: string) {
    if (id === activeNoteId.value) return
    activeNoteId.value = id
  }

  function toggleStar(noteId: string) {
    for (const group of groups.value) {
      const item = findItemInTree(group.items, noteId)
      if (item) {
        item.starred = !item.starred
        return
      }
    }
  }

  function getNoteTitle(noteId: string): string | null {
    for (const group of groups.value) {
      const item = findItemInTree(group.items, noteId)
      if (item) return item.title
    }
    return null
  }

  function isNoteStarred(noteId: string): boolean {
    for (const group of groups.value) {
      const item = findItemInTree(group.items, noteId)
      if (item) return item.starred
    }
    return false
  }

  function syncTimestamps(items: NavItem[], notes: Record<string, any>) {
    for (const item of items) {
      const noteData = notes[item.id]
      if (noteData && noteData.updatedAt) {
        item.updatedAt = noteData.updatedAt
      }
      if (item.children) syncTimestamps(item.children, notes)
    }
  }

  function loadFromData(data: AppData) {
    groups.value = data.groups
    activeNoteId.value = data.activeNoteId || null
    if (data.notes) {
      for (const group of groups.value) {
        syncTimestamps(group.items, data.notes)
      }
    }
  }

  function updateNoteTimestamp(noteId: string, timestamp: number) {
    for (const group of groups.value) {
      const item = findItemInTree(group.items, noteId)
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

  function addNote(parentId: string, title: string, asChild = false): string | undefined {
    const id = 'n' + crypto.randomUUID().slice(0, 8)
    const newItem: NavItem = { id, title, starred: false }

    if (asChild) {
      // Add as child of an existing item
      for (const group of groups.value) {
        const parent = findItemInTree(group.items, parentId)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(newItem)
          parent.collapsed = false
          return id
        }
      }
    } else {
      // Add to group directly
      const group = groups.value.find(g => g.id === parentId)
      if (group) {
        group.items.push(newItem)
        return id
      }
    }
    return undefined
  }

  function addChildNote(parentNoteId: string, title: string): string | undefined {
    return addNote(parentNoteId, title, true)
  }

  function renameNote(noteId: string, newTitle: string) {
    for (const group of groups.value) {
      const item = findItemInTree(group.items, noteId)
      if (item) {
        item.title = newTitle
        return
      }
    }
  }

  function deleteNote(noteId: string) {
    for (const group of groups.value) {
      const removed = removeItemFromTree(group.items, noteId)
      if (removed) {
        if (activeNoteId.value === noteId) {
          activeNoteId.value = null
        }
        return
      }
    }
  }

  // Drag & drop: reorder items within same parent array
  function reorderItem(parentItems: NavItem[], fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    if (fromIndex >= parentItems.length || toIndex >= parentItems.length) return
    const [moved] = parentItems.splice(fromIndex, 1)
    parentItems.splice(toIndex, 0, moved)
  }

  // Drag & drop: move item to a different parent (group or note)
  function moveItem(itemId: string, targetParentId: string, targetIsGroup: boolean) {
    // Remove from current location
    let movedItem: NavItem | null = null
    for (const group of groups.value) {
      movedItem = removeItemFromTree(group.items, itemId)
      if (movedItem) break
    }
    if (!movedItem) return

    // Prevent moving a note into its own subtree
    if (!targetIsGroup && findItemInTree([movedItem], targetParentId)) {
      // Restore to original position (just push back to first group as fallback)
      groups.value[0]?.items.push(movedItem)
      return
    }

    if (targetIsGroup) {
      const group = groups.value.find(g => g.id === targetParentId)
      if (group) {
        group.items.push(movedItem)
        group.collapsed = false
      }
    } else {
      for (const group of groups.value) {
        const parent = findItemInTree(group.items, targetParentId)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(movedItem)
          parent.collapsed = false
          break
        }
      }
    }
  }

  // Drag & drop: reorder groups
  function reorderGroup(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    if (fromIndex >= groups.value.length || toIndex >= groups.value.length) return
    const [moved] = groups.value.splice(fromIndex, 1)
    groups.value.splice(toIndex, 0, moved)
  }

  return {
    groups,
    activeNoteId,
    toggleGroup,
    toggleItemCollapsed,
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
    addChildNote,
    renameNote,
    deleteNote,
    reorderItem,
    moveItem,
    reorderGroup,
    findItemInTree,
    findParentArray,
    removeItemFromTree,
  }
})
