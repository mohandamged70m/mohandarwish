export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
