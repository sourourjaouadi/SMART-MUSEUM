export default function Sidebar() {
  return (
    <aside className="sidebar">
      <a className="brand" href="#overview" aria-label="Smart Museum dashboard">
        <img
          className="brand__mark"
          src="/icons/museum-mark.svg"
          alt=""
          width="44"
          height="44"
        />
        <span className="brand__text">
          <strong>Smart Museum</strong>
          <span>Heritage monitoring</span>
        </span>
      </a>

      <nav className="sidebar__nav" aria-label="Main navigation">
        <a className="sidebar__link sidebar__link--active" href="#overview" aria-current="page">
          <span aria-hidden="true">01</span>
          Dashboard
        </a>
        <a className="sidebar__link" href="#alerts">
          <span aria-hidden="true">02</span>
          Alerts
          <span className="sidebar__preview">Preview</span>
        </a>
        <a className="sidebar__link" href="#history">
          <span aria-hidden="true">03</span>
          History
        </a>
      </nav>

      <div className="sidebar__note">
        <span className="sidebar__note-indicator" aria-hidden="true" />
        <div>
          <strong>Preventive conservation</strong>
          <p>Environmental context for the care of cultural collections.</p>
        </div>
      </div>

      <p className="sidebar__version">CLIENT PWA · FOUNDATION</p>
    </aside>
  );
}
