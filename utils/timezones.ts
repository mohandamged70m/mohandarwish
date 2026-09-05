// Timezone options (replaces the old utils/timezones).
// Entries are { value: hour offset (fractions allowed), label: starts with UTC±HH:MM }.

export interface TimezoneOption {
  value: number;
  label: string;
}

const ZONES: [number, string][] = [
  [-12, "UTC-12:00 (Baker Island)"],
  [-11, "UTC-11:00 (Niue)"],
  [-10, "UTC-10:00 (Honolulu)"],
  [-9, "UTC-09:00 (Anchorage)"],
  [-8, "UTC-08:00 (Los Angeles)"],
  [-7, "UTC-07:00 (Denver)"],
  [-6, "UTC-06:00 (Chicago)"],
  [-5, "UTC-05:00 (New York)"],
  [-4, "UTC-04:00 (Santiago)"],
  [-3, "UTC-03:00 (São Paulo)"],
  [-2, "UTC-02:00 (Fernando de Noronha)"],
  [-1, "UTC-01:00 (Azores)"],
  [0, "UTC+00:00 (London)"],
  [1, "UTC+01:00 (Berlin)"],
  [2, "UTC+02:00 (Cairo)"],
  [3, "UTC+03:00 (Riyadh)"],
  [3.5, "UTC+03:30 (Tehran)"],
  [4, "UTC+04:00 (Dubai)"],
  [4.5, "UTC+04:30 (Kabul)"],
  [5, "UTC+05:00 (Karachi)"],
  [5.5, "UTC+05:30 (Mumbai)"],
  [5.75, "UTC+05:45 (Kathmandu)"],
  [6, "UTC+06:00 (Dhaka)"],
  [6.5, "UTC+06:30 (Yangon)"],
  [7, "UTC+07:00 (Bangkok)"],
  [8, "UTC+08:00 (Singapore)"],
  [8.75, "UTC+08:45 (Eucla)"],
  [9, "UTC+09:00 (Tokyo)"],
  [9.5, "UTC+09:30 (Adelaide)"],
  [10, "UTC+10:00 (Sydney)"],
  [10.5, "UTC+10:30 (Lord Howe)"],
  [11, "UTC+11:00 (Nouméa)"],
  [12, "UTC+12:00 (Auckland)"],
  [12.75, "UTC+12:45 (Chatham)"],
  [13, "UTC+13:00 (Apia)"],
  [14, "UTC+14:00 (Kiritimati)"],
];

export function timezoneOptions(): TimezoneOption[] {
  return ZONES.map(([value, label]) => ({ value, label }));
}
