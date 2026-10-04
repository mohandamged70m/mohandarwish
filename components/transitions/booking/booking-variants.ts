"use client";

import type { TargetAndTransition, Transition, Variants } from "motion/react";

// Shared motion kit for the booking modal (backdrop, panel, tabs, calendar,
// subnav). Values are byte-identical to the modal's previous inline props —
// this file only centralizes them so every booking surface reuses one timing
// language. Opacity-only pieces still animate under OS reduced-motion;
// transform/layout pieces are disabled globally by MotionConfig (user).

export type MotionBundle = {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
};

export const EASE_STANDARD: [number, number, number, number] = [0.4, 0, 0.2, 1];
export const EASE_SNAP: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Dim + blur wash behind the modal.
export const backdropMotion: MotionBundle = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: EASE_STANDARD },
};

// Full-screen centering layer (pointer-events-none; panel re-enables).
export const wrapperMotion: MotionBundle = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

// The panel itself: drops in from above with a spring, exits downward.
export const PANEL_ORIGIN = "top center";

export const panelMotion: MotionBundle = {
  initial: { opacity: 0, scale: 0.95, y: -16 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 16 },
  transition: { type: "spring", damping: 30, stiffness: 350, mass: 1 },
};

export const iconSpring: Transition = {
  type: "spring",
  damping: 30,
  stiffness: 350,
  mass: 1,
};

// Meeting <-> message tab slide. Custom = direction (-1 back, +1 forward).
export const tabSlideVariants: Variants = {
  enter: (d: number) => ({ x: d > 0 ? "40%" : "-40%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? "-40%" : "40%", opacity: 0 }),
};

export const tabSlideTransition: Transition = {
  duration: 0.3,
  ease: EASE_STANDARD,
};

// Month title flip on calendar page.
export const monthTitleMotion: MotionBundle = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
  transition: { duration: 0.2 },
};

// Calendar month page. Custom = direction (-1 prev, +1 next).
export const monthGridVariants: Variants = {
  enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
};

export const monthGridTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

// Agenda detail / success pane swap.
export const detailMotion: MotionBundle = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
};

// Submitting spinner.
export const spinTransition: Transition = {
  duration: 1,
  repeat: Infinity,
  ease: "linear",
};

// Bottom tab bar entrance.
export const subnavMotion: MotionBundle = {
  initial: { opacity: 0, y: 10, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.96 },
  transition: { duration: 0.35, ease: EASE_SNAP },
};

// Sliding active-tab pill.
export const pillSpring: Transition = {
  type: "spring",
  damping: 28,
  stiffness: 380,
};
