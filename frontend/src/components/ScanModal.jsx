import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperAPI, deptAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import MarkerRoleWarningModal from './MarkerRoleWarningModal';

export default function ScanModal({ onClose, markMode = false }) {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab]       = useState('camera');
  const [ref, setRef]       = useState('');
  const [error, setError]   = useState('');
  const [result, setResult] = useState(null);
  const [department, setDepartment] = useState(null);
  const [departmentPapers, setDepartmentPapers] = useState(null);
  const [departmentError, setDepartmentError] = useState('');
  const [markerRoleWarning, setMarkerRoleWarning] = useState(null);
  const [scanStatusWarning, setScanStatusWarning] = useState(null);
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
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

  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    // initialize
    setScreenWidth(window.innerWidth);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startCamera = async () => {
    setCamError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }

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
          setCamError('Auto-scan is not supported on this browser. Please use your phone\'s camera app to scan the QR code directly.');
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
            setCamError('Auto-scan is not supported on this device. Please use your phone\'s camera app instead.');
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
        
        // New format: Department abbreviation + number (e.g., HR101, MTO102)
        const deptRefPattern = /^([A-Z]+)(\d+)$/;
        const deptMatch = v.match(deptRefPattern);
        if (deptMatch) return v; // Return the full formatted ref
        
        // Old format: Pure number (for backward compatibility)
        if (/^\d+$/.test(v)) return v;
        
        // Try to extract from URLs: /document/HR101, /paper/HR101, /scan/HR101, ?ref=HR101, #HR101
        const patterns = [
          /\/document\/([A-Z]+\d+)/i,
          /\/paper\/([A-Z]+\d+)/i,
          /\/scan\/([A-Z]+\d+)/i,
          /(?:[?&]ref=|#)([A-Z]+\d+)/i,
          // Also support old numeric formats for backward compatibility
          /\/document\/(\d+)/i,
          /\/paper\/(\d+)/i,
          /\/scan\/(\d+)/i,
          /(?:[?&]ref=|#)(\d+)/i,
          /(?:[?&]id=)(\d+)/i,
          /(?:ref|id)\D+(\d+)/i,
        ];
        for (const pattern of patterns) {
          const match = v.match(pattern);
          if (match && match[1]) return match[1];
        }
        return null;
      };


      const handleDetectedRef = async (detectedRef) => {
        if (detectLockRef.current) return;
        detectLockRef.current = true;
        setScanning(false);
        stopCamera();
        setError('');
        setDepartmentError('');
        setResult(null);
        clearDepartmentResults();

        // If the scanned value is a pure department id, show department lookup first.
        if (/^\d+$/.test(detectedRef)) {
          const departmentFound = await loadDepartmentPapers(detectedRef);
          if (departmentFound) return;
        }

        let preview = null;
        if (markMode) {
          try {
            const previewResp = await paperAPI.publicView(detectedRef);
            preview = previewResp.data.paper;
          } catch {
            preview = null;
          }
        }

        if (preview) {
          const current = preview;
          const isAdmin = user?.role === 'admin';
          const isCurrentDept = user?.dept_name && current.status_dept && user.dept_name === current.status_dept;

          if (current.status_action === 'IN' && !isCurrentDept) {
            if (!isAdmin) {
              setScanStatusWarning({ statusDept: current.status_dept });
              return;
            }
          }

          if (current.status_action === 'DONE') {
            setError('This document is already marked DONE.');
            return;
          }
        }

        try {
          const r = await paperAPI.scan(detectedRef, { auto: 1 });
          if (r?.data?.paper) {
            const targetPath = markMode ? '/scan' : '/document';
            const lockKey = `scan-lock-${detectedRef}-${user?.uid || user?.username || 'user'}`;
            sessionStorage.setItem(lockKey, String(Date.now()));
            setTimeout(() => nav(`${targetPath}/${encodeURIComponent(detectedRef)}`), 250);
            return;
          }
        } catch (err) {
          const errMsg = getErrorMessage(err) || 'Paper not found.';
          const isPaperNotFound = err.response?.status === 404 || errMsg === 'Paper not found.' || errMsg === 'Ref required.';
          if (isPaperNotFound) {
            const departmentFound = await loadDepartmentPapers(detectedRef);
            if (departmentFound) {
              return;
            }
          }
          if (showMarkerRoleWarning(err)) {
            return;
          }
          setError(errMsg);
          return;
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
      setCamError('Camera access blocked or not available on HTTP. Please use your phone\'s native camera app to scan the QR code directly.');
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

  const clearDepartmentResults = () => {
    setDepartment(null);
    setDepartmentPapers(null);
    setDepartmentError('');
  };

  const getErrorMessage = (err) => {
    if (!err) return '';
    if (err.response?.data?.error) return err.response.data.error;
    if (err.response?.data?.message) return err.response.data.message;
    if (typeof err.response?.data === 'string') return err.response.data;
    return err.message || '';
  };

  const showMarkerRoleWarning = (err) => {
    const errMsg = getErrorMessage(err);
    if (errMsg.includes('You are assigned to mark papers as')) {
      const match = errMsg.match(/You are assigned to mark papers as '([^']+)', but scanning this paper would mark it as '([^']+)'/);
      if (match && match[1] && match[2]) {
        setMarkerRoleWarning({ markerRole: match[1], attemptedAction: match[2] });
        return true;
      }
    }
    if (errMsg.includes('not assigned a marker role')) {
      setMarkerRoleWarning({ markerRole: 'UNASSIGNED', attemptedAction: 'SCAN' });
      return true;
    }
    return false;
  };

  const loadDepartmentPapers = async (dept_id) => {
    setDepartmentError('');
    setDepartment(null);
    setDepartmentPapers(null);
    try {
      const r = await deptAPI.papers(dept_id);
      setDepartment(r.data.department);
      setDepartmentPapers(r.data.papers || []);
      return true;
    } catch (err) {
      setDepartmentError(err.response?.data?.error || 'Department not found.');
      return false;
    }
  };

  const lookup = async (e) => {
    e.preventDefault();
    setError('');
    setDepartmentError('');
    setResult(null);
    clearDepartmentResults();

    if (/^\d+$/.test(ref)) {
      const departmentFound = await loadDepartmentPapers(ref);
      if (departmentFound) return;
    }

    try {
      const r = await paperAPI.scan(ref);
      setResult(r.data.paper);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Paper not found.';
      const isPaperNotFound = err.response?.status === 404 || errMsg === 'Paper not found.' || errMsg === 'Ref required.';
      if (isPaperNotFound) {
        const departmentFound = await loadDepartmentPapers(ref);
        if (departmentFound) return;
      }
      if (showMarkerRoleWarning(err)) {
        return;
      }
      setError(errMsg);
    }
  };

  const goTo = () => { nav(`/paper/${result.id}`); onClose(); };
  const goScan = () => { nav(`/scan/${result.ref_code}`); onClose(); };

  if (markerRoleWarning) {
    return (
      <MarkerRoleWarningModal
        markerRole={markerRoleWarning.markerRole}
        attemptedAction={markerRoleWarning.attemptedAction}
        onClose={() => {
          setMarkerRoleWarning(null);
          setError('');
          if (tab === 'camera' && !scanning) {
            startCamera().catch(() => {});
          }
        }}
      />
    );
  }

  if (scanStatusWarning) {
    return (
      <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 500 }}>
          <div className="modal-head">
            <span className="modal-title">⚠️ Status Warning</span>
            <button className="btn btn-outline btn-sm" onClick={() => { setScanStatusWarning(null); stopCamera(); onClose(); }}>✕</button>
          </div>
          <div className="modal-body">
            <div className="alert a-err" style={{ textAlign: 'center' }}>
              <strong>This paper is currently marked IN at {scanStatusWarning.statusDept}.</strong>
              <div style={{ marginTop: 10 }}>
                You can only mark this paper once it has been marked OUT by {scanStatusWarning.statusDept}.
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn btn-outline btn-full" onClick={() => { setScanStatusWarning(null); stopCamera(); onClose(); }}>OK</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: (department && screenWidth >= 768) ? 760 : 480 }}>
        <div className="modal-head">
          <span className="modal-title">{department ? '📄 Department documents' : '📷 Scan / Lookup'}</span>
          <button className="btn btn-outline btn-sm" onClick={() => { stopCamera(); onClose(); }}>✕</button>
        </div>

        {!department && (
          <div style={{ display:'flex', borderBottom:'2px solid var(--border)', padding:'0 22px' }}>
            <div style={{ padding:'10px 16px', fontWeight:700, color:'var(--navy)', fontSize:13 }}>
              {markMode ? '📷 Scan Document QR Code to mark status' : '📷 Scan Document QR Code'}
            </div>
          </div>
        )}

        <div className="modal-body">
          {scanStatusWarning && (
            <div className="alert a-err" style={{ marginBottom: 16, textAlign: 'center' }}>
              <strong>This paper is currently marked IN at {scanStatusWarning.statusDept}.</strong>
              <div style={{ marginTop: 10 }}>
                You can only mark this paper once it has been marked OUT by {scanStatusWarning.statusDept}.
              </div>
              <button
                type="button"
                className="btn btn-outline btn-full"
                style={{ marginTop: 16 }}
                onClick={() => {
                  setScanStatusWarning(null);
                  if (!streamRef.current) startCamera().catch(() => {});
                }}
              >
                OK
              </button>
            </div>
          )}

          {/* Camera tab */}
          {!department && (tab === 'camera' || true) && (
            <div>
              {camError ? (
                <div>
                  <div className="alert a-err" style={{ marginBottom:14 }}>{camError}</div>
                  <div style={{ background:'var(--ivory)', borderRadius:10, padding:18, textAlign:'center' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>📱</div>
                    <div style={{ fontWeight:600, color:'var(--navy)', marginBottom:6 }}>Use Phone Camera Instead</div>
                    <div className="sm muted">Open your phone's native camera app and point it at the QR code on the document. It will open the paper directly.</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ background:'#000', borderRadius:8, overflow:'hidden', marginBottom:12, height:240, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <video ref={videoRef} autoPlay muted playsInline style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                  <p className="sm muted" style={{ textAlign:'center' }}>
                    {scanning ? 'Scanning... point camera at QR code or barcode' : 'Point camera at QR code or barcode'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Manual tab - HIDDEN */}
          {false && tab === 'manual' && (
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

          {department && (
            <div className="card mt4">
              <div className="card-body">
                <div className="alert a-info mb2">📄 List of Papers for {department.name}</div>
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

          {departmentError && <div className="alert a-err" style={{ marginTop: 14 }}>{departmentError}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-outline" onClick={() => { stopCamera(); onClose(); }}>Close</button>
        </div>
      </div>
    </div>
  );
}