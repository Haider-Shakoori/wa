import RelayHome from '../components/relay-home';
import { publicMetadata, siteUrl } from '../lib/seo';
export const metadata = publicMetadata('RelayWA — WhatsApp API for Developers', 'Connect WhatsApp to your app with isolated sessions, REST API messaging, and real-time webhooks. Start a free 7-day RelayWA trial.', '/');
export default function Page(){
  const schema = {'@context':'https://schema.org','@graph':[
    {'@type':'Organization','@id':siteUrl+'/#organization',name:'RelayWA',url:siteUrl,logo:siteUrl+'/brand/relaywa-icon-web.png'},
    {'@type':'WebSite','@id':siteUrl+'/#website',name:'RelayWA',url:siteUrl,publisher:{'@id':siteUrl+'/#organization'}},
    {'@type':'SoftwareApplication',name:'RelayWA',applicationCategory:'DeveloperApplication',operatingSystem:'Web',url:siteUrl,description:'WhatsApp REST API with isolated sessions and real-time webhooks'}
  ]};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><RelayHome/></>;
}
