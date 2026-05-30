import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperAPI } from '../utils/api';
import StatusBadge from './StatusBadge';

export default function ScanModal({ onClose }) {
  const nav = useNavigate();
  const [tab, setTab]       = useState('camera');
  const [ref, setRef]       = useState('');
  const [error, setError]   = useState('');
  const [result, setResult] = useState(null);
  const [camError, setCamError] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef();
  const streamRef = useRef();
  const rafRef = useRef();
  const detectLockRef = useRef(false);

  useEffect(() => {
    if (tab === 'camera') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [tab]);

  const startCamera = async () => {
    setCamError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;

      const Detector = window.BarcodeDetector;
      let useJSQR = false;
      let detector;

      if (!Detector) {
        // Try loading jsQR as a fallback for browsers without BarcodeDetector
        try {
          await new Promise((resolve, reject) => {
            if (window.jsQR) return resolve();
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/jsqr/dist/jsQR.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load jsQR'));
            document.head.appendChild(s);
          });
          useJSQR = true;
        } catch {
          setCamError('Auto-scan is not supported on this browser. Please use the Manual tab to enter the Ref Code.');
          return;
        }
      } else {
        try {
          detector = new Detector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8'] });
        } catch {
          // Fallback to jsQR if BarcodeDetector cannot be constructed
          try {
            if (!window.jsQR) {
              await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/jsqr/dist/jsQR.js';
                s.onload = () => resolve();
                s.onerror = () => reject(new Error('Failed to load jsQR'));
                document.head.appendChild(s);
              });
            }
            useJSQR = true;
          } catch {
            setCamError('Auto-scan is not supported on this device. Please use the Manual tab.');
            return;
          }
        }
      }

      setScanning(true);
      detectLockRef.current = false;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const parseRefFromValue = (raw = '') => {
        const v = String(raw).trim();
        if (!v) return null;
        if (/^\d+$/.test(v)) return parseInt(v, 10);
        const m1 = v.match(/\/scan\/(\d+)/i);
        if (m1) return parseInt(m1[1], 10);
        const m2 = v.match(/(?:ref=|#)(\d+)/i);
        if (m2) return parseInt(m2[1], 10);
        return null;
      };

      const handleDetectedRef = async (detectedRef) => {
        if (detectLockRef.current) return;
        detectLockRef.current = true;
        setScanning(false);
        stopCamera();
        try {
          const r = await paperAPI.scan(detectedRef);
          const found = r.data.paper;
          setResult(found);
          nav(`/scan/${found.ref_code}`);
          onClose();
        } catch {
          setCamError('Scanned code is not a valid paper reference. Try again or use Manual tab.');
          detectLockRef.current = false;
        }
      };

      const loop = async () => {
        if (!videoRef.current || detectLockRef.current || !streamRef.current) return;
        const v = videoRef.current;
        if (v.readyState >= 2) {
          canvas.width = v.videoWidth || 640;
          canvas.height = v.videoHeight || 480;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          try {
            if (useJSQR) {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = window.jsQR(imageData.data, canvas.width, canvas.height);
              if (code && code.data) {
                const parsed = parseRefFromValue(code.data || '');
                if (parsed) { await handleDetectedRef(parsed); return; }
              }
            } else {
              const codes = await detector.detect(canvas);
              if (codes?.length) {
                const parsed = parseRefFromValue(codes[0]?.rawValue || '');
                if (parsed) { await handleDetectedRef(parsed); return; }
              }
            }
          } catch {
            // Keep scanning frames.
          }
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch {
      setCamError('Camera blocked on HTTP. Use the Manual tab to enter the Ref Code, or scan the QR with your phone camera app directly.');
    }
  };

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const lookup = async (e) => {
    e.preventDefault();
    setError(''); setResult(null);
    try {
      const r = await paperAPI.scan(ref);
      setResult(r.data.paper);
    } catch (err) {
      setError(err.response?.data?.error || 'Paper not found.');
    }
  };

  const goTo = () => { nav(`/paper/${result.id}`); onClose(); };
  const goScan = () => { nav(`/scan/${result.ref_code}`); onClose(); };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <span className="modal-title">📷 Scan / Lookup</span>
          <button className="btn btn-outline btn-sm" onClick={() => { stopCamera(); onClose(); }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--border)', padding:'0 22px' }}>
          {[['camera','📷 Camera'],['manual','✏️ Manual']].map(([k,label]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ padding:'10px 16px', border:'none', background:'none', fontWeight: tab===k ? 700 : 400,
                color: tab===k ? 'var(--navy)' : 'var(--t2)', borderBottom: tab===k ? '2px solid var(--gold)' : '2px solid transparent',
                marginBottom:-2, cursor:'pointer', fontSize:13 }}>
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {/* Camera tab */}
          {tab === 'camera' && (
            <div>
              {camError ? (
                <div>
                  <div className="alert a-err" style={{ marginBottom:14 }}>{camError}</div>
                  <div style={{ background:'var(--ivory)', borderRadius:10, padding:18, textAlign:'center' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>📱</div>
                    <div style={{ fontWeight:600, color:'var(--navy)', marginBottom:6 }}>Use Phone Camera Instead</div>
                    <div className="sm muted">Open your phone's native camera app and point it at the QR code on the document. It will open the paper directly.</div>
                  </div>
                  <button className="btn btn-outline btn-full mt4" onClick={() => setTab('manual')}>
                    Or use Manual Entry →
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ background:'#000', borderRadius:8, overflow:'hidden', marginBottom:12, height:240, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <video ref={videoRef} autoPlay playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                  <p className="sm muted" style={{ textAlign:'center' }}>
                    {scanning ? 'Scanning... point camera at QR code or barcode' : 'Point camera at QR code or barcode'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Manual tab */}
          {tab === 'manual' && (
            <div>
              {error && <div className="alert a-err">{error}</div>}
              <form onSubmit={lookup} style={{ display:'flex', gap:8 }}>
                <input className="inp" type="number" min="1" placeholder="Enter Ref Code (e.g. 1, 25, 152)"
                  value={ref} onChange={e => setRef(e.target.value)} required />
                <button type="submit" className="btn btn-navy" style={{ whiteSpace:'nowrap' }}>Look Up</button>
              </form>

              {result && (
                <div className="card mt4">
                  <div className="card-body">
                    <div className="alert a-ok mb2">✅ Paper found!</div>
                    <table style={{ width:'100%' }}>
                      <tbody>
                        {[
                          ['Ref',    <span className="mono" style={{fontSize:20,fontWeight:800,color:'var(--navy)'}}>#{result.ref_code}</span>],
                          ['Title',  result.title],
                          ['Origin', result.origin],
                          ['Status', <StatusBadge action={result.status_action} dept={result.status_dept} />],
                        ].map(([k,v]) => (
                          <tr key={k} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'7px 0', fontWeight:600, fontSize:11, color:'var(--t2)', width:60, textTransform:'uppercase' }}>{k}</td>
                            <td style={{ padding:'7px 0' }}>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display:'flex', gap:8, marginTop:14 }}>
                      <button className="btn btn-navy btn-sm" onClick={goScan}>⚡ Mark Status</button>
                      <button className="btn btn-outline btn-sm" onClick={goTo}>View Details</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => { stopCamera(); onClose(); }}>Close</button>
        </div>
      </div>
    </div>
  );
}