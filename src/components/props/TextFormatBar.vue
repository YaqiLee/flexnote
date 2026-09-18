<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useCanvasStore } from '../../stores/canvas'
import { stripInlineFormatting } from '../../utils/text-format'

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

function getEditor() {
  return canvas.currentEditor
}

function updateSelectionState() {
  const editor = getEditor()
  if (!editor) {
    // No editor, fall back to block-level properties
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

  // Use TipTap editor state
  isBold.value = editor.isActive('bold')
  isItalic.value = editor.isActive('italic')
  isUnderline.value = editor.isActive('underline')
  isStrikeThrough.value = editor.isActive('strike')

  const fontFamily = editor.getAttributes('textStyle').fontFamily
  currentFontFamily.value = fontFamily || ''

  const fontSize = editor.getAttributes('textStyle').fontSize
  currentFontSize.value = fontSize ? parseInt(fontSize, 10) : 14

  const color = editor.getAttributes('textStyle').color
  currentFontColor.value = color || '#333333'

  const highlight = editor.getAttributes('highlight')
  currentHiliteColor.value = highlight?.color || 'transparent'
}

// Watch for editor changes and selection updates
watch(() => canvas.currentEditor, (editor) => {
  if (editor) {
    editor.on('selectionUpdate', updateSelectionState)
    editor.on('transaction', updateSelectionState)
    updateSelectionState()
  }
}, { immediate: true })

onMounted(() => {
  updateSelectionState()
})

onUnmounted(() => {
  const editor = getEditor()
  if (editor) {
    editor.off('selectionUpdate', updateSelectionState)
    editor.off('transaction', updateSelectionState)
  }
})

function applyBlockStyle(updates: Record<string, any>) {
  if (!canvas.selectedBlockId) return
  stripInlineFormatting(canvas.selectedBlockId)
  canvas.updateBlock(canvas.selectedBlockId, updates)
}

function toggleBold() {
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().toggleBold().run()
  } else if (canvas.selectedBlockId) {
    const block = canvas.selectedBlock
    const current = block?.fontWeight === 'bold'
    applyBlockStyle({ fontWeight: current ? 'normal' : 'bold' })
  }
  updateSelectionState()
}

function toggleItalic() {
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().toggleItalic().run()
  } else if (canvas.selectedBlockId) {
    const block = canvas.selectedBlock
    const current = block?.fontStyle === 'italic'
    applyBlockStyle({ fontStyle: current ? 'normal' : 'italic' })
  }
  updateSelectionState()
}

function toggleUnderline() {
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().toggleUnderline().run()
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
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().toggleStrike().run()
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
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().setMark('textStyle', { fontSize: val + 'px' }).run()
  } else if (canvas.selectedBlockId) {
    applyBlockStyle({ fontSize: Number(val) })
  }
  updateSelectionState()
}

function setFontColor(val: string) {
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().setColor(val).run()
  } else if (canvas.selectedBlockId) {
    applyBlockStyle({ fontColor: val })
  }
  updateSelectionState()
}

function setFontFamily(val: string) {
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().setFontFamily(val).run()
  } else if (canvas.selectedBlockId) {
    applyBlockStyle({ fontFamily: val || undefined })
  }
  updateSelectionState()
}

function setHiliteColor(val: string) {
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().toggleHighlight({ color: val }).run()
  } else if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { bgColor: val })
  }
  updateSelectionState()
}

function clearHilite() {
  const editor = getEditor()
  if (editor && canvas.editingBlockId) {
    editor.chain().focus().unsetHighlight().run()
  } else if (canvas.selectedBlockId) {
    canvas.updateBlock(canvas.selectedBlockId, { bgColor: undefined })
  }
  updateSelectionState()
}

function setLineHeight(val: string) {
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
      <select class="font-family-select" :value="currentFontFamily" @change="setFontFamily(($event.target as HTMLSelectElement).value)">
        <option v-for="f in FONT_FAMILIES" :key="f.value" :value="f.value">{{ f.name }}</option>
      </select>
      <select class="font-size-select" :value="currentFontSize" @change="setFontSize(($event.target as HTMLSelectElement).value)">
        <option v-for="s in [10,11,12,13,14,15,16,18,20,22,24,28,32,36]" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div class="props-sep"></div>

    <!-- Style buttons group -->
    <div class="format-group btn-group">
      <button :class="{ active: isBold }" @click="toggleBold" title="加粗"><b>B</b></button>
      <button :class="{ active: isItalic }" @click="toggleItalic" title="斜体"><i>I</i></button>
      <button :class="{ active: isUnderline }" @click="toggleUnderline" title="下划线"><u>U</u></button>
      <button :class="{ active: isStrikeThrough }" @click="toggleStrikeThrough" title="删除线"><s>S</s></button>
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
      <button v-if="currentHiliteColor !== 'transparent'" class="clear-hilite-btn" title="清除高亮" @click="clearHilite">✕</button>
      <select class="line-height-select" :value="canvas.selectedBlock?.lineHeight || 1.7" @change="setLineHeight(($event.target as HTMLSelectElement).value)" title="行高">
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
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-group button:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.btn-group button.active {
  background: var(--primary-light);
  color: var(--primary);
}

.font-family-select,
.font-size-select,
.line-height-select {
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  padding: 0 4px;
  cursor: pointer;
}

.font-family-select { width: 90px; }
.font-size-select { width: 50px; }
.line-height-select { width: 50px; }

.props-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 2px;
}

.color-picker-wrap {
  position: relative;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
}

.color-picker-wrap:hover {
  background: var(--surface-hover);
}

.color-picker-wrap input[type="color"] {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.color-label {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-secondary);
  pointer-events: none;
}

.hilite-label {
  font-size: 16px;
}

.clear-hilite-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-hilite-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}
</style>