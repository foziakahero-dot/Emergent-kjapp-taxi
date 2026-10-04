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
export function Brand() {
  return (
    <Link to="/" className="snar-brand" aria-label="SNAR forside">
      <SnarMark />
      <strong>SNAR</strong>
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
        <p>Norsk taxi. Uten omveier.</p>
      </div>
      <nav aria-label="Bunnmeny">
        <Link to="/#how">Slik fungerer det</Link>
        <Link to="/#vehicles">Bilvalg</Link>
        <Link to="/loyvehaver">Løyvehaver</Link>
        <Link to="/help">Hjelp</Link>
        <a href="https://fleet.kjappapp.no">Fleet Panel</a>
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
