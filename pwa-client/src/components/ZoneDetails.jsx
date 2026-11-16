import { formatDeviceLocation, formatLocation } from '../utils/location.js';

export default function ZoneDetails({ zone, devices = [], zoneLocation = null }) {
  const zoneLocationText = formatLocation(zoneLocation);
  return (
    <section className="panel zone-details" aria-labelledby="zone-details-title">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Connected environment</p>
          <h2 id="zone-details-title">Device &amp; zone</h2>
        </div>
        <span className="zone-details__tag">{zone.shortLabel}</span>
      </div>
      {zoneLocationText && (
        <dl className="zone-details__list">
          <div className="zone-details__row">
            <dt>Zone location (WGS84)</dt>
            <dd>{zoneLocationText}</dd>
          </div>
        </dl>
      )}
      {devices.length > 0 ? (
        devices.map((device, index) => {
          const details = [
            ['Device ID', device.deviceId],
            ['Zone', device.zoneId ?? zone.id],
            ['Location', formatDeviceLocation(device)],
            ['Gateway ID', device.gatewayId],
            ['Source', device.source],
            ['Status (API)', device.status],
            ['Last seen (API)', device.lastSeenAt],
          ];

          return (
            <dl
              className="zone-details__list"
              key={`${device.deviceId ?? 'device'}-${index}`}
            >
              {details
                .filter(([, value]) => value != null && value !== '')
                .map(([label, value]) => (
                  <div className="zone-details__row" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          );
        })
      ) : (
        <p className="zone-details__empty">
          Device information is unavailable for this zone.
        </p>
      )}
    </section>
  );
}
