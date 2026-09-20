export type ReverseGeo = {
  name: string;
  cep: string | null;
} | null;

export const reverseGeocode = async (
  lat: number,
  lon: number,
  lang = 'pt',
): Promise<ReverseGeo> => {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1' +
      `&zoom=18&accept-language=${encodeURIComponent(lang)}&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BussolaApp/6.0 (personal use)' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const address = data?.address ?? {};
    const name =
      address.road ??
      address.neighbourhood ??
      address.suburb ??
      address.city_district ??
      address.village ??
      address.town ??
      address.city ??
      address.municipality;
    if (!name) return null;
    return { name, cep: address.postcode ? String(address.postcode) : null };
  } catch {
    return null;
  }
};