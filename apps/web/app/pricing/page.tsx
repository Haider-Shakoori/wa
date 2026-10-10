import {PublicHeader,PublicFooter,PricingSection} from '../../components/relay-home';
import { marketingPageMetadata } from '../../lib/seo';

export const metadata = marketingPageMetadata('/pricing');

export default function Page(){return <main className="rw-site" id="main-content"><PublicHeader/><PricingSection standalone/><PublicFooter/></main>;}
