from pathlib import Path
import json, csv, html, hashlib
from collections import defaultdict
import sys
root=Path(sys.argv[1])
out=Path(sys.argv[2])
a=root/'ArchitectureRepository'
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,s):
    p=out/p
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(s.rstrip()+'\n',encoding='utf-8')
def table(headers,rows):
    return '| '+' | '.join(headers)+' |\n| '+' | '.join(['---']*len(headers))+' |\n'+'\n'.join('| '+' | '.join(map(str,r))+' |' for r in rows)
def chart(file,title,subtitle,groups,series,maxval,unit):
    w=900; h=125+len(groups)*76; left=175; span=570
    colors=['#64748b','#087f8c','#d97706']
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img"><title>{html.escape(title)}</title><rect width="100%" height="100%" rx="12" fill="#f8fafc"/>']
    def t(x,y,s,size=14,color='#172b46',weight='normal'):
        parts.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{size}" fill="{color}" font-weight="{weight}">{html.escape(str(s))}</text>')
    t(24,30,title,22,weight='bold');t(24,53,subtitle,13)
    for j,name in enumerate(series):
        parts.append(f'<rect x="{24+j*250}" y="66" width="14" height="14" fill="{colors[j]}"/>');t(44+j*250,78,name,13)
    for i,(label,vals) in enumerate(groups):
        y=106+i*76;t(24,y+17,label,14,weight='bold')
        for j,v in enumerate(vals):
            yy=y+j*21; bw=v/maxval*span
            parts.append(f'<rect x="{left}" y="{yy}" width="{bw:.2f}" height="16" rx="2" fill="{colors[j]}"/>')
            t(left+bw+7,yy+13,f'{v:g}{unit}',12)
    parts.append('</svg>');write(file,'\n'.join(parts))
runs=['run-01','run-03','run-01','run-01']
rt=[]
for i,run in enumerate(runs,1):
    path=a/f'experiments/RT-{i}/{run}/results.json';j=load(path)
    def score(k):
        s=j['scores'][k];return s[-1] if isinstance(s,list) else s
    before=score('original');after=score('improved' if i<3 else 'reconstructed')
    rt.append(dict(id=f'RT-{i}',cases=j['cases'],before=before,after=after,optimization=i<3,evidence=str(path.relative_to(a)).replace('\\','/')))
live=[]
for name,label in [('live-committee-','Initial'),('live-deliberation-','Deliberation'),('live-typed-deliberation-','Typed'),('live-concise-deliberation-','Concise')]:
    p=next((a/'evidence/phase-I').glob(name+'*.json')); j=load(p); ts=j['telemetry']
    live.append(dict(label=label,passed=j['livePassed'],typed=j.get('typedAI'),calls=len(ts),prompt=sum(t['usage']['prompt_tokens'] for t in ts),completion=sum(t['usage']['completion_tokens'] for t in ts),ms=sum(t['elapsedMs'] for t in ts),evidence=str(p.relative_to(a)).replace('\\','/')))
pilots=sorted((a/'evidence/phase-I').glob('pilot-*.json')); p=load(pilots[0])
assert len(pilots)==2 and pilots[0].read_bytes()==pilots[1].read_bytes()
assert p['status']=='pilot-pass' and all(s['oracleMatch'] for s in p['subjects'])
bench=load(a/'experiments/RT-1/run-01/benchmark.json')
write('ArchitectureRepository/analytics/metrics.json',json.dumps({'roundtrip':rt,'live':live,'pilot':{'runs':len(pilots),'verificationCasesPerRun':p['verificationCases'],'discoveryCasesPerRun':p['discoveryCases'],'subjects':len(p['subjects']),'distinctIdentities':len(set(s['identity'] for s in p['subjects'])),'identicalEvidence':True,'evidence':[str(x.relative_to(a)).replace('\\','/') for x in pilots]},'rt1Benchmark':bench},indent=2))
for metric,title in [('cyclomatic','Cyclomatic complexity'),('campbell','Campbell cognitive complexity'),('mbcc','MikeVan Better Cognitive Complexity')]:
    chart(f'ArchitectureRepository/analytics/{metric}.svg',title,'Discount function: original versus final Python; lower is simpler.',[(r['id'],[r['before'][metric],r['after'][metric]]) for r in rt],['Original','Final'],max(r['before'][metric] for r in rt), '')
chart('ArchitectureRepository/analytics/tokens.svg','Local inference by qualification','Prompt and completion token counts; not external API charges.',[(x['label'],[x['prompt'],x['completion']]) for x in live],['Prompt','Completion'],max(max(x['prompt'],x['completion']) for x in live),'')
chart('ArchitectureRepository/analytics/latency.svg','Cumulative inference duration','Sum of invocation elapsed time, not end-to-end wall clock.',[(x['label'],[round(x['ms']/1000,1)]) for x in live],['Seconds'],max(x['ms']/1000 for x in live),' s')
chart('ArchitectureRepository/analytics/timing.svg','RT-1 local timing observation','Nine samples per implementation; 200,010 calls per sample.',[('Median',[bench['median_ms']['original'],bench['median_ms']['improved']])],['Original','Improved'],max(bench['median_ms'].values()),' ms')
rows=[]
for r in rt:
    rows.append([r['id'],f"{r['cases']:,}",'Explicit' if r['optimization'] else 'Disabled',*[f"{r['before'][k]} → {r['after'][k]}" for k in ['cyclomatic','campbell','mbcc']],f"[raw](../{r['evidence']})"])
lrows=[[x['label'],'Pass' if x['passed'] else 'Fail',str(x['typed']) if x['typed'] is not None else 'Not gated',x['calls'],x['prompt'],x['completion'],x['prompt']+x['completion'],f"{x['ms']/1000:.3f}",f"[raw](../{x['evidence']})"] for x in live]
write('ArchitectureRepository/analytics/README.md',f"""# Research analytics | Intellectus

Michael Van Geertruy — research originator. Derived analysis of preserved evidence, November 26, 2026.

## Round-trip experiments: behavior versus implementation

{table(['Trial','Oracle cases / implementation','Optimization','Cyclomatic','Campbell','MBCC','Evidence'],rows)}

![Cyclomatic complexity](cyclomatic.svg)

![Campbell cognitive complexity](campbell.svg)

![MBCC](mbcc.svg)

RT-1/RT-2 applied explicit equal-arm elimination. RT-3/RT-4 disabled it, preserving redundant structure. RT-1/RT-3 used representative samples of a large domain, not exhaustive enumeration; RT-2/RT-4 exhausted their 202 input pairs. Counts are per implementation, not unit-test counts. Complexity thresholds remain 15/12/15. These results refute the expectation that the existing representation implicitly optimizes these fixtures; they do not refute semantic abstraction as a research direction.

![Local RT-1 timing](timing.svg)

Median timing declined from {bench['median_ms']['original']} ms to {bench['median_ms']['improved']} ms ({(1-bench['median_ms']['improved']/bench['median_ms']['original'])*100:.1f}% lower). Small descriptive local sample; no generalized performance claim. [Raw samples](../experiments/RT-1/run-01/benchmark.json).

## Live committee qualification

{table(['Trial','Operational gate','Typed AI','Calls','Prompt','Completion','Total tokens','Seconds','Evidence'],lrows)}

![Token counts](tokens.svg)

![Inference duration](latency.svg)

The final concise trial: deterministic candidate verified over 25 input pairs in two languages; AI conceptual hypothesis contradicted, zero of two revision attempts corrected it; domain specialist abstained. No verified incremental conceptual or domain contribution. Operational pass is not semantic success. Initial and final passes use different gate definitions and are not directly comparable accuracy scores. Total tokens are local compute, not billed external API tokens. CPU/GPU and memory measurements were not retained in these records and are not estimated.

## P1/P2 deterministic pilot

{table(['Subject','Behavioral class','Candidate outcome'],[[s['name'],['A','B','C'][list(dict.fromkeys(x['identity'] for x in p['subjects'])).index(s['identity'])],s['verification']['status']] for s in p['subjects']])}

Four equivalent subjects, two distinct controls, three canonical identities. {p['verificationCases']} complete verification cases per run; {p['discoveryCases']} discovery observations per run; two byte-identical evidence records. The late control is distinguished only on held-out verification: (4,1) predicted 9, observed 10. No AI. This is an engineering pilot, not RT-5.

Evidence: [first run](../{str(pilots[0].relative_to(a)).replace(chr(92),'/')}) and [second run](../{str(pilots[1].relative_to(a)).replace(chr(92),'/')}).

## Measurement integrity

[Machine-readable derived metrics](metrics.json) | [Research curriculum](../research/Testing-Curriculum.md) | [Decision rationale](../research/Research-Decision-Register.md)

All chart values derive from preserved JSON; no synthetic results, success probabilities, or pooled case counts across unlike protocols. The benchmark and live trials are descriptive. Test-suite results are separate from research acceptance criteria.
""")