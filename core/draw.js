// core/draw.js

const DrawEngine = {
    NS: 'http://www.w3.org/2000/svg',

    create(tag, attrs = {}) {
        const e = document.createElementNS(this.NS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        return e;
    },

    render(block) {
        const fig = document.createElement('figure');
        fig.className = 'fig';
        const w = parseInt(block.params.width) || 480;
        const h = parseInt(block.params.height) || 260;
        const svg = this.create('svg', {
            viewBox: `0 0 ${w} ${h}`,
            preserveAspectRatio: 'xMidYMid meet'
        });
        svg.style.maxWidth = w + 'px';
        const lines = block.body.split('\n');
        for (const line of lines) {
            const t = line.trim();
            if (!t || t.startsWith('#')) continue;
            this.exec(svg, t);
        }
        fig.appendChild(svg);
        if (block.params.caption) {
            const cap = document.createElement('figcaption');
            cap.innerHTML = Utils.formatInline(block.params.caption);
            fig.appendChild(cap);
        }
        return fig;
    },

    exec(svg, line) {
        const m = line.match(/^(\w+)(?:\[([^\]]*)\])?:\s*(.*)/);
        if (!m) return;
        const cmd = m[1], color = (m[2] || 'ink').trim(), argsStr = m[3] || '';
        const parts = argsStr.split('|').map(s => s.trim());
        const main = parts[0];
        const params = this.parseParams(parts.slice(1));
        const fn = this['cmd_' + cmd];
        if (fn) fn.call(this, svg, color, main, params);
    },

    parseParams(parts) {
        const p = {};
        parts.forEach(part => {
            const kv = part.match(/^(\w+)\s*:\s*(.+)/);
            if (kv) p[kv[1]] = kv[2].trim();
        });
        return p;
    },

    parsePoint(s) { const [x, y] = s.split(',').map(parseFloat); return [x, y]; },

    parseLine(s) {
        const [from, to] = s.split('->').map(p => p.trim());
        const [x1, y1] = this.parsePoint(from);
        const [x2, y2] = this.parsePoint(to);
        return { x1, y1, x2, y2 };
    },

    cmd_line(svg, color, args, p) {
        const { x1, y1, x2, y2 } = this.parseLine(args);
        let cls = 'st ' + color;
        if (p.dash) cls += ' dash';
        if (p.thin) cls += ' thin';
        svg.appendChild(this.create('line', { x1, y1, x2, y2, class: cls }));
    },

    cmd_arrow(svg, color, args, p) {
        const { x1, y1, x2, y2 } = this.parseLine(args);
        svg.appendChild(this.create('line', {
            x1, y1, x2, y2, class: 'st ' + color,
            'marker-end': `url(#t-${color})`
        }));
        if (p.label) {
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const ox = -dy / len * 14, oy = dx / len * 14;
            this.addText(svg, p.label, mx + ox, my + oy, color);
        }
    },

    cmd_dot(svg, color, args, p) {
        const [x, y] = this.parsePoint(args);
        const r = parseFloat(p.r) || 4;
        svg.appendChild(this.create('circle', {
            cx: x, cy: y, r, fill: `var(--${color})`, stroke: 'none'
        }));
        if (p.label) this.addText(svg, p.label, x + 10, y - 8, color, { anchor: 'start' });
    },

    cmd_circle(svg, color, args, p) {
        const [cx, cy, r] = args.split(',').map(parseFloat);
        svg.appendChild(this.create('circle', {
            cx, cy, r, class: 'st ' + color,
            fill: p.fill === 'panel' ? 'var(--panel)' : p.fill || 'none'
        }));
    },

    cmd_rect(svg, color, args, p) {
        const { x1, y1, x2, y2 } = this.parseLine(args);
        const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
        const x = Math.min(x1, x2), y = Math.min(y1, y2);
        svg.appendChild(this.create('rect', {
            x, y, width: w, height: h, rx: p.rx || 0, class: 'st ' + color,
            fill: p.fill === 'panel' ? 'var(--panel)' : p.fill === 'hatch' ? 'url(#hatch)' : p.fill || 'var(--bg)'
        }));
    },

    cmd_path(svg, color, args, p) {
        let cls = 'st ' + color;
        if (p.dash) cls += ' dash';
        const el = this.create('path', { d: args, class: cls, fill: p.fill || 'none' });
        if (p.arrow) el.setAttribute('marker-end', `url(#t-${color})`);
        svg.appendChild(el);
    },

    cmd_arc(svg, color, args, p) {
        const [cx, cy, r, a1, a2] = args.split(',').map(parseFloat);
        const rad1 = a1 * Math.PI / 180, rad2 = a2 * Math.PI / 180;
        const x1 = cx + r * Math.cos(rad1), y1 = cy - r * Math.sin(rad1);
        const x2 = cx + r * Math.cos(rad2), y2 = cy - r * Math.sin(rad2);
        const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
        svg.appendChild(this.create('path', {
            d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`,
            class: 'st ' + color, fill: 'none'
        }));
    },

    cmd_text(svg, color, args, p) {
        const parts = args.match(/^([\d.]+)\s*,\s*([\d.]+)\s+(.*)/);
        if (!parts) return;
        this.addText(svg, parts[3], parseFloat(parts[1]), parseFloat(parts[2]), color, {
            anchor: p.anchor || 'middle', size: parseFloat(p.size) || 13.5
        });
    },

    cmd_axis(svg, color, args, p) {
        const { x1, y1, x2, y2 } = this.parseLine(args);
        svg.appendChild(this.create('line', {
            x1, y1, x2, y2, class: 'st mut', 'marker-end': 'url(#t-mut)'
        }));
        if (p.label) {
            const dx = x2 - x1, dy = y2 - y1;
            const lx = x2 + (dx > 0 ? 12 : dx < 0 ? -8 : 0);
            const ly = y2 + (dy > 0 ? 14 : dy < 0 ? -8 : 4);
            this.addText(svg, p.label, lx, ly, 'mut', {
                anchor: dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle', size: 12
            });
        }
    },

    addText(svg, text, x, y, color = 'ink', opts = {}) {
        const t = this.create('text', {
            x, y, class: 'lbl ' + color,
            'font-size': opts.size || 13.5,
            'text-anchor': opts.anchor || 'middle'
        });
        t.textContent = text;
        svg.appendChild(t);
        return t;
    }
};

const JSDraw = {
    NS: 'http://www.w3.org/2000/svg',
    CV: { ink: 'var(--ink)', red: 'var(--red)', blue: 'var(--blue)', amber: 'var(--amber)', mut: 'var(--mut)', green: 'var(--green)' },
    BG: 'var(--bg)', PANEL: 'var(--panel)',

    E(t, a = {}) {
        const e = document.createElementNS(this.NS, t);
        for (const k in a) e.setAttribute(k, a[k]);
        return e;
    },
    mk(w, h) {
        const s = this.E('svg', { viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet' });
        s.style.maxWidth = w + 'px'; return s;
    },
    ln(p, x1, y1, x2, y2, c = 'ink', o = {}) {
        return p.appendChild(this.E('line', { x1, y1, x2, y2, class: 'st ' + c + (o.dash ? ' dash' : '') + (o.thin ? ' thin' : '') }));
    },
    ar(p, x1, y1, x2, y2, c = 'ink') {
        return p.appendChild(this.E('line', { x1, y1, x2, y2, class: 'st ' + c, 'marker-end': `url(#t-${c})` }));
    },
    ci(p, cx, cy, r, c = 'ink', fill = 'none') {
        return p.appendChild(this.E('circle', { cx, cy, r, class: 'st ' + c, fill }));
    },
    re(p, x, y, w, h, c = 'ink', fill = 'var(--bg)') {
        return p.appendChild(this.E('rect', { x, y, width: w, height: h, class: 'st ' + c, fill }));
    },
    dt(p, cx, cy, r = 4, c = 'ink') {
        return p.appendChild(this.E('circle', { cx, cy, r, fill: this.CV[c], stroke: 'none' }));
    },
    pa(p, d, c = 'ink', o = {}) {
        const attrs = { d, class: 'st ' + c + (o.dash ? ' dash' : '') + (o.thin ? ' thin' : ''), fill: o.fill || 'none' };
        if (o.arrow) attrs['marker-end'] = `url(#t-${c})`;
        return p.appendChild(this.E('path', attrs));
    },
    tx(p, str, x, y, o = {}) {
        const { c = 'ink', size = 13.5, anchor = 'middle' } = o;
        const t = this.E('text', { x, y, class: 'lbl ' + c, 'font-size': size, 'text-anchor': anchor });
        t.textContent = str; p.appendChild(t); return t;
    },
    rect(p, x, y, w, h, fill, stroke) {
        return p.appendChild(this.E('rect', { x, y, width: w, height: h, fill: fill || 'none', class: stroke ? 'st ' + stroke : '', rx: 0 }));
    },

    miniGraph(W, H, axisY, axisX, drawFn) {
        const s = this.mk(W, H);
        const ox = 28, oy = H - 24, w = W - 42, h = H - 42;
        this.ar(s, ox, oy, ox + w, oy, 'mut');
        this.tx(s, axisX, ox + w + 4, oy + 4, { c: 'mut', size: 9, anchor: 'start' });
        this.ar(s, ox, oy, ox, oy - h, 'mut');
        this.tx(s, axisY, ox - 4, oy - h - 6, { c: 'mut', size: 9 });
        drawFn(s, ox, oy, w, h);
        return s;
    },

    execJS(code, caption) {
        const fig = document.createElement('figure');
        fig.className = 'fig';
        try {
            const fn = new Function('D', code);
            const svg = fn(this);
            if (svg) fig.appendChild(svg);
        } catch (e) {
            fig.innerHTML = `<div style="color:var(--red);font-size:.85rem">Ошибка рисунка: ${e.message}</div>`;
        }
        if (caption) {
            const cap = document.createElement('figcaption');
            cap.innerHTML = Utils.formatInline(caption);
            fig.appendChild(cap);
        }
        return fig;
    }
};
