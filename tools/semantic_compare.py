#!/usr/bin/env python3
"""
Semantic comparator for TRL files by move key (mover|from|to).
Produces a CSV report with per-key categories and a human-readable summary.

Usage:
  python3 tools/semantic_compare.py <new.trl> <ref.trl> [out.csv]

"""
import sys
import re
from collections import Counter


def parse_moves(file):
    moves = {}
    with open(file, 'r', encoding='utf-8') as f:
        for line in f:
            line=line.strip()
            if not line.startswith('Move=[Move:'): continue
            m=re.search(r'mover=(\d+),from=(\d+),to=(\d+),actions=(.*)\]$', line)
            if not m:
                m=re.search(r'mover=(\d+),from=(\d+),to=(\d+),actions=(.*)\]', line)
            if not m: continue
            key=f"{m.group(1)}|{m.group(2)}|{m.group(3)}"
            actions_raw=m.group(4)
            toks=re.split(r'\],\[', actions_raw)
            toks_clean=[]
            for t in toks:
                t=t.strip()
                t=t.lstrip('[').rstrip(']')
                toks_clean.append(t)
            moves[key]=toks_clean
    return moves


def semantics_from_actions(toks):
    sem={}
    sem['promotion']=None
    sem['capturedPiece']=None
    sem['isCapture']=False
    sem['enPassantSet']=False
    sem['enPassantReset']=False
    sem['setScore_add']=False
    sem['setState']=False
    sem['notes']=[]
    sem['levelTo']=False
    for t in toks:
        if t.startswith('Promote:') or t.startswith('Promote'):
            m=re.search(r'what=(\d+)', t)
            sem['promotion']=int(m.group(1)) if m else True
        if 'CapturedPiece' in t:
            m=re.search(r'value=(\d+)', t)
            if m:
                sem['capturedPiece']=int(m.group(1))
                sem['isCapture']=True
        if 'Note:message=' in t and 'captured' in t:
            sem['isCapture']=True
        if 'EnPassantLocation' in t or 'SetPending' in t:
            m=re.search(r'value=(-?\d+)', t)
            if m:
                v=int(m.group(1))
                if v==-1:
                    sem['enPassantReset']=True
                else:
                    sem['enPassantSet']=True
            else:
                sem['enPassantSet']=True
        # Robustly detect SetScore tokens with score=1 and add=true
        # Parse token into a type and attribute map, e.g. 'SetScore:player=2,score=1,add=true'
        typ = t.split(':', 1)[0] if ':' in t else t
        rest = t.split(':', 1)[1] if ':' in t else ''
        attrs = {}
        if rest:
            parts = [p.strip() for p in rest.split(',') if p.strip()]
            for p in parts:
                if '=' in p:
                    k, v = p.split('=', 1)
                    attrs[k.strip()] = v.strip()
        if typ.startswith('SetScore') or typ == 'SetScore':
            score_val = attrs.get('score', '')
            add_val = attrs.get('add', '').lower()
            if score_val == '1' and add_val == 'true':
                sem['setScore_add'] = True
        if t.startswith('SetState:') or 'SetState' in t:
            sem['setState']=True
        if t.startswith('Note:'):
            m=re.search(r'message=([^,]+)', t)
            if m:
                sem['notes'].append(m.group(1).strip())
        if 'levelTo=0' in t:
            sem['levelTo']=True
    sem['notes']=sorted(set(sem['notes']))
    return sem


def categorize(a_actions, b_actions):
    if a_actions is None or b_actions is None:
        return 'missing_key', None, None
    sa=semantics_from_actions(a_actions)
    sb=semantics_from_actions(b_actions)
    if sa==sb:
        return 'semantic_match', sa, sb
    diff_cats=[]
    if sa['promotion']!=sb['promotion']:
        diff_cats.append('promotion')
    if sa['isCapture']!=sb['isCapture'] or sa['capturedPiece']!=sb['capturedPiece']:
        diff_cats.append('capture')
    # Only consider differences where an EnPassant target is set (non -1).
    # Ignore mere presence/absence of an explicit reset (-1) which can be ordering-dependent.
    if sa['enPassantSet']!=sb['enPassantSet']:
        diff_cats.append('enpassant')
    if sa['setScore_add']!=sb['setScore_add']:
        diff_cats.append('setscore_add')
    if sa['setState']!=sb['setState']:
        diff_cats.append('setstate')
    if sa['levelTo']!=sb['levelTo']:
        diff_cats.append('levelTo')
    if sa['notes']!=sb['notes']:
        diff_cats.append('notes')
    if not diff_cats:
        diff_cats=['other']
    return ','.join(diff_cats), sa, sb


def main(argv):
    if len(argv) < 3:
        print('Usage: tools/semantic_compare.py <new.trl> <ref.trl> [out.csv]')
        return 2
    newfile = argv[1]
    reffile = argv[2]
    outcsv = argv[3] if len(argv) > 3 else 'semantic_report.csv'

    m1=parse_moves(newfile)
    m2=parse_moves(reffile)
    all_keys=sorted(set(m1.keys())|set(m2.keys()))

    counts=Counter()
    rows=[]
    for k in all_keys:
        a=m1.get(k)
        b=m2.get(k)
        cat,sa,sb = categorize(a,b)
        counts[cat]+=1
        rows.append((k,cat,sa,sb))

    # write CSV
    with open(outcsv,'w',encoding='utf-8') as out:
        out.write('key,category,details_new,details_ref\n')
        for k,cat,sa,sb in rows:
            out.write(f'"{k}","{cat}","{sa}","{sb}"\n')

    # print summary
    print('Total move keys:', len(all_keys))
    print('Parsed moves: new=', len(m1), ' ref=', len(m2))
    print('\nSemantic comparison summary:')
    for k,v in counts.most_common():
        print(f'{k}: {v}')

    print(f'CSV report written to: {outcsv}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
