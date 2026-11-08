const STATUS_CONTENT = {
  loading: {
    label: 'Connecting to the API',
    detail: 'Requesting the selected zone and its latest measurements.',
    className: 'status-message--loading',
  },
  success: {
    label: 'Zone data available',
    detail: 'Measurements below belong to the selected zone.',
    className: 'status-message--success',
  },
  empty: {
    label: 'No measurements returned',
    detail: 'The selected zone has a device, but no latest readings are available.',
    className: 'status-message--neutral',
  },
  error: {
    label: 'API request failed',
    detail: 'Live data could not be loaded. Check the API URL and try again.',
    className: 'status-message--error',
  },
  forbidden: {
    label: 'Access to this zone is denied',
    detail: 'Your account is not assigned to this zone. Contact a museum administrator if you need access.',
    className: 'status-message--error',
  },
  unavailable: {
    label: 'Measurement data unavailable',
    detail: 'A device is not registered for this zone or a reading timestamp is invalid.',
    className: 'status-message--neutral',
  },
};

export default function StatusMessage({ status, error, errorCode, isDemo }) {
  if (isDemo) {
    return (
      <div className="status-message status-message--demo" role="status">
        <span className="status-message__dot" aria-hidden="true" />
        <div>
          <strong>Illustrative mock data · not sensor readings</strong>
          <p>
            These example values are for preview only. They are not live
            measurements, even when their source is labeled real.
          </p>
        </div>
      </div>
    );
  }

  const content = STATUS_CONTENT[status] ?? STATUS_CONTENT.unavailable;

  return (
    <div
      className={`status-message ${content.className}`}
      role={status === 'error' || status === 'forbidden' ? 'alert' : 'status'}
      aria-live={status === 'error' || status === 'forbidden' ? 'assertive' : 'polite'}
    >
      <span className="status-message__dot" aria-hidden="true" />
      <div className="status-message__copy">
        <strong>{content.label}</strong>
        <p>{content.detail}</p>
        {status === 'error' && error && (
          <p className="status-message__error-detail">{error}</p>
        )}
        {status === 'error' && errorCode && (
          <p className="status-message__error-detail">
            Backend error code: {errorCode}
          </p>
        )}
      </div>
    </div>
  );
}
