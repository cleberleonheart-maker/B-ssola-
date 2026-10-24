export type Point = { lat: number; lon: number };
export type Ray = { point: Point; bearing: number };

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

const normalize = (b: number) => ((b % 360) + 360) % 360;

export const intersectRays = (r1: Ray, r2: Ray): Point | null => {
  const lat1 = toRad(r1.point.lat);
  const lon1 = toRad(r1.point.lon);
  const lat2 = toRad(r2.point.lat);
  const lon2 = toRad(r2.point.lon);
  const brng13 = toRad(r1.bearing);
  const brng23 = toRad(r2.bearing);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const dist12 = 2 * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2));

  if (dist12 === 0) return null;

  const a = Math.acos((Math.sin(lat2) - Math.sin(lat1) * Math.cos(dist12)) / (Math.sin(dist12) * Math.cos(lat1)));
  const b = Math.acos((Math.sin(lat1) - Math.sin(lat2) * Math.cos(dist12)) / (Math.sin(dist12) * Math.cos(lat2)));
  const brngA = Math.sin(lon2 - lon1) > 0 ? a : 2 * Math.PI - a;
  const brngB = Math.sin(lon1 - lon2) > 0 ? b : 2 * Math.PI - b;

  const alpha1 = (brng13 - brngA + Math.PI) % (2 * Math.PI);
  const alpha2 = (brngB - brng23 + Math.PI) % (2 * Math.PI);
  const alpha3 = Math.PI - alpha1 + alpha2;

  if (alpha3 <= 0 || alpha3 >= Math.PI) return null;

  const dist13 = Math.sin(alpha2) * dist12 / Math.sin(alpha3);
  const lat3 = Math.asin(Math.sin(lat1) * Math.cos(dist13) + Math.cos(lat1) * Math.sin(dist13) * Math.cos(brng13));
  const lon3 = lon1 + Math.atan2(Math.sin(brng13) * Math.sin(dist13) * Math.cos(lat1), Math.cos(dist13) - Math.sin(lat1) * Math.sin(lat3));
  return { lat: (lat3 * 180) / Math.PI, lon: ((lon3 * 180) / Math.PI + 540) % 360 - 180 };
};
