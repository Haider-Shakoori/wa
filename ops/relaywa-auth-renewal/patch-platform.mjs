// Fail closed: patch only verified parts of the deployed Cloudflare platform Worker.
function replaceOne(s,a,b){if(s.split(a).length!==2)throw Error('Production layout changed: '+a.slice(0,80));return s.replace(a,b)}
export function patchPlatform(s){
 const begin='async function issuePlatformTokens(req,env,u,m) {';
 const end='async function whoami(env, auth) {';
 const i=s.indexOf(begin),j=s.indexOf(end,i);
 if(i<0||j<i)throw Error('Token issuer missing');
 let part=s.slice(i,j);
 part=replaceOne(part,'  const expiresIn = Number(env.JWT_EXPIRES_SECONDS || 3600);',
  '  const expiresIn = 3600;\n  const sessionSeconds = 604800; // Seven-day absolute maximum; not extended.');
 part=replaceOne(part,'[sid, u.id, m.organization_id, "password", ip || null, ua || null, expiresIn]',
  '[sid, u.id, m.organization_id, "password", ip || null, ua || null, sessionSeconds]');
 part=replaceOne(part,'  return json({','  const response = json({');
 part=replaceOne(part,'    nextPath: "/platform"\n  });\n}',
  [
   '    nextPath: "/platform"',
   '  });',
   '  const refresh=await jwtSign(env.PLATFORM_JWT_SECRET,{sub:u.id,sid,org:m.organization_id,',
   '    ver:u.token_version|0,scope:"platform_refresh",iss:"https://platform.relaywa.com",aud:"relaywa-platform"},sessionSeconds);',
   '  response.headers.append("Set-Cookie","rw_admin_refresh="+refresh+"; Max-Age="+sessionSeconds+"; Path=/api/auth; Secure; HttpOnly; SameSite=Strict");',
   '  return response;',
   '}'
  ].join('\n'));
 s=s.slice(0,i)+part+s.slice(j);
 const functions=[
'// RELAYWA_SECURE_SESSION_RENEWAL_V1',
'function rwCookie(req){let x=(req.headers.get("cookie")||"").split(";").map(s=>s.trim()).find(s=>s.startsWith("rw_admin_refresh="));return x?x.slice(17):"";}',
'function rwClear(res){res.headers.append("Set-Cookie","rw_admin_refresh=; Max-Age=0; Path=/api/auth; Secure; HttpOnly; SameSite=Strict");return res;}',
'function rwOrigin(req){return req.headers.get("origin")==="https://platform.relaywa.com"&&(!req.headers.get("sec-fetch-site")||req.headers.get("sec-fetch-site")==="same-origin");}',
'async function rwRenew(req,env){',
' if(!rwOrigin(req))return fail(403,"Invalid origin");',
' const jwt=rwCookie(req);const payload=jwt?await jwtVerify(env.PLATFORM_JWT_SECRET,jwt):null;',
' if(!payload||payload.scope!=="platform_refresh"||!payload.sub||!payload.sid||!payload.org)return rwClear(fail(401,"Session expired"));',
' const user=await one(env.DB,"SELECT id,email,is_platform_admin,platform_role,token_version,disabled_at FROM users WHERE id=? LIMIT 1",[payload.sub]);',
' if(!user||!user.is_platform_admin||user.disabled_at||(user.token_version|0)!==(payload.ver|0))return rwClear(fail(401,"Session revoked"));',
' const login=await one(env.DB,"SELECT id FROM user_login_sessions WHERE id=? AND user_id=? AND organization_id=? AND revoked_at IS NULL AND datetime(expires_at)>datetime(\'now\') LIMIT 1",[payload.sid,user.id,payload.org]);',
' if(!login)return rwClear(fail(401,"Session expired"));',
' const member=await one(env.DB,"SELECT m.id,m.organization_id FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id AND o.suspended_at IS NULL WHERE m.user_id=? AND m.organization_id=? AND m.status=\'active\' LIMIT 1",[user.id,payload.org]);',
' if(!member)return rwClear(fail(401,"Membership inactive"));',
' const seconds=Math.min(3600,Math.floor(payload.exp-Date.now()/1000));if(seconds<30)return rwClear(fail(401,"Session expired"));',
' const accessToken=await jwtSign(env.PLATFORM_JWT_SECRET,{sub:user.id,email:user.email,org:member.organization_id,membership:member.id,sid:payload.sid,ver:user.token_version|0,scope:"platform",iss:"https://platform.relaywa.com",aud:"relaywa-platform",role:user.platform_role||"super_admin"},seconds);',
' return json({accessToken,tokenType:"Bearer",expiresIn:seconds});',
'}',
'async function rwLogout(req,env){',
' if(!rwOrigin(req))return fail(403,"Invalid origin");',
' const raw=rwCookie(req);const payload=raw?await jwtVerify(env.PLATFORM_JWT_SECRET,raw):null;',
' if(payload&&payload.scope==="platform_refresh"&&payload.sid&&payload.sub)await run(env.DB,"UPDATE user_login_sessions SET revoked_at=datetime(\'now\') WHERE id=? AND user_id=? AND revoked_at IS NULL",[payload.sid,payload.sub]);',
' return rwClear(json({signedOut:true}));',
'}'
 ].join('\n')+'\n';
 s=replaceOne(s,begin,functions+begin);
 const route='      if (p === "/api/auth/me" && req.method === "GET") {';
 s=replaceOne(s,route,
  '      if(p==="/api/auth/refresh"&&req.method==="POST")return withCors(req,await rwRenew(req,env));\n'+
  '      if(p==="/api/auth/logout"&&req.method==="POST")return withCors(req,await rwLogout(req,env));\n'+route);
 return s;
}
