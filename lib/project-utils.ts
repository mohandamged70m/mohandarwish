export function isVideoFile(src: string): boolean {
  const clean = src.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov)$/.test(clean) || src.includes("/videos/");
}

const TECH_COLOR_MAP: Record<string, string> = {
  "next.js": "#ffffff",
  next: "#ffffff",
  react: "#61dafb",
  typescript: "#3178c6",
  tailwind: "#38bdf8",
  tailwindcss: "#38bdf8",
  motion: "#a3e635",
  "framer motion": "#a3e635",
  storybook: "#ff4785",
  trpc: "#2596be",
  prisma: "#0c344b",
  "ai sdk": "#a3e635",
  mapbox: "#4264fb",
  recharts: "#22b5bf",
  mdx: "#f97316",
  algolia: "#003dff",
  isr: "#ffffff",
  websockets: "#010101",
  "node.js": "#339933",
  nodejs: "#339933",
  postgres: "#336791",
  stripe: "#635bff",
  nextauth: "#000000",
  yjs: "#ff006a",
  canvas: "#ff6b35",
  electron: "#47848f",
  firebase: "#ffca28",
  supabase: "#3ecf8e",
};

export function getTechColor(tech: string): string {
  const key = tech.toLowerCase().trim();
  if (TECH_COLOR_MAP[key]) return TECH_COLOR_MAP[key];
  // fallback to accent
  return "#a3e635";
}

export function getStackIcon(_tech: string): string {
  // Revil uses per-tag iconSvg from Firestore; we return empty and let caller show dot fallback.
  return "";
}
