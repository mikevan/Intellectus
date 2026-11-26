import {investigateFixture} from './committee.mjs';
import {reconcile,normalizeHypothesis} from './reconciliation.mjs';
import {observeFixture} from './observation.mjs';
// Adapter for the existing single-string Colibri response contract.
// An optional structured candidate is sent inside that string as JSON.
// A plain-text response is retained without constructing a mathematical claim.
export async function investigateAndReconcile(c,options={}){
 const hypotheses=[];
 const wrap=(role,port)=>port?async input=>{
  const response=await port({...input,requestedHypothesisFormat:{hypothesis:'string',candidate:{type:'affine-integer-v1',intercept:'decimal integer string',coefficients:'decimal integer strings in input order'},candidateOptional:true}});
  let parsed;try{parsed=JSON.parse(response.hypothesis);}catch{}
  const normalized=normalizeHypothesis(c,role,parsed&&typeof parsed.hypothesis==='string'?parsed:response);
  hypotheses.push({...normalized,rawHypothesis:response.hypothesis});
  return response;
 }:undefined;
 const result=await investigateFixture(c,{...options,conceptual:wrap('conceptual',options.conceptual),domain:wrap('domain',options.domain)});
 const math=result.initial.find(p=>p.role==='mathematical');
 const packets=[...hypotheses];
 if(math)packets.push({role:'mathematical',...math.body});
 if(!result.enabled.includes('skeptic'))return {result,deliberation:null,hypotheses:packets};
 // Reacquire full, independent evidence; do not feed these observations to the model.
 const full=['python','typescript'].map(language=>observeFixture(language,c));
 return {result,deliberation:reconcile(c,packets,full),hypotheses:packets};
}
