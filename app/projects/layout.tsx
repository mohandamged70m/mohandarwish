import { ModalViewport } from "@/components/layouts/modal-viewport";
import type { ReactNode } from "react";

export default function ProjectsLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    <>
      {children}
      <ModalViewport modal={modal} />
    </>
  );
}
