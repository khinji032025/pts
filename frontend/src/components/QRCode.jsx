import React, { useEffect, useRef } from 'react';

export default function QRCode({ value, size = 120 }) {
  const ref = useRef();
  useEffect(() => {
    if (!value || !ref.current) return;
    import('qrcode').then(QR => {
      QR.toCanvas(ref.current, String(value), { width: size, margin: 1, color: { dark: '#0d1b35', light: '#fff' } });
    });
  }, [value, size]);
  return <canvas ref={ref} style={{ borderRadius:4, display:'block', margin: '0 auto' }} />;
}