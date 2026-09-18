<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, toRaw, type Directive } from 'vue'
import { useCanvasStore } from '../stores/canvas'
import { saveAsset, loadAsset, deleteAsset, assetUrl, isAssetRef, getAssetId } from '../services/assetStore'

// Directive that sets innerHTML only once on mount, avoiding v-html re-render conflicts with contenteditable
const vInitHtml: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    el.innerHTML = binding.value || ''
  },
  // Do NOT update — let the browser manage contenteditable DOM
}

const canvas = useCanvasStore()
const canvasEl = ref<HTMLDivElement>()

function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvasEl.value!.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

function clearTextSelection() {
  const sel = window.getSelection()
  if (sel) sel.removeAllRanges()
}

// Dynamic canvas size
const CANVAS_PADDING = 200
const DEFAULT_CANVAS_WIDTH = Math.max(window.innerWidth, 1200)
const DEFAULT_CANVAS_HEIGHT = Math.max(window.innerHeight, 800)
const canvasWidth = ref(DEFAULT_CANVAS_WIDTH)
const canvasHeight = ref(DEFAULT_CANVAS_HEIGHT)

function fitCanvasToContent() {
  if (canvas.blocks.length === 0) {
    canvasWidth.value = DEFAULT_CANVAS_WIDTH
    canvasHeight.value = DEFAULT_CANVAS_HEIGHT
    return
  }
  let maxRight = 0
  let maxBottom = 0
  for (const block of canvas.blocks) {
    const right = block.x + (block.width || 200)
    const bottom = block.y + (block.height || 80)
    if (right > maxRight) maxRight = right
    if (bottom > maxBottom) maxBottom = bottom
  }
  canvasWidth.value = Math.max(DEFAULT_CANVAS_WIDTH, Math.ceil((maxRight + CANVAS_PADDING) / 100) * 100)
  canvasHeight.value = Math.max(DEFAULT_CANVAS_HEIGHT, Math.ceil((maxBottom + CANVAS_PADDING) / 100) * 100)
}

function expandCanvasIfNeeded() {
  let maxRight = 0
  let maxBottom = 0
  for (const block of canvas.blocks) {
    const right = block.x + (block.width || 200)
    const bottom = block.y + (block.height || 80)
    if (right > maxRight) maxRight = right
    if (bottom > maxBottom) maxBottom = bottom
  }
  if (maxRight + CANVAS_PADDING > canvasWidth.value) {
    canvasWidth.value = Math.max(DEFAULT_CANVAS_WIDTH, Math.ceil((maxRight + CANVAS_PADDING) / 100) * 100)
  }
  if (maxBottom + CANVAS_PADDING > canvasHeight.value) {
    canvasHeight.value = Math.max(DEFAULT_CANVAS_HEIGHT, Math.ceil((maxBottom + CANVAS_PADDING) / 100) * 100)
  }
}

// Check if viewport is near edges and expand proactively during panning
function expandCanvasForViewport() {
  const wrap = canvasEl.value?.parentElement
  if (!wrap) return

  const scrollLeft = wrap.scrollLeft
  const scrollTop = wrap.scrollTop
  const viewWidth = wrap.clientWidth
  const viewHeight = wrap.clientHeight

  // Expand right if scrolled near right edge
  if (scrollLeft + viewWidth > canvasWidth.value - CANVAS_PADDING) {
    canvasWidth.value = Math.max(DEFAULT_CANVAS_WIDTH, Math.ceil((scrollLeft + viewWidth + CANVAS_PADDING) / 100) * 100)
  }

  // Expand bottom if scrolled near bottom edge
  if (scrollTop + viewHeight > canvasHeight.value - CANVAS_PADDING) {
    canvasHeight.value = Math.max(DEFAULT_CANVAS_HEIGHT, Math.ceil((scrollTop + viewHeight + CANVAS_PADDING) / 100) * 100)
  }
}

const LABEL_PRESETS = [
  { name: '重点', bg: '#ffeaea', color: '#d32f2f' },
  { name: '安全', bg: '#fff8e1', color: '#f57f17' },
  { name: '理解', bg: '#e8f5e9', color: '#2e7d32' },
  { name: '公式', bg: '#e3f2fd', color: '#1565c0' },
  { name: '实操', bg: '#f3e5f5', color: '#7b1fa2' },
  { name: '易错', bg: '#fce4ec', color: '#c62828' },
]

function getLabelPreset(name: string) {
  return LABEL_PRESETS.find(p => p.name === name) || LABEL_PRESETS[0]
}

// Drag state
let isDragging = false
let dragBlockId: string | null = null
let dragStartX = 0
let dragStartY = 0
let dragMoved = false
const DRAG_THRESHOLD = 4
// Store initial block positions at drag start for absolute snap calculation
let dragInitialPositions: Map<string, { x: number; y: number }> = new Map()

// Resize state
let isResizing = false
let resizeBlockId: string | null = null
let resizeDir = '' // 'n','s','e','w','ne','nw','se','sw'
let resizeStartX = 0
let resizeStartY = 0
let resizeStartW = 0
let resizeStartH = 0
let resizeStartBX = 0
let resizeStartBY = 0

// Canvas pan state
let isPanning = false
let spaceHeld = false
let panStartX = 0
let panStartY = 0
let panScrollLeft = 0
let panScrollTop = 0

// Marquee selection state
let isMarquee = false
let marqueeStartX = 0
let marqueeStartY = 0
let marqueeDidSelect = false
const marqueeRect = ref({ left: 0, top: 0, width: 0, height: 0, visible: false })
const pasteNotice = ref('')
let pasteNoticeTimer: ReturnType<typeof setTimeout> | null = null
const MAX_PASTE_IMAGE_BYTES = 10 * 1024 * 1024

// Grid snapping & smart guide lines
const GRID_SIZE = 20
const SNAP_THRESHOLD = 8
interface GuideLine {
  orientation: 'h' | 'v'
  position: number
}
const activeGuides = ref<GuideLine[]>([])

// Resolve asset:// references to displayable object URLs
const resolvedImageUrls = ref<Record<string, string>>({})

async function resolveImageUrl(src: string | undefined): Promise<string> {
  if (!src) return ''
  if (!isAssetRef(src)) return src
  const cached = resolvedImageUrls.value[src]
  if (cached) return cached
  const blob = await loadAsset(getAssetId(src))
  if (!blob) return ''
  const url = URL.createObjectURL(blob)
  resolvedImageUrls.value[src] = url
  return url
}

function getImageSrc(block: { src?: string }): string {
  if (!block.src) return ''
  if (!isAssetRef(block.src)) return block.src
  return resolvedImageUrls.value[block.src] || ''
}

// Fit canvas to content when a note is loaded or switched
watch(() => canvas.loadVersion, () => {
  nextTick(() => fitCanvasToContent())
})

// Pre-resolve all image blocks when they change
watch(() => canvas.blocks.map(b => b.type === 'image' ? b.src : null).filter(Boolean), async (srcs) => {
  for (const src of srcs) {
    if (src && isAssetRef(src) && !resolvedImageUrls.value[src]) {
      await resolveImageUrl(src)
    }
  }
}, { immediate: true })

function onCanvasMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  const isCanvasArea = target === canvasEl.value ||
    target.classList.contains('canvas-hint') ||
    target.classList.contains('canvas-wrap')
  if (!isCanvasArea) return

  // Clear editing state and text selection immediately on mousedown
  // to prevent contenteditable from restoring selection on mouseup
  if (e.button === 0 && !spaceHeld && !canvas.currentTool) {
    if (canvas.editingBlockId) {
      canvas.setEditing(null)
    }
    canvas.selectBlock(null)
    clearTextSelection()
  }

  // Middle mouse or Space+click for panning
  if (e.button === 1 || spaceHeld) {
    isPanning = true
    panStartX = e.clientX
    panStartY = e.clientY
    panScrollLeft = canvasEl.value?.parentElement?.scrollLeft || 0
    panScrollTop = canvasEl.value?.parentElement?.scrollTop || 0
  } else if (canvas.currentTool) {
    // Active tool: block placement happens in handleCanvasClick
  } else {
    // No active tool: start marquee selection
    isMarquee = true
    document.body.style.userSelect = 'none'
    const pos = clientToCanvas(e.clientX, e.clientY)
    marqueeStartX = pos.x
    marqueeStartY = pos.y
    marqueeRect.value = { left: marqueeStartX, top: marqueeStartY, width: 0, height: 0, visible: true }
  }
}

function showPasteNotice(message: string) {
  pasteNotice.value = message
  if (pasteNoticeTimer) clearTimeout(pasteNoticeTimer)
  pasteNoticeTimer = setTimeout(() => {
    pasteNotice.value = ''
    pasteNoticeTimer = null
  }, 2800)
}

function getPasteOrigin() {
  const wrap = canvasEl.value?.parentElement
  return {
    x: (wrap?.scrollLeft || 0) + (wrap?.clientWidth || 800) / 2 - 200,
    y: (wrap?.scrollTop || 0) + (wrap?.clientHeight || 600) / 2 - 100,
  }
}

async function readImageFile(file: File): Promise<{ src: string; width: number; height: number } | null> {
  if (file.size > MAX_PASTE_IMAGE_BYTES) return null
  // Read dimensions using a temporary object URL
  const tempUrl = URL.createObjectURL(file)
  try {
    const dims = await new Promise<{ w: number; h: number } | null>(resolve => {
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = tempUrl
    })
    if (!dims) return null
    // Persist to asset store
    const id = crypto.randomUUID()
    await saveAsset(id, file)
    const scale = Math.min(1, 400 / dims.w, 300 / dims.h)
    return {
      src: assetUrl(id),
      width: Math.max(1, Math.round(dims.w * scale)),
      height: Math.max(1, Math.round(dims.h * scale)),
    }
  } finally {
    URL.revokeObjectURL(tempUrl)
  }
}

function extractTextFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || doc.body.innerText || ''
}

async function onCanvasPaste(e: ClipboardEvent) {
  const activeEl = document.activeElement as HTMLElement | null
  if (activeEl?.isContentEditable) return
  if (activeEl && activeEl !== document.body && !activeEl.closest('.canvas-wrap')) return

  const data = e.clipboardData
  const imageFiles = data ? Array.from(data.files).filter(file => file.type.startsWith('image/')) : []

  // Prefer text/plain over text/html: text/plain is usually the rendered text
  // the user sees, while text/html may contain raw LaTeX source (e.g.
  // \(\boldsymbol{...}\)) that leaks through when extracted as text content.
  let text = data?.getData('text/plain').trim() ?? ''
  if (!text) {
    const html = data?.getData('text/html') || ''
    if (html) {
      text = extractTextFromHtml(html).trim()
    }
  }

  const hasExternalContent = imageFiles.length > 0 || text.length > 0

  // If the OS clipboard has external content (images or text from screenshots
  // or other apps), always prefer it over internal blocks. This ensures that
  // whichever copy happened last wins.
  if (hasExternalContent) {
    internalClipboardActive = false
  } else if (internalClipboardActive && clipboardBlocks.length > 0) {
    // No external content in clipboardData → use internal blocks
    e.preventDefault()
    pasteInternalBlocks()
    return
  }

  if (!data) return
  if (!text && imageFiles.length === 0) {
    showPasteNotice('剪贴板中没有可插入的文本或图片')
    return
  }

  e.preventDefault()
  const origin = getPasteOrigin()
  const newIds: string[] = []
  let y = origin.y

  if (text) {
    const id = canvas.addBlock({
      type: 'text',
      x: origin.x,
      y,
      width: 400,
      content: text.replace(/\r\n/g, '\n'),
      borderRadius: 0,
      fontSize: 14,
      fontColor: '#333333',
    })
    newIds.push(id)
    y += Math.max(90, Math.min(300, text.split('\n').length * 28 + 40))
  }

  let skippedImages = 0
  for (const file of imageFiles) {
    const image = await readImageFile(file)
    if (!image) {
      skippedImages++
      continue
    }
    const id = canvas.addBlock({
      type: 'image',
      x: origin.x,
      y,
      width: image.width,
      height: image.height,
      src: image.src,
      borderRadius: 0,
    })
    newIds.push(id)
    y += image.height + 24
  }

  if (newIds.length > 0) {
    canvas.selectBlocks(newIds)
    expandCanvasIfNeeded()
    if (text && newIds.length === 1) {
      canvas.setEditing(newIds[0])
      await nextTick()
      const textEl = document.querySelector<HTMLElement>(`[data-block-id="${newIds[0]}"] .block-text`)
      textEl?.focus()
    }
  }
  if (skippedImages > 0) {
    showPasteNotice('部分图片超过 10MB 或格式无法读取，未能插入')
  }
}

function handleCanvasClick(e: MouseEvent) {
  // Skip if this was a marquee selection or pan operation
  if (marqueeDidSelect) {
    marqueeDidSelect = false
    return
  }
  if (isPanning) return

  const target = e.target as HTMLElement
  const isCanvasArea = target === canvasEl.value ||
    target.classList.contains('canvas-hint') ||
    target.classList.contains('canvas-wrap')
  if (!isCanvasArea) return

  if (!canvas.currentTool) {
    const activeEl = document.activeElement as HTMLElement | null
    if (activeEl && activeEl !== document.body) activeEl.blur()
    canvas.selectBlock(null)
    clearTextSelection()
    return
  }

  const rect = canvasEl.value!.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  if (canvas.currentTool === 'text') {
    const id = canvas.addBlock({ type: 'text', x, y, content: '', borderRadius: 0, fontSize: 14, fontColor: '#333333' })
    canvas.setTool(null)
    expandCanvasIfNeeded()
    nextTick(() => {
      const el = document.querySelector(`[data-block-id="${id}"] .block-text`) as HTMLElement
      if (el) el.focus()
    })
  } else if (canvas.currentTool === 'image' && canvas.pendingImageData) {
    canvas.addBlock({ type: 'image', x, y, src: canvas.pendingImageData.src, width: canvas.pendingImageData.width, height: canvas.pendingImageData.height, borderRadius: 0 })
    canvas.setPendingImage(null)
    canvas.setTool(null)
    expandCanvasIfNeeded()
  } else if (canvas.currentTool === 'label') {
    canvas.addBlock({ type: 'label', x, y, labelName: '重点', borderRadius: 14 })
    canvas.setTool(null)
    expandCanvasIfNeeded()
  }
}

function onTextBlur(blockId: string, e: FocusEvent) {
  const el = e.target as HTMLElement
  // Save content with inline formatting preserved
  canvas.updateBlock(blockId, { content: el.innerHTML })
  // Delay exit to allow format bar controls to receive focus without losing editing state
  const relatedTarget = e.relatedTarget as HTMLElement | null
  if (relatedTarget && relatedTarget.closest('.text-format-bar')) {
    return
  }
  setTimeout(() => {
    const activeEl = document.activeElement
    if (activeEl && activeEl.closest('.text-format-bar')) {
      return
    }
    if (canvas.editingBlockId === blockId) {
      canvas.setEditing(null)
      clearTextSelection()
    }
  }, 150)
}

function onDragHandleDown(e: MouseEvent, blockId: string) {
  e.preventDefault()
  e.stopPropagation()
  // Snapshot will be pushed in onMouseMove when drag actually starts
  if (e.shiftKey) {
    const ids = [...canvas.selectedBlockIds]
    const idx = ids.indexOf(blockId)
    if (idx >= 0) {
      ids.splice(idx, 1)
    } else {
      ids.push(blockId)
    }
    canvas.selectBlocks(ids)
  } else if (!canvas.selectedBlockIds.includes(blockId)) {
    canvas.selectBlock(blockId)
  }
  isDragging = true
  dragBlockId = blockId
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragMoved = false
  // Record initial positions of all blocks that will move together
  dragInitialPositions.clear()
  const idsToMove = canvas.selectedBlockIds.includes(blockId)
    ? canvas.selectedBlockIds
    : [blockId]
  for (const id of idsToMove) {
    const b = canvas.blocks.find(bl => bl.id === id)
    if (b) dragInitialPositions.set(id, { x: b.x, y: b.y })
  }
}

function onTextFocus(blockId: string) {
  canvas.setEditing(blockId)
}

function onTextMouseDown(e: MouseEvent, blockId: string) {
  if (e.shiftKey) {
    const ids = [...canvas.selectedBlockIds]
    const idx = ids.indexOf(blockId)
    if (idx >= 0) {
      ids.splice(idx, 1)
    } else {
      ids.push(blockId)
    }
    canvas.selectBlocks(ids)
    e.preventDefault()
    return
  }
  // Single click enters editing mode directly for text blocks
  if (!canvas.selectedBlockIds.includes(blockId)) {
    canvas.selectBlock(blockId)
  }
  canvas.setEditing(blockId)
}

function onBlockMouseDown(e: MouseEvent, blockId: string) {
  const target = e.target as HTMLElement
  if (target.classList.contains('rh')) return
  if (target.classList.contains('drag-handle')) return

  const isTextBlock = target.classList.contains('block-text')
  if (isTextBlock) return

  // Shift+click toggles individual block selection
  if (e.shiftKey) {
    const ids = [...canvas.selectedBlockIds]
    const idx = ids.indexOf(blockId)
    if (idx >= 0) {
      ids.splice(idx, 1)
    } else {
      ids.push(blockId)
    }
    canvas.selectBlocks(ids)
  } else if (!canvas.selectedBlockIds.includes(blockId)) {
    canvas.selectBlock(blockId)
  }

  e.preventDefault()
  // Snapshot will be pushed in onMouseMove when drag actually starts (dragMoved)
  isDragging = true
  dragBlockId = blockId
  dragStartX = e.clientX
  dragStartY = e.clientY
  dragMoved = false
  // Record initial positions of all blocks that will move together
  dragInitialPositions.clear()
  const idsToMove = canvas.selectedBlockIds.includes(blockId)
    ? canvas.selectedBlockIds
    : [blockId]
  for (const id of idsToMove) {
    const b = canvas.blocks.find(bl => bl.id === id)
    if (b) dragInitialPositions.set(id, { x: b.x, y: b.y })
  }
}

// Compute smart guide lines and snap position for dragging blocks.
// Returns snapped x/y and updates activeGuides for rendering.
function computeSnapAndGuides(
  dragIds: string[],
  rawX: number,
  rawY: number,
): { x: number; y: number } {
  const guides: GuideLine[] = []
  let snapX = rawX
  let snapY = rawY

  // Collect edges of all non-dragged blocks
  const otherBlocks = canvas.blocks.filter(b => !dragIds.includes(b.id))
  const xEdges: number[] = []
  const yEdges: number[] = []
  for (const b of otherBlocks) {
    const w = b.width || 200
    const h = b.height || 80
    xEdges.push(b.x, b.x + w)
    yEdges.push(b.y, b.y + h)
  }
  // Also include grid lines
  // (grid snapping is applied after alignment snapping)

  // Find closest horizontal alignment (top/bottom edges)
  let bestDx = Infinity
  let bestSnapX = rawX
  for (const edge of xEdges) {
    const d = Math.abs(rawX - edge)
    if (d < bestDx) {
      bestDx = d
      bestSnapX = edge
    }
  }
  if (bestDx <= SNAP_THRESHOLD) {
    snapX = bestSnapX
    guides.push({ orientation: 'v', position: bestSnapX })
  }

  // Find closest vertical alignment (left/right edges)
  let bestDy = Infinity
  let bestSnapY = rawY
  for (const edge of yEdges) {
    const d = Math.abs(rawY - edge)
    if (d < bestDy) {
      bestDy = d
      bestSnapY = edge
    }
  }
  if (bestDy <= SNAP_THRESHOLD) {
    snapY = bestSnapY
    guides.push({ orientation: 'h', position: bestSnapY })
  }

  // If no alignment snap, apply grid snap
  if (guides.length === 0) {
    snapX = Math.round(rawX / GRID_SIZE) * GRID_SIZE
    snapY = Math.round(rawY / GRID_SIZE) * GRID_SIZE
  }

  activeGuides.value = guides
  return { x: snapX, y: snapY }
}

function clearGuides() {
  activeGuides.value = []
}

// Compute snap and guides for resizing a block.
// Returns snapped x, y, width, height based on which edges are being resized.
function computeResizeSnapAndGuides(
  blockId: string,
  rawX: number,
  rawY: number,
  rawW: number,
  rawH: number,
  dir: string,
): { x: number; y: number; w: number; h: number } {
  const guides: GuideLine[] = []
  let snapX = rawX
  let snapY = rawY
  let snapW = rawW
  let snapH = rawH

  const otherBlocks = canvas.blocks.filter(b => b.id !== blockId)
  const xEdges: number[] = []
  const yEdges: number[] = []
  for (const b of otherBlocks) {
    const w = b.width || 200
    const h = b.height || 80
    xEdges.push(b.x, b.x + w)
    yEdges.push(b.y, b.y + h)
  }

  // Snap right edge (x + w) when resizing east
  if (dir.includes('e')) {
    const rightEdge = rawX + rawW
    let bestD = Infinity
    let bestSnap = rightEdge
    for (const edge of xEdges) {
      const d = Math.abs(rightEdge - edge)
      if (d < bestD) { bestD = d; bestSnap = edge }
    }
    if (bestD <= SNAP_THRESHOLD) {
      snapW = Math.max(60, bestSnap - rawX)
      guides.push({ orientation: 'v', position: bestSnap })
    } else {
      // Grid snap right edge
      const gridRight = Math.round(rightEdge / GRID_SIZE) * GRID_SIZE
      snapW = Math.max(60, gridRight - rawX)
    }
  }

  // Snap left edge (x) when resizing west
  if (dir.includes('w')) {
    let bestD = Infinity
    let bestSnap = rawX
    for (const edge of xEdges) {
      const d = Math.abs(rawX - edge)
      if (d < bestD) { bestD = d; bestSnap = edge }
    }
    if (bestD <= SNAP_THRESHOLD) {
      const newW = Math.max(60, (rawX + rawW) - bestSnap)
      snapX = bestSnap
      snapW = newW
      guides.push({ orientation: 'v', position: bestSnap })
    } else {
      const gridLeft = Math.round(rawX / GRID_SIZE) * GRID_SIZE
      const newW = Math.max(60, (rawX + rawW) - gridLeft)
      snapX = gridLeft
      snapW = newW
    }
  }

  // Snap bottom edge (y + h) when resizing south
  if (dir.includes('s')) {
    const bottomEdge = rawY + rawH
    let bestD = Infinity
    let bestSnap = bottomEdge
    for (const edge of yEdges) {
      const d = Math.abs(bottomEdge - edge)
      if (d < bestD) { bestD = d; bestSnap = edge }
    }
    if (bestD <= SNAP_THRESHOLD) {
      snapH = Math.max(24, bestSnap - rawY)
      guides.push({ orientation: 'h', position: bestSnap })
    } else {
      const gridBottom = Math.round(bottomEdge / GRID_SIZE) * GRID_SIZE
      snapH = Math.max(24, gridBottom - rawY)
    }
  }

  // Snap top edge (y) when resizing north
  if (dir.includes('n')) {
    let bestD = Infinity
    let bestSnap = rawY
    for (const edge of yEdges) {
      const d = Math.abs(rawY - edge)
      if (d < bestD) { bestD = d; bestSnap = edge }
    }
    if (bestD <= SNAP_THRESHOLD) {
      const newH = Math.max(24, (rawY + rawH) - bestSnap)
      snapY = bestSnap
      snapH = newH
      guides.push({ orientation: 'h', position: bestSnap })
    } else {
      const gridTop = Math.round(rawY / GRID_SIZE) * GRID_SIZE
      const newH = Math.max(24, (rawY + rawH) - gridTop)
      snapY = gridTop
      snapH = newH
    }
  }

  activeGuides.value = guides
  return { x: snapX, y: snapY, w: snapW, h: snapH }
}

function startResize(e: MouseEvent, blockId: string, dir: string) {
  e.preventDefault()
  e.stopPropagation()
  const block = canvas.blocks.find(b => b.id === blockId)
  if (!block) return
  canvas.pushSnapshot()
  isResizing = true
  resizeBlockId = blockId
  resizeDir = dir
  resizeStartX = e.clientX
  resizeStartY = e.clientY
  // Use actual DOM dimensions to avoid jump when store values are stale/undefined
  const blockEl = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null
  resizeStartW = blockEl ? blockEl.offsetWidth : (block.width || 200)
  resizeStartH = blockEl ? blockEl.offsetHeight : (block.height || 80)
  resizeStartBX = block.x
  resizeStartBY = block.y
}

function onMouseMove(e: MouseEvent) {
  if (isPanning) {
    const dx = e.clientX - panStartX
    const dy = e.clientY - panStartY
    const wrap = canvasEl.value?.parentElement
    if (wrap) {
      wrap.scrollLeft = panScrollLeft - dx
      wrap.scrollTop = panScrollTop - dy
      expandCanvasForViewport()
    }
    return
  }
  if (isMarquee && canvasEl.value) {
    const cur = clientToCanvas(e.clientX, e.clientY)
    const curX = cur.x
    const curY = cur.y
    const left = Math.min(marqueeStartX, curX)
    const top = Math.min(marqueeStartY, curY)
    const width = Math.abs(curX - marqueeStartX)
    const height = Math.abs(curY - marqueeStartY)
    marqueeRect.value = { left, top, width, height, visible: true }
    return
  }
  if (isDragging && dragBlockId) {
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY

    if (!dragMoved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      dragMoved = true
      canvas.pushSnapshot()
    }

    if (dragMoved) {
      const idsToMove = canvas.selectedBlockIds.includes(dragBlockId)
        ? canvas.selectedBlockIds
        : [dragBlockId]

      // Compute raw position of the primary dragged block
      const primaryInit = dragInitialPositions.get(dragBlockId)
      if (primaryInit) {
        const rawX = primaryInit.x + dx
        const rawY = primaryInit.y + dy
        const snapped = computeSnapAndGuides(idsToMove, rawX, rawY)
        const offsetX = snapped.x - primaryInit.x
        const offsetY = snapped.y - primaryInit.y

        for (const id of idsToMove) {
          const init = dragInitialPositions.get(id)
          if (init) {
            canvas.updateBlock(id, { x: init.x + offsetX, y: init.y + offsetY })
          }
        }
      }
      expandCanvasIfNeeded()
    }
  }
  if (isResizing && resizeBlockId) {
    const dw = e.clientX - resizeStartX
    const dh = e.clientY - resizeStartY
    const MIN_W = 60
    const MIN_H = 24
    let rawX = resizeStartBX
    let rawY = resizeStartBY
    let rawW = resizeStartW
    let rawH = resizeStartH

    if (resizeDir.includes('e')) rawW = Math.max(MIN_W, resizeStartW + dw)
    if (resizeDir.includes('w')) {
      const w = Math.max(MIN_W, resizeStartW - dw)
      rawX = resizeStartBX + (resizeStartW - w)
      rawW = w
    }
    if (resizeDir.includes('s')) rawH = Math.max(MIN_H, resizeStartH + dh)
    if (resizeDir.includes('n')) {
      const h = Math.max(MIN_H, resizeStartH - dh)
      rawY = resizeStartBY + (resizeStartH - h)
      rawH = h
    }

    const snapped = computeResizeSnapAndGuides(resizeBlockId, rawX, rawY, rawW, rawH, resizeDir)
    canvas.updateBlock(resizeBlockId, { x: snapped.x, y: snapped.y, width: snapped.w, height: snapped.h })
    expandCanvasIfNeeded()
  }
}

function onMouseUp() {
  if (isMarquee) {
    document.body.style.userSelect = ''
    // Calculate which blocks intersect with the marquee rectangle
    const m = marqueeRect.value
    if (m.width > 5 || m.height > 5) {
      const ids: string[] = []
      for (const block of canvas.blocks) {
        const bx = block.x
        const by = block.y
        const bw = block.width || 200
        const bh = block.height || 80
        if (bx < m.left + m.width && bx + bw > m.left &&
            by < m.top + m.height && by + bh > m.top) {
          ids.push(block.id)
        }
      }
      canvas.selectBlocks(ids)
      marqueeDidSelect = true
    } else {
      canvas.selectBlock(null)
      marqueeDidSelect = true
    }
    marqueeRect.value = { left: 0, top: 0, width: 0, height: 0, visible: false }
    isMarquee = false
  }
  isPanning = false
  isDragging = false
  dragBlockId = null
  dragInitialPositions.clear()
  clearGuides()
  isResizing = false
  resizeBlockId = null
}

// Internal clipboard for copy/paste. Ctrl+C stores blocks in `clipboardBlocks`.
// On Ctrl+V, we check the paste event's clipboardData first: if it contains
// images or text, that means the OS clipboard has external content (from a
// screenshot or another app), so we use that. Only when clipboardData is empty
// do we fall back to the internal blocks.
let clipboardBlocks: import('../stores/canvas').BlockData[] = []
let internalClipboardActive = false

function pasteInternalBlocks() {
  const offset = 20
  const newIds: string[] = []
  for (const src of clipboardBlocks) {
    const { id: _id, zIndex: _z, ...rest } = src
    const nid = canvas.addBlock({
      ...rest,
      x: src.x + offset,
      y: src.y + offset,
    })
    newIds.push(nid)
  }
  if (newIds.length > 0) {
    canvas.selectBlocks(newIds)
    expandCanvasIfNeeded()
  }
}

async function onKeyDown(e: KeyboardEvent) {
  const activeEl = document.activeElement as HTMLElement | null
  const isEditing = activeEl?.isContentEditable === true
  const ctrl = e.ctrlKey || e.metaKey

  // Space for panning (only when not editing)
  if (e.code === 'Space' && !isEditing) {
    e.preventDefault()
    spaceHeld = true
    return
  }

  // Escape: blur editing or deselect
  if (e.key === 'Escape') {
    if (isEditing) {
      activeEl?.blur()
      clearTextSelection()
    } else {
      canvas.setTool(null)
      canvas.selectBlock(null)
    }
    return
  }

  // All shortcuts below are disabled while editing text
  if (isEditing) return

  // Use e.code for letter keys to avoid case sensitivity issues with Ctrl
  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y: Undo / Redo
  if (ctrl && e.code === 'KeyZ' && !e.shiftKey) {
    e.preventDefault()
    canvas.undo()
    return
  }
  if (ctrl && ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY')) {
    e.preventDefault()
    canvas.redo()
    return
  }

  // Ctrl+A: Select all
  if (ctrl && e.code === 'KeyA') {
    e.preventDefault()
    canvas.selectBlocks(canvas.blocks.map(b => b.id))
    return
  }

  // Ctrl+C: copy selected blocks into the internal clipboard AND clear the
  // OS clipboard so that stale external content (e.g. a previous screenshot)
  // doesn't interfere. On Ctrl+V, if clipboardData is empty we use internal
  // blocks; if it has content, an external copy happened after our Ctrl+C.
  if (ctrl && e.code === 'KeyC') {
    if (canvas.selectedBlockIds.length > 0) {
      const rawBlocks = toRaw(canvas.blocks)
      const selected = rawBlocks.filter(b => canvas.selectedBlockIds.includes(b.id))
      clipboardBlocks = JSON.parse(JSON.stringify(selected))
      internalClipboardActive = true
      // Clear OS clipboard so old external content doesn't shadow internal copy
      try {
        await navigator.clipboard.writeText('')
      } catch {
        // Clipboard write may fail silently; paste handler will still work
      }
    }
    return
  }

  // Ctrl+V: handled by the paste event below.

  // Ctrl+D: Duplicate selected blocks
  if (ctrl && e.code === 'KeyD') {
    if (canvas.selectedBlockIds.length > 0) {
      e.preventDefault()
      e.stopImmediatePropagation()
      const offset = 20
      const newIds: string[] = []
      const rawBlocks = toRaw(canvas.blocks)
      for (const selId of canvas.selectedBlockIds) {
        const src = rawBlocks.find(b => b.id === selId)
        if (src) {
          const { id: _id, zIndex: _z, ...rest } = src
          const nid = canvas.addBlock({
            ...rest,
            x: src.x + offset,
            y: src.y + offset,
          })
          newIds.push(nid)
        }
      }
      canvas.selectBlocks(newIds)
      expandCanvasIfNeeded()
    }
    return
  }

  // Delete / Backspace: Remove selected blocks
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (canvas.selectedBlockIds.length > 0) {
      e.preventDefault()
      const idsToRemove = [...canvas.selectedBlockIds]
      const removeSet = new Set(idsToRemove)
      // Clean up assets for deleted image blocks, but only when no remaining
      // block still references the same asset (copied/pasted images share src).
      for (const id of idsToRemove) {
        const block = canvas.blocks.find(b => b.id === id)
        if (block?.type === 'image' && block.src && isAssetRef(block.src)) {
          const stillReferenced = canvas.blocks.some(
            b => b.id !== id && !removeSet.has(b.id) && b.src === block.src
          )
          if (!stillReferenced) {
            const assetId = getAssetId(block.src)
            deleteAsset(assetId).catch(() => {})
            const cachedUrl = resolvedImageUrls.value[block.src]
            if (cachedUrl) {
              URL.revokeObjectURL(cachedUrl)
              delete resolvedImageUrls.value[block.src]
            }
          }
        }
      }
      canvas.removeBlocks(idsToRemove)
    }
    return
  }

  // Arrow keys: Nudge selected blocks
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (canvas.selectedBlockIds.length > 0) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
      canvas.pushSnapshot()
      for (const id of canvas.selectedBlockIds) {
        const block = canvas.blocks.find(b => b.id === id)
        if (block) {
          canvas.updateBlock(id, { x: block.x + dx, y: block.y + dy })
        }
      }
      expandCanvasIfNeeded()
    }
    return
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spaceHeld = false
    isPanning = false
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('paste', onCanvasPaste)
  expandCanvasIfNeeded()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('paste', onCanvasPaste)
  if (pasteNoticeTimer) clearTimeout(pasteNoticeTimer)
  // Revoke all object URLs to prevent memory leaks
  for (const url of Object.values(resolvedImageUrls.value)) {
    URL.revokeObjectURL(url)
  }
  resolvedImageUrls.value = {}
})
</script>

<template>
  <div class="canvas-wrap" @mousedown="onCanvasMouseDown" @click="handleCanvasClick">
    <div ref="canvasEl" class="canvas" :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }">
      <div
        v-for="block in canvas.blocks"
        :key="block.id"
        class="block"
        :class="{ selected: canvas.selectedBlockIds.includes(block.id) }"
        :data-block-id="block.id"
        :style="{
          left: block.x + 'px',
          top: block.y + 'px',
          zIndex: block.zIndex,
          borderRadius: (block.borderRadius || 0) + 'px',
          backgroundColor: block.bgColor || undefined,
          border: block.borderWidth ? `${block.borderWidth}px ${block.borderStyle || 'solid'} ${block.borderColor || '#cccccc'}` : undefined,
          width: block.width ? block.width + 'px' : undefined,
          height: block.height ? block.height + 'px' : undefined,
        }"
        @mousedown="onBlockMouseDown($event, block.id)"
      >
        <div v-if="block.type === 'text'" class="block-text-wrap">
          <div
            class="drag-handle"
            title="拖动移动"
            @mousedown.stop="onDragHandleDown($event, block.id)"
          >⠿</div>
          <div
            class="block-text"
            :contenteditable="canvas.editingBlockId === block.id ? 'true' : 'false'"
            :style="{
              fontSize: (block.fontSize || 14) + 'px',
              color: block.fontColor || '#333333',
              fontFamily: block.fontFamily || undefined,
              lineHeight: block.lineHeight || 1.7,
              fontWeight: block.fontWeight || undefined,
              fontStyle: block.fontStyle || undefined,
              textDecoration: block.textDecoration || undefined,
            }"
            @focus="onTextFocus(block.id)"
            @blur="onTextBlur(block.id, $event)"
            @mousedown.stop="onTextMouseDown($event, block.id)"
            @dblclick.stop="canvas.setEditing(block.id); ($event.target as HTMLElement).focus()"
            v-init-html="block.content || ''"
          />
        </div>

        <div v-else-if="block.type === 'image'" class="block-image">
          <img :src="getImageSrc(block)" draggable="false" />
        </div>

        <div
          v-else-if="block.type === 'label'"
          class="block-label"
          :style="{
            background: getLabelPreset(block.labelName || '重点').bg,
            color: getLabelPreset(block.labelName || '重点').color,
          }"
        >
          {{ block.labelName || '重点' }}
        </div>

        <template v-if="(block.type === 'text' || block.type === 'image') && canvas.selectedBlockIds.includes(block.id)">
          <div class="rh rh-n" @mousedown="startResize($event, block.id, 'n')" />
          <div class="rh rh-s" @mousedown="startResize($event, block.id, 's')" />
          <div class="rh rh-e" @mousedown="startResize($event, block.id, 'e')" />
          <div class="rh rh-w" @mousedown="startResize($event, block.id, 'w')" />
          <div class="rh rh-ne" @mousedown="startResize($event, block.id, 'ne')" />
          <div class="rh rh-nw" @mousedown="startResize($event, block.id, 'nw')" />
          <div class="rh rh-se" @mousedown="startResize($event, block.id, 'se')" />
          <div class="rh rh-sw" @mousedown="startResize($event, block.id, 'sw')" />
        </template>
      </div>

      <div v-if="canvas.blocks.length === 0" class="canvas-hint">
        选择顶部工具，点击画布放置组件
        <small>点击文本编辑 · 拖拽 ⠿ 手柄移动 · Alt+拖拽平移画布 · 框选多个块</small>
      </div>
      <div v-if="pasteNotice" class="paste-notice" role="status">{{ pasteNotice }}</div>

      <!-- Marquee selection rectangle -->
      <div
        v-if="marqueeRect.visible"
        class="marquee-rect"
        :style="{
          left: marqueeRect.left + 'px',
          top: marqueeRect.top + 'px',
          width: marqueeRect.width + 'px',
          height: marqueeRect.height + 'px',
        }"
      />

      <!-- Smart guide lines -->
      <template v-for="(guide, idx) in activeGuides" :key="idx">
        <div
          v-if="guide.orientation === 'v'"
          class="guide-line guide-v"
          :style="{ left: guide.position + 'px' }"
        />
        <div
          v-else
          class="guide-line guide-h"
          :style="{ top: guide.position + 'px' }"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.canvas-wrap {
  flex: 1;
  position: relative;
  overflow: auto;
  min-height: 0;
  min-width: 0;
  background: #fafbfd;
  background-image: radial-gradient(circle, #e0e0e0 1px, transparent 1px);
  background-size: 20px 20px;
  cursor: grab;
}

.canvas-wrap:active {
  cursor: grabbing;
}

/* Custom scrollbar styles */
.canvas-wrap::-webkit-scrollbar {
  width: 3px;
  height: 3px;
}

.canvas-wrap::-webkit-scrollbar-track {
  background: transparent;
}

.canvas-wrap::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

.canvas-wrap::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.canvas-wrap::-webkit-scrollbar-corner {
  background: transparent;
}

.canvas {
  position: relative;
}

.block {
  position: absolute;
  min-width: 60px;
  min-height: 24px;
  border: 2px solid transparent;
  cursor: grab;
  transition: border-color 0.12s, box-shadow 0.12s;
  overflow: visible;
}

.block:hover { border-color: var(--primary-border); }
.block.selected { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.12); }

.block-text-wrap {
  position: relative;
}

.drag-handle {
  position: absolute;
  left: -20px;
  top: 6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #bbb;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.15s;
  user-select: none;
  border-radius: 3px;
}

.block:hover .drag-handle,
.block.selected .drag-handle {
  opacity: 1;
}

.drag-handle:hover {
  color: var(--primary);
  background: rgba(26, 115, 232, 0.08);
}

.drag-handle:active {
  cursor: grabbing;
}

.block-text {
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.7;
  outline: none;
  word-break: break-word;
  white-space: pre-wrap;
  cursor: text;
}

.block:has(.block-image) { overflow: hidden; }
.block-image { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.block-image img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; display: block; }

.block-label {
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  white-space: nowrap;
  border-radius: 12px;
  cursor: grab;
}

.rh {
  position: absolute;
  z-index: 100;
}
.rh-n, .rh-s { left: 12px; right: 12px; height: 14px; cursor: ns-resize; }
.rh-e, .rh-w { top: 12px; bottom: 12px; width: 14px; cursor: ew-resize; }
.rh-n { top: -7px; }
.rh-s { bottom: -7px; }
.rh-e { right: -7px; }
.rh-w { left: -7px; }
.rh-ne, .rh-nw, .rh-se, .rh-sw {
  width: 20px; height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rh-ne::after, .rh-nw::after, .rh-se::after, .rh-sw::after {
  content: '';
  width: 8px; height: 8px;
  background: var(--primary);
  border: 1.5px solid #fff;
  border-radius: 50%;
  pointer-events: none;
}
.rh-ne { top: -10px; right: -10px; cursor: nesw-resize; }
.rh-nw { top: -10px; left: -10px; cursor: nwse-resize; }
.rh-se { bottom: -10px; right: -10px; cursor: nwse-resize; }
.rh-sw { bottom: -10px; left: -10px; cursor: nesw-resize; }

.canvas-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #c0c0c0;
  font-size: 15px;
  pointer-events: none;
  user-select: none;
  text-align: center;
}
.canvas-hint small { font-size: 12px; color: #d5d5d5; display: block; margin-top: 8px; }

.paste-notice {
  position: fixed;
  left: 50%;
  bottom: 28px;
  z-index: 200;
  max-width: 360px;
  padding: 9px 14px;
  transform: translateX(-50%);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 6px 20px rgba(32, 33, 36, 0.14);
  font-size: 12px;
  text-align: center;
}

.marquee-rect {
  position: absolute;
  border: 1px dashed var(--primary);
  background: rgba(26, 115, 232, 0.08);
  pointer-events: none;
  z-index: 999;
}

.guide-line {
  position: absolute;
  background: #ff4081;
  pointer-events: none;
  z-index: 998;
}
.guide-v {
  top: 0;
  bottom: 0;
  width: 1px;
}
.guide-h {
  left: 0;
  right: 0;
  height: 1px;
}
</style>
