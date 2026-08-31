"use client";

import { AnimatePresence } from "motion/react";
import type { ReactNode } from "react";

export function ModalViewport({ modal }: { modal: ReactNode }): ReactNode {
  return <AnimatePresence mode="wait" initial={false}>{modal}</AnimatePresence>;
}
