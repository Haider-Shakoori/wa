import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const bot=read('../src/bots/bots.service.ts');
const stripe=read('../src/payments/stripe.provider.ts');
const controller=read('../src/payments/payments.controller.ts');
test('Bot Builder uses existing Stripe provider and configured mode',()=>{
 assert.match(bot,/this.stripe.isLiveMode\(\)/);
 assert.match(bot,/this.stripe.createBotAddonCheckout/);
 assert.match(stripe,/STRIPE_SECRET_KEY/);
 assert.match(stripe,/STRIPE_WEBHOOK_SECRET/);
});
test('Bot Builder respects existing Stripe enable switch',()=>{
 assert.match(bot,/SELECT enabled FROM payment_provider_settings WHERE provider='stripe'/);
 assert.match(bot,/Stripe payments are currently disabled/);
});
test('single existing signed webhook handles bot add-on and core payments',()=>{
 assert.match(controller,/@Post\('stripe\/webhook'\)/);
 assert.match(controller,/this.stripe.constructEvent\(request.rawBody, signature\)/);
 assert.match(controller,/this.bots.handleStripeEvent\(event\)/);
 assert.match(controller,/this.payments.handleStripeEvent\(event\)/);
});
