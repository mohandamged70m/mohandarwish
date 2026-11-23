"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { SENTENCE_TEMPLATE, STACK, stackIcons, type StackItem } from "@/data/stack";
import styles from "./stack.module.css";

type Token = { kind: "word"; text: string } | { kind: "tool"; tool: StackItem };

/** Split the template into words and tool placeholders, in reading order. */
function tokenize(template: string, byId: Map<string, StackItem>): Token[] {
  const tokens: Token[] = [];
  const pushWords = (text: string) => {
    // Keep whitespace attached to the word so spaces around inline pills survive.
    for (const word of text.match(/\s*\S+\s*/g) ?? []) {
      tokens.push({ kind: "word", text: word });
    }
  };

  const placeholder = /\{([a-z0-9-]+)\}/gi;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = placeholder.exec(template)) !== null) {
    if (match.index > cursor) pushWords(template.slice(cursor, match.index));
    const tool = byId.get(match[1].toLowerCase());
    if (tool) tokens.push({ kind: "tool", tool });
    else pushWords(match[0]); // unknown id: leave it readable instead of crashing
    cursor = match.index + match[0].length;
  }
  if (cursor < template.length) pushWords(template.slice(cursor));
  return tokens;
}

/** Categories are discovered from the data, in first-seen order. */
function groupByCategory(items: readonly StackItem[]) {
  const categories: string[] = [];
  for (const item of items) {
    if (!categories.includes(item.category)) categories.push(item.category);
  }
  return {
    categories,
    ordered: categories.flatMap((category) =>
      items.filter((item) => item.category === category)
    ),
  };
}

/** Two rows, split on category boundaries so a category's chips stay together. */
function splitRows(ordered: readonly StackItem[]): [StackItem[], StackItem[]] {
  const rows: [StackItem[], StackItem[]] = [[], []];
  const target = ordered.length / 2;
  let row = 0;
  let i = 0;

  while (i < ordered.length) {
    const category = ordered[i].category;
    const block: StackItem[] = [];
    while (i < ordered.length && ordered[i].category === category) {
      block.push(ordered[i]);
      i += 1;
    }
    if (row === 0 && rows[0].length > 0 && rows[0].length + block.length > target) {
      row = 1;
    }
    rows[row].push(...block);
  }

  // A single new category must not produce an empty second row.
  if (rows[1].length === 0 && rows[0].length > 1) {
    rows[1] = rows[0].splice(Math.ceil(rows[0].length / 2));
  }
  return rows;
}

const stagger = (index: number) => ({ "--stack-i": index }) as CSSProperties;

function Glyph({ tool }: { tool: StackItem }) {
  const Icon = stackIcons[tool.icon];
  return <Icon aria-hidden="true" />;
}

function ToolChip({
  tool,
  repeated,
  duplicate,
}: {
  tool: StackItem;
  repeated: boolean;
  duplicate?: boolean;
}) {
  // Only the first copy is announced and tabbable; repeats/dupes are decor.
  const decorative = repeated || duplicate;
  return (
    <li
      className={`${styles.chip}${repeated ? ` ${styles["chip--repeat"]}` : ""}`}
      tabIndex={decorative ? -1 : 0}
      aria-hidden={decorative || undefined}
    >
      <span className={styles.iconRing} aria-hidden="true">
        <Glyph tool={tool} />
      </span>
      <span>{tool.name}</span>
    </li>
  );
}

function MarqueeRow({
  tools,
  direction,
  label,
  speed,
}: {
  tools: readonly StackItem[];
  direction: "left" | "right";
  label: string;
  speed: string;
}) {
  // Repeat the group until it is comfortably wider than any viewport, so the
  // two identical groups always cover the row with no visible gap mid-loop.
  const repeats = Math.max(2, Math.ceil(12 / Math.max(1, tools.length)));
  const group = useMemo(
    () =>
      Array.from({ length: repeats }, (_, repeat) =>
        tools.map((tool) => ({ tool, repeat }))
      ).flat(),
    [tools, repeats]
  );

  return (
    <div
      className={styles.row}
      data-direction={direction}
      style={{ "--stack-speed": speed } as CSSProperties}
    >
      <div className={styles.track}>
        <ul className={styles.list} aria-label={label}>
          {group.map(({ tool, repeat }) => (
            <ToolChip
              key={`${tool.id}-${repeat}`}
              tool={tool}
              repeated={repeat > 0}
            />
          ))}
        </ul>
        <ul className={`${styles.list} ${styles["list--duplicate"]}`} aria-hidden="true">
          {group.map(({ tool, repeat }) => (
            <ToolChip
              key={`dup-${tool.id}-${repeat}`}
              tool={tool}
              repeated={repeat > 0}
              duplicate
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function StackSurvey(): React.JSX.Element {
  const sectionRef = useRef<HTMLElement | null>(null);

  const { categories, ordered } = useMemo(() => groupByCategory(STACK), []);
  const [firstRow, secondRow] = useMemo(() => splitRows(ordered), [ordered]);
  const tokens = useMemo(
    () =>
      tokenize(
        SENTENCE_TEMPLATE,
        new Map(STACK.map((item) => [item.id, item]))
      ),
    []
  );

  // One-shot entrance when the section scrolls into view. Toggling a class on
  // the DOM node avoids a React re-render and fires at most once.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const reveal = () => el.classList.add(styles.enter);
    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="stack"
      aria-label="Stack"
      className={`${styles.section} w-full scroll-mt-24 ${styles.motion}`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 text-left sm:px-6 sm:py-16 lg:px-8 lg:py-12">
        <h2
          data-pager-focus
          tabIndex={-1}
          className={`${styles.heading} max-w-[16ch] font-display text-[clamp(2rem,5.4vw,3.5rem)] font-bold leading-[1.04] tracking-[-0.02em] text-balance`}
        >
          Stack
        </h2>
        <p
          className={`${styles.subtitle} mt-4 max-w-[52ch] font-body text-[15px] leading-[1.6] text-pretty sm:text-base`}
        >
          The tools I use to take an idea from first commit to production.
        </p>

        <p className={styles.statement}>
          {tokens.map((token, index) =>
            token.kind === "tool" ? (
              <span
                key={`${token.tool.id}-${index}`}
                className={styles.pill}
                style={stagger(index)}
              >
                <span className={styles.iconRing} aria-hidden="true">
                  <Glyph tool={token.tool} />
                </span>
                <span className={styles.pillName}>{token.tool.name}</span>
              </span>
            ) : (
              <span key={`word-${index}`} className={styles.word} style={stagger(index)}>
                {token.text}
              </span>
            )
          )}
        </p>

        <div className={styles.rows} role="group" aria-label="Tools I use">
          <MarqueeRow
            tools={firstRow}
            direction="left"
            label="Tools I use, part one"
            speed="54s"
          />
          {secondRow.length > 0 && (
            <MarqueeRow
              tools={secondRow}
              direction="right"
              label="Tools I use, part two"
              speed="62s"
            />
          )}
        </div>

        <ul className={styles.key} aria-label="Tool categories">
          {categories.map((category) => (
            <li key={category} className={styles.keyItem}>
              <span className={`${styles.iconRing} ${styles.keyMark}`} aria-hidden="true" />
              {category}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default StackSurvey;
