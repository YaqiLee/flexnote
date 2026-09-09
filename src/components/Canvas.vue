<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, toRaw, type Directive } from 'vue'
import { useCanvasStore } from '../stores/canvas'

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

// Dynamic canvas size
const canvasWidth = ref(3000)
const canvasHeight = ref(2000)
const CANVAS_PADDING = 200
const MIN_CANVAS_WIDTH = 3000
const MIN_CANVAS_HEIGHT = 2000

function expandCanvasIfNeeded() {
  let maxRight = 0
  let maxBottom = 0
  for (const block of canvas.blocks) {
    const right = block.x + (block.width || 200)
    const bottom = block.y + (block.height || 80)
    if (right > maxRight) maxRight = right
    if (bottom > maxBottom) maxBottom = bottom
  }
  // Expand right/bottom with padding if blocks approach boundary
  if (maxRight + CANVAS_PADDING > canvasWidth.value) {
    canvasWidth.value = Math.max(MIN_CANVAS_WIDTH, Math.ceil((maxRight + CANVAS_PADDING) / 100) * 100)
  }
  if (maxBottom + CANVAS_PADDING > canvasHeight.value) {
    canvasHeight.value = Math.max(MIN_CANVAS_HEIGHT, Math.ceil((maxBottom + CANVAS_PADDING) / 100) * 100)
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
    canvasWidth.value = Math.max(MIN_CANVAS_WIDTH, Math.ceil((scrollLeft + viewWidth + CANVAS_PADDING) / 100) * 100)
  }

  // Expand bottom if scrolled near bottom edge
  if (scrollTop + viewHeight > canvasHeight.value - CANVAS_PADDING) {
    canvasHeight.value = Math.max(MIN_CANVAS_HEIGHT, Math.ceil((scrollTop + viewHeight + CANVAS_PADDING) / 100) * 100)
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

function onCanvasMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  const isCanvasArea = target === canvasEl.value ||
    target.classList.contains('canvas-hint') ||
    target.classList.contains('canvas-wrap')
  if (!isCanvasArea) return

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
    canvas.addBlock({ type: 'image', x, y, src: canvas.pendingImageData, borderRadius: 0 })
    canvas.setPendingImage(null)
    canvas.setTool(null)
    expandCanvasIfNeeded()
  } else if (canvas.currentTool === 'label') {
    canvas.addBlock({ type: 'label', x, y, labelName: '重点', borderRadius: 14 })
    expandCanvasIfNeeded()
  } else if (canvas.currentTool === 'formula') {
    const id = canvas.addBlock({ type: 'formula', x, y, formula: 'U = I × R', borderRadius: 6 })
    canvas.setTool(null)
    expandCanvasIfNeeded()
    nextTick(() => {
      const el = document.querySelector(`[data-block-id="${id}"] .block-formula`) as HTMLElement
      if (el) el.focus()
    })
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
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
      }
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
  resizeStartW = block.width || 200
  resizeStartH = block.height || 80
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
      for (const id of idsToMove) {
        const block = canvas.blocks.find(b => b.id === id)
        if (block) {
          canvas.updateBlock(id, { x: block.x + dx, y: block.y + dy })
        }
      }
      dragStartX = e.clientX
      dragStartY = e.clientY
      expandCanvasIfNeeded()
    }
  }
  if (isResizing && resizeBlockId) {
    const dw = e.clientX - resizeStartX
    const dh = e.clientY - resizeStartY
    const MIN_W = 60
    const MIN_H = 24
    let newX = resizeStartBX
    let newY = resizeStartBY
    let newW = resizeStartW
    let newH = resizeStartH

    if (resizeDir.includes('e')) newW = Math.max(MIN_W, resizeStartW + dw)
    if (resizeDir.includes('w')) {
      const w = Math.max(MIN_W, resizeStartW - dw)
      newX = resizeStartBX + (resizeStartW - w)
      newW = w
    }
    if (resizeDir.includes('s')) newH = Math.max(MIN_H, resizeStartH + dh)
    if (resizeDir.includes('n')) {
      const h = Math.max(MIN_H, resizeStartH - dh)
      newY = resizeStartBY + (resizeStartH - h)
      newH = h
    }

    canvas.updateBlock(resizeBlockId, { x: newX, y: newY, width: newW, height: newH })
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
  isResizing = false
  resizeBlockId = null
}

// Clipboard for copy/paste
let clipboardBlocks: import('../stores/canvas').BlockData[] = []

function onKeyDown(e: KeyboardEvent) {
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

  // Ctrl+C: Copy selected blocks
  if (ctrl && e.code === 'KeyC') {
    if (canvas.selectedBlockIds.length > 0) {
      e.preventDefault()
      e.stopImmediatePropagation()
      const rawBlocks = toRaw(canvas.blocks)
      clipboardBlocks = structuredClone(
        rawBlocks.filter(b => canvas.selectedBlockIds.includes(b.id))
      )
    }
    return
  }

  // Ctrl+V: Paste copied blocks (offset by 20px)
  if (ctrl && e.code === 'KeyV') {
    if (clipboardBlocks.length > 0) {
      e.preventDefault()
      e.stopImmediatePropagation()
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
      canvas.selectBlocks(newIds)
      expandCanvasIfNeeded()
    }
    return
  }

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
      canvas.removeBlocks([...canvas.selectedBlockIds])
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
  expandCanvasIfNeeded()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
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
          <img :src="block.src || ''" draggable="false" />
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

        <div
          v-else-if="block.type === 'formula'"
          class="block-formula"
          contenteditable="true"
          @focus="canvas.selectBlock(block.id)"
          @blur="canvas.updateBlock(block.id, { formula: ($event.target as HTMLElement).textContent || '' })"
        >
          {{ block.formula || 'E = mc²' }}
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
  width: 8px;
  height: 8px;
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
  min-width: 3000px;
  min-height: 2000px;
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

.block-image { padding: 3px; display: flex; align-items: center; justify-content: center; }
.block-image img { max-width: 400px; max-height: 300px; pointer-events: none; display: block; }

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

.block-formula {
  padding: 8px 16px;
  font-size: 18px;
  font-family: 'Times New Roman', 'Cambria Math', serif;
  font-style: italic;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  outline: none;
  cursor: text;
}
.block-formula:focus { outline: 2px solid var(--primary-border); }

.rh {
  position: absolute;
  z-index: 100;
}
.rh-n, .rh-s { left: 8px; right: 8px; height: 8px; cursor: ns-resize; }
.rh-e, .rh-w { top: 8px; bottom: 8px; width: 8px; cursor: ew-resize; }
.rh-n { top: -4px; }
.rh-s { bottom: -4px; }
.rh-e { right: -4px; }
.rh-w { left: -4px; }
.rh-ne, .rh-nw, .rh-se, .rh-sw {
  width: 8px; height: 8px;
  background: var(--primary);
  border: 1.5px solid #fff;
  border-radius: 50%;
}
.rh-ne { top: -4px; right: -4px; cursor: nesw-resize; }
.rh-nw { top: -4px; left: -4px; cursor: nwse-resize; }
.rh-se { bottom: -4px; right: -4px; cursor: nwse-resize; }
.rh-sw { bottom: -4px; left: -4px; cursor: nesw-resize; }

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

.marquee-rect {
  position: absolute;
  border: 1px dashed var(--primary);
  background: rgba(26, 115, 232, 0.08);
  pointer-events: none;
  z-index: 999;
}
</style>
