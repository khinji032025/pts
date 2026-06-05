import React, { useEffect, useRef } from 'react';

export default function Barcode({ value, width = 1.8, height = 50 }) {
  const ref = useRef();
  useEffect(() => {
    if (!value || !ref.current) return;
    let isMounted = true;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (!isMounted || !ref.current) return;
      try {
        JsBarcode(ref.current, String(value), {
          format: 'CODE128', width, height,
          displayValue: true, fontSize: 12, margin: 4,
          lineColor: '#0d1b35', background: '#fff',
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }).catch(err => console.error('JsBarcode import error:', err));
    return () => { isMounted = false; };
  }, [value, width, height]);
  return <svg ref={ref} style={{ display:'block', maxWidth:'100%', margin: '0 auto' }} />;
}
