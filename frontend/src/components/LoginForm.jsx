import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export default function LoginForm({ compact = false, onSuccess }) {
  const { login, googleLogin } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleRendered, setGoogleRendered] = useState(false);
  const [googleInitError, setGoogleInitError] = useState('');
  const googleButtonRef = useRef(null);

  const handleSuccess = (user) => {
    if (onSuccess) {
      onSuccess(user);
      return;
    }
    nav(user.role === 'admin' ? '/admin' : '/dept');
  };

  const initGoogle = () => {
    if (!window.google?.accounts?.id) {
      setGoogleInitError('Unable to initialize Google Sign-In.');
      return;
    }

    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setGoogleInitError('Google client ID is not configured.');
      return;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleResponse,
      ux_mode: 'popup',
      auto_select: false,
    });
    setGoogleReady(true);
  };

  // Ensure the visible Google button is rendered into the container
  // after google SDK is ready and the ref is attached.
  useEffect(() => {
    if (!googleReady) return;
    try {
      if (googleButtonRef.current && window.google?.accounts?.id?.renderButton) {
        setGoogleRendered(false);
        window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', type: 'standard' });
        setTimeout(() => {
          if (googleButtonRef.current) {
            const innerButton = googleButtonRef.current.querySelector('div[role="button"], button');
            if (innerButton) {
              innerButton.style.width = '100%';
              innerButton.style.maxWidth = '100%';
            }
          }
          setGoogleRendered(true);
        }, 50);
      }
    } catch (e) {
      // ignore render errors
    }
  }, [googleReady]);

  useEffect(() => {
    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    if (document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)) {
      const checkReady = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(checkReady);
          initGoogle();
        }
      }, 250);
      return () => clearInterval(checkReady);
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    script.onerror = () => setGoogleInitError('Failed to load Google Sign-In script.');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleResponse = async (response) => {
    if (!response?.credential) {
      setError('Google sign-in failed.');
      setGoogleBusy(false);
      return;
    }

    try {
      const result = await googleLogin(response.credential);
      if (result.user) {
        handleSuccess(result.user);
      } else {
        setError(result.message || 'Your Google account is pending approval.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Google login failed.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleReady) {
      setError(googleInitError || 'Google Sign-In is not ready yet.');
      return;
    }
    setError('');
    setGoogleBusy(true);
    let resolved = false;
    try {
      window.google.accounts.id.prompt((notification) => {
        // handle different notification moments to give useful feedback
        try {
              if (notification.isNotDisplayed && notification.isNotDisplayed()) {
                const reason = notification.getNotDisplayedReason && notification.getNotDisplayedReason();
                const cid = process.env.REACT_APP_GOOGLE_CLIENT_ID || '(not configured)';
                const origin = window.location.origin;
                setError('Google prompt not displayed' + (reason ? `: ${reason}` : '.') + `\nClient ID: ${cid}\nOrigin: ${origin}`);
            resolved = true;
            setGoogleBusy(false);
          } else if (notification.isSkippedMoment && notification.isSkippedMoment()) {
                const reason = notification.getSkippedReason && notification.getSkippedReason();
                const cid = process.env.REACT_APP_GOOGLE_CLIENT_ID || '(not configured)';
                const origin = window.location.origin;
                setError('Google prompt skipped' + (reason ? `: ${reason}` : '.') + `\nClient ID: ${cid}\nOrigin: ${origin}`);
            resolved = true;
            setGoogleBusy(false);
          } else if (notification.isDisplayed && notification.isDisplayed()) {
            // prompt is shown to the user; keep busy until callback runs
          }
        } catch (e) {
          // ignore notification parsing errors
        }
      });
    } catch (err) {
      setError('Failed to invoke Google prompt.');
      setGoogleBusy(false);
      return;
    }

    // fallback: if prompt didn't display within 6 seconds, stop busy state and hint troubleshooting
    setTimeout(() => {
      if (!resolved) {
        setGoogleBusy(false);
        const cid = process.env.REACT_APP_GOOGLE_CLIENT_ID || '(not configured)';
        const origin = window.location.origin;
        setError(`No Google account chooser appeared. Check that your Google Client ID (${cid}) allows this site origin (${origin}) and that third-party cookies are enabled.`);
      }
    }, 6000);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(form.username, form.password);
      handleSuccess(user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };


  return (
    <>
      <form onSubmit={submit} className={compact ? 'login-form-compact' : ''}>
        {error && <div className="alert a-err">{error}</div>}

        <div className="fg">
          <label className="lbl">Username</label>
          <input className="inp" type="text" autoComplete="username" required value={form.username} placeholder="Enter username" onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
        </div>

        <div className="fg">
          <label className="lbl">Password</label>
          <div style={{ position: 'relative' }}>
            <input className="inp" type={show ? 'text' : 'password'} autoComplete="current-password" required value={form.password} placeholder="Enter password" style={{ paddingRight: 40 }} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            <button type="button" onClick={() => setShow(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: .6 }}>
              {show ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 4.11-5.17" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-navy btn-lg btn-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="login-or-separator">or</div>

        <div
          ref={googleButtonRef}
          style={{
            marginTop: 12,
            width: '100%',
            minHeight: 56,
            visibility: googleRendered ? 'visible' : 'hidden',
            display: 'flex',
            justifyContent: 'center',
          }}
        />
        <p className="login-hint">If you don't have an account yet, please sign up using Google. New users remain pending until approved by an administrator.</p>
      </form>
    </>
  );
}