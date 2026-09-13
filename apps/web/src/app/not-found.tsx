import Link from "next/link";

export default function NotFound() {
  return <main id="main" className="not-found"><p className="eyebrow">404 / UNSAID</p><h1>NOT<br />SAID.</h1><p>Questa pagina non è nell&apos;archivio.</p><Link className="button button--dark" href="/shop">Torna allo shop</Link></main>;
}
