import { useId, useState } from "react";
import { SnarMark } from "./SnarUI";

const views = ["Destinasjon", "Bilvalg", "Stemme"];
const cars = [
  ["SNAR", "Rask og enkel", "standard"],
  ["SNAR XL", "Mer plass", "xl"],
  ["Premium", "Premium komfort", "premium"],
];

/** Web illustration of the Customer home search and vehicle sheet.
 * Uses Customer tokens and vehicle assets, without live trip or price data. */
export default function ProductPreview() {
  const [view, setView] = useState(1);
  const panelId = useId();
  return (
    <figure className="snar-product-preview snar-product-story">
      <div className="snar-product-halo" aria-hidden="true" />
      <div className="snar-phone">
        <div className="snar-phone-screen snar-app-preview">
          <div className="snar-island" aria-hidden="true" />
          <div className="snar-preview-brand"><SnarMark size={24} /><strong>SNAR</strong><span>OSLO · BETA</span></div>
          <svg className="snar-preview-map" viewBox="0 0 360 660" aria-hidden="true">
            <rect width="360" height="660" fill="#EEF1F5" />
            <g fill="#E1E9E3">
              <rect x="32" y="168" width="82" height="72" rx="18" />
              <rect x="241" y="310" width="90" height="95" rx="18" />
              <rect x="116" y="62" width="58" height="64" rx="14" />
            </g>
            <path d="M360 440C295 430 263 478 247 540S209 633 181 660H360Z" fill="#D7E6EF" />
            <g fill="none" stroke="#FFFFFF" strokeWidth="13" strokeLinejoin="round">
              <path d="M-30 146L390 268M-20 297L368 410M-20 460L260 539M57 -10L-6 538M206 -10L91 660M356 -10L219 660" />
              <path d="M-20 355L66 333L184 258L303 170L379 164" strokeWidth="19" />
            </g>
            <g fill="none" stroke="#D6DDE5" strokeWidth="1.5">
              <path d="M-30 146L390 268M-20 297L368 410M-20 460L260 539M57 -10L-6 538M206 -10L91 660M356 -10L219 660" />
            </g>
          </svg>
          <div className="snar-preview-search"><img src="/assets/figma/search.svg" width="18" height="18" alt="" /><span>Hvor skal du?</span><span className="snar-preview-search-mic" aria-hidden="true">↗</span></div>
          <div id={panelId} className="snar-preview-sheet" aria-live="polite" aria-atomic="true">
            <div className="snar-preview-handle" aria-hidden="true" />
            {view === 0 ? (
              <div className="snar-preview-destination">
                <span className="snar-kicker">DIN NESTE REISE</span>
                <h3>Hvor skal du?</h3>
                <div className="snar-preview-place"><span aria-hidden="true">◉</span><div><strong>Hentested</strong><span>Velg hvor du vil bli hentet</span></div></div>
                <div className="snar-preview-place"><span aria-hidden="true">↗</span><div><strong>Destinasjon</strong><span>Søk etter sted eller adresse</span></div></div>
                <p>Skriv destinasjonen eller bruk stemmen.</p>
              </div>
            ) : view === 1 ? (
              <div>
                <div className="snar-preview-sheet-title"><h3>Velg reise</h3><span>SNAR</span></div>
                <div className="snar-preview-cars">{cars.map(([name, copy, asset], index) => (
                  <div className={`snar-preview-car${index === 0 ? " is-selected" : ""}`} key={name}>
                    <img src={`/assets/snar/${asset}.svg`} width="78" height="42" alt="" />
                    <div><strong>{name}</strong><span>{copy}</span></div>
                    <span className="snar-preview-radio" aria-hidden="true" />
                  </div>
                ))}</div>
                <p>Pris og hentetid vises i appen før bestilling.</p>
              </div>
            ) : (
              <div className="snar-preview-assist">
                <span className="snar-kicker">SNAR ASSIST</span>
                <div className="snar-preview-mic"><img src="/assets/figma/mic.svg" width="32" height="32" alt="" /></div>
                <h3>Si hvor du skal.</h3>
                <div className="snar-preview-wave" aria-hidden="true">{[12, 26, 42, 30, 52, 24, 38, 18, 30].map((height, index) => <i key={index} style={{ height }} />)}</div>
                <p>Se over destinasjon, bilvalg og prisestimat før du bekrefter.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="snar-preview-controls" role="group" aria-label="Utforsk appvisningen">
        {views.map((label, index) => <button key={label} type="button" aria-pressed={view === index} aria-controls={panelId} onClick={() => setView(index)}><span aria-hidden="true">0{index + 1}</span>{label}</button>)}
      </div>
      <figcaption>Appvisning · illustrasjon</figcaption>
    </figure>
  );
}
