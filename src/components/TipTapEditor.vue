<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Blockquote } from '@tiptap/extension-blockquote'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { OrderedList } from '@tiptap/extension-ordered-list'
import { BulletList } from '@tiptap/extension-bullet-list'
import { ListItem } from '@tiptap/extension-list-item'
import { Image } from '@tiptap/extension-image'
import { common, createLowlight } from 'lowlight'
import { Extension, markInputRule } from '@tiptap/core'
import { useCanvasStore } from '../stores/canvas'

const lowlight = createLowlight(common)

interface BlockStyle {
  fontSize?: number
  fontColor?: string
  fontFamily?: string
  lineHeight?: number
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
}

const props = defineProps<{
  blockId: string
  content: string
  editing: boolean
  blockStyle: BlockStyle
}>()

const emit = defineEmits<{
  'update:content': [html: string]
  focus: []
  blur: [e: FocusEvent]
}>()

// Custom strikethrough input rule: ~~text~~
const StrikethroughExtension = Extension.create({
  name: 'strikethroughInputRule',
  addInputRules() {
    return [
      markInputRule({
        find: /~~([^~]+)~~$/,
        type: this.editor.schema.marks.strike,
      }),
    ]
  },
})

// Custom task item input rule: - [ ] or * [ ] triggers taskItem
import { wrappingInputRule } from '@tiptap/core'
const TaskItemInputRuleExtension = Extension.create({
  name: 'taskItemInputRule',
  addInputRules() {
    return [
      wrappingInputRule({
        find: /^\s*[-*]\s\[( |x)?\]\s$/,
        type: this.editor.schema.nodes.taskItem,
        getAttributes: (match) => ({ checked: match[1] === 'x' }),
      }),
    ]
  },
})

const editor = useEditor({
  content: props.content,
  editable: props.editing,
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      orderedList: false,
      bulletList: false,
      listItem: false,
      link: { openOnClick: false, autolink: true },
      underline: {},
    }),
    TextStyle,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    StrikethroughExtension,
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'javascript' }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem.configure({ nested: true }),
    TaskItemInputRuleExtension,
    Blockquote,
    HorizontalRule,
    ListItem,
    BulletList,
    OrderedList,
    Image.configure({ inline: false, allowBase64: true }),
  ],
  onUpdate: ({ editor: e }) => {
    emit('update:content', e.getHTML())
  },
  onFocus: () => {
    emit('focus')
  },
  onBlur: ({ event }) => {
    emit('update:content', editor.value?.getHTML() || '')
    emit('blur', event as FocusEvent)
  },
})

const canvas = useCanvasStore()

// Sync editing state and register/unregister editor in store
watch(() => props.editing, (val) => {
  editor.value?.setEditable(val)
  if (val && editor.value) {
    canvas.setCurrentEditor(editor.value)
  } else if (!val && canvas.currentEditor === editor.value) {
    canvas.setCurrentEditor(null)
  }
})

// Sync content from parent (only when externally updated)
let isInternalUpdate = false
watch(() => props.content, (newContent) => {
  if (!editor.value) return
  const currentHtml = editor.value.getHTML()
  if (newContent !== currentHtml && !isInternalUpdate) {
    editor.value.commands.setContent(newContent, { emitUpdate: false })
  }
  isInternalUpdate = false
})

// Sync block styles to editor root element
watch(() => props.blockStyle, (style) => {
  if (!editor.value) return
  const el = editor.value.view.dom as HTMLElement
  if (style.fontSize) el.style.fontSize = style.fontSize + 'px'
  if (style.fontColor) el.style.color = style.fontColor
  if (style.fontFamily) el.style.fontFamily = style.fontFamily
  if (style.lineHeight) el.style.lineHeight = String(style.lineHeight)
  if (style.fontWeight) el.style.fontWeight = style.fontWeight
  if (style.fontStyle) el.style.fontStyle = style.fontStyle
  if (style.textDecoration) el.style.textDecoration = style.textDecoration
}, { immediate: true, deep: true })

// Expose editor instance for TextFormatBar
defineExpose({ editor })

onBeforeUnmount(() => {
  if (canvas.currentEditor === editor.value) {
    canvas.setCurrentEditor(null)
  }
  editor.value?.destroy()
})
</script>

<template>
  <EditorContent :editor="editor" class="tiptap-editor" />
</template>

<style scoped>
.tiptap-editor {
  outline: none;
  min-height: 1em;
}

.tiptap-editor :deep(.ProseMirror) {
  outline: none;
  min-height: 1em;
}

.tiptap-editor :deep(.ProseMirror p) {
  margin: 0;
}

.tiptap-editor :deep(.ProseMirror h1) { font-size: 28px; font-weight: bold; margin: 0; }
.tiptap-editor :deep(.ProseMirror h2) { font-size: 24px; font-weight: bold; margin: 0; }
.tiptap-editor :deep(.ProseMirror h3) { font-size: 20px; font-weight: bold; margin: 0; }
.tiptap-editor :deep(.ProseMirror h4) { font-size: 18px; font-weight: bold; margin: 0; }
.tiptap-editor :deep(.ProseMirror h5) { font-size: 16px; font-weight: bold; margin: 0; }
.tiptap-editor :deep(.ProseMirror h6) { font-size: 14px; font-weight: bold; margin: 0; }

.tiptap-editor :deep(.ProseMirror blockquote) {
  border-left: 3px solid #ccc;
  padding-left: 12px;
  color: #666;
  margin: 0;
}

.tiptap-editor :deep(.ProseMirror ul),
.tiptap-editor :deep(.ProseMirror ol) {
  padding-left: 20px;
  margin: 0;
}

.tiptap-editor :deep(.ProseMirror hr) {
  border: none;
  border-bottom: 1px solid #ccc;
  margin: 8px 0;
}

.tiptap-editor :deep(.ProseMirror code) {
  background: #f5f5f5;
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}

.tiptap-editor :deep(.ProseMirror pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.5;
  margin: 4px 0;
}

.tiptap-editor :deep(.ProseMirror pre code) {
  background: none;
  padding: 0;
  color: inherit;
}

.tiptap-editor :deep(.ProseMirror table) {
  border-collapse: collapse;
  width: 100%;
  margin: 4px 0;
  overflow: hidden;
}

.tiptap-editor :deep(.ProseMirror td),
.tiptap-editor :deep(.ProseMirror th) {
  border: 1px solid #ccc;
  padding: 6px 10px;
  min-width: 60px;
  position: relative;
  vertical-align: top;
}

.tiptap-editor :deep(.ProseMirror th) {
  background: #f5f5f5;
  font-weight: bold;
}

.tiptap-editor :deep(.ProseMirror .selectedCell) {
  background: #e8f0fe;
}

.tiptap-editor :deep(.ProseMirror ul[data-type="taskList"]) {
  list-style: none;
  padding-left: 0;
}

.tiptap-editor :deep(.ProseMirror ul[data-type="taskList"] li) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.tiptap-editor :deep(.ProseMirror ul[data-type="taskList"] li label) {
  margin-top: 3px;
}

.tiptap-editor :deep(.ProseMirror ul[data-type="taskList"] li label input[type="checkbox"]) {
  cursor: pointer;
  accent-color: #4a90d9;
}

.tiptap-editor :deep(.ProseMirror img) {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}

.tiptap-editor :deep(.ProseMirror a) {
  color: #4a90d9;
  text-decoration: underline;
  cursor: pointer;
}

.tiptap-editor :deep(.ProseMirror mark) {
  background-color: inherit;
}

/* Syntax highlighting - GitHub Dark theme for lowlight */
.tiptap-editor :deep(.ProseMirror pre .hljs-keyword),
.tiptap-editor :deep(.ProseMirror pre .hljs-doctag),
.tiptap-editor :deep(.ProseMirror pre .hljs-type),
.tiptap-editor :deep(.ProseMirror pre .hljs-template-tag),
.tiptap-editor :deep(.ProseMirror pre .hljs-template-variable) {
  color: #ff7b72;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-title),
.tiptap-editor :deep(.ProseMirror pre .hljs-title\.class_),
.tiptap-editor :deep(.ProseMirror pre .hljs-title\.function_) {
  color: #d2a8ff;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-attr),
.tiptap-editor :deep(.ProseMirror pre .hljs-attribute),
.tiptap-editor :deep(.ProseMirror pre .hljs-literal),
.tiptap-editor :deep(.ProseMirror pre .hljs-number),
.tiptap-editor :deep(.ProseMirror pre .hljs-operator),
.tiptap-editor :deep(.ProseMirror pre .hljs-variable),
.tiptap-editor :deep(.ProseMirror pre .hljs-selector-attr),
.tiptap-editor :deep(.ProseMirror pre .hljs-selector-class),
.tiptap-editor :deep(.ProseMirror pre .hljs-selector-id) {
  color: #79c0ff;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-regexp),
.tiptap-editor :deep(.ProseMirror pre .hljs-string),
.tiptap-editor :deep(.ProseMirror pre .hljs-meta .hljs-string) {
  color: #a5d6ff;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-built_in),
.tiptap-editor :deep(.ProseMirror pre .hljs-symbol) {
  color: #ffa657;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-comment),
.tiptap-editor :deep(.ProseMirror pre .hljs-quote) {
  color: #8b949e;
  font-style: italic;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-name),
.tiptap-editor :deep(.ProseMirror pre .hljs-tag),
.tiptap-editor :deep(.ProseMirror pre .hljs-meta) {
  color: #7ee787;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-section),
.tiptap-editor :deep(.ProseMirror pre .hljs-emphasis) {
  color: #d2a8ff;
  font-weight: bold;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-strong) {
  font-weight: bold;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-bullet),
.tiptap-editor :deep(.ProseMirror pre .hljs-addition) {
  color: #aff5b4;
  background: #033a16;
}

.tiptap-editor :deep(.ProseMirror pre .hljs-deletion) {
  color: #ffdcd7;
  background: #67060c;
}
</style>