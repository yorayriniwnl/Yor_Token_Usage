export function canonicalizeExtensionOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
