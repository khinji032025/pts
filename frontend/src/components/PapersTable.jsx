import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { paperAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';
import QRCode from './QRCode';
import Barcode from './Barcode';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function PapersTable({ refresh }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [papers, setPapers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search:'', month:'', day:'' });
  const [active, setActive]   = useState({});
  const [msg, setMsg]         = useState('');
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const isAdmin = user?.role === 'admin';

  const canMark = (paper, action) => {
    const status = paper.status_action || null;
    if (action === 'IN') return status !== 'IN' && status !== 'DONE';
    if (action === 'OUT') return status === 'IN';
    if (action === 'DONE') return !!status && status !== 'DONE';
    return false;
  };

  const warningFor = (paper, action) => {
    const status = paper.status_action || null;
    if (action === 'IN' && status === 'IN') return 'Duplicate IN. This paper is already marked IN.';
    if (action === 'IN' && status === 'DONE') return 'This paper is already marked DONE.';
    if (action === 'OUT' && !status) return 'Please mark IN first before marking OUT.';
    if (action === 'OUT' && status === 'OUT') return 'Duplicate OUT. This paper is already marked OUT.';
    if (action === 'OUT' && status === 'DONE') return 'This paper is already marked DONE.';
    if (action === 'DONE' && !status) return 'Please mark IN first before marking DONE.';
    if (action === 'DONE' && status === 'DONE') return 'Duplicate DONE. This paper is already marked DONE.';
    return 'This status update is not allowed right now.';
  };

  const load = useCallback(async (f={}) => {
    setLoading(true);
    try {
      const p = {};
      if (f.search) p.search = f.search;
      if (f.month)  p.month  = f.month;
      if (f.day)    p.day    = f.day;
      const r = await paperAPI.list(p);
      setPapers(r.data.papers);
    } catch { setPapers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(active); }, [active, refresh, load]);

  const applyFilter = () => setActive({ ...filters });
  const clearFilter = () => { setFilters({ search:'', month:'', day:'' }); setActive({}); };

  useEffect(() => {
    const onDocPointerDown = (event) => {
      if (event.target instanceof Element && event.target.closest('.paper-actions-dropdown')) return;
      setOpenActionMenuId(null);
    };

    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, []);

  const toggleActionMenu = (paperId) => {
    setOpenActionMenuId(current => (current === paperId ? null : paperId));
  };

  const closeActionMenu = () => setOpenActionMenuId(null);

  const mark = async (paper, action) => {
    try {
      await paperAPI.mark({ paper_id: paper.id, action, dept_id: user.dept_id, note: 'manual' });
      setMsg(`Marked ${action} — Ref #${paper.ref_code}`);
      load(active);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) { setMsg('Error: ' + (err.response?.data?.error || 'Failed')); }
  };

  const attemptMark = async (paper, action) => {
    if (!canMark(paper, action)) {
      setMsg(`⚠️ ${warningFor(paper, action)}`);
      setTimeout(() => setMsg(''), 3500);
      return;
    }
    await mark(paper, action);
  };

  const del = async (paper) => {
    if (!window.confirm(`Delete Ref #${paper.ref_code}?`)) return;
    await paperAPI.delete(paper.id);
    load(active);
  };

  const renderMobileActions = (paper) => {
    const showDeptActions = !isAdmin && (user?.dept_name === paper.origin || (paper.status_action === 'IN' && paper.status_dept === user?.dept_name));

    return (
      <div className="paper-actions-dropdown">
        <button
          type="button"
          className="btn btn-navy btn-sm paper-actions-trigger"
          onClick={() => toggleActionMenu(paper.id)}
          aria-expanded={openActionMenuId === paper.id}
        >
          Actions ▾
        </button>

        {openActionMenuId === paper.id && (
          <div className="paper-actions-menu">
            {showDeptActions && (
              <>
                <button type="button" className="paper-actions-item" onClick={() => { closeActionMenu(); attemptMark(paper, 'IN'); }} disabled={!canMark(paper, 'IN')}>↓ Mark IN</button>
                <button type="button" className="paper-actions-item" onClick={() => { closeActionMenu(); nav(`/paper/${paper.id}/capture`); }}>📷 Capture Doc</button>
                <button type="button" className="paper-actions-item" onClick={() => { closeActionMenu(); attemptMark(paper, 'OUT'); }} disabled={!canMark(paper, 'OUT')}>↑ Mark OUT</button>
              </>
            )}

            <button type="button" className="paper-actions-item" onClick={() => { closeActionMenu(); print(paper); }}>🖨️ Print</button>
            <button type="button" className="paper-actions-item" onClick={() => { closeActionMenu(); nav(`/paper/${paper.id}`); }}>View</button>
            <button
              type="button"
              className="paper-actions-item"
              onClick={() => { closeActionMenu(); attemptMark(paper, 'DONE'); }}
              disabled={!canMark(paper, 'DONE')}
            >
              ✓ Done
            </button>
            {(isAdmin || user?.dept_name === paper.origin) && (
              <button type="button" className="paper-actions-item paper-actions-danger" onClick={() => { closeActionMenu(); del(paper); }}>Delete</button>
            )}
          </div>
        )}
      </div>
    );
  };

  const print = (p) => {
  const createdDate = new Date(p.created_at).toLocaleString('en-PH', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
  const w = window.open('', '_blank', 'width=400,height=600');
  const safeFileName = `ref-${p.ref_code}-${String(p.title || 'paper').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'paper'}.png`;
  w.document.write(`
    <html>
    <head>
      <title>Ref #${p.ref_code}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 20px; margin: 0; }
        h3 { margin: 0 0 4px; font-size: 15px; }
        p  { margin: 0 0 12px; font-size: 12px; color: #555; }
        .label { font-weight: 700; font-size: 12px; margin: 10px 0 4px; }
        .hint  { font-size: 11px; color: #999; margin: 4px 0 0; }
        canvas, svg { display: block; margin: 0 auto; }
        .box { border: 1px solid #ddd; border-radius: 10px; padding: 20px; display: inline-block; min-width: 260px; }
        .btns { margin-top: 16px; display: flex; gap: 8px; justify-content: center; }
        button { padding: 7px 20px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
        .b-back  { background: #555; color: #fff; }
        .b-down  { background: #0f766e; color: #fff; }
        .b-print { background: #1d4ed8; color: #fff; }
        @media print { .btns { display: none; } body { padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="box">
        <h3>Ref: ${p.ref_code}</h3>
        <p>${p.title}<br>Origin: ${p.origin}<br>Created: ${createdDate}</p>
        <div class="label">QR Code</div>
        <div id="qr"></div>
        <div class="hint">Scan QR to update status</div>
        <div class="label" style="margin-top:14px">Barcode</div>
        <div id="bc"></div>
        <div class="hint">Scan barcode as backup</div>
      </div>
      <div class="btns">
        <button class="b-back" onclick="window.close()">Back</button>
        <button class="b-down" onclick="downloadFile()">Download</button>
        <button class="b-print" onclick="window.print()">Print</button>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"><\/script>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
      <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"><\/script>
      <script>
        async function downloadFile() {
          const qrCanvas = document.querySelector('#qr canvas');
          if (!qrCanvas || typeof qrCanvas.toBlob !== 'function') {
            alert('QR download is not ready yet. Please try again in a moment.');
            return;
          }

          qrCanvas.toBlob(function(blob) {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '${safeFileName}';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }, 'image/png');
        }
        QRCode.toCanvas(document.createElement('canvas'), '${p.ref_code}', { width: 180, margin: 1 }, function(err, canvas) {
          canvas.style.display = 'block';
          canvas.style.margin = '0 auto';
          document.getElementById('qr').appendChild(canvas);
        });
        var bcCanvas = document.createElement('canvas');
        bcCanvas.style.display = 'block';
        bcCanvas.style.margin = '0 auto';
        document.getElementById('bc').appendChild(bcCanvas);
        JsBarcode(bcCanvas, '${p.ref_code}', { width: 1.5, height: 50, fontSize: 13, margin: 4 });
      <\/script>
    </body>
    </html>
  `);
  w.document.close();
};

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">📄 {isAdmin ? 'All Papers' : 'Recent Papers'}</span>
      </div>

      {/* Filters */}
      <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', background:'var(--ivory)' }}>
        <div className="row">
          <input className="inp" style={{ flex:2, minWidth:180 }} placeholder="🔍 Search title or ref…"
            value={filters.search} onChange={e => setFilters(f=>({...f,search:e.target.value}))}
            onKeyDown={e => e.key==='Enter' && applyFilter()} />
          <select className="sel" style={{ width:130 }} value={filters.month} onChange={e => setFilters(f=>({...f,month:e.target.value}))}>
            <option value="">All Months</option>
            {MONTHS.slice(1).map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select className="sel" style={{ width:100 }} value={filters.day} onChange={e => setFilters(f=>({...f,day:e.target.value}))}>
            <option value="">All Days</option>
            {Array.from({length:31},(_,i)=>i+1).map(d=><option key={d} value={d}>Day {d}</option>)}
          </select>
          <button className="btn btn-navy btn-sm" onClick={applyFilter}>Filter</button>
          <button className="btn btn-outline btn-sm" onClick={clearFilter}>Clear</button>
        </div>
      </div>

      {msg && <div className="alert a-info" style={{ margin:'10px 20px 0' }}>{msg}</div>}

      <div className="tbl-wrap">
        {loading ? (
          <div style={{ padding:40, textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : papers.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--t3)' }}>No papers found.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width:60 }}>Ref</th>
                <th>Title</th>
                <th>Origin</th>
                <th>Created</th>
                <th>Status</th>
                <th style={{ width:180 }}>QR / Barcode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {papers.map(p => (
                <React.Fragment key={p.id}>
                  <tr>
                    <td onClick={() => nav(`/paper/${p.id}`)} style={{ cursor: 'pointer' }}>
                      <span className="mono" style={{ fontWeight:700, color:'var(--navy)', fontSize:15 }}>{p.ref_code}</span>
                    </td>
                    <td style={{ fontWeight:500, maxWidth:240, textAlign: 'left', cursor: 'pointer' }} onClick={() => nav(`/paper/${p.id}`)}>
                      <span tabIndex={0} role="button" onKeyDown={(e) => { if (e.key === 'Enter') nav(`/paper/${p.id}`); }}>{p.title}</span>
                    </td>
                    <td style={{ fontWeight:500, color:'var(--t1)' }}>{p.origin}</td>
                    <td style={{ whiteSpace:'nowrap', fontWeight:500, color:'var(--t1)', lineHeight:'1.4' }}>
                      <div>{new Date(p.created_at).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'2-digit'})}</div>
                      <div style={{fontSize:'11px', color:'var(--t3)'}}>{new Date(p.created_at).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</div>
                    </td>
                    <td><StatusBadge action={p.status_action} dept={p.status_dept} /></td>
                    <td>
                      <div style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:10 }}>
                        <QRCode value={p.ref_code} size={80} />
                        <Barcode value={p.ref_code} width={2} height={60} />
                      </div>
                    </td>
                    <td className="paper-actions-cell">
                      <div className="paper-actions">
                        <div className="paper-actions-desktop">
                        {isAdmin ? (
                          <>
                            <div className="row" style={{ justifyContent:'center', gap:4 }}>
                              <button className="btn btn-outline btn-sm" style={{color:'var(--t1)', border:'1.5px solid var(--border2)'}} onClick={() => print(p)}>🖨️ Print</button>
                              <button className="btn btn-blue btn-sm" onClick={() => nav(`/paper/${p.id}`)}>View</button>
                              {(isAdmin || user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && (
                                <button
                                  className="btn btn-sm"
                                  style={{backgroundColor:'#0e612c', color:'#fff', border:'none', opacity: canMark(p, 'DONE') ? 1 : 0.45, cursor: canMark(p, 'DONE') ? 'pointer' : 'not-allowed'}}
                                  onClick={() => attemptMark(p,'DONE')}
                                >✓ Done</button>
                              )}
                            </div>
                            <div className="row" style={{ justifyContent:'center', gap:4 }}>
                              <div style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
                                {!isAdmin && (user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && (
                                  <button
                                    className="btn btn-green btn-sm"
                                    onClick={() => attemptMark(p,'IN')}
                                    style={{ opacity: canMark(p, 'IN') ? 1 : 0.45, cursor: canMark(p, 'IN') ? 'pointer' : 'not-allowed' }}
                                  >↓ Mark IN</button>
                                )}
                                {(isAdmin || user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && (
                                  <button className="btn btn-navy btn-sm" onClick={() => nav(`/paper/${p.id}/capture`)}>📷 Capture Doc</button>
                                )}
                                {!isAdmin && (user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && (
                                  <button
                                    className="btn btn-amber btn-sm"
                                    onClick={() => attemptMark(p,'OUT')}
                                    style={{ opacity: canMark(p, 'OUT') ? 1 : 0.45, cursor: canMark(p, 'OUT') ? 'pointer' : 'not-allowed' }}
                                  >↑ Mark OUT</button>
                                )}
                              </div>
                              {isAdmin && <button className="btn btn-red btn-sm" onClick={() => del(p)}>Delete</button>}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="row" style={{ justifyContent:'center', gap:4 }}>
                              <div style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
                                {!isAdmin && (user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && (
                                  <button
                                    className="btn btn-green btn-sm"
                                    onClick={() => attemptMark(p,'IN')}
                                    style={{ opacity: canMark(p, 'IN') ? 1 : 0.45, cursor: canMark(p, 'IN') ? 'pointer' : 'not-allowed' }}
                                  >↓ Mark IN</button>
                                )}
                                {(isAdmin || user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && (
                                  <button className="btn btn-navy btn-sm" onClick={() => nav(`/paper/${p.id}/capture`)}>📷 Capture Doc</button>
                                )}
                                {!isAdmin && (user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && (
                                  <button
                                    className="btn btn-amber btn-sm"
                                    onClick={() => attemptMark(p,'OUT')}
                                    style={{ opacity: canMark(p, 'OUT') ? 1 : 0.45, cursor: canMark(p, 'OUT') ? 'pointer' : 'not-allowed' }}
                                  >↑ Mark OUT</button>
                                )}
                              </div>
                            </div>
                            <div className="row" style={{ justifyContent:'center', gap:4 }}>
                              <button className="btn btn-outline btn-sm" style={{color:'var(--t1)', border:'1.5px solid var(--border2)'}} onClick={() => print(p)}>🖨️ Print</button>
                              <button className="btn btn-blue btn-sm" onClick={() => nav(`/paper/${p.id}`)}>View</button>
                              {(isAdmin || user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && (
                                  <button
                                    className="btn btn-sm"
                                    style={{backgroundColor:'#0b632b', color:'#fff', border:'none', opacity: canMark(p, 'DONE') ? 1 : 0.45, cursor: canMark(p, 'DONE') ? 'pointer' : 'not-allowed'}}
                                    onClick={() => attemptMark(p,'DONE')}
                                  >✓ Done</button>
                              )}
                              {!isAdmin && (user?.dept_name === p.origin || (p.status_action === 'IN' && p.status_dept === user?.dept_name)) && <button className="btn btn-red btn-sm" onClick={() => del(p)}>Delete</button>}
                            </div>
                          </>
                        )}
                        </div>
                        <div className="paper-actions-mobile">
                          {renderMobileActions(p)}
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
