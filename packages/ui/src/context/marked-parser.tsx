import katex from "katex"
import type { MarkedExtension, Tokens } from "marked"
import markedShiki from "marked-shiki"
import { createMarkdownBase } from "./marked-base"

export function createMarkdownParser(highlight: (code: string, language: string) => string | Promise<string>) {
  return createMarkdownBase().use(katexExtension, markedShiki({ highlight }))
}

const inlineMathRegex = /^\\\(((?:\\.|[^\\\n])*?)\\\)/
// Keep currency and unmatched dollars as prose. Escaped dollars belong to the formula.
const dollarMathRegex = /^\$(?!\$|\s)((?:\\[^\n]|[^\\$\n])+?)(?<!\s)\$(?!\d)/
const blockMathRegex = /^\$\$\n([\s\S]+?)\n\$\$(?:\n|$)/

const katexExtension: MarkedExtension = {
  extensions: [
    {
      name: "inlineKatex",
      level: "inline",
      start(src) {
        const index = src.search(/\\\(|\$/)
        if (index === -1) return
        return index
      },
      tokenizer(src) {
        const match = src.match(inlineMathRegex) ?? src.match(dollarMathRegex)
        if (!match) return
        return {
          type: "inlineKatex",
          raw: match[0],
          text: match[1].trim(),
          displayMode: false,
        }
      },
      renderer: renderKatexToken,
    },
    {
      name: "blockKatex",
      level: "block",
      tokenizer(src) {
        const match = src.match(blockMathRegex)
        if (!match) return
        return {
          type: "blockKatex",
          raw: match[0],
          text: match[1].trim(),
          displayMode: true,
        }
      },
      renderer: renderKatexToken,
    },
  ],
}

function renderKatexToken(token: Tokens.Generic) {
  return katex.renderToString(typeof token.text === "string" ? token.text : "", {
    displayMode: token.displayMode === true,
    throwOnError: false,
  })
}
