import React, { useState, useRef, useEffect } from 'react';
import { deptAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

export default function LoginQRModal({ onClose }) {
  const [tab, setTab] = useState('camera'); // camera or manual
  const [deptId, setDeptId] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [departmentPapers, setDepartmentPapers] = useState(null);
  const [papersError, setPapersError] = useState('');
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('environment');
  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  const { qrLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (tab !== 'camera') {
        await stopCamera();
        return;
      }

      await stopCamera();
      if (cancelled) return;
      await startCamera();
    };

    run();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'camera') return;
    startCamera();
  }, [cameraFacing]);

  const getBestCameraConfig = async () => {
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (Array.isArray(cameras) && cameras.length > 0) {
        const preferred = cameraFacing === 'user'
          ? cameras.find(c => /front|user/i.test(c.label)) || cameras[0]
          : cameras.find(c => /back|rear|environment/i.test(c.label)) || cameras[cameras.length - 1] || cameras[0];
        return preferred?.id || null;
      }
    } catch (e) {}
    return null;
  };

  const startCamera = async () => {
    try {
      if (startingRef.current) return;
      startingRef.current = true;

      // Use Html5Qrcode for scanning
      const html5QrId = 'html5qr-reader';
      const container = document.getElementById(html5QrId);
      if (scannerRef.current) {
        try { 
          const p = scannerRef.current.stop();
          if (p && p.then) p.catch(()=>{});
        } catch (e) {}
        try { 
          const c = scannerRef.current.clear();
          if (c && c.then) c.catch(()=>{});
        } catch (e) {}
        scannerRef.current = null;
      }
      // ensure previous DOM inside container is cleared to avoid duplicate video elements
      try { if (container) container.innerHTML = ''; } catch (e) {}
      scannerRef.current = new Html5Qrcode(html5QrId);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      const cameraId = await getBestCameraConfig();
      const cameraConstraint = cameraId
        ? cameraId
        : { facingMode: { ideal: cameraFacing } };
      await scannerRef.current.start(
        cameraConstraint,
        config,
        async (decodedText, decodedResult) => {
          // Stop scanner
          try { 
            const p = scannerRef.current.stop();
            if (p && p.then) await p.catch(()=>{});
          } catch (e) {}
          try { 
            const c = scannerRef.current.clear();
            if (c && c.then) await c.catch(()=>{});
          } catch (e) {}

          // Parse department id from decoded text (handle numeric, URLs, or embedded digits)
          const parseDeptId = (txt) => {
            if (!txt) return null;
            const s = String(txt).trim();
            // plain numeric
            if (/^\d+$/.test(s)) return s;
            // URL with query param
            try {
              const u = new URL(s);
              const q = u.searchParams.get('dept_id') || u.searchParams.get('dept') || u.searchParams.get('id');
              if (q && /^\d+$/.test(q)) return q;
            } catch (e) {}
            // look for first group of digits
            const m = s.match(/(\d{1,6})/);
            return m ? m[1] : null;
          };

          const deptIdParsed = parseDeptId(decodedText);
          if (!deptIdParsed) {
            setError('Could not extract department id from QR.');
            return;
          }
          setResult(null);
          setDepartmentPapers(null);
          setPapersError('');
          await loadDepartmentPapers(deptIdParsed);
        }
      );
    } catch (err) {
      if (cameraFacing === 'environment') {
        setCameraFacing('user');
        return;
      }
      const insecureContext = typeof window !== 'undefined'
        && window.location.protocol === 'http:'
        && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
      setError(
        insecureContext
          ? 'Camera is blocked here because this page is opened over HTTP. Use HTTPS or localhost, then tap Retry Camera.'
          : 'Camera access failed. Allow camera permission, then tap Retry Camera.'
      );
    } finally {
      startingRef.current = false;
    }
  };

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        const p = scannerRef.current.stop();
        if (p && p.then) await p.catch(()=>{});
      } catch (e) {}
      try {
        const c = scannerRef.current.clear();
        if (c && c.then) await c.catch(()=>{});
      } catch (e) {}
      scannerRef.current = null;
    }
    // also clear container DOM to remove leftover video nodes
    try { const el = document.getElementById('html5qr-reader'); if (el) el.innerHTML = ''; } catch (e) {}
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const loadDepartmentPapers = async (dept_id) => {
    setError('');
    setPapersError('');
    setLoadingPapers(true);
    setResult(null);
    setDepartmentPapers(null);
    try {
      const r = await deptAPI.papers(dept_id);
      setResult(r.data.department);
      setDepartmentPapers(r.data.papers || []);
      setLoadingPapers(false);
      stopCamera();
    } catch (err) {
      setLoadingPapers(false);
      setPapersError(err.response?.data?.error || 'Unable to load department documents.');
    }
  };

  const lookup = async (e) => {
    if (e) e.preventDefault();
    if (!deptId) return;
    await loadDepartmentPapers(deptId);
  };

  const handleLogin = () => {
    if (!result) return;
    // Call backend QR login endpoint
    (async () => {
      try {
        const user = await qrLogin(result.id);
        if (user) {
          onClose();
          navigate('/dept');
        }
      } catch (err) {
        setError(err.response?.data?.error || 'QR login failed.');
      }
    })();
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <span className="modal-title">📷 Scan Department QR</span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="segment-tabs">
            <button 
              className={`segment-tab ${tab === 'camera' ? 'active' : ''}`}
              onClick={() => setTab('camera')}
            >
              📷 Camera
            </button>
            <button 
              className={`segment-tab ${tab === 'manual' ? 'active' : ''}`}
              onClick={() => setTab('manual')}
            >
              ✏️ Manual
            </button>
          </div>

          {error && <div className="alert a-err">{error}</div>}

          {tab === 'camera' && (
            <div style={{ marginBottom: 16 }}>
              <div className="camera-switch-row">
                <button type="button" className={`btn btn-sm ${cameraFacing === 'environment' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setCameraFacing('environment')}>
                  📷 Back Camera
                </button>
                <button type="button" className={`btn btn-sm ${cameraFacing === 'user' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setCameraFacing('user')}>
                  🤳 Front Camera
                </button>
              </div>
              {error && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-navy btn-sm" onClick={startCamera}>
                    Retry Camera
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setTab('manual')}>
                    Use Manual Entry
                  </button>
                </div>
              )}
              <div id="html5qr-reader" style={{ width: '100%', borderRadius: 8, overflow: 'hidden' }} />
              <p style={{ fontSize: 12, color: 'var(--t2)', marginTop: 8, textAlign: 'center' }}>
                Point camera at department QR code
              </p>
            </div>
          )}

          {tab === 'manual' && (
            <form onSubmit={lookup} style={{ display:'flex', gap:8, marginBottom: 16 }}>
              <input 
                className="inp" 
                type="text" 
                placeholder="Enter Department ID"
                value={deptId} 
                onChange={e => setDeptId(e.target.value)} 
                required 
              />
              <button type="submit" className="btn btn-navy" style={{ whiteSpace:'nowrap' }}>
                Look Up
              </button>
            </form>
          )}

          {result && (
            <>
              <div className="card mt4">
                <div className="card-body">
                  <div className="alert a-ok mb2">✅ Department found!</div>
                  <table style={{ width:'100%' }}>
                    <tbody>
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 0', fontWeight:600, fontSize:11, color:'var(--t2)', width:70, textTransform:'uppercase' }}>Department</td>
                        <td style={{ padding:'8px 0' }}>{result.name}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-outline" onClick={() => loadDepartmentPapers(result.id)} disabled={loadingPapers}>
                  {loadingPapers ? 'Refreshing documents…' : 'Refresh documents'}
                </button>
                <button type="button" className="btn btn-navy" onClick={handleLogin} style={{ flex: 1, minWidth: 160 }}>
                  Login to {result.name}
                </button>
              </div>

              {papersError && <div className="alert a-err" style={{ marginTop: 12 }}>{papersError}</div>}

              {departmentPapers && (
                <div className="card mt4">
                  <div className="card-body">
                    <div className="alert a-info mb2">📄 Read-only documents for {result.name}</div>
                    {departmentPapers.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--t2)' }}>No documents found for this department.</div>
                    ) : (
                      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign:'left', padding:'8px 0', fontSize:11, color:'var(--t2)', textTransform:'uppercase' }}>Ref</th>
                              <th style={{ textAlign:'left', padding:'8px 0', fontSize:11, color:'var(--t2)', textTransform:'uppercase' }}>Title</th>
                              <th style={{ textAlign:'left', padding:'8px 0', fontSize:11, color:'var(--t2)', textTransform:'uppercase' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {departmentPapers.map((paper) => (
                              <tr key={paper.id} style={{ borderTop:'1px solid var(--border)' }}>
                                <td style={{ padding:'10px 0', verticalAlign:'top', fontSize:13 }}>{paper.ref_code}</td>
                                <td style={{ padding:'10px 0', verticalAlign:'top', fontSize:13 }}>{paper.title}</td>
                                <td style={{ padding:'10px 0', verticalAlign:'top', fontSize:13 }}>{paper.status_action || 'Unknown'}{paper.status_dept ? ` @ ${paper.status_dept}` : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          {result ? (
            <>
              <button className="btn btn-navy" onClick={handleLogin} style={{ flex: 1 }}>Login to {result.name}</button>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-outline" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
