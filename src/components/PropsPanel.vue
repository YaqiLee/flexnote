<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../stores/canvas'
import TextFormatBar from './props/TextFormatBar.vue'
import BlockPropsPanel from './props/BlockPropsPanel.vue'
import AlignToolbar from './props/AlignToolbar.vue'

const canvas = useCanvasStore()
const panelRef = ref<HTMLDivElement>()
const pos = ref({ left: '-9999px', top: '-9999px' })
const positioned = ref(false)

const hasTextSelection = ref(false)

const showTextFormat = computed(() => {
  if (!canvas.selectedBlockId) return false
  const block = canvas.selectedBlock
  if (!block || block.type !== 'text') return false
  return true
})

const showBlockProps = computed(() => {
  if (!canvas.selectedBlockId) return false
  const block = canvas.selectedBlock
  if (!block) return false
  // In editing mode, only show text format bar (hide block props)
  if (canvas.editingBlockId && block.type === 'text') return false
  return true
})

const showAlignToolbar = computed(() => {
  return canvas.selectedBlockIds.length >= 2
})

const visible = computed(() => showTextFormat.value || showBlockProps.value || showAlignToolbar.value)

function updatePosition() {
  if (!panelRef.value) return

  // When not visible, keep off-screen but maintain layout for measurement
  if (!visible.value) {
    pos.value = { left: '-9999px', top: '-9999px' }
    positioned.value = false
    return
  }

  // For multi-select, compute bounding box of all selected blocks
  let blockRect: DOMRect | null = null
  if (canvas.selectedBlockIds.length >= 2) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of canvas.selectedBlockIds) {
      const el = document.querySelector(`[data-block-id="${id}"]`) as HTMLElement
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.left < minX) minX = r.left
      if (r.top < minY) minY = r.top
      if (r.right > maxX) maxX = r.right
      if (r.bottom > maxY) maxY = r.bottom
    }
    if (minX === Infinity) {
      pos.value = { left: '-9999px', top: '-9999px' }
      positioned.value = false
      return
    }
    blockRect = new DOMRect(minX, minY, maxX - minX, maxY - minY)
  } else {
    const blockEl = document.querySelector(`[data-block-id="${canvas.selectedBlockId}"]`) as HTMLElement
    if (!blockEl) {
      pos.value = { left: '-9999px', top: '-9999px' }
      positioned.value = false
      return
    }
    blockRect = blockEl.getBoundingClientRect()
  }

  const container = document.querySelector('.canvas-wrap') as HTMLElement
  if (!container) return

  const containerRect = container.getBoundingClientRect()
  const pw = panelRef.value.offsetWidth
  const ph = panelRef.value.offsetHeight

  // If panel has no size yet (content just rendered), defer
  if (pw === 0 || ph === 0) {
    requestAnimationFrame(updatePosition)
    return
  }

  const gap = 8
  const blockLeftInContainer = blockRect.left - containerRect.left
  const blockTopInContainer = blockRect.top - containerRect.top
  const blockBottomInContainer = blockRect.bottom - containerRect.top

  // Priority: above > below > right > left
  const candidates: { left: number; top: number }[] = []

  // Above center-aligned
  const aboveLeft = Math.max(4, Math.min(blockLeftInContainer + (blockRect.width - pw) / 2, containerRect.width - pw - 4))
  const aboveTop = blockTopInContainer - ph - gap
  if (aboveTop >= 4) candidates.push({ left: aboveLeft, top: aboveTop })

  // Below center-aligned
  const belowLeft = Math.max(4, Math.min(blockLeftInContainer + (blockRect.width - pw) / 2, containerRect.width - pw - 4))
  const belowTop = blockBottomInContainer + gap
  if (belowTop + ph <= containerRect.height - 4) candidates.push({ left: belowLeft, top: belowTop })

  // Right aligned to block top
  const rightLeft = blockLeftInContainer + blockRect.width + gap
  const rightTop = blockTopInContainer
  if (rightLeft + pw <= containerRect.width - 4) candidates.push({ left: rightLeft, top: rightTop })

  // Left aligned to block top
  const leftLeft = blockLeftInContainer - pw - gap
  const leftTop = blockTopInContainer
  if (leftLeft >= 4) candidates.push({ left: leftLeft, top: leftTop })

  const br = blockRect!
  function overlaps(l: number, t: number) {
    return !(l + pw <= blockLeftInContainer || l >= blockLeftInContainer + br.width ||
             t + ph <= blockTopInContainer || t >= blockTopInContainer + br.height)
  }

  let chosen = candidates.find(c => !overlaps(c.left, c.top))
  if (!chosen) {
    // Fallback: top-right corner of container
    chosen = { left: containerRect.width - pw - 8, top: 8 }
  }

  pos.value = { left: chosen.left + 'px', top: chosen.top + 'px' }
  positioned.value = true
}

function updateTextSelection() {
  const selection = window.getSelection()
  const blockId = canvas.selectedBlockId
  if (!selection || selection.isCollapsed || !blockId) {
    hasTextSelection.value = false
    return
  }

  const anchor = selection.anchorNode instanceof Element
    ? selection.anchorNode
    : selection.anchorNode?.parentElement
  const focus = selection.focusNode instanceof Element
    ? selection.focusNode
    : selection.focusNode?.parentElement
  const blockEl = document.querySelector(`[data-block-id="${blockId}"] .block-text`)
  hasTextSelection.value = Boolean(
    blockEl && anchor && focus && blockEl.contains(anchor) && blockEl.contains(focus),
  )
}

// Re-position when selection changes or content mode switches
watch([() => canvas.selectedBlockId, () => canvas.selectedBlockIds.length, showTextFormat, showBlockProps, showAlignToolbar], () => {
  updateTextSelection()
  nextTick(() => {
    requestAnimationFrame(updatePosition)
  })
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  document.addEventListener('selectionchange', updateTextSelection)
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)

  // Observe panel size changes (e.g. switching between TextFormatBar and BlockPropsPanel)
  if (panelRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (visible.value) {
        requestAnimationFrame(updatePosition)
      }
    })
    resizeObserver.observe(panelRef.value)
  }
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', updateTextSelection)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
  resizeObserver?.disconnect()
})

function onPanelMouseDown(e: MouseEvent) {
  // Stop propagation to prevent canvas mousedown handler from firing
  // but do NOT preventDefault so buttons and inputs work normally
  e.stopPropagation()
}
</script>

<template>
  <div
    ref="panelRef"
    class="props-panel"
    :class="{ 'props-panel--visible': visible && positioned }"
    :style="{ left: pos.left, top: pos.top }"
    @mousedown="onPanelMouseDown"
  >
    <TextFormatBar v-if="showTextFormat" />
    <BlockPropsPanel v-if="showBlockProps" />
    <AlignToolbar v-if="showAlignToolbar" />
  </div>
</template>

<style scoped>
.props-panel {
  position: absolute;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  z-index: 200;
  max-width: 560px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s ease;
}

.props-panel--visible {
  opacity: 1;
  pointer-events: auto;
}
</style>
