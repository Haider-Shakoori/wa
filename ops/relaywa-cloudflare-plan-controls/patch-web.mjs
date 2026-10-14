// Minimal, fail-closed modifications of the deployed Vinext platform page asset.
// Do not rebuild the website Worker from an older Next-only source checkout.
const replaceAllRequired=(src,oldValue,newValue,label)=>{
  if(!src.includes(oldValue))throw Error('Live website bundle changed unexpectedly: '+label);
  return src.split(oldValue).join(newValue);
};
export function patchWebsitePage(original,includeButtons=true){
  let src=String(original);
  if(!src.includes('Save website plan')||!src.includes('Website subscription catalog'))throw Error('Not the platform subscriptions page');
  src=replaceAllRequired(src,
    'disabled:D||T.trim().length<8,children:D?',
    'disabled:D,children:D?','unexplained disabled save button');
  src=replaceAllRequired(src,
    'else if(T.trim().length<8)k(`Enter an audit reason of at least 8 characters.`);else{',
    'else{','empty audit reason submit branch');
  src=replaceAllRequired(src,
    'required:!0,placeholder:`Example: Updated public website pricing for the new tier`',
    'required:!1,placeholder:`Optional: explain why the plan is being changed`',
    'audit reason placeholder');
  src=replaceAllRequired(src,
    'reason:T.trim()})',
    'reason:T.trim()||`Website plan updated from platform dashboard`})',
    'audit reason fallback');

  const edit='r&&e.code!==`trial`&&(0,c.jsx)(`button`,{type:`button`,className:`secondary-button website-plan-edit-btn`,onClick:()=>d(e.code),children:`Edit plan`})';
  const availability=`(0,c.jsx)(\`button\`,{type:\`button\`,className:\`secondary-button\`,onClick:async()=>{let reason=window.prompt((e.available_for_purchase===0?\`Enable\`:\`Disable\`)+\` new purchases for \`+e.name+\`. Enter an audit reason (8+ characters):\`);if(reason===null)return;if(reason.trim().length<8){window.alert(\`Enter at least eight characters.\`);return}if(!window.confirm(\`Continue? Existing subscribers retain access.\`))return;try{let res=await fetch(\`/api/platform/website-plans/\`+encodeURIComponent(e.code)+\`/availability\`,{method:\`PATCH\`,headers:{authorization:\`Bearer \`+n,["content-type"]:\`application/json\`},body:JSON.stringify({availableForPurchase:e.available_for_purchase===0,reason:reason.trim()})});let saved=await res.json();if(!res.ok)throw Error(saved.message||\`Unable to change availability\`);await i(saved)}catch(err){window.alert(err instanceof Error?err.message:\`Unable to change plan availability\`)}},children:e.available_for_purchase===0?\`Enable new purchases\`:\`Disable new purchases\`})`;
  const deletion=`(0,c.jsx)(\`button\`,{type:\`button\`,className:\`secondary-button\`,onClick:async()=>{let code=window.prompt(\`Type \`+e.code+\` to permanently delete this unused plan:\`);if(code===null)return;if(code.trim()!==e.code){window.alert(\`Plan code mismatch\`);return}let reason=window.prompt(\`Reason for deletion (8+ characters):\`);if(reason===null)return;if(reason.trim().length<8){window.alert(\`Enter at least eight characters.\`);return}if(!window.confirm(\`Delete \`+e.name+\` permanently? Plans with subscribers cannot be deleted.\`))return;try{let res=await fetch(\`/api/platform/website-plans/\`+encodeURIComponent(e.code),{method:\`DELETE\`,headers:{authorization:\`Bearer \`+n,["content-type"]:\`application/json\`},body:JSON.stringify({reason:reason.trim()})});let body=await res.json();if(!res.ok)throw Error(body.message||\`Unable to delete this plan\`);window.location.reload()}catch(err){window.alert(err instanceof Error?err.message:\`Unable to delete this plan\`)}},children:\`Delete unused plan\`})`;
  const wrapped='r&&e.code!==`trial`&&(0,c.jsxs)(c.Fragment,{children:['+edit.slice('r&&e.code!==`trial`&&'.length)+','+availability+','+deletion+']})';
  if(includeButtons)src=replaceAllRequired(src,edit,wrapped,'existing plan edit action');
  return src;
}
