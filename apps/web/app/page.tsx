import RelayHome from '../components/relay-home';
import { marketingPageMetadata, siteUrl } from '../lib/seo';
export const metadata = marketingPageMetadata('/');
export default function Page(){
  const schema = {'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':siteUrl+'/#organization',name:'RelayWA',url:siteUrl,logo:siteUrl+'/brand/relaywa-icon-web.png'},
    {'@type':'WebSite','@id':siteUrl+'/#website',name:'RelayWA',url:siteUrl,publisher:{'@id':siteUrl+'/#organization'}},
    {'@type':'SoftwareApplication',name:'RelayWA',applicationCategory:'DeveloperApplication',operatingSystem:'Web',url:siteUrl,description:'WhatsApp REST API with isolated sessions and real-time webhooks'}
  ]};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><RelayHome/></>;
}
