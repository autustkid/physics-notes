// core/renderer.js

const Renderer = {
    renderTopic(topic) {
        const root = document.createElement('div');
        root.appendChild(Utils.el('a', { href: '#/', class: 'back-btn' }, '← Все темы'));
        const hero = Utils.el('header', { class: 'hero' },
                              Utils.el('div', { class: 'kicker' }, topic.meta.section || 'Конспект'),
                              Utils.el('h1', {}, topic.meta.title || 'Без названия'),
                              Utils.el('p', { class: 'lead' }, topic.meta.subtitle || ''),
                              Utils.el('p', { class: 'hint', html: 'Наведите курсор на <u>любую формулу</u> — откроется справочник обозначений.' })
                             );
        root.appendChild(hero);
        topic.sections.forEach(section => root.appendChild(this.renderSection(section)));
        if (topic.tasks.length) root.appendChild(this.renderTasks(topic.tasks));
        return root;
    },

    renderSection(section) {
        const el = Utils.el('section', { class: 's' });
        if (section.num) el.appendChild(Utils.el('div', { class: 'num' }, section.num));
        el.appendChild(Utils.el('h2', {}, section.title));
        section.content.forEach(block => {
            const node = this.renderBlock(block);
            if (node) el.appendChild(node);
        });
        return el;
    },

    renderBlock(block) {
        switch (block.type) {
            case 'p':        return this.renderP(block);
            case 'h3':       return Utils.el('h3', {}, block.text);
            case 'ol':       return this.renderOL(block);
            case 'chips':    return this.renderChips(block);
            case 'note':     return this.renderNote(block);
            case 'formula':  return FormulaRenderer.render(block);
            case 'draw':     return DrawEngine.render(block);
            case 'tree':     return this.renderTree(block);
            case 'table':    return this.renderTable(block);
            case 'htmltable':return this.renderHTMLTable(block);
            case 'grid':     return this.renderGrid(block);
            case 'js':       return JSDraw.execJS(block.body, block.params.caption);
            case 'task':     return null;
            default: return null;
        }
    },

    renderP(block) {
        const p = document.createElement('p');
        p.innerHTML = Utils.formatInline(block.text);
        return p;
    },

    renderOL(block) {
        const ol = Utils.el('ol', { class: 'n' });
        block.items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = Utils.formatInline(item);
            ol.appendChild(li);
        });
        return ol;
    },

    renderChips(block) {
        const div = Utils.el('div', { class: 'chips' });
        block.items.forEach(c => div.appendChild(Utils.el('span', { class: 'chip' }, c)));
        return div;
    },

    renderNote(block) {
        const div = Utils.el('div', { class: 'note' });
        div.innerHTML = '<b>Важно:</b> ' + Utils.formatInline(block.body.trim());
        return div;
    },

    renderTree(block) {
        const lines = block.body.split('\n').filter(l => l.trim());
        const wrap = Utils.el('div', { class: 'tree' });
        let rootText = '';
        const branches = [];
        let currentBranch = null;
        lines.forEach(line => {
            const m = line.match(/^(\s*)(root|branch|leaf)(?:\[(\w+)\])?:\s*(.+)/);
            if (!m) return;
            const [, , kind, color, text] = m;
            const [main, sub] = text.split('|').map(s => s.trim());
            if (kind === 'root') rootText = main;
            else if (kind === 'branch') { currentBranch = { label: main, leaves: [] }; branches.push(currentBranch); }
            else if (kind === 'leaf' && currentBranch) { currentBranch.leaves.push({ label: main, color: color || '', sub }); }
        });
        wrap.appendChild(Utils.el('div', { class: 'tree-root' }, rootText));
        wrap.appendChild(Utils.el('div', { class: 'tree-line' }));
        const fork = Utils.el('div', { class: 'tree-fork' });
        branches.forEach(br => {
            const branch = Utils.el('div', { class: 'tree-branch' });
            branch.appendChild(Utils.el('div', { class: 'tree-line' }));
            branch.appendChild(Utils.el('div', { class: 'tree-node' }, br.label));
            if (br.leaves.length) {
                branch.appendChild(Utils.el('div', { class: 'tree-line' }));
                const sub = Utils.el('div', { class: 'tree-sub' });
                br.leaves.forEach(leaf => {
                    const subBranch = Utils.el('div', { class: 'tree-branch' });
                    const node = Utils.el('div', { class: 'tree-node ' + leaf.color });
                    node.innerHTML = leaf.label + (leaf.sub ? `<small>${leaf.sub}</small>` : '');
                    subBranch.appendChild(node);
                    sub.appendChild(subBranch);
                });
                branch.appendChild(sub);
            }
            fork.appendChild(branch);
        });
        wrap.appendChild(fork);
        return wrap;
    },

    renderTable(block) {
        const wrap = Utils.el('div', { class: 'tbl-wrap' });
        const tbl = Utils.el('table', { class: 'tbl' });
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const lines = block.body.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach(line => {
            if (line.startsWith('headers:')) {
                const cells = line.slice(8).split('|').map(s => s.trim());
                const tr = document.createElement('tr');
                cells.forEach(c => { const th = document.createElement('th'); th.innerHTML = Utils.formatInline(c); tr.appendChild(th); });
                thead.appendChild(tr);
            } else if (line.startsWith('row:')) {
                const cells = line.slice(4).split('|').map(s => s.trim());
                const tr = document.createElement('tr');
                cells.forEach((c, i) => {
                    const td = document.createElement('td');
                    if (i === 0) td.className = 'rowh';
                    td.innerHTML = i === 0 ? Utils.escape(c) : FormulaRenderer.renderExpr(c);
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            }
        });
        tbl.appendChild(thead);
        tbl.appendChild(tbody);
        wrap.appendChild(tbl);
        return wrap;
    },

    renderHTMLTable(block) {
        const wrap = Utils.el('div', { class: 'tbl-wrap' });
        const div = document.createElement('div');
        div.innerHTML = block.body;
        const table = div.querySelector('table');
        if (table) {
            table.className = 'tbl';
            wrap.appendChild(table);
            wrap.querySelectorAll('[data-graph]').forEach(cell => {
                const name = cell.dataset.graph;
                if (GraphLib[name]) {
                    const svg = GraphLib[name]();
                    cell.appendChild(svg);
                    cell.classList.add('fig');
                }
            });
        }
        return wrap;
    },

    renderGrid(block) {
        const cols = parseInt(block.params.cols) || 2;
        const div = Utils.el('div', { class: 'grid' + cols });
        const cells = block.body.split(/\n---\n/);
        cells.forEach(cellText => {
            const cell = Utils.el('div', { class: 'cell' });
            const sub = TopicParser.parseSection('## x\n' + cellText);
            if (sub) sub.content.forEach(b => {
                if (b.type === 'p' && b.text.startsWith('cap:')) {
                    cell.appendChild(Utils.el('div', { class: 'cap' }, b.text.slice(4).trim()));
                } else {
                    const node = this.renderBlock(b);
                    if (node) cell.appendChild(node);
                }
            });
            div.appendChild(cell);
        });
        return div;
    },

    renderTasks(tasks) {
        const wrap = document.createElement('div');
        const btn = Utils.el('button', { class: 'tasks-btn', 'aria-expanded': 'false' });
        btn.innerHTML = `<span>Задачи</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
        wrap.appendChild(btn);
        const container = Utils.el('div', { class: 'tasks' });
        const inner = Utils.el('div', { class: 'tasks-inner' });
        tasks.forEach(t => inner.appendChild(this.renderTask(t)));
        container.appendChild(inner);
        wrap.appendChild(container);
        btn.addEventListener('click', () => {
            const open = container.classList.toggle('open');
            btn.setAttribute('aria-expanded', open);
            btn.querySelector('span').textContent = open ? 'Скрыть задачи' : 'Задачи';
            if (open) setTimeout(() => AnimationManager.scanNew(), 100);
        });
        return wrap;
    },

    renderTask(block) {
        const data = this.parseTask(block.body);
        const task = Utils.el('div', { class: 'task' });
        task.appendChild(Utils.el('div', { class: 'tnum' }, 'Задача ' + (block.params.n || data.n || '')));
        task.appendChild(Utils.el('h3', {}, data.title || ''));
        if (data.text) { const p = Utils.el('p'); p.innerHTML = Utils.formatInline(data.text); task.appendChild(p); }
        const body = Utils.el('div', { class: 'task-body' });
        const given = Utils.el('aside', { class: 'task-given' });
        given.appendChild(Utils.el('div', { class: 'gh' }, 'Дано'));
        const gv = Utils.el('div', { class: 'gv' });
        data.given.forEach(g => { const d = document.createElement('div'); d.innerHTML = Utils.formatInline(g); gv.appendChild(d); });
        given.appendChild(gv);
        if (data.find) {
            given.appendChild(Utils.el('div', { class: 'sep' }));
            given.appendChild(Utils.el('div', { class: 'gh' }, 'Найти'));
            const fv = Utils.el('div', { class: 'gv' }); const d = document.createElement('div');
            d.innerHTML = Utils.formatInline(data.find); fv.appendChild(d); given.appendChild(fv);
        }
        body.appendChild(given);
        const sol = Utils.el('div', { class: 'task-sol' });
        const solLines = Utils.el('div', { class: 'sol' });
        data.solution.forEach((s, i) => {
            const line = Utils.el('div', { class: 'line' });
            line.innerHTML = (i + 1) + '. ' + Utils.formatInline(s);
            solLines.appendChild(line);
        });
        if (data.answer) { const ans = Utils.el('div', { class: 'line ans' }); ans.innerHTML = 'Ответ: ' + Utils.formatInline(data.answer); solLines.appendChild(ans); }
        sol.appendChild(solLines);
        body.appendChild(sol);
        task.appendChild(body);
        return task;
    },

    parseTask(body) {
        const data = { title: '', text: '', given: [], find: '', solution: [], answer: '', n: '' };
        const lines = body.split('\n');
        let section = null;
        for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            if (t.startsWith('title:')) { data.title = t.slice(6).trim(); section = null; }
            else if (t.startsWith('n:')) { data.n = t.slice(2).trim(); section = null; }
            else if (t.startsWith('text:')) { data.text = t.slice(5).trim(); section = null; }
            else if (t.startsWith('find:')) { data.find = t.slice(5).trim(); section = null; }
            else if (t.startsWith('answer:')) { data.answer = t.slice(7).trim(); section = null; }
            else if (t === 'given:') section = 'given';
            else if (t === 'solution:') section = 'solution';
            else if (t.startsWith('- ') && section) data[section].push(t.slice(2).trim());
        }
        return data;
    }
};

const GraphLib = {};

// S(t) графики
GraphLib['gs-uniform'] = () => JSDraw.miniGraph(140, 100, 'S', 't', (s, ox, oy, w, h) => {
    JSDraw.pa(s, `M ${ox} ${oy} L ${ox + w * 0.85} ${oy - h * 0.85}`, 'red');
});
GraphLib['gs-accel'] = () => JSDraw.miniGraph(140, 100, 'S', 't', (s, ox, oy, w, h) => {
    JSDraw.pa(s, `M ${ox} ${oy} Q ${ox + w * 0.7} ${oy} ${ox + w * 0.85} ${oy - h * 0.85}`, 'red');
});
GraphLib['gs-decel'] = () => JSDraw.miniGraph(140, 100, 'S', 't', (s, ox, oy, w, h) => {
    JSDraw.pa(s, `M ${ox} ${oy} Q ${ox} ${oy - h * 0.7} ${ox + w * 0.85} ${oy - h * 0.85}`, 'red');
});
// V(t) графики
GraphLib['gv-uniform'] = () => JSDraw.miniGraph(140, 100, 'V', 't', (s, ox, oy, w, h) => {
    JSDraw.pa(s, `M ${ox} ${oy - h * 0.55} L ${ox + w * 0.85} ${oy - h * 0.55}`, 'blue');
});
GraphLib['gv-accel'] = () => JSDraw.miniGraph(140, 100, 'V', 't', (s, ox, oy, w, h) => {
    JSDraw.pa(s, `M ${ox} ${oy - h * 0.25} L ${ox + w * 0.85} ${oy - h * 0.85}`, 'blue');
});
GraphLib['gv-decel'] = () => JSDraw.miniGraph(140, 100, 'V', 't', (s, ox, oy, w, h) => {
    JSDraw.pa(s, `M ${ox} ${oy - h * 0.85} L ${ox + w * 0.55} ${oy - h * 0.25}`, 'blue');
});
// a(t) графики
GraphLib['ga-uniform'] = () => JSDraw.miniGraph(140, 110, 'a', 't', (s, ox, oy, w, h) => {
    JSDraw.ln(s, ox - 6, oy, ox + 6, oy, 'mut', { thin: 1 });
});
GraphLib['ga-accel'] = () => JSDraw.miniGraph(140, 110, 'a', 't', (s, ox, oy, w, h) => {
    const mid = oy - h * 0.5;
    JSDraw.ln(s, ox - 4, mid, ox + w * 0.85, mid, 'mut', { thin: 1, dash: 1 });
    JSDraw.pa(s, `M ${ox} ${mid - h * 0.3} L ${ox + w * 0.85} ${mid - h * 0.3}`, 'amber');
    JSDraw.tx(s, '+', ox - 12, mid - h * 0.3 + 4, { c: 'amber', size: 9 });
});
GraphLib['ga-decel'] = () => JSDraw.miniGraph(140, 110, 'a', 't', (s, ox, oy, w, h) => {
    const mid = oy - h * 0.5;
    JSDraw.ln(s, ox - 4, mid, ox + w * 0.85, mid, 'mut', { thin: 1, dash: 1 });
    JSDraw.pa(s, `M ${ox} ${mid + h * 0.3} L ${ox + w * 0.85} ${mid + h * 0.3}`, 'amber');
    JSDraw.tx(s, '−', ox - 12, mid + h * 0.3 + 4, { c: 'amber', size: 9 });
});
