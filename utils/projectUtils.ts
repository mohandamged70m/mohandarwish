// Dashboard import path compat: '../../utils/projectUtils' -> lib/project-utils.
// lib/ is canonical; this file only re-exports so old imports keep working.

export { getTechColor, getStackIcon, isVideoFile } from "@/lib/project-utils";
