import React, { useEffect, useRef } from 'react';

export default function QRCode({ value, size = 120 }) {
  const ref = useRef();
  useEffect(() => {
    if (!value || !ref.current) return;
    let isMounted = true;
    import('qrcode').then(QR => {
      if (!isMounted || !ref.current) return;
      try {
        QR.toCanvas(ref.current, String(value), { width: size, margin: 1, color: { dark: '#0d1b35', light: '#fff' } });
      } catch (err) {
        console.error('QR code render error:', err);
      }
    }).catch(err => console.error('QRCode import error:', err));
    return () => { isMounted = false; };
  }, [value, size]);
  return <canvas ref={ref} style={{ borderRadius:4, display:'block', margin: '0 auto' }} />;
}