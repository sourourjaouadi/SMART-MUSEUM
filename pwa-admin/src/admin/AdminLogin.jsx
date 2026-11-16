import { useState } from 'react';
import { createAdminApiClient } from './services/adminApi.js';
import { NotAdminError, saveSession } from './services/adminSession.js';

const defaultLogin = (email, password) => createAdminApiClient().login(email, password);

function loginErrorMessage(cause) {
  if (cause instanceof NotAdminError) return cause.message;
  if (cause?.status === 401) return 'The email or password was not accepted.';
  if (cause?.status === 400) return 'Enter a valid email address and password.';
  if (cause instanceof TypeError) return 'The server returned an unexpected sign-in response.';
  return cause?.message || 'Sign in could not be completed.';
}

/** ADMIN-only sign-in. `allowDemo` is true only in mock builds (VITE_DATA_MODE is not "api"). */
export default function AdminLogin({ onAuthenticated, onDemo, allowDemo = false, expired = false, login = defaultLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const session = saveSession(await login(email.trim(), password));
      setPassword('');
      onAuthenticated(session);
    } catch (cause) {
      setError(loginErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login__card" aria-labelledby="admin-login-title">
        <div className="admin-brand admin-login__brand">
          <img src="/icons/museum-mark.svg" alt="" />
          <span><strong>Smart Museum</strong><small>Administration</small></span>
        </div>
        <h1 id="admin-login-title">Administrator sign-in</h1>
        <p className="admin-copy">Only active ADMIN accounts can open the Admin PWA.</p>
        {expired && <p className="admin-notice" role="status">Your session ended. Sign in again to continue.</p>}
        <form className="admin-login__form" onSubmit={handleSubmit}>
          <label htmlFor="admin-login-email">Email</label>
          <input id="admin-login-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="admin-login-password">Password</label>
          <input id="admin-login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="admin-inline-error" role="alert">{error}</p>}
          <button type="submit" className="admin-button" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        {/* Vite inlines VITE_DATA_MODE: in api builds this branch is removed from the bundle. */}
        {import.meta.env.VITE_DATA_MODE !== 'api' && allowDemo && (
          <button type="button" className="admin-button admin-button--quiet admin-login__demo" onClick={onDemo}>
            Continue with demo data
          </button>
        )}
      </section>
    </main>
  );
}
