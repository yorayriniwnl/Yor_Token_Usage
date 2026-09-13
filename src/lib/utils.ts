export function clamp(value: any, min: any, max: any) {
  return Math.min(max, Math.max(min, value));
}
    // @ts-ignore
export function sum(values: any) {
    // @ts-ignore
    // @ts-ignore
  return values.reduce((acc: any, value: any) => acc + value, 0);
}
    // @ts-ignore
export function average(values: any) {
  return values.length ? sum(values) / values.length : 0;
}
    // @ts-ignore
export function median(values: any) {
    // @ts-ignore
    // @ts-ignore
  const sorted = values.filter(Number.isFinite).sort((a: any, b: any) => a - b);
  if (!sorted.length) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}
    // @ts-ignore
export function round(value: any, digits = 0) {
  const precision = 10 ** digits;
  return Math.round(value * precision) / precision;
}
    // @ts-ignore
    // @ts-ignore
export function groupBy(items: any, keyFn: any) {
    // @ts-ignore
    // @ts-ignore
  return items.reduce((groups: any, item: any) => {
    const key = keyFn(item);
    groups[key] ??= [];
    groups[key].push(item);
    return groups;
  }, {});
}
    // @ts-ignore
export function toDateKey(timestamp: any) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
    // @ts-ignore
export function startOfLocalDay(timestamp: any) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
    // @ts-ignore
export function previousLocalDayStart(timestamp: any) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
    // @ts-ignore
export function startOfLocalWeek(timestamp: any) {
  const date = new Date(timestamp);
  const day = date.getDay();
  const delta = (day + 6) % 7;
  date.setDate(date.getDate() - delta);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

