export function formatIsoToLocal(value: string): string {
  return new Date(value).toLocaleString();
}
