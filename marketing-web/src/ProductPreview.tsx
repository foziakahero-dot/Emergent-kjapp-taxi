import { SnarMark, SnarWordmark } from "./SnarUI";

const cars = [
  ["SNAR", "3 min", "189 kr", "standard"],
  ["SNAR XL", "5 min", "249 kr", "xl"],
  ["Premium", "7 min", "319 kr", "premium"],
];

/** Calm, non-interactive product illustration for the marketing hero.
 * It mirrors the Customer visual language without pretending to show live prices/data. */
export default function ProductPreview() {
  return (
    <figure className="snar-product-preview snar-product-story" aria-label="Illustrasjon av SNAR-appen">
      <div className="snar-product-halo" aria-hidden="true" />
      <div className="snar-phone">
        <div className="snar-phone-screen snar-app-preview">
          <div className="snar-island" aria-hidden="true" />
          <div className="snar-preview-brand">
            <SnarMark size={24} />
            <SnarWordmark height={13} />
            <span>OSLO · BETA</span>
          </div>

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
            <circle cx="184" cy="258" r="12" fill="#ff0000" opacity=".14" />
            <circle cx="184" cy="258" r="6" fill="#ff0000" />
          </svg>

          <div className="snar-preview-search">
            <img src="/assets/figma/search.svg" width="18" height="18" alt="" />
            <span>Hvor skal du?</span>
            <span className="snar-preview-search-mic" aria-hidden="true">⌁</span>
          </div>

          <div className="snar-preview-sheet">
            <div className="snar-preview-handle" aria-hidden="true" />
            <div className="snar-preview-sheet-title">
              <div>
                <span className="snar-preview-eyebrow">Velg reise</span>
                <h3>Bilene nær deg</h3>
              </div>
              <span>SNAR</span>
            </div>
            <div className="snar-preview-cars">
              {cars.map(([name, eta, price, asset], index) => (
                <div className={`snar-preview-car${index === 0 ? " is-selected" : ""}`} key={name}>
                  <img src={`/assets/snar/${asset}-3d.svg`} width="78" height="42" alt="" />
                  <div>
                    <strong>{name}</strong>
                    <span>{eta} · estimert</span>
                  </div>
                  <div className="snar-preview-meta">
                    <strong>{price}</strong>
                    <span className="snar-preview-radio" aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>
            <p>Illustrasjon · priser og hentetider er eksempler.</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
