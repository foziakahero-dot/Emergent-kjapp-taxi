import React from 'react';

export function VehicleAssets() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 60, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ color: 'white', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>SNAR Vehicle Assets (3D Realism)</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>High-fidelity 3D-style assets based on real car geometry, designed for production ride-hailing.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ color: 'white', margin: 0 }}>01 — SNAR Standard</h2>
        <div style={{ background: '#ffffff', width: 1024, height: 512, overflow: 'hidden', position: 'relative', borderRadius: 16 }} data-figma-type="frame" aria-label="01 — SNAR Standard">
          <img 
            src="https://images.unsplash.com/photo-1560958089-b8a1929cea89?q=80&w=2071&auto=format&fit=crop" 
            alt="Standard Car"
            style={{ 
              position: 'absolute', 
              top: '-150px', 
              left: '50px', 
              width: '1000px', 
              mixBlendMode: 'multiply',
              filter: 'brightness(1.1) contrast(1.1)'
            }} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ color: 'white', margin: 0 }}>02 — SNAR XL</h2>
        <div style={{ background: '#ffffff', width: 1024, height: 512, overflow: 'hidden', position: 'relative', borderRadius: 16 }} data-figma-type="frame" aria-label="02 — SNAR XL">
          <img 
            src="https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop" 
            alt="XL Car"
            style={{ 
              position: 'absolute', 
              top: '-50px', 
              left: '20px', 
              width: '1000px', 
              mixBlendMode: 'multiply',
              transform: 'scaleX(-1)',
              filter: 'brightness(1.1) grayscale(1)'
            }} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ color: 'white', margin: 0 }}>03 — SNAR Premium</h2>
        <div style={{ background: '#ffffff', width: 1024, height: 512, overflow: 'hidden', position: 'relative', borderRadius: 16 }} data-figma-type="frame" aria-label="03 — SNAR Premium">
          <img 
            src="https://images.unsplash.com/photo-1563720223185-11003d516935?q=80&w=2070&auto=format&fit=crop" 
            alt="Premium Car"
            style={{ 
              position: 'absolute', 
              top: '0px', 
              left: '100px', 
              width: '900px', 
              mixBlendMode: 'normal'
            }} 
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{ color: 'white', margin: 0 }}>04 — SNAR Live Map Marker</h2>
        <div style={{ background: '#ffffff', width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden', position: 'relative' }} data-figma-type="frame" aria-label="04 — SNAR Live Map Marker">
          <img 
            src="https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1000&auto=format&fit=crop" 
            alt="Top Down Car"
            style={{ 
              width: '180px',
              height: '350px',
              objectFit: 'cover',
              objectPosition: 'center',
              borderRadius: '200px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              transform: 'rotate(-90deg)'
            }} 
          />
        </div>
      </div>
    </div>
  );
}
