const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Colombo",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: "Asia/Colombo",
  year: "numeric",
});

export function formatDisplayDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatDisplayDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}
