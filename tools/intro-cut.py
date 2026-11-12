# Cuts the filmed frames to length per step and lays the titles over them.
# python3 tools/intro-cut.py <framesDir> <titlesDir> <out-with-titles.mp4> <out-clean.mp4>
import json, os, shutil, subprocess, sys

src, titles, out, clean = sys.argv[1:5]
cues = {c['name']: c['frame'] for c in json.load(open(f'{src}/cues.json'))}
# per step: which of its frames to keep (seconds from its start or, negative, before its end)
order = ['car', 'pickup', 'clock', 'drop', 'police', 'rise', 'top', 'end']
keep = {'car': (0, 3.7), 'pickup': (-3.4, None), 'clock': (0, 2.8), 'drop': (-3.6, None), 'police': (0, 3.2), 'rise': (0, None), 'top': (0, None)}
seq = f'{src}-cut'
shutil.rmtree(seq, ignore_errors=True)
os.makedirs(seq)
n = 0
at = {}
for i, name in enumerate(order[:-1]):
    a, b = cues[name], cues[order[i + 1]]
    lo, hi = keep[name]
    first = max(a, b + round(lo * 30)) if lo < 0 else a + round(lo * 30)
    last = b if hi is None else min(b, a + round(hi * 30))
    at[name] = n / 30
    for f in range(first, last):
        os.link(f'{src}/{f:05d}.jpg', f'{seq}/{n:05d}.jpg')
        n += 1
total = n / 30
at['endT'] = total
print('seconds', round(total, 2), {k: round(v, 2) for k, v in at.items()})

enc = ['-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', f'{seq}/%05d.jpg', *enc, clean], check=True)

# title, from, to
shows = [('hook', 0.15, 1.75), ('car', 1.85, at['pickup']), ('pickup', at['pickup'], at['clock']), ('clock', at['clock'], at['drop']), ('drop', at['drop'], at['police']),
         ('police', at['police'], at['rise'] + 0.3), ('ask', at['rise'] + 1.6, total), ('end', at['top'] + 0.5, total)]
cmd = ['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', f'{seq}/%05d.jpg']
graph = []
prev = '0:v'
for k, (name, a, b) in enumerate(shows, 1):
    cmd += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', f'{titles}/{name}.png']
    a += 0.06
    b -= 0.06
    fade_out = '' if b >= total - 0.2 else f',fade=out:st={b - 0.22:.3f}:d=0.22:alpha=1'
    graph.append(f'[{k}:v]format=rgba,fade=in:st={a:.3f}:d=0.22:alpha=1{fade_out}[t{k}]')
    graph.append(f"[{prev}][t{k}]overlay=enable='between(t,{a:.3f},{b:.3f})'[v{k}]")
    prev = f'v{k}'
cmd += ['-filter_complex', ';'.join(graph), '-map', f'[{prev}]', '-t', f'{total:.3f}', *enc, out]
subprocess.run(cmd, check=True)
