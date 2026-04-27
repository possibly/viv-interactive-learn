import { type ReactNode } from 'react'

// A tiny Viv syntax highlighter. The grammar is small, the colour
// vocabulary is small, and pulling in shiki/prism for one snippet
// would dwarf the rest of the bundle. Keep it line-by-line, regex
// based, and good enough.

const KEYWORDS = new Set([
  'action', 'template', 'reserved', 'from',
  'gloss', 'report', 'importance', 'saliences', 'associations',
  'tags', 'roles', 'conditions', 'scratch', 'effects', 'reactions',
  'embargoes', 'as', 'is', 'n', 'renames', 'spawn',
  'queue', 'with', 'urgent', 'priority', 'time', 'abandon', 'repeat',
  'default', 'for', 'end', 'if', 'else', 'in', 'and', 'or', 'not',
  'true', 'false', 'null',
  // Stage 7: sifting + queries
  'pattern', 'query', 'search', 'sift', 'over', 'inherit', 'chronicle',
  'actions', 'partners', 'recipients', 'bystanders', 'active', 'present',
  'preceded', 'caused', 'triggered',
  'any', 'all', 'none', 'exactly',
])

const ROLE_LABELS = new Set([
  'character', 'item', 'location', 'symbol',
  'initiator', 'partner', 'recipient', 'bystander',
  'anywhere', 'precast',
])

interface Token {
  kind: string
  text: string
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < line.length) {
    const ch = line[i]

    // Comments to end of line.
    if (ch === '/' && line[i + 1] === '/') {
      tokens.push({ kind: 'comment', text: line.slice(i) })
      return tokens
    }

    // Strings (double or single quoted).
    if (ch === '"' || ch === "'") {
      const quote = ch
      let j = i + 1
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\' && j + 1 < line.length) j += 2
        else j++
      }
      tokens.push({ kind: 'string', text: line.slice(i, Math.min(j + 1, line.length)) })
      i = Math.min(j + 1, line.length)
      continue
    }

    // Role refs (@name) and symbol refs (&name).
    if (ch === '@' || ch === '&') {
      const m = /^[@&][A-Za-z_][\w-]*\*?/.exec(line.slice(i))
      if (m) {
        tokens.push({ kind: 'role', text: m[0] })
        i += m[0].length
        continue
      }
    }

    // Function refs (~name).
    if (ch === '~') {
      const m = /^~[A-Za-z_][\w-]*/.exec(line.slice(i))
      if (m) {
        tokens.push({ kind: 'function', text: m[0] })
        i += m[0].length
        continue
      }
    }

    // Enum refs (#NAME).
    if (ch === '#') {
      const m = /^#[A-Z][A-Z_]*/.exec(line.slice(i))
      if (m) {
        tokens.push({ kind: 'enum', text: m[0] })
        i += m[0].length
        continue
      }
    }

    // Numbers.
    if (/[0-9]/.test(ch)) {
      const m = /^[0-9]+(\.[0-9]+)?/.exec(line.slice(i))
      if (m) {
        tokens.push({ kind: 'number', text: m[0] })
        i += m[0].length
        continue
      }
    }

    // Identifiers / keywords.
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][\w-]*/.exec(line.slice(i))
      if (m) {
        const word = m[0]
        if (KEYWORDS.has(word)) tokens.push({ kind: 'keyword', text: word })
        else if (ROLE_LABELS.has(word)) tokens.push({ kind: 'label', text: word })
        else tokens.push({ kind: 'ident', text: word })
        i += word.length
        continue
      }
    }

    // Operators.
    const op = /^(==|!=|<=|>=|\+=|-=|\*=|\/=|=>|->|[+\-*/<>=:,.;()[\]{}|?])/.exec(
      line.slice(i),
    )
    if (op) {
      tokens.push({ kind: 'op', text: op[0] })
      i += op[0].length
      continue
    }

    // Whitespace / fallthrough.
    tokens.push({ kind: 'plain', text: ch })
    i++
  }
  return tokens
}

export function HighlightedViv({ code }: { code: string }) {
  const lines = code.split('\n')
  return (
    <pre className="code lang-viv">
      <code>
        {lines.map((line, idx) => {
          const toks = tokenizeLine(line)
          return (
            <span key={idx}>
              {toks.map((t, j) => renderToken(t, j))}
              {idx < lines.length - 1 ? '\n' : ''}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

function renderToken(t: Token, key: number): ReactNode {
  if (t.kind === 'plain') return t.text
  return (
    <span key={key} className={`tok-${t.kind}`}>
      {t.text}
    </span>
  )
}

export function HighlightedTs({ code }: { code: string }) {
  // We don't need the same level of richness for the host snippet --
  // a small set of TS keywords plus strings + comments suffices.
  return (
    <pre className="code lang-ts">
      <code>{tokenizeTs(code)}</code>
    </pre>
  )
}

const TS_KEYWORDS = new Set([
  'import', 'from', 'const', 'let', 'var', 'function', 'return',
  'if', 'else', 'while', 'for', 'of', 'in', 'await', 'async',
  'true', 'false', 'null', 'undefined', 'new', 'typeof', 'export',
])

function tokenizeTs(code: string): ReactNode[] {
  const out: ReactNode[] = []
  const lines = code.split('\n')
  lines.forEach((line, lineIdx) => {
    let i = 0
    while (i < line.length) {
      const ch = line[i]
      if (ch === '/' && line[i + 1] === '/') {
        out.push(
          <span key={`${lineIdx}-c-${i}`} className="tok-comment">
            {line.slice(i)}
          </span>,
        )
        break
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch
        let j = i + 1
        while (j < line.length && line[j] !== quote) {
          if (line[j] === '\\' && j + 1 < line.length) j += 2
          else j++
        }
        out.push(
          <span key={`${lineIdx}-s-${i}`} className="tok-string">
            {line.slice(i, Math.min(j + 1, line.length))}
          </span>,
        )
        i = Math.min(j + 1, line.length)
        continue
      }
      if (/[A-Za-z_$]/.test(ch)) {
        const m = /^[A-Za-z_$][\w$]*/.exec(line.slice(i))
        if (m) {
          const word = m[0]
          if (TS_KEYWORDS.has(word)) {
            out.push(
              <span key={`${lineIdx}-k-${i}`} className="tok-keyword">
                {word}
              </span>,
            )
          } else {
            out.push(word)
          }
          i += word.length
          continue
        }
      }
      out.push(ch)
      i++
    }
    if (lineIdx < lines.length - 1) out.push('\n')
  })
  return out
}
