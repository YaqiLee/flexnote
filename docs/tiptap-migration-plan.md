# TipTap 迁移设计规划

## 一、概述

将 FlexNote 文本块编辑器从 contenteditable + execCommand 迁移到 TipTap/ProseMirror，
彻底解决 Markdown 快捷输入导致内容丢失的问题，同时获得更可靠的富文本编辑能力。

## 二、架构分层

TipTap 仅替换文本块内部的编辑区域，画布层完全不变。

Canvas.vue (画布层 - 不变)
  Block 容器 div (拖动/选中/缩放手柄 - 不变)
    TipTapEditor (仅此处替换原 contenteditable div)
  Image / Label Block (不变)

## 三、功能对照表

| 现有功能 | TipTap 方案 | 备注 |
|---------|------------|------|
| 粗体/斜体/下划线/删除线 | starter-kit + extension-underline | 原生支持 |
| 文字颜色 | extension-color + extension-text-style | 替代 execCommand foreColor |
| 高亮背景色 | extension-highlight | 替代 execCommand hiliteColor |
| 字体族 | extension-font-family | 替代 execCommand fontName |
| 字号(px) | 自定义 TextStyle mark | 精确 px，优于 execCommand 1-7 |
| 行高 | 自定义 Extension | 应用到编辑器容器 CSS |
| 块级 fontWeight/fontStyle/textDecoration | 容器级 CSS | 通过 props 传入 |
| 内容保存 | editor.getHTML() | 替代 el.innerHTML |
| 内容初始化 | editor.setContent(html) | 替代 v-init-html directive |
| 编辑/只读切换 | editor.setEditable(bool) | 替代 contenteditable attr |
| 选区状态同步 | editor.isActive() | 替代 queryCommandState |
| 格式栏不失焦 | chainable commands | 移除 saveSelection hack |
| Markdown 快捷输入 | InputRule | 内置 heading/list/blockquote/hr/bold/italic/code |

## 四、新增依赖

@tiptap/vue-3
@tiptap/starter-kit
@tiptap/extension-underline
@tiptap/extension-color
@tiptap/extension-text-style
@tiptap/extension-font-family
@tiptap/extension-highlight

## 五、文件变更计划

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | src/components/TipTapEditor.vue | 封装 TipTap 编辑器组件 |
| 修改 | src/components/Canvas.vue | 替换 contenteditable 为 TipTapEditor |
| 修改 | src/components/props/TextFormatBar.vue | execCommand 改为 TipTap commands |
| 删除 | src/services/markdown-shortcuts.ts | 由 TipTap InputRule 替代 |
| 保留 | src/utils/text-format.ts | stripInlineFormatting 仍可用于数据清理 |
| 修改 | package.json | 添加 tiptap 依赖 |

## 六、TipTapEditor.vue 设计

### Props
- blockId: string
- content: string (HTML)
- editing: boolean
- blockStyle: { fontSize, fontColor, fontFamily, lineHeight, fontWeight, fontStyle, textDecoration }

### Emits
- update:content (html) - blur 或 debounce 时触发
- focus
- blur

### 内部逻辑
1. useEditor() 创建实例，配置 extensions + InputRules
2. watch(editing) -> editor.setEditable(editing)
3. watch(content) -> 仅外部更新时 setContent
4. watch(blockStyle) -> 更新编辑器根节点 CSS
5. onUpdate (debounce 300ms) -> emit update:content
6. onBlur -> emit update:content + emit blur
7. expose({ editor }) -> 供 TextFormatBar 访问

### InputRules
- # ~ ###### + Space -> Heading
- > + Space -> Blockquote
- - / * / + + Space -> BulletList
- 1. + Space -> OrderedList
- --- -> HorizontalRule
- **text** -> Bold
- *text* -> Italic
- `text` -> Code
- ~~text~~ -> Strikethrough (自定义)

## 七、TextFormatBar 改造

### 命令映射
- execBold() -> editor.chain().focus().toggleBold().run()
- execItalic() -> editor.chain().focus().toggleItalic().run()
- execUnderline() -> editor.chain().focus().toggleUnderline().run()
- execStrikeThrough() -> editor.chain().focus().toggleStrike().run()
- execForeColor(c) -> editor.chain().focus().setColor(c).run()
- execHiliteColor(c) -> editor.chain().focus().toggleHighlight({ color: c }).run()
- execFontName(f) -> editor.chain().focus().setFontFamily(f).run()
- execFontSize(px) -> editor.chain().focus().setMark(textStyle, { fontSize }).run()

### 选区状态
- 监听 editor.on(selectionUpdate)
- editor.isActive(bold) 替代 queryCommandState
- 移除 saveSelection/restoreSelection

## 八、Canvas.vue 改动

### 模板替换
将 .block-text contenteditable div 替换为 TipTapEditor 组件
传入 block.id, block.content, editing 状态, blockStyle
监听 update:content, focus, blur 事件

### 移除
- v-init-html directive
- markdown-shortcuts import 和 onKeyDown 调用

### 保留
- onTextFocus/onTextBlur 逻辑
- 拖拽手柄、缩放手柄、选中逻辑
- 所有非文本块代码

## 九、数据兼容性

- TipTap 可解析旧 HTML (font, span style 等)
- 首次编辑后自动规范化
- BlockData 结构不变，无需迁移脚本

## 十、风险与应对

| 风险 | 应对 |
|------|------|
| 旧笔记 HTML 不规范 | TipTap 容错解析，首次编辑自动规范化 |
| 包体积增加 ~80-120KB gzip | Tauri 桌面应用影响极小 |
| 焦点与画布交互冲突 | editable=false 时不拦截鼠标事件 |
| TextFormatBar 获取 editor 时序 | provide/inject + optional chaining |
| Undo/Redo 双层 | 块级(store)和文档级(TipTap)独立运作 |

## 十一、实施步骤

1. 安装 TipTap 依赖
2. 创建 TipTapEditor.vue
3. 修改 Canvas.vue 集成
4. 改造 TextFormatBar.vue
5. 删除 markdown-shortcuts.ts
6. 测试验证