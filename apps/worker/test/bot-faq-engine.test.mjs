import test from 'node:test';
import assert from 'node:assert/strict';
import { decideBotReply, validateBot } from '../src/bot/faq-engine.js';

const bot = { id:'bot_1', tenantId:'tenant_1', sessionId:'session_1',
  enabled:true, mode:'active', faqs:[{id:'faq_1',question:'Working hours?',answer:'8 AM to 9 PM',aliases:['hours']}],
};
const event = {tenantId:'tenant_1',sessionId:'session_1',messageId:'wa_msg_1',
  direction:'inbound', type:'text', text:' Working HOURS?? '};
const evaluate = (changes={}, opts={}) =>
  decideBotReply({bot:{...bot,...opts},event:{...event,...changes}});
test('matching approved FAQ alias returns deterministic answer',()=>{
  assert.deepEqual(evaluate(),{action:'reply',faqId:'faq_1',messageId:'wa_msg_1',text:'8 AM to 9 PM'});
});
test('tenant and session isolation prevent cross-account replies',()=>{
  for(const change of [{tenantId:'tenant_2'},{sessionId:'session_2'}])
    assert.equal(evaluate(change).reason,'ownership_mismatch');
});
test('disabled and standby bots never answer',()=>{
  assert.equal(evaluate({}, {enabled:false}).reason,'disabled');
  assert.equal(evaluate({}, {mode:'standby'}).reason,'disabled');
});
test('outbound, own and group messages are ignored',()=>{
  for(const change of [{direction:'outbound'},{fromMe:true},{isGroup:true}])
    assert.equal(evaluate(change).reason,'not_customer_inbound');
});
test('duplicate message protection',()=>{
  assert.equal(decideBotReply({bot,event,processedIds:new Set(['wa_msg_1'])}).reason,'duplicate_or_invalid_message');
});
test('human takeover always prevents bot reply',()=>{
  assert.equal(decideBotReply({bot,event,conversation:{humanTakeover:true}}).reason,'human_takeover');
});
test('human request is handoff rather than automated answer',()=>{
  assert.equal(evaluate({text:'agent'}).action,'handoff');
});
test('unknown questions do not cause invented responses',()=>{
  assert.equal(evaluate({text:'Do you have medicine X?'}).action,'unmatched');
});
test('non-text messages ignored safely',()=>{
  assert.equal(evaluate({type:'image',text:undefined}).reason,'unsupported_message_type');
});
test('reject malformed bot data',()=>{
  assert.throws(()=>validateBot({...bot,tenantId:'../../secret'}));
  assert.throws(()=>validateBot({...bot,faqs:[{id:'f',question:'Q',answer:''}]}));
});
test('Dari and Pashto Arabic-character normalization',()=>{
  const b={...bot,faqs:[{id:'faq_2',question:'ساعات کاری',answer:'۸ تا ۹'}]};
  assert.equal(decideBotReply({bot:b,event:{...event,text:'ساعات كاري'}}).action,'reply');
});
