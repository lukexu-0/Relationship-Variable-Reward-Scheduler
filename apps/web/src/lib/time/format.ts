export function formatIsoToLocal(value: string, includeTime = true): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (!includeTime) {
    return date.toLocaleDateString();
  }

  return date.toLocaleString();
}
