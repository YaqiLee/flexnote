/**
 * Text format adapter — encapsulates all inline formatting operations.
 * Currently backed by execCommand; future-proofed for Input Events or TipTap migration.
 */

/**
 * Strip inline formatting tags from a text block's DOM element.
 * Unwraps b, i, u, strong, em, span, font, strike, del, s tags
 * and removes residual inline attributes so block-level CSS applies uniformly.
 */
export function stripInlineFormatting(blockId: string): void {
  const el = document.querySelector(`[data-block-id="${blockId}"] .block-text`) as HTMLElement
  if (!el) return

  const INLINE_TAGS = ['b', 'i', 'u', 's', 'strike', 'del', 'strong', 'em', 'font', 'span']
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT)
  const toUnwrap: Element[] = []
  let node: Node | null = walker.currentNode

  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName.toLowerCase()
      if (INLINE_TAGS.includes(tag)) {
        toUnwrap.push(node as Element)
      }
    }
    node = walker.nextNode()
  }

  for (const elem of toUnwrap) {
    const parent = elem.parentNode
    if (parent) {
      while (elem.firstChild) {
        parent.insertBefore(elem.firstChild, elem)
      }
      parent.removeChild(elem)
    }
  }

  el.querySelectorAll('*').forEach(child => {
    child.removeAttribute('style')
    child.removeAttribute('color')
    child.removeAttribute('face')
    child.removeAttribute('size')
  })
}

// --- Inline format commands (execCommand wrapper) ---

export function execBold(): void {
  document.execCommand('bold', false)
}

export function execItalic(): void {
  document.execCommand('italic', false)
}

export function execUnderline(): void {
  document.execCommand('underline', false)
}

export function execStrikeThrough(): void {
  document.execCommand('strikeThrough', false)
}

export function execForeColor(color: string): void {
  document.execCommand('foreColor', false, color)
}

export function execHiliteColor(color: string): void {
  document.execCommand('hiliteColor', false, color)
}

export function execFontName(fontName: string): void {
  document.execCommand('fontName', false, fontName || 'sans-serif')
}

/**
 * Apply font size to current selection.
 * Uses span wrapping for precise px control; falls back to execCommand fontSize.
 */
export function execFontSize(sizePx: number): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  const span = document.createElement('span')
  span.style.fontSize = sizePx + 'px'
  try {
    range.surroundContents(span)
  } catch {
    document.execCommand('fontSize', false, '4')
  }
}
