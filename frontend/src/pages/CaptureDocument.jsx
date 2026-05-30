import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { paperAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import usePaperNotifications from '../hooks/usePaperNotifications';

export default function CaptureDocument() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const [paper, setPaper]     = useState(null);
  const [tab, setTab]         = useState('camera');
  const [stream, setStream]   = useState(null);
  const [captured, setCaptured] = useState(null);
  const [file, setFile]       = useState(null);
  const [msg, setMsg]         = useState('');
  const [error, setError]     = useState('');
  const [cameraFacing, setCameraFacing] = useState('environment');
  const videoRef = useRef();
  const canvasRef = useRef();
  const { notifCount, recentPapers, markNotificationsSeen, markNotificationRead } = usePaperNotifications();

  const { user } = useAuth();

useEffect(() => {
  paperAPI.view(id)
    .then(r => {
      const p = r.data.paper;
      setPaper(p);
      // Only origin department or admin can capture
      if (user?.role !== 'admin' && user?.dept_name !== p.origin) {
        nav(`/paper/${id}`);
      }
    })
    .catch(() => nav(user?.role === 'admin' ? '/admin' : '/dept', { replace: true }));
  return () => stopCamera();
}, [id]);

  const startCamera = async () => {
    try {
      const constraints = { video: { facingMode: { ideal: cameraFacing } }, audio: false };
      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (primaryErr) {
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setError('Camera not available. Please use Upload File instead.');
    }
  };

  const stopCamera = () => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  const capture = () => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => setCaptured(blob), 'image/jpeg', 0.92);
    stopCamera();
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  useEffect(() => {
    if (tab !== 'camera') return;
    if (stream) startCamera();
  }, [cameraFacing]);

  const goBack = () => {
    // Navigate to Papers page - for admin, go to /admin with Papers tab active
    if (user?.role === 'admin') {
      nav('/admin', { state: { tab: 'papers' } });
    } else {
      nav('/dept');
    }
  };

  const save = async () => {
    const blob = tab === 'camera' ? captured : file;
    if (!blob) { setError('No image to save.'); return; }
    const fd = new FormData();
    fd.append('paper_id', id);
    fd.append('image', blob, 'capture.jpg');
    try {
      await paperAPI.uploadImage(fd);
      setMsg('Image saved!');
      setTimeout(() => goBack(), 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    }
  };

  return (
    <div>
      <Navbar title="QR Office" sub="Capture Document" notifCount={notifCount} recentPapers={recentPapers} onNotificationsClick={markNotificationsSeen} onNotificationRead={markNotificationRead} />
      <div className="page">
        {paper && (
          <div style={{ marginBottom: 20 }}>
           <button className="btn btn-outline btn-sm" onClick={goBack}>← Back to Paper</button>
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <div>
              <span className="card-title">📷 Capture Document Image</span>
              {paper && <div className="sm muted" style={{ marginTop: 4 }}>Paper: {paper.ref_code} — {paper.title}</div>}
            </div>
          </div>

          {/* Tabs */}
          <div className="capture-tabs">
            {['camera', 'upload'].map(t => (
              <button key={t} className={`capture-tab ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setCaptured(null); stopCamera(); }}>
                {t === 'camera' ? '📷 Camera' : '📁 Upload File'}
              </button>
            ))}
          </div>

          <div className="card-body">
            {error && <div className="alert a-err">{error}</div>}
            {msg   && <div className="alert a-ok">{msg}</div>}

            {tab === 'camera' && (
              <div>
                <div className="camera-switch-row" style={{ marginBottom: 12 }}>
                  <button type="button" className={`btn btn-sm ${cameraFacing === 'environment' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setCameraFacing('environment')}>
                    📷 Back Camera
                  </button>
                  <button type="button" className={`btn btn-sm ${cameraFacing === 'user' ? 'btn-navy' : 'btn-outline'}`} onClick={() => setCameraFacing('user')}>
                    🤳 Front Camera
                  </button>
                </div>
                {/* Video / captured preview */}
                <div className="capture-stage">
                  {!stream && !captured && (
                    <p style={{ color: '#aaa', fontSize: 14 }}>Camera not started. Click "Start Camera" to begin.</p>
                  )}
                  <video ref={videoRef} autoPlay playsInline style={{ width: '100%', display: stream && !captured ? 'block' : 'none' }} />
                  <canvas ref={canvasRef} style={{ width: '100%', display: captured ? 'block' : 'none' }} />
                </div>

                <div className="row" style={{ gap: 8 }}>
                  {!stream && !captured && (
                    <button className="btn btn-navy" onClick={startCamera}>▶ Start Camera</button>
                  )}
                  {stream && !captured && (
                    <button className="btn btn-gold" onClick={capture}>📸 Capture</button>
                  )}
                  {captured && (
                    <>
                      <button className="btn btn-outline" onClick={retake}>🔄 Retake</button>
                      <button className="btn btn-green" onClick={save}>💾 Save Document Image</button>
                    </>
                  )}
                 <button className="btn btn-outline" onClick={goBack}>Cancel</button>
                </div>
              </div>
            )}

            {tab === 'upload' && (
              <div>
                <div className="fg">
                  <label className="lbl">Select Image File</label>
                  <input className="inp" type="file" accept="image/*"
                    onChange={e => setFile(e.target.files[0])} />
                </div>
                {file && (
                  <img src={URL.createObjectURL(file)} alt="preview"
                    style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8, marginBottom: 14, display: 'block' }} />
                )}
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-green" onClick={save} disabled={!file}>💾 Save Document Image</button>
                  <button className="btn btn-outline" onClick={goBack}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}