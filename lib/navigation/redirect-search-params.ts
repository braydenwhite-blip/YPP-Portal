export type RedirectSearchParams = Record<string, string | string[] | undefined>;

export function appendSearchParams(
  pathname: string,
  searchParams: RedirectSearchParams | undefined,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
