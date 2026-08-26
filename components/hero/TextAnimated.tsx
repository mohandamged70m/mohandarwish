"use client";

import * as React from "react";
import { JSX, useEffect, useRef, useState } from "react";

type AnimatedTextProps = {
  text: string;
  className?: string;
  startDelay?: number;
  stagger?: number;
  duration?: number;
  as?: keyof JSX.IntrinsicElements;
};

export default function AnimatedText({
  text = "",
  className = "",
  startDelay = 0,
  stagger = 60,
  duration = 500,
  as: Tag = "span",
}: AnimatedTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!text) return null;

  const words = text.split(" ");
  let globalIndex = 0;

  return React.createElement(
    Tag,
    {
      ref: ref as React.Ref<HTMLElement>,
      className,
      style: { display: "inline-block" } as React.CSSProperties,
      "aria-label": text,
    },
    ...words.map((word, wIndex) => (
      <span
        key={wIndex}
        style={{ display: "inline-block", whiteSpace: "nowrap" }}
      >
        {word.split("").map((char, cIndex) => {
          const i = globalIndex++;
          return (
            <span
              key={cIndex}
              aria-hidden="true"
              style={{
                display: "inline-block",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(0.4em)",
                transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
                transitionDelay: `${startDelay + i * stagger}ms`,
              }}
            >
              {char}
            </span>
          );
        })}
        {wIndex < words.length - 1 ? "\u00A0" : ""}
      </span>
    ))
  );
}