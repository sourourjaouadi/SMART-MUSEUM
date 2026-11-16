/** Formatting for WGS84 zone and device locations (fixed decimal notation, locale-independent). */

function isLocation(location) {
  return (
    location != null &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  );
}

export function formatLocation(location) {
  if (!isLocation(location)) return null;
  const coordinates = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
  return Number.isInteger(location.floor)
    ? `${coordinates} · Floor ${location.floor}`
    : coordinates;
}

const SOURCE_LABELS = {
  device: 'own position',
  zone: 'from zone',
};

export function formatDeviceLocation(device) {
  const text = formatLocation(device?.location);
  if (!text) return null;
  const source = SOURCE_LABELS[device.locationSource];
  return source ? `${text} (${source})` : text;
}
