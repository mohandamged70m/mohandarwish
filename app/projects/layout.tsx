import { ModalViewport } from "@/components/layouts/modal-viewport";

export default function ProjectsLayout({
  children,
  modal,
}: LayoutProps<"/projects">) {
  return (
    <>
      {children}
      <ModalViewport modal={modal} />
    </>
  );
}
