import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Customer BrandBadge: same glyph, radius and gradient. */
export function SnarMark({ size = 40 }: { size?: number }) {
  const id = "mark-" + useId().replace(/:/g, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="snar-mark-source"
    >
      <defs>
        <linearGradient id={id} x1=".1" y1="-.07" x2=".9" y2="1.07">
          <stop stopColor="#ff3b3b" />
          <stop offset="55%" stopColor="#ff0000" />
          <stop offset="100%" stopColor="#b30000" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="28" fill={`url(#${id})`} />
      <svg x="24" y="24" width="52" height="52" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 5l7 7-7 7"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 5l7 7-7 7"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </svg>
  );
}
/** Uppercase Inter wordmark with equal cap heights; independent of text/font rendering. */
export function SnarWordmark({ height = 24 }: { height?: number }) {
  return (
    <svg width={height * 89.7443 / 24} height={height} viewBox="0 0 89.7443 24" fill="currentColor" role="img" aria-label="SNAR" style={{ flexShrink: 0, display: "block" }}>
        <path transform="translate(0.0000 24) scale(0.015687 -0.015687) translate(-71.91943359375 19.919921875)" d="M691.200439453125 -19.919921875Q505.1201171875 -19.919921875 366.85986328125 36.2601318359375Q228.599609375 92.440185546875 151.719482421875 206.0804443359375Q74.83935546875 319.720703125 71.91943359375 491.84130859375H410.561279296875Q415.521240234375 420.00146484375 450.4610595703125 371.2015380859375Q485.40087890625 322.401611328125 545.940673828125 297.8016357421875Q606.48046875 273.20166015625 686.640380859375 273.20166015625Q760.280029296875 273.20166015625 813.0396728515625 293.281494140625Q865.79931640625 313.361328125 894.1790771484375 349.4210205078125Q922.558837890625 385.480712890625 922.558837890625 432.560302734375Q922.558837890625 475.679931640625 896.4990234375 505.8597412109375Q870.439208984375 536.03955078125 817.119384765625 558.95947265625Q763.799560546875 581.87939453125 681.51953125 600.079345703125L524.31982421875 636.63916015625Q331.399658203125 680.799072265625 221.1395263671875 780.7391357421875Q110.87939453125 880.67919921875 110.87939453125 1049.199462890625Q110.87939453125 1187.359619140625 185.719482421875 1290.979736328125Q260.5595703125 1394.599853515625 391.3797607421875 1452.2999267578125Q522.199951171875 1510 691.2802734375 1510Q864.12060546875 1510 991.1807861328125 1451.5399169921875Q1118.240966796875 1393.079833984375 1188.301025390625 1288.379638671875Q1258.361083984375 1183.679443359375 1260.0810546875 1045.59912109375H920.55908203125Q913.63916015625 1127.23876953125 854.9395751953125 1172.298583984375Q796.239990234375 1217.3583984375 689.84033203125 1217.3583984375Q619.6806640625 1217.3583984375 571.8809814453125 1198.778564453125Q524.081298828125 1180.19873046875 500.04150390625 1147.3590087890625Q476.001708984375 1114.519287109375 476.001708984375 1072.6396484375Q476.001708984375 1027.320068359375 503.221435546875 995.7802734375Q530.441162109375 964.240478515625 580.220947265625 943.060546875Q630.000732421875 921.880615234375 696.160888671875 906.880615234375L824.640625 877.28076171875Q932.521240234375 853.6806640625 1017.181396484375 814.280517578125Q1101.841552734375 774.88037109375 1160.6214599609375 720.020263671875Q1219.4013671875 665.16015625 1249.7412109375 593.2801513671875Q1280.0810546875 521.400146484375 1280.0810546875 431.84033203125Q1280.0810546875 290.840087890625 1209.740966796875 189.4200439453125Q1139.40087890625 88 1007.7607421875 34.0400390625Q876.12060546875 -19.919921875 691.200439453125 -19.919921875Z" />
        <path transform="translate(20.9525 24) scale(0.016107 -0.016107) translate(-116.1591796875 0)" d="M116.1591796875 0V1490H504.3212890625L919.558837890625 816.68359375Q960.279052734375 750.043212890625 998.839111328125 678.363037109375Q1037.399169921875 606.682861328125 1075.379150390625 519.6226806640625Q1113.359130859375 432.5625 1152.119140625 319.922119140625H1119.0390625Q1113.0791015625 402.1220703125 1106.4190673828125 501.90234375Q1099.759033203125 601.6826171875 1094.958984375 696.1829833984375Q1090.158935546875 790.683349609375 1090.158935546875 855.68359375V1490H1451.921142578125V0H1063.279052734375L682.12109375 616.95703125Q630.680908203125 701.79736328125 589.380859375 777.9775390625Q548.080810546875 854.15771484375 506.5408935546875 943.0777587890625Q465.0009765625 1031.997802734375 409.201171875 1151.917724609375H449.521240234375Q456.80126953125 1045.477783203125 463.4613037109375 943.877685546875Q470.121337890625 842.277587890625 474.141357421875 757.83740234375Q478.161376953125 673.397216796875 478.161376953125 617.43701171875V0Z" />
        <path transform="translate(44.4682 24) scale(0.016107 -0.016107) translate(-47.43994140625 0)" d="M47.43994140625 0 544.359375 1490H1016.6826171875L1528.962158203125 0H1132.879638671875L925.56103515625 651.43701171875Q876.040771484375 813.998046875 829.5606689453125 997.298828125Q783.08056640625 1180.599609375 736.440673828125 1378.19970703125H815.001220703125Q770.121337890625 1180.11962890625 727.9613037109375 996.3388671875Q685.80126953125 812.55810546875 638.52099609375 651.43701171875L439.4423828125 0ZM384.80078125 317.19873046875V586.56005859375H1191.601318359375V317.19873046875Z" />
        <path transform="translate(70.3316 24) scale(0.016107 -0.016107) translate(-116.1591796875 0)" d="M116.1591796875 0V1490H726.48046875Q894.400390625 1490 1016.0205078125 1429.739990234375Q1137.640625 1369.47998046875 1203.540771484375 1258.2598876953125Q1269.44091796875 1147.039794921875 1269.44091796875 995.03955078125Q1269.44091796875 841.519287109375 1202.4007568359375 733.439208984375Q1135.360595703125 625.359130859375 1011.200439453125 568.9991455078125Q887.040283203125 512.63916015625 716.080322265625 512.63916015625H327.04052734375V791.840576171875H651.599609375Q734.63916015625 791.840576171875 790.5589599609375 813.8004150390625Q846.478759765625 835.76025390625 874.918701171875 880.6400146484375Q903.358642578125 925.519775390625 903.358642578125 995.03955078125Q903.358642578125 1065.039306640625 874.918701171875 1111.1590576171875Q846.478759765625 1157.27880859375 790.43896484375 1180.4786376953125Q734.399169921875 1203.678466796875 651.11962890625 1203.678466796875H468.80126953125V0ZM934.15869140625 0 571.11865234375 680.880126953125H949.28076171875L1321.36083984375 0Z" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link to="/" className="snar-brand" aria-label="SNAR forside">
      <SnarMark />
      <SnarWordmark height={20} />
    </Link>
  );
}
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`snar-shell ${className}`}>{children}</div>;
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="snar-beta-label">
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <article className={`snar-card ${className}`}>{children}</article>;
}
export function Header({
  onBeta,
}: {
  onBeta?: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="snar-header">
      <a className="snar-skip" href="#content">
        Hopp til innhold
      </a>
      <Container className="snar-header-inner">
        <Brand />
        <nav
          id={menuId}
          className={open ? "is-open" : ""}
          aria-label="Hovedmeny"
          onClick={() => setOpen(false)}
        >
          <Link to="/#how">Slik fungerer det</Link>
          <Link to="/#vehicles">Bilvalg</Link>
          <Link to="/loyvehaver">Løyvehavere</Link>
          <Link to="/help">Hjelp</Link>
          {onBeta && (
            <button
              type="button"
              className="snar-btn snar-btn-primary snar-mobile-beta"
              onClick={onBeta}
            >
              Få tilgang til beta
            </button>
          )}
        </nav>
        <div className="snar-header-actions">
          {onBeta ? (
            <button
              type="button"
              className="snar-btn snar-btn-primary"
              onClick={onBeta}
            >
              Få tilgang til beta
            </button>
          ) : (
            <Link className="snar-btn snar-btn-primary" to="/loyvehaver/soknad">
              Bli partner
            </Link>
          )}
        </div>
        <button
          ref={toggle}
          className="snar-menu"
          type="button"
          aria-controls={menuId}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Lukk" : "Meny"}
        </button>
      </Container>
    </header>
  );
}
const contacts = [
  ["Generelt", "hei"], ["Kundeservice", "support"], ["Sjåfører", "driver"],
  ["Flåte", "fleet"], ["Partnerskap", "partner"], ["Personvern", "privacy"],
];
export function Footer() {
  return (
    <footer className="snar-footer snar-shell">
      <div>
        <Brand />
        <p>Appen som kobler deg med selvstendige løyvehavere.</p>
      </div>
      <nav aria-label="Bunnmeny">
        <Link to="/#how">Slik fungerer det</Link>
        <Link to="/#vehicles">Bilvalg</Link>
        <Link to="/loyvehaver">Løyvehaver</Link>
        <Link to="/help">Hjelp</Link>
        <a href="https://fleet.snarapp.no/login">Fleet Panel</a>
      </nav>
      <div className="snar-contacts">
        {contacts.map(([label, name]) => (
          <a key={name} href={`mailto:${name}@kjappapp.no`}>
            <span>{label}</span><strong>{name}@kjappapp.no</strong>
          </a>
        ))}
      </div>
      <div className="snar-footer-meta">
        <span>© 2026 SNAR · NexoraHub AS</span>
        <Link to="/personvern">Personvern</Link>
        <Link to="/vilkar">Vilkår</Link>
      </div>
    </footer>
  );
}

