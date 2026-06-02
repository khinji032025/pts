import React, { useEffect, useRef } from 'react';

export default function Barcode({ value, width = 1.8, height = 50 }) {
  const ref = useRef();
  useEffect(() => {
    if (!value || !ref.current) return;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      JsBarcode(ref.current, String(value), {
        format: 'CODE128', width, height,
        displayValue: true, fontSize: 12, margin: 4,
        lineColor: '#0d1b35', background: '#fff',
      });
    });
  }, [value, width, height]);
  return <svg ref={ref} style={{ display:'block', maxWidth:'100%', margin: '0 auto' }} />;
}
