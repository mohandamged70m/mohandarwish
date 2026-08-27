export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (s: string) => EMAIL_RE.test(s.trim());

export const timezones = [
  { label: "UTC-12:00", value: -12 },
  { label: "UTC-11:00", value: -11 },
  { label: "UTC-10:00", value: -10 },
  { label: "UTC-09:00", value: -9 },
  { label: "UTC-08:00 (PST)", value: -8 },
  { label: "UTC-07:00 (MST)", value: -7 },
  { label: "UTC-06:00 (CST)", value: -6 },
  { label: "UTC-05:00 (EST)", value: -5 },
  { label: "UTC-04:00", value: -4 },
  { label: "UTC-03:00", value: -3 },
  { label: "UTC-02:00", value: -2 },
  { label: "UTC-01:00", value: -1 },
  { label: "UTC+00:00 (GMT)", value: 0 },
  { label: "UTC+01:00 (CET)", value: 1 },
  { label: "UTC+02:00 (EET)", value: 2 },
  { label: "UTC+03:00 (MSK)", value: 3 },
  { label: "UTC+04:00", value: 4 },
  { label: "UTC+05:00", value: 5 },
  { label: "UTC+05:30 (IST)", value: 5.5 },
  { label: "UTC+06:00", value: 6 },
  { label: "UTC+07:00", value: 7 },
  { label: "UTC+08:00 (CST)", value: 8 },
  { label: "UTC+09:00 (JST)", value: 9 },
  { label: "UTC+10:00 (AEST)", value: 10 },
  { label: "UTC+11:00", value: 11 },
  { label: "UTC+12:00 (NZST)", value: 12 },
] as const;

export function getOffsetFromUTCString(tzStr: string): number {
  const match = tzStr.match(/UTC([+-]\d{2}):(\d{2})/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours + (minutes / 60) * (hours < 0 ? -1 : 1);
}

export function formatDateDDMMYYYY(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseTime12h(t: string): { h: number; m: number } {
  const [time, period] = t.split(" ");
  const [hStr, mStr] = (time || "0:0").split(":");
  let h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return { h, m };
}

export function to12h(h24: number, m: number): string {
  const period = h24 >= 12 ? "PM" : "AM";
  const display = h24 % 12 || 12;
  return `${display.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
}

export function convertHostToUser(hostTime: string, offsetDiff: number): string {
  const { h, m } = parseTime12h(hostTime);
  let total = h * 60 + m + offsetDiff * 60;
  total = ((total % 1440) + 1440) % 1440;
  return to12h(Math.floor(total / 60), total % 60);
}

export function convertUserToHost(userTime: string, offsetDiff: number): string {
  const { h, m } = parseTime12h(userTime);
  let total = h * 60 + m - offsetDiff * 60;
  total = ((total % 1440) + 1440) % 1440;
  return to12h(Math.floor(total / 60), total % 60);
}

export function isTimePassed(date: Date, hostTime: string, hostOffset: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const check = new Date(date);
  check.setHours(0, 0, 0, 0);
  if (check > today) return false;
  if (check < today) return true;
  const { h, m } = parseTime12h(hostTime);
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const hostNow = new Date(utc + 3600000 * hostOffset);
  const slot = h * 60 + m;
  const cur = hostNow.getHours() * 60 + hostNow.getMinutes();
  return cur + 30 > slot;
}
