import fs from 'node:fs';

const src=fs.readFileSync(new URL('../cloud/src/providers/vusic.js',import.meta.url),'utf8');
const fail=m=>{throw new Error(m)};

if(src.includes('[...target.options]'))fail('Unsafe spread of target.options is forbidden; custom Vusic controls may not be native selects.');
if(!src.includes("isSelect=e=>!!e&&String(e.tagName||'').toLowerCase()==='select'"))fail('Vusic native-select guard is missing.');
if(!src.includes('Array.from(target.options||[])'))fail('Vusic select options must use a null-safe conversion.');
if(!src.includes("if(!isSelect(target))return''"))fail('Vusic custom controls must fall back instead of entering native select logic.');
if(!src.includes("chooseText(page,values,label,{optional:true})"))fail('Custom-select click fallback is missing.');
if(!src.includes("code:'VUSIC_STAGE_BLOCKED'"))fail('Wizard stage-advance protection is missing.');
if(!src.includes('confirmSubmit!==true'))fail('Final release must remain explicitly gated.');

console.log('Vusic browser contract self-test: PASS');
