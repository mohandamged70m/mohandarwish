export default function ProjectsLayout({
  children,
  modal,
}: LayoutProps<"/projects">) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
