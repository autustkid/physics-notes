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

        topic.sections.forEach(section => {
            root.appendChild(this.renderSection(section));
        });

        if (topic.tasks.length) {
            root.appendChild(this.renderTasks(topic.tasks));
        }

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
            case 'grid':     return this.renderGrid(block);
            default:
                console.warn('Неизвестный тип блока:', block.type);
                return null;
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
        block.items.forEach(c => {
            div.appendChild(Utils.el('span', { class: 'chip' }, c));
        });
        return div;
    },

    renderNote(block) {
        const div = Utils.el('div', { class: 'note' });
        div.innerHTML = '<b>Важно:</b> ' + Utils.formatInline(block.body.trim());
        return div;
    },

    // @tree
    //   root: Траектория
    //     branch: Все точки тела
    //       leaf[blue]: Прямолинейное
    //       leaf[red]: Криволинейное
    renderTree(block) {
        const lines = block.body.split('\n').filter(l => l.trim());
        const wrap = Utils.el('div', { class: 'tree' });

        let rootText = '';
        const branches = []; // {label, leaves: [{label, color, sub}]}
        let currentBranch = null;

        lines.forEach(line => {
            const m = line.match(/^(\s*)(root|branch|leaf)(?:\[(\w+)\])?:\s*(.+)/);
            if (!m) return;
            const [, , kind, color, text] = m;
            const [main, sub] = text.split('|').map(s => s.trim());

            if (kind === 'root') rootText = main;
            else if (kind === 'branch') {
                currentBranch = { label: main, leaves: [] };
                branches.push(currentBranch);
            } else if (kind === 'leaf' && currentBranch) {
                currentBranch.leaves.push({ label: main, color: color || '', sub });
            }
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

    // @table
    //   headers: | Прямолинейное | Криволинейное
    //   row: Скорость | V | ω
    //   row: Ускорение | a | ε
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
                cells.forEach(c => {
                    const th = document.createElement('th');
                    th.innerHTML = Utils.formatInline(c);
                    tr.appendChild(th);
                });
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

    // @grid cols:2 | caption1 \n @draw ... @end \n caption2 \n @draw ... @end
    renderGrid(block) {
        // Простая версия — используем grid2 или grid3
        const cols = parseInt(block.params.cols) || 2;
        const div = Utils.el('div', { class: 'grid' + cols });
        // Разбор содержимого — ячейки разделены "---"
        const cells = block.body.split(/\n---\n/);
        cells.forEach(cellText => {
            const cell = Utils.el('div', { class: 'cell' });
            // Первая непустая строка — caption, если начинается с "cap:"
            const sub = TopicParser.parseSection('## x\n' + cellText);
            sub.content.forEach(b => {
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


    // ЗАДАЧИ:
    renderTasks(tasks) {
        const wrap = document.createElement('div');
        const btn = Utils.el('button', { class: 'tasks-btn', 'aria-expanded': 'false' });
        btn.innerHTML = `<span>Задачи</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
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
        if (data.text) {
            const p = Utils.el('p');
            p.innerHTML = Utils.formatInline(data.text);
            task.appendChild(p);
        }

        const body = Utils.el('div', { class: 'task-body' });

        // Дано/Найти
        const given = Utils.el('aside', { class: 'task-given' });
        given.appendChild(Utils.el('div', { class: 'gh' }, 'Дано'));
        const gv = Utils.el('div', { class: 'gv' });
        data.given.forEach(g => {
            const d = document.createElement('div');
            d.innerHTML = FormulaRenderer.renderExpr(g);
            gv.appendChild(d);
        });
        given.appendChild(gv);

        if (data.find) {
            given.appendChild(Utils.el('div', { class: 'sep' }));
            given.appendChild(Utils.el('div', { class: 'gh' }, 'Найти'));
            const fv = Utils.el('div', { class: 'gv' });
            const d = document.createElement('div');
            d.innerHTML = FormulaRenderer.renderExpr(data.find);
            fv.appendChild(d);
            given.appendChild(fv);
        }
        body.appendChild(given);

        // Решение
        const sol = Utils.el('div', { class: 'task-sol' });
        const solLines = Utils.el('div', { class: 'sol' });
        data.solution.forEach((s, i) => {
            const line = Utils.el('div', { class: 'line' });
            line.innerHTML = (i + 1) + '. ' + FormulaRenderer.renderExpr(s);
            solLines.appendChild(line);
        });
        if (data.answer) {
            const ans = Utils.el('div', { class: 'line ans' });
            ans.innerHTML = 'Ответ: ' + Utils.formatInline(data.answer);
            solLines.appendChild(ans);
        }
        sol.appendChild(solLines);
        body.appendChild(sol);

        task.appendChild(body);
        return task;
    },

    parseTask(body) {
        const data = { title: '', text: '', given: [], find: '', solution: [], answer: '' };
        const lines = body.split('\n');
        let section = null;
        for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            if (t.startsWith('title:')) { data.title = t.slice(6).trim(); section = null; }
            else if (t.startsWith('text:')) { data.text = t.slice(5).trim(); section = null; }
            else if (t.startsWith('find:')) { data.find = t.slice(5).trim(); section = null; }
            else if (t.startsWith('answer:')) { data.answer = t.slice(7).trim(); section = null; }
            else if (t === 'given:') section = 'given';
            else if (t === 'solution:') section = 'solution';
            else if (t.startsWith('- ') && section) {
                data[section].push(t.slice(2).trim());
            }
        }
        return data;
    }
};
