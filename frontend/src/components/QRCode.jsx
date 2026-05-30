import React, { useEffect, useRef } from 'react';

export default function QRCode({ value, size = 120 }) {
  const ref = useRef();
  useEffect(() => {
    if (!value || !ref.current) return;
    const protocol = process.env.REACT_APP_PROTOCOL || 'http';
    const host = process.env.REACT_APP_HOST
      ? `${protocol}://${process.env.REACT_APP_HOST}`
      : window.location.origin;
    const url = `${host}/scan/${value}`;
    import('qrcode').then(QR => {
      QR.toCanvas(ref.current, url, { width: size, margin: 1, color: { dark: '#0d1b35', light: '#fff' } });
    });
  }, [value, size]);
  return <canvas ref={ref} style={{ borderRadius:4, display:'block' }} />;
}