import React, { useRef, useEffect } from 'react';
import QRCode from './QRCode';

export default function DepartmentQRModal({ dept_id, dept_name, onClose }) {
  const qrRef = useRef();

  const openPrintable = () => {
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(dept_id)}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Department QR - ${dept_name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { padding: 40px; font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; }
          .container { background: white; text-align: center; }
          .title { font-size: 28px; font-weight: bold; margin-bottom: 30px; color: #0d1b35; }
          .qr-container { display: flex; justify-content: center; margin: 40px 0; }
          .qr-container img { width: 300px; height: 300px; }
          .text { font-size: 16px; color: #333; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title">Department: ${dept_name}</div>
          <div class="qr-container">
            <img src="${qrCodeUrl}" alt="Department QR Code" onload="window.print(); window.close();" />
          </div>
          <div class="text">Scan to open department dashboard</div>
        </div>
      </body>
      </html>
    `;
    
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="modal" style={{ maxWidth: 420, margin: 'auto' }}>
        <div className="modal-head">
          <span className="modal-title">🏢 Department QR - {dept_name}</span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ padding: '20px 0' }}>
            <QRCode value={dept_id} size={280} />
          </div>
          <p style={{ fontSize: 14, color: 'var(--t2)', marginTop: 16 }}>
            Scan to open this department dashboard
          </p>
        </div>
        <div className="modal-foot" style={{ display: 'flex', gap: 8, justifyContent: 'center', flexDirection: 'row' }}>
          <button className="btn btn-navy" onClick={openPrintable} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🖨️ Open Printable QR
          </button>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
