"""Render canonical Markdown sources to a static site using Python 3."""
from pathlib import Path
import html, re, shutil
root=Path(__file__).resolve().parent.parent
src=root/"ArchitectureRepository/ProjectDocumentation"
site=root/"public"
site.mkdir(parents=True,exist_ok=True)
docs={}
for p in sorted(src.glob("*.md")):
    first,body=p.read_text(encoding="utf-8").split("\n",1)
    docs[p.stem]=(first.removeprefix("# "),body.strip())
for p in src.iterdir():
    if p.suffix == ".csv":
        shutil.copy2(p,site/p.name)
    elif p.suffix == ".svg":
        theme = (src/"theme/theme.css").read_text()
        chart = (src/"theme/charts.css").read_text()
        svg = re.sub(r"<style>.*?</style>", "", p.read_text(), flags=re.S)
        pos = svg.index(">") + 1
        (site/p.name).write_text(svg[:pos]+"<style>"+theme+chart+"</style>"+svg[pos:])
shutil.copytree(src/"theme",site/"theme",dirs_exist_ok=True)
def inline(s):
    s=html.escape(s)
    def link(m):
        label,href=m.groups(); href=href.replace(".md",".html")
        if href.endswith(".svg"):return f'<figure><img src="{href}" alt="{label}"/><figcaption>{label}</figcaption></figure>'
        return f'<a href="{href}">{label}</a>'
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)',link,s)
def render(body):
    out=[];lines=body.splitlines();i=0
    while i<len(lines):
        l=lines[i];i+=1
        if not l.strip():continue
        if l.startswith("#"):
            n=len(l)-len(l.lstrip("#"));n=min(n+1,6);out.append(f"<h{n}>{inline(l.lstrip('# '))}</h{n}>")
        elif l.startswith("|"):
            rows=[l]
            while i<len(lines) and lines[i].startswith("|"):rows.append(lines[i]);i+=1
            out.append('<div class="table-wrap"><table>')
            for j,row in enumerate(rows):
                cells=[c.strip() for c in row.strip("|").split("|")]
                if all(re.fullmatch(r'[:\- ]+',c) for c in cells):continue
                tag="th" if j==0 else "td";out.append("<tr>"+"".join(f"<{tag}>{inline(c)}</{tag}>" for c in cells)+"</tr>")
            out.append("</table></div>")
        elif re.match(r'^(- |\d+\. )',l):
            ordered=not l.startswith("- ");tag="ol" if ordered else "ul";out.append(f"<{tag}>")
            while True:
                out.append("<li>"+inline(re.sub(r'^(- |\d+\. )','',l))+"</li>")
                if i>=len(lines) or not re.match(r'^\d+\. ' if ordered else r'^- ',lines[i]):break
                l=lines[i];i+=1
            out.append(f"</{tag}>")
        else:
            x=inline(l);out.append(x if x.startswith("<figure>") else "<p>"+x+"</p>")
    return "\n".join(out)
nav=[("index","Home"),("projects","Projects"),("get-started","Get Started"),("documentation","Documentation"),("research","Research"),("archive","Architecture Repository"),("analytics","Analytics"),("downloads","Downloads"),("community","Community")]
(site/"style.css").write_text('@import url("theme/theme.css");\n@import url("theme/layout.css");\n@import url("theme/components.css");\n@import url("theme/charts.css");\n')
for slug,(title,body) in docs.items():
    links=" ".join(f'<a href="{s}.html"'+(' aria-current="page"' if s==slug else '')+f'>{l}</a>' for s,l in nav)
    foot=" · ".join(f'<a href="{s}.html">{l}</a>' for s,l in [("charter","Charter"),("standards","Standards"),("testing","Validation"),("glossary","Glossary")])
    banner='<div class="review">Documentation preview — November 26, 2026. Review historical evidence before public release.</div>'
    headline=f'<div class="hero"><h1>{html.escape(title)}</h1><p>Semantic understanding beyond implementation.</p></div>' if slug=="index" else f'<h1>{html.escape(title)}</h1>'
    (site/(slug+".html")).write_text(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)} | Intellectus</title><link rel="stylesheet" href="style.css"></head><body><header><div class="brand"><img src="theme/intellectus.png" alt="Intellectus semantic modelling logo"/><div><strong>INTELLECTUS</strong><p>Independent open-source research</p></div></div><nav aria-label="Main navigation">{links}</nav></header><main>{banner}{headline}{render(body)}</main><footer>{foot}<p>Intellectus · Research · Engineering · Community</p></footer></body></html>')

# Build a browsable generated copy of the single canonical repository.
from urllib.parse import quote
archive = site / "ArchitectureRepository"
shutil.copytree(root / "ArchitectureRepository", archive, dirs_exist_ok=True)
entries = []
for p in sorted(archive.rglob("*")):
    if p.is_file():
        rel = p.relative_to(archive).as_posix()
        entries.append('<li><a href="ArchitectureRepository/'+quote(rel)+'">'+html.escape(rel)+'</a></li>')
(site/"archive.html").write_text('<!doctype html><html lang="en"><meta charset="utf-8"><title>Architecture Repository</title><link rel="stylesheet" href="style.css"><main><p><a href="index.html">Home</a></p><h1>Architecture Repository</h1><p>Original records and source documents.</p><ul>'+''.join(entries)+'</ul></main></html>', encoding="utf-8")
