import {PublicHeader,PublicFooter,FAQ} from '../../components/relay-home';
import Link from 'next/link';
export default function Page(){return <main className="rw-site"><PublicHeader/><section className="rw-site-section"><div className="rw-section-intro"><p className="rw-kicker">RELAYWA HELP CENTER</p><h1>Keep your integration moving.</h1><p>Start with the answers below, or explore the <Link href="/api-docs">API documentation</Link> for request examples and endpoint details.</p></div><FAQ/></section><PublicFooter/></main>;}
