import { SnarMark } from "./SnarUI";
/** Actual Customer Splash layout/artwork from SplashArt.tsx and app/index.tsx.
 * No invented drivers, prices, availability, or fake booking controls. */
export default function ProductPreview() {
  return (
    <figure className="snar-product-preview">
      <div
        className="snar-phone"
        role="img"
        aria-label="Customer-appens startskjerm: SNAR og Kom i gang"
      >
        <div className="snar-phone-screen">
          <div className="snar-island" aria-hidden="true" />
          <div className="snar-source-splash">
            <div className="snar-splash-brand">
              <SnarMark size={104} />
              <strong>SNAR</strong>
            </div>
            <span className="snar-source-action">Kom i gang</span>
          </div>
        </div>
      </div>
      <figcaption>Customer-appens startskjerm</figcaption>
    </figure>
  );
}
