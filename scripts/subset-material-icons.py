from fontTools.ttLib import TTFont
from fontTools import subset
from pathlib import Path
import re
import sys
if len(sys.argv) != 2: raise SystemExit('Usage: python scripts/subset-material-icons.py /path/to/MaterialSymbolsRounded.woff2')
font=TTFont(sys.argv[1])
corpus=' '.join(p.read_text() for folder in ['src','shared','osbb','sklad'] for p in Path(folder).glob('*') if p.suffix in ['.js','.ts','.html','.css'])+Path('index.html').read_text()
words=set(re.findall(r'[a-z][a-z0-9_]+',corpus));cmap=font.getBestCmap();rev={v:chr(k) for k,v in cmap.items()};kept=[]
for lookup in font['GSUB'].table.LookupList.Lookup:
 for table in lookup.SubTable:
  if hasattr(table, 'ExtSubTable'): table = table.ExtSubTable
  if not hasattr(table,'ligatures'):continue
  for first,ligs in list(table.ligatures.items()):
   selected=[l for l in ligs if ''.join(rev.get(g,'') for g in [first]+l.Component) in words]
   kept.extend(l.LigGlyph for l in selected)
   if selected:table.ligatures[first]=selected
   else:del table.ligatures[first]
opt=subset.Options();opt.flavor='woff2';sub=subset.Subsetter(options=opt);sub.populate(text='abcdefghijklmnopqrstuvwxyz0123456789_',glyphs=kept);sub.subset(font);font.flavor='woff2';font.save('shared/fonts/material-symbols-rounded.woff2');print('icons',len(kept),'bytes',Path('shared/fonts/material-symbols-rounded.woff2').stat().st_size)
