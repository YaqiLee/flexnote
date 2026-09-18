import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick, toRaw } from 'vue'
import { saveAppData, loadAppData, createDefaultData, mutateAppData, type NoteData } from '../services/storage'
import { useNavStore } from './nav'

type NoteEntry = NoteData

export interface BlockData {
  id: string
  type: 'text' | 'image' | 'label'
  x: number
  y: number
  width?: number
  height?: number
  content?: string
  src?: string
  labelName?: string
  bgColor?: string
  borderRadius?: number
  borderColor?: string
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double'
  fontSize?: number
  fontColor?: string
  fontFamily?: string
  lineHeight?: number
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  zIndex: number
}

// Editor instance type (avoid importing TipTap directly in store)
type EditorInstance = any

export const useCanvasStore = defineStore('canvas', () => {
  const blocks = ref<BlockData[]>([])
  const selectedBlockId = ref<string | null>(null)
  const selectedBlockIds = ref<string[]>([])
  const editingBlockId = ref<string | null>(null)
  const currentTool = ref<'text' | 'image' | 'label' | null>(null)
  const currentEditor = ref<EditorInstance | null>(null)
  const pendingImageData = ref<{ src: string; width: number; height: number } | null>(null)
  const isLoaded = ref(false)
  const loadVersion = ref(0)
  let zIndexCounter = 0
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let suppressSave = false

  // Undo/Redo history
  const MAX_HISTORY = 50
  const undoStack: BlockData[][] = []
  const redoStack: BlockData[][] = []
  let isUndoRedoInProgress = false

  function cloneBlocks(): BlockData[] {
    return JSON.parse(JSON.stringify(toRaw(blocks.value)))
  }

  function pushSnapshot() {
    if (isUndoRedoInProgress) return
    undoStack.push(cloneBlocks())
    if (undoStack.length > MAX_HISTORY) undoStack.shift()
    redoStack.length = 0
  }

  function undo() {
    if (undoStack.length === 0) return
    isUndoRedoInProgress = true
    redoStack.push(cloneBlocks())
    blocks.value = undoStack.pop()!
    selectedBlockId.value = null
    selectedBlockIds.value = []
    editingBlockId.value = null
    normalizeZIndices()
    isUndoRedoInProgress = false
    scheduleSave()
  }

  function redo() {
    if (redoStack.length === 0) return
    isUndoRedoInProgress = true
    undoStack.push(cloneBlocks())
    blocks.value = redoStack.pop()!
    selectedBlockId.value = null
    selectedBlockIds.value = []
    editingBlockId.value = null
    normalizeZIndices()
    isUndoRedoInProgress = false
    scheduleSave()
  }

  function normalizeZIndices() {
    const sorted = [...blocks.value].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    sorted.forEach((b, i) => { b.zIndex = i + 1 })
    zIndexCounter = sorted.length
  }

  function validateAndFixBlock(raw: any): BlockData | null {
    if (!raw || typeof raw !== 'object') return null
    const validTypes = ['text', 'image', 'label'] as const
    const type = validTypes.includes(raw.type) ? raw.type : 'text'
    const x = Number.isFinite(raw.x) ? raw.x : 0
    const y = Number.isFinite(raw.y) ? raw.y : 0
    const width = Number.isFinite(raw.width) && raw.width > 0 ? raw.width : undefined
    const height = Number.isFinite(raw.height) && raw.height > 0 ? raw.height : undefined
    const zIndex = Number.isFinite(raw.zIndex) ? raw.zIndex : 0
    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
      type,
      x,
      y,
      width,
      height,
      content: typeof raw.content === 'string' ? raw.content : undefined,
      src: typeof raw.src === 'string' ? raw.src : undefined,
      labelName: typeof raw.labelName === 'string' ? raw.labelName : undefined,
      bgColor: typeof raw.bgColor === 'string' ? raw.bgColor : undefined,
      borderRadius: Number.isFinite(raw.borderRadius) ? raw.borderRadius : undefined,
      borderColor: typeof raw.borderColor === 'string' ? raw.borderColor : undefined,
      borderWidth: Number.isFinite(raw.borderWidth) && raw.borderWidth > 0 ? raw.borderWidth : undefined,
      borderStyle: ['solid', 'dashed', 'dotted', 'double'].includes(raw.borderStyle) ? raw.borderStyle : undefined,
      fontSize: Number.isFinite(raw.fontSize) ? raw.fontSize : undefined,
      fontColor: typeof raw.fontColor === 'string' ? raw.fontColor : undefined,
      fontFamily: typeof raw.fontFamily === 'string' ? raw.fontFamily : undefined,
      lineHeight: Number.isFinite(raw.lineHeight) ? raw.lineHeight : undefined,
      fontWeight: typeof raw.fontWeight === 'string' ? raw.fontWeight : undefined,
      fontStyle: typeof raw.fontStyle === 'string' ? raw.fontStyle : undefined,
      textDecoration: typeof raw.textDecoration === 'string' ? raw.textDecoration : undefined,
      zIndex,
    }
  }

  const selectedBlock = computed(() =>
    blocks.value.find(b => b.id === selectedBlockId.value) || null
  )

  const selectedBlocks = computed(() =>
    blocks.value.filter(b => selectedBlockIds.value.includes(b.id))
  )

  function addBlock(block: Omit<BlockData, 'id' | 'zIndex'>) {
    pushSnapshot()
    const id = crypto.randomUUID()
    blocks.value.push({
      ...block,
      id,
      zIndex: ++zIndexCounter,
    })
    scheduleSave()
    return id
  }

  function updateBlock(id: string, updates: Partial<BlockData>) {
    const block = blocks.value.find(b => b.id === id)
    if (block) {
      Object.assign(block, updates)
      scheduleSave()
    }
  }

  function removeBlock(id: string) {
    pushSnapshot()
    blocks.value = blocks.value.filter(b => b.id !== id)
    if (selectedBlockId.value === id) selectedBlockId.value = null
    scheduleSave()
  }

  function removeBlocks(ids: string[]) {
    if (ids.length === 0) return
    pushSnapshot()
    const idSet = new Set(ids)
    blocks.value = blocks.value.filter(b => !idSet.has(b.id))
    if (selectedBlockId.value && idSet.has(selectedBlockId.value)) {
      selectedBlockId.value = null
    }
    selectedBlockIds.value = selectedBlockIds.value.filter(id => !idSet.has(id))
    scheduleSave()
  }

  function selectBlock(id: string | null) {
    selectedBlockId.value = id
    selectedBlockIds.value = id ? [id] : []
    editingBlockId.value = null
    if (id) {
      const block = blocks.value.find(b => b.id === id)
      if (block) block.zIndex = ++zIndexCounter
    }
  }

  function selectBlocks(ids: string[]) {
    selectedBlockIds.value = ids
    selectedBlockId.value = ids.length === 1 ? ids[0] : null
    editingBlockId.value = null
  }

  function setEditing(id: string | null) {
    editingBlockId.value = id
    if (id) {
      selectedBlockId.value = id
      selectedBlockIds.value = [id]
    }
  }

  function getBlockRect(b: BlockData) {
    const el = typeof document !== 'undefined'
      ? document.querySelector(`[data-block-id="${b.id}"]`) as HTMLElement | null
      : null
    const w = el ? el.offsetWidth : (b.width || 200)
    const h = el ? el.offsetHeight : (b.height || 80)
    return { x: b.x, y: b.y, w, h }
  }

  function alignBlocks(direction: 'left' | 'right' | 'top' | 'bottom' | 'h-center' | 'v-center') {
    const sel = selectedBlocks.value
    if (sel.length < 2) return
    pushSnapshot()

    const rects = sel.map(b => ({ id: b.id, ...getBlockRect(b) }))

    if (direction === 'left') {
      const minX = Math.min(...rects.map(r => r.x))
      rects.forEach(r => updateBlock(r.id, { x: minX }))
    } else if (direction === 'right') {
      const maxRight = Math.max(...rects.map(r => r.x + r.w))
      rects.forEach(r => updateBlock(r.id, { x: maxRight - r.w }))
    } else if (direction === 'top') {
      const minY = Math.min(...rects.map(r => r.y))
      rects.forEach(r => updateBlock(r.id, { y: minY }))
    } else if (direction === 'bottom') {
      const maxBottom = Math.max(...rects.map(r => r.y + r.h))
      rects.forEach(r => updateBlock(r.id, { y: maxBottom - r.h }))
    } else if (direction === 'h-center') {
      const minX = Math.min(...rects.map(r => r.x))
      const maxRight = Math.max(...rects.map(r => r.x + r.w))
      const centerX = (minX + maxRight) / 2
      rects.forEach(r => updateBlock(r.id, { x: centerX - r.w / 2 }))
    } else if (direction === 'v-center') {
      const minY = Math.min(...rects.map(r => r.y))
      const maxBottom = Math.max(...rects.map(r => r.y + r.h))
      const centerY = (minY + maxBottom) / 2
      rects.forEach(r => updateBlock(r.id, { y: centerY - r.h / 2 }))
    }
  }

  function distributeBlocks(axis: 'horizontal' | 'vertical') {
    const sel = selectedBlocks.value
    if (sel.length < 3) return
    pushSnapshot()

    const rects = sel.map(b => ({ id: b.id, ...getBlockRect(b) }))

    if (axis === 'horizontal') {
      // Sort by x position, keep first and last fixed
      rects.sort((a, b) => a.x - b.x)
      const first = rects[0]
      const last = rects[rects.length - 1]
      const totalWidth = rects.reduce((sum, r) => sum + r.w, 0)
      const availableSpace = (last.x + last.w) - first.x - totalWidth
      const gap = availableSpace / (rects.length - 1)
      let cursor = first.x
      for (const r of rects) {
        updateBlock(r.id, { x: cursor })
        cursor += r.w + gap
      }
    } else {
      // Sort by y position, keep first and last fixed
      rects.sort((a, b) => a.y - b.y)
      const first = rects[0]
      const last = rects[rects.length - 1]
      const totalHeight = rects.reduce((sum, r) => sum + r.h, 0)
      const availableSpace = (last.y + last.h) - first.y - totalHeight
      const gap = availableSpace / (rects.length - 1)
      let cursor = first.y
      for (const r of rects) {
        updateBlock(r.id, { y: cursor })
        cursor += r.h + gap
      }
    }
  }

  function setTool(tool: typeof currentTool.value) {
    currentTool.value = tool
  }

  function setPendingImage(data: { src: string; width: number; height: number } | null) {
    pendingImageData.value = data
  }

  function bringToFront(id: string) {
    const block = blocks.value.find(b => b.id === id)
    if (block) {
      block.zIndex = ++zIndexCounter
      // Periodically normalize to prevent unbounded growth
      if (zIndexCounter > blocks.value.length * 2) {
        normalizeZIndices()
      }
    }
  }

  function loadBlocks(newBlocks: BlockData[]) {
    suppressSave = true
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const validated: BlockData[] = []
    for (const raw of newBlocks) {
      const block = validateAndFixBlock(raw)
      if (block) validated.push(block)
    }
    blocks.value = validated
    selectedBlockId.value = null
    normalizeZIndices()
    loadVersion.value++
    nextTick(() => { suppressSave = false })
  }

  // Tracks which note the in-memory `blocks` currently belong to, so a
  // pending save can never be attributed to the wrong note.
  let loadedNoteId: string | null = null

  function buildNoteEntry(noteId: string, nav: ReturnType<typeof useNavStore>): NoteEntry {
    return {
      id: noteId,
      title: nav.getNoteTitle(noteId) || '未命名笔记',
      starred: nav.isNoteStarred(noteId),
      blocks: JSON.parse(JSON.stringify(toRaw(blocks.value))),
      updatedAt: Date.now(),
    }
  }

  /**
   * Persists the currently loaded note. The target note id is resolved when the
   * write actually runs, and the pending save is dropped if the user has since
   * switched notes (the switch itself saves the previous note).
   */
  function scheduleSave() {
    if (!isLoaded.value || suppressSave) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      const nav = useNavStore()
      const noteId = loadedNoteId
      if (!noteId) return
      mutateAppData(data => {
        if (loadedNoteId !== noteId) return false
        data.notes[noteId] = buildNoteEntry(noteId, nav)
        data.groups = JSON.parse(JSON.stringify(toRaw(nav.groups)))
        data.activeNoteId = noteId
        nav.updateNoteTimestamp(noteId, data.notes[noteId].updatedAt)
      }).catch(e => console.error('[CanvasStore] Failed to save note:', noteId, e))
    }, 500)
  }

  /** Flushes any pending debounced save immediately (used before switching notes). */
  function flushPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  async function saveNoteById(noteId: string) {
    if (!noteId) return
    const nav = useNavStore()
    flushPendingSave()
    // Only persist block content if `blocks` still belongs to this note
    const blocksBelongToNote = loadedNoteId === noteId
    try {
      const data = await mutateAppData(draft => {
        if (blocksBelongToNote) {
          draft.notes[noteId] = buildNoteEntry(noteId, nav)
        } else if (draft.notes[noteId]) {
          draft.notes[noteId].title = nav.getNoteTitle(noteId) || '未命名笔记'
          draft.notes[noteId].starred = nav.isNoteStarred(noteId)
        }
        draft.groups = JSON.parse(JSON.stringify(toRaw(nav.groups)))
        draft.activeNoteId = noteId
      })
      const updatedAt = data?.notes[noteId]?.updatedAt
      if (updatedAt) nav.updateNoteTimestamp(noteId, updatedAt)
    } catch (e) {
      console.error('Failed to save note:', noteId, e)
    }
  }

  async function saveActiveNoteId(noteId: string) {
    if (!noteId) return
    try {
      await mutateAppData(data => {
        data.activeNoteId = noteId
        data.groups = JSON.parse(JSON.stringify(toRaw(useNavStore().groups)))
      })
    } catch (e) {
      console.warn('[CanvasStore] saveActiveNoteId failed:', e)
    }
  }

  async function loadNote(noteId: string) {
    try {
      const data = await loadAppData()
      if (!data) {
        // Storage unreadable - keep current content rather than blanking the canvas
        return
      }
      if (!data.notes[noteId]) {
        loadedNoteId = noteId
        loadBlocks([])
        return
      }
      loadedNoteId = noteId
      loadBlocks(data.notes[noteId].blocks)
    } catch (e) {
      console.error('[CanvasStore] loadNote failed:', noteId, e)
    }
  }

  async function initFromStorage() {
    let data: ReturnType<typeof createDefaultData> | null = null
    try {
      data = await loadAppData()
    } catch (e) {
      console.error('[CanvasStore] initFromStorage load failed:', e)
    }
    const hasPersistedData = !!data
    if (!data) {
      data = createDefaultData()
    }
    const nav = useNavStore()
    nav.loadFromData(data)
    loadedNoteId = data.activeNoteId
    if (data.activeNoteId && data.notes[data.activeNoteId]) {
      loadBlocks(data.notes[data.activeNoteId].blocks)
    }
    // Only persist the freshly created defaults. Re-saving loaded data here
    // would rewrite the file with a possibly stale snapshot.
    if (!hasPersistedData) {
      try {
        await saveAppData(data)
      } catch (e) {
        console.warn('[CanvasStore] Initial save skipped:', e)
      }
    }
    isLoaded.value = true
  }

  async function saveNavData() {
    if (!isLoaded.value) return
    const nav = useNavStore()
    try {
      await mutateAppData(data => {
        data.groups = JSON.parse(JSON.stringify(toRaw(nav.groups)))
        data.activeNoteId = nav.activeNoteId

        // Collect all note IDs currently in the nav tree
        const validIds = new Set<string>()
        function collectIds(items: typeof nav.groups[number]['items']) {
          for (const item of items) {
            validIds.add(item.id)
            if (item.children) collectIds(item.children)
          }
        }
        for (const group of nav.groups) {
          collectIds(group.items)
        }

        // Prune notes that no longer exist in the nav tree. The active note and
        // the note currently loaded in the canvas are always preserved so that
        // a transient nav state can never wipe content that is still on screen.
        const protectedIds = new Set<string>(validIds)
        if (nav.activeNoteId) protectedIds.add(nav.activeNoteId)
        if (loadedNoteId) protectedIds.add(loadedNoteId)
        for (const noteId of Object.keys(data.notes)) {
          if (!protectedIds.has(noteId)) {
            delete data.notes[noteId]
          }
        }

        // Ensure all nav items have corresponding note entries
        for (const id of validIds) {
          if (!data.notes[id]) {
            data.notes[id] = {
              id,
              title: nav.getNoteTitle(id) || '未命名笔记',
              starred: nav.isNoteStarred(id),
              blocks: [],
              updatedAt: Date.now(),
            }
          }
        }
      })
    } catch (e) {
      console.error('[CanvasStore] saveNavData failed:', e)
    }
  }

  /**
   * Deletes a note's persisted content. Called explicitly when the user
   * confirms deletion, so ordinary nav saves never remove note data.
   */
  async function deleteNoteData(noteId: string) {
    if (!noteId) return
    if (loadedNoteId === noteId) {
      flushPendingSave()
      loadedNoteId = null
    }
    try {
      await mutateAppData(data => {
        delete data.notes[noteId]
      })
    } catch (e) {
      console.error('[CanvasStore] deleteNoteData failed:', noteId, e)
    }
  }

  watch(blocks, () => {
    if (suppressSave) return
    scheduleSave()
  }, { deep: true })

  function setCurrentEditor(editor: EditorInstance | null) {
    currentEditor.value = editor
  }

  return {
    blocks,
    selectedBlockId,
    selectedBlockIds,
    editingBlockId,
    selectedBlock,
    selectedBlocks,
    currentTool,
    pendingImageData,
    isLoaded,
    loadVersion,
    currentEditor,
    setCurrentEditor,
    addBlock,
    updateBlock,
    removeBlock,
    selectBlock,
    selectBlocks,
    setEditing,
    alignBlocks,
    distributeBlocks,
    setTool,
    setPendingImage,
    bringToFront,
    loadBlocks,
    loadNote,
    saveNoteById,
    saveActiveNoteId,
    saveNavData,
    deleteNoteData,
    initFromStorage,
    undo,
    redo,
    pushSnapshot,
    removeBlocks,
  }
})
