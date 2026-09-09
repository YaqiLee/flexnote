<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import {
  stripInlineFormatting,
  execBold,
  execItalic,
  execUnderline,
  execStrikeThrough,
  execForeColor,
  execHiliteColor,
  execFontName,
  execFontSize,
} from '../../utils/text-format'

const canvas = useCanvasStore()

const FONT_FAMILIES = [
  { name: '默认', value: '' },
  { name: '微软雅黑', value: 'Microsoft YaHei' },
  { name: '宋体', value: 'SimSun' },
  { name: '黑体', value: 'SimHei' },
  { name: '楷体', value: 'KaiTi' },
  { name: 'Arial', value: 'Arial' },
  { name: 'Times New Roman', value: 'Times New Roman' },
  { name: 'Courier New', value: 'Courier New' },
]

// Track current selection style state
const isBold = ref(false)
const isItalic = ref(false)
const isUnderline = ref(false)
const isStrikeThrough = ref(false)
const currentFontFamily = ref('')
const currentFontSize = ref(14)
const currentFontColor = ref('#333333')
const currentHiliteColor = ref('transparent')

function updateSelectionState() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    // No selection, fall back to block-level properties
    const block = canvas.selectedBlock
    isBold.value = block?.fontWeight === 'bold'
    isItalic.value = block?.fontStyle === 'italic'
    isUnderline.value = block?.textDecoration?.includes('underline') ?? false
    isStrikeThrough.value = block?.textDecoration?.includes('line-through') ?? false
    currentFontFamily.value = block?.fontFamily || ''
    currentFontSize.value = block?.fontSize || 14
    currentFontColor.value = block?.fontColor || '#333333'
    currentHiliteColor.value = block?.bgColor || 'transparent'
    return
  }
  // Check computed style at selection
  try {
    isBold.value = document.queryCommandState('bold')
    isItalic.value = document.queryCommandState('italic')
    isUnderline.value = document.queryCommandState('underline')
    isStrikeThrough.value = document.queryCommandState('strikeThrough')
    const fontName = document.queryCommandValue('fontName')
    currentFontFamily.value = fontName ? fontName.replace(/"/g, '') : ''
    const fontSizeVal = document.queryCommandValue('fontSize')
    // execCommand fontSize returns 1-7, map to actual px
    const sizeMap: Record<string, number> = { '1': 10, '2': 13, '3': 16, '4': 18, '5': 24, '6': 32, '7': 48 }
    currentFontSize.value = sizeMap[fontSizeVal] || 14
    const colorVal = document.queryCommandValue('foreColor')
    if (colorVal) {
      // Convert rgb(r, g, b) to #rrggbb
      const rgbMatch = colorVal.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0')
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0')
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0')
        currentFontColor.value = `#${r}${g}${b}`
      } else if (colorVal.startsWith('#')) {
        currentFontColor.value = colorVal
      }
    }
    const hiliteVal = document.queryCommandValue('hiliteColor')
    if (hiliteVal) {
      const rgbMatch = hiliteVal.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0')
        const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0')
        const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0')
        currentHiliteColor.value = `#${r}${g}${b}`
      } else if (hiliteVal.startsWith('#')) {
        currentHiliteColor.value = hiliteVal
      }
    } else {
      currentHiliteColor.value = 'transparent'
    }
  } catch {
    // queryCommandState may throw in some contexts
  }
}

onMounted(() => {
  document.addEventListener('selectionchange', updateSelectionState)
  updateSelectionState()
})

onUnmounted(() => {
  document.removeEventListener('selectionchange', updateSelectionState)
})

// Check if there is an active text selection within the editing block
function hasTextSelection(): boolean {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false
  if (!canvas.editingBlockId) return false
  const blockEl = document.querySelector(`[data-block-id="${canvas.editingBlockId}"] .block-text`)
  if (!blockEl) return false
  const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement
  const focus = sel.focusNode instanceof Element ? sel.focusNode : sel.focusNode?.parentElement
  return Boolean(anchor && focus && blockEl.contains(anchor) && blockEl.contains(focus))
}

// Save/restore selection for color picker (which causes blur)
let savedRange: Range | null = null
let savedEditingBlockId: string | null = null

function saveSelection() {
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed && canvas.editingBlockId) {
    savedRange = sel.getRangeAt(0).cloneRange()
    savedEditingBlockId = canvas.editingBlockId
  } else {
    savedRange = null
    savedEditingBlockId = null
  }
}

function restoreSelection(): boolean {
  if (savedRange && savedEditingBlockId) {
    // Re-focus the editing block first
    const blockEl = document.querySelector(`[data-block-id="${savedEditingBlockId}"] .block-text`) as HTMLElement
    if (blockEl) {
      blockEl.focus()
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(savedRange)
      }
      return true
    }
  }
  return false
}

function applyBlockStyle(updates: Record<string, any>) {
  if (!canvas.selectedBlockId) return
  stripInlineFormatting(canvas.selectedBlockId)
  canvas.updateBlock(canvas.selectedBlockId, updates)
}

function toggleBold() {
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execBold()
  } else if (canvas.selectedBlockId) {
    const block = canvas.selectedBlock
    const current = block?.fontWeight === 'bold'
    applyBlockStyle({ fontWeight: current ? 'normal' : 'bold' })
  }
  updateSelectionState()
}

function toggleItalic() {
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execItalic()
  } else if (canvas.selectedBlockId) {
    const block = canvas.selectedBlock
    const current = block?.fontStyle === 'italic'
    applyBlockStyle({ fontStyle: current ? 'normal' : 'italic' })
  }
  updateSelectionState()
}

function toggleUnderline() {
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execUnderline()
  } else if (canvas.selectedBlockId) {
    const block = canvas.selectedBlock
    const hasUnder = block?.textDecoration?.includes('underline')
    const hasLine = block?.textDecoration?.includes('line-through')
    let deco = ''
    if (!hasUnder) {
      deco = hasLine ? 'underline line-through' : 'underline'
    } else if (hasLine) {
      deco = 'line-through'
    }
    applyBlockStyle({ textDecoration: deco || undefined })
  }
  updateSelectionState()
}

function toggleStrikeThrough() {
  // Only restore selection if currently in editing mode
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execStrikeThrough()
  } else if (canvas.selectedBlockId) {
    const block = canvas.selectedBlock
    const hasUnder = block?.textDecoration?.includes('underline')
    const hasLine = block?.textDecoration?.includes('line-through')
    let deco = ''
    if (!hasLine) {
      deco = hasUnder ? 'underline line-through' : 'line-through'
    } else if (hasUnder) {
      deco = 'underline'
    }
    applyBlockStyle({ textDecoration: deco || undefined })
  }
  updateSelectionState()
}

function setFontSize(val: string) {
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execFontSize(Number(val))
  } else if (canvas.selectedBlockId) {
    applyBlockStyle({ fontSize: Number(val) })
  }
  updateSelectionState()
}

function setFontColor(val: string) {
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execForeColor(val)
  } else if (canvas.selectedBlockId) {
    applyBlockStyle({ fontColor: val })
  }
  updateSelectionState()
}

function setFontFamily(val: string) {
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execFontName(val)
  } else if (canvas.selectedBlockId) {
    applyBlockStyle({ fontFamily: val || undefined })
  }
  updateSelectionState()
}

function setHiliteColor(val: string) {
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execHiliteColor(val)
  } else if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { bgColor: val })
  }
  updateSelectionState()
}

function clearHilite() {
  if (canvas.editingBlockId) {
    restoreSelection()
  }
  if (canvas.editingBlockId && hasTextSelection()) {
    execHiliteColor('transparent')
  } else if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { bgColor: undefined })
  }
  updateSelectionState()
}

function setLineHeight(val: string) {
  // Line height applies to whole block (no execCommand equivalent)
  if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { lineHeight: Number(val) })
  }
}
</script>

<template>
  <div class="text-format-bar" @mousedown="(e: MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName.toLowerCase()
    if (tag !== 'select' && tag !== 'input' && tag !== 'option') e.preventDefault()
  }">
    <!-- Font group -->
    <div class="format-group">
      <select class="font-family-select" :value="currentFontFamily" @mousedown.stop="saveSelection()" @change="setFontFamily(($event.target as HTMLSelectElement).value)">
        <option v-for="f in FONT_FAMILIES" :key="f.value" :value="f.value">{{ f.name }}</option>
      </select>
      <select class="font-size-select" :value="currentFontSize" @mousedown.stop="saveSelection()" @change="setFontSize(($event.target as HTMLSelectElement).value)">
        <option v-for="s in [10,11,12,13,14,15,16,18,20,22,24,28,32,36]" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div class="props-sep"></div>

    <!-- Style buttons group -->
    <div class="format-group btn-group">
      <button :class="{ active: isBold }" @mousedown="saveSelection(); $event.preventDefault()" @click="toggleBold" title="加粗"><b>B</b></button>
      <button :class="{ active: isItalic }" @mousedown="saveSelection(); $event.preventDefault()" @click="toggleItalic" title="斜体"><i>I</i></button>
      <button :class="{ active: isUnderline }" @mousedown="saveSelection(); $event.preventDefault()" @click="toggleUnderline" title="下划线"><u>U</u></button>
      <button :class="{ active: isStrikeThrough }" @mousedown="saveSelection(); $event.preventDefault()" @click="toggleStrikeThrough" title="删除线"><s>S</s></button>
    </div>

    <div class="props-sep"></div>

    <!-- Color & Line height group -->
    <div class="format-group">
      <div class="color-picker-wrap" title="文字颜色" @mousedown.stop>
        <input type="color" :value="currentFontColor" @mousedown.prevent @input="setFontColor(($event.target as HTMLInputElement).value)" />
        <span class="color-label">A</span>
      </div>
      <div class="color-picker-wrap hilite" title="高亮背景色" @mousedown.stop>
        <input type="color" :value="currentHiliteColor === 'transparent' ? '#ffff00' : currentHiliteColor" @mousedown.prevent @input="setHiliteColor(($event.target as HTMLInputElement).value)" />
        <span class="color-label hilite-label">⌶</span>
      </div>
      <button v-if="currentHiliteColor !== 'transparent'" class="clear-hilite-btn" title="清除高亮" @mousedown="saveSelection(); $event.preventDefault()" @click="clearHilite">✕</button>
      <select class="line-height-select" :value="canvas.selectedBlock?.lineHeight || 1.7" @mousedown.stop="saveSelection()" @change="setLineHeight(($event.target as HTMLSelectElement).value)" title="行高">
        <option v-for="lh in [1.0, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0, 2.2, 2.5, 3.0]" :key="lh" :value="lh">{{ lh }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.text-format-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.format-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-group button {
  padding: 4px 7px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  transition: all 0.12s;
  min-width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.btn-group button:hover {
  background: var(--primary-light);
  border-color: var(--primary-border);
}

.btn-group button.active {
  background: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}

.font-family-select {
  width: 90px;
  padding: 3px 4px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 12px;
  background: var(--surface);
  height: 26px;
}

.font-size-select {
  width: 48px;
  padding: 3px 2px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 12px;
  background: var(--surface);
  height: 26px;
  text-align: center;
}

.line-height-select {
  width: 48px;
  padding: 3px 2px;
  border: 1px solid var(--border);
  border-radius: 3px;
  font-size: 12px;
  background: var(--surface);
  height: 26px;
  text-align: center;
}

.color-picker-wrap {
  position: relative;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
}

.color-picker-wrap input[type="color"] {
  position: absolute;
  top: -4px;
  left: -4px;
  width: 34px;
  height: 34px;
  border: none;
  cursor: pointer;
  opacity: 0;
}

.color-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  pointer-events: none;
}

.color-picker-wrap.hilite .hilite-label {
  font-size: 13px;
  font-weight: 600;
}

.clear-hilite-btn {
  padding: 2px 5px;
  border: 1px solid var(--border);
  background: transparent;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text-secondary);
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s;
}

.clear-hilite-btn:hover {
  background: var(--danger-light);
  border-color: var(--danger);
  color: var(--danger);
}

.props-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  flex-shrink: 0;
}
</style>
