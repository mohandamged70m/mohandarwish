// Dashboard import path compat: dashboard files import '../../utils/availability'
// (the old project's location). Re-export this repo's lib/availability.

export {
  DEFAULT_AVAILABILITY,
  WEEKDAY_LABELS,
  ALL_HOURS,
  parseAvailabilityConfig,
  formatHourSlot,
  buildHostSlots,
  isWorkingDay,
} from "@/lib/availability";
export type { AvailabilityConfig } from "@/lib/availability";
