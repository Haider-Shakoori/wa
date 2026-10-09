'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '../../lib/api';

type Provider={provider:string;enabled:boolean};
export default function CheckoutPage(){
 const [message,setMessage]=useState('Checking secure Stripe checkout availability…');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
   let alive=true;
   async function start(){
     try{
       const q=new URLSearchParams(location.search);
       const planCode=q.get('plan');
       const billingInterval=q.get('interval')==='annual'?'annual':'monthly';
       if(!planCode||!['starter','growth','plus','scale'].includes(planCode)){
         throw new Error('Please choose a subscription from the plans page.');
       }
       const token=localStorage.getItem('relaywa_access_token');
       if(!token){throw new Error('Please sign in before subscribing.');}
       const providers=await api<Provider[]>('/billing/providers',token);
       if(!providers.some(p=>p.provider==='stripe'&&p.enabled)){
         throw new Error('Secure Stripe checkout is not enabled yet. No payment has been made.');
       }
       if(!alive)return;
       setBusy(true);setMessage('Opening Stripe secure checkout…');
       const result=await api<{checkoutUrl:string}>('/billing/checkout/stripe',token,{
         method:'POST',body:JSON.stringify({planCode,billingInterval}),
       });
       const url=new URL(result.checkoutUrl);
       if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'){
         throw new Error('Unexpected checkout destination. Payment was not started.');
       }
       if(alive)location.assign(result.checkoutUrl);
     }catch(error){
       if(alive){setBusy(false);setMessage(error instanceof Error?error.message:'Unable to open secure checkout.');}
     }
   }
   void start();
   return()=>{alive=false;};
 },[]);
 return <main className="rw-checkout"><section className="rw-checkout-success">
   <h1>Secure subscription checkout</h1>
   <p role="status">{message}</p>
   <p>Card information is entered only on Stripe's hosted payment page, never on RelayWA.</p>
   {!busy&&<Link className="rw-button" href="/subscription">Return to subscription plans</Link>}
 </section></main>;
}
