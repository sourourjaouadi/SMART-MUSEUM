import { useState } from 'react';
import { login } from '../services/api.js';
import { saveSession } from '../services/authSession.js';

export default function ClientLogin({ onAuthenticated, onDemo, expired = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const response = await login(email.trim(), password);
      let session;
      try {
        session = saveSession(response);
      } catch {
        setError('This browser cannot keep a sign-in session. Enable session storage or continue with demo data.');
        return;
      }
      setPassword('');
      onAuthenticated(session);
    } catch (cause) {
      const message = cause.status === 401
        ? 'The email or password was not accepted.'
        : cause.status === 400
          ? 'Enter a valid email address and password.'
          : cause.message || 'Sign in could not be completed.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <a className="login-brand" href="#overview" aria-label="Smart Museum Client PWA">
          <img src="/icons/museum-mark.svg" alt="" width="44" height="44" />
          <span><strong>Smart Museum</strong><small>Heritage monitoring</small></span>
        </a>
        <p className="eyebrow">Client PWA</p>
        <h1 id="login-title">Sign in to your collection view</h1>
        <p className="login-copy">
          Use your active museum account to load readings for its assigned zones.
        </p>
        {expired && (
          <p className="login-notice" role="status">
            Your session ended. Sign in again to continue with live data.
          </p>
        )}
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={254}
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="login-divider"><span>or</span></div>
        <button className="login-demo" type="button" onClick={onDemo}>
          Continue with demo data
        </button>
        <p className="login-footnote">
          Live readings require a backend connection. Demo mode uses local sample records.
        </p>
      </section>
    </main>
  );
}
