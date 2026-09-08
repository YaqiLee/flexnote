import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick, toRaw } from 'vue'
import { saveAppData, loadAppData, createDefaultData } from '../services/storage'
import { useNavStore } from './nav'

export interface BlockData {
  id: string
  type: 'text' | 'image' | 'label' | 'formula'
  x: number
  y: number
  width?: number
  height?: number
  content?: string
  src?: string
  labelName?: string
  formula?: string
  bgColor?: string
  borderRadius?: number
  fontSize?: number
  fontColor?: string
  fontFamily?: string
  lineHeight?: number
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  zIndex: number
}

export const useCanvasStore = defineStore('canvas', () => {
  const blocks = ref<BlockData[]>([])
  const selectedBlockId = ref<string | null>(null)
  const selectedBlockIds = ref<string[]>([])
  const editingBlockId = ref<string | null>(null)
  const currentTool = ref<'text' | 'image' | 'label' | 'formula' | null>(null)
  const pendingImageData = ref<string | null>(null)
  const isLoaded = ref(false)
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
    const validTypes = ['text', 'image', 'label', 'formula'] as const
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
      formula: typeof raw.formula === 'string' ? raw.formula : undefined,
      bgColor: typeof raw.bgColor === 'string' ? raw.bgColor : undefined,
      borderRadius: Number.isFinite(raw.borderRadius) ? raw.borderRadius : undefined,
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

  function setPendingImage(data: string | null) {
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
    nextTick(() => { suppressSave = false })
  }

  function scheduleSave() {
    if (!isLoaded.value || suppressSave) return
    if (saveTimer) clearTimeout(saveTimer)
    const nav = useNavStore()
    const noteId = nav.activeNoteId
    if (!noteId) return
    const snapshot = JSON.parse(JSON.stringify(toRaw(blocks.value)))
    saveTimer = setTimeout(async () => {
      try {
        const data = await loadAppData()
        if (!data) return
        const now = Date.now()
        data.notes[noteId] = {
          id: noteId,
          title: nav.getNoteTitle(noteId) || '未命名笔记',
          starred: nav.isNoteStarred(noteId),
          blocks: snapshot,
          updatedAt: now,
        }
        data.groups = JSON.parse(JSON.stringify(toRaw(nav.groups)))
        data.activeNoteId = noteId
        await saveAppData(data)
        // Sync timestamp to nav store for UI display
        nav.updateNoteTimestamp(noteId, now)
      } catch (e) {
        console.error('Failed to save note:', noteId, e)
      }
    }, 500)
  }

  async function saveNoteById(noteId: string) {
    if (!noteId) return
    const nav = useNavStore()
    try {
      const data = await loadAppData()
      if (!data) return
      data.notes[noteId] = {
        id: noteId,
        title: nav.getNoteTitle(noteId) || '未命名笔记',
        starred: nav.isNoteStarred(noteId),
        blocks: JSON.parse(JSON.stringify(toRaw(blocks.value))),
        updatedAt: Date.now(),
      }
      data.groups = JSON.parse(JSON.stringify(toRaw(nav.groups)))
      data.activeNoteId = noteId
      await saveAppData(data)
    } catch (e) {
      console.error('Failed to save note:', noteId, e)
    }
  }

  async function saveActiveNoteId(noteId: string) {
    if (!noteId) return
    try {
      const data = await loadAppData()
      if (!data) return
      data.activeNoteId = noteId
      data.groups = JSON.parse(JSON.stringify(toRaw(useNavStore().groups)))
      await saveAppData(data)
    } catch (e) {
      console.warn('[CanvasStore] saveActiveNoteId failed:', e)
    }
  }

  async function loadNote(noteId: string) {
    try {
      const data = await loadAppData()
      console.log('[CanvasStore] loadNote:', noteId, 'found:', Boolean(data?.notes[noteId]), 'blocks:', data?.notes[noteId]?.blocks.length ?? 0)
      if (!data || !data.notes[noteId]) {
        loadBlocks([])
        return
      }
      loadBlocks(data.notes[noteId].blocks)
    } catch (e) {
      // loadNote failed, loading empty
      loadBlocks([])
    }
  }

  async function initFromStorage() {
    let data: ReturnType<typeof createDefaultData> | null = null
    try {
      data = await loadAppData()
    } catch (e) {
      // loadAppData failed, will use defaults
    }
    if (!data) {
      data = createDefaultData()
    }
    const nav = useNavStore()
    nav.loadFromData(data)
    if (data.activeNoteId && data.notes[data.activeNoteId]) {
      loadBlocks(data.notes[data.activeNoteId].blocks)
    }
    try {
      await saveAppData(data)
    } catch (e) {
      // saveAppData skipped in non-Tauri env
    }
    isLoaded.value = true
  }

  watch(blocks, () => {
    if (suppressSave) return
    scheduleSave()
  }, { deep: true })

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
    initFromStorage,
    undo,
    redo,
    pushSnapshot,
    removeBlocks,
  }
})
