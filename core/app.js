// core/app.js

const AnimationManager = {
    io: null,
    init() {
        this.io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    this.animate(e.target);
                    this.io.unobserve(e.target);
                }
            });
        }, {
            threshold: 0.15
        });
    },
    scanNew() {
        document.querySelectorAll('.fig:not(.scanned), section.s:not(.scanned)').forEach(el => {
            el.classList.add('scanned');
            if (el.classList.contains('fig')) {
                this.io.observe(el);
            } else {
                el.classList.add('fade-in');
                this.io.observe(el);
            }
        });
    },
    animate(el) {
        if (el.classList.contains('fig')) {
            const svg = el.querySelector('svg');
            if (!svg) return;
            const items = [...svg.querySelectorAll('.st')];
            items.forEach((item, i) => {
                let L = 0;
                try { L = item.getTotalLength(); } catch (e) { return; }
                if (!L || L > 4000) return;
                if (item.classList.contains('dash')) {
                    item.style.opacity = 0;
                    item.style.transition = `opacity .5s ease ${0.28 + i * 0.012}s`;
                    item.getBoundingClientRect();
                    item.style.opacity = 1;
                    return;
                }
                item.style.strokeDasharray = L + ' ' + L;
                item.style.strokeDashoffset = L;
                item.getBoundingClientRect();
                item.style.transition = `stroke-dashoffset .85s cubic-bezier(.4,0,.2,1) ${Math.min(i * 0.024, 0.28)}s`;
                item.style.strokeDashoffset = 0;
            });
            el.classList.add('in');
            setTimeout(() => items.forEach(it => {
                if (!it.classList.contains('dash')) it.style.strokeDasharray = 'none';
            }), 1500);
        } else {
            el.classList.add('visible');
        }
    }
};

const ThemeManager = {
    init() {
        const btn = document.getElementById('themeBtn');
        const saved = localStorage.getItem('theme');
        document.documentElement.dataset.theme =
            saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        btn.addEventListener('click', () => {
            const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
            document.documentElement.dataset.theme = next;
            localStorage.setItem('theme', next);
        });
    }
};

const ProgressBar = {
    init() {
        const bar = document.getElementById('prog');
        addEventListener('scroll', () => {
            const h = document.documentElement;
            const p = (h.scrollTop / (h.scrollHeight - h.clientHeight)) || 0;
            bar.style.transform = `scaleX(${p})`;
        }, { passive: true });
    }
};

class PhysicsApp {
    constructor() {
        this.root = document.getElementById('app');
        this.topSection = document.getElementById('topSection');
        this.catalog = null;
        this.topicsCache = {};
        this.searchIndex = [];
    }

    async init() {
        ThemeManager.init();
        ProgressBar.init();
        AnimationManager.init();

        try {
            this.catalog = await Utils.loadJSON('topics/index.json');
            this.buildBasicIndex();
        } catch (e) {
            this.showError('Не удалось загрузить каталог тем. ' + e.message);
            return;
        }

        window.addEventListener('hashchange', () => this.route());
        this.route();
    }

    route() {
        const hash = location.hash.slice(1);
        if (!hash || hash === '/') return this.showCatalog();
        if (hash.startsWith('/topic/')) return this.loadTopic(hash.slice(7));
        this.show404();
    }


    // КАТАЛОГ:
    showCatalog() {
        this.topSection.textContent = '';
        this.root.innerHTML = '';

        const hero = Utils.el('header', { class: 'hero' },
                              Utils.el('div', { class: 'kicker' }, 'Конспекты'),
                              Utils.el('h1', {}, 'Физика'),
                              Utils.el('p', { class: 'lead' }, 'Все темы в одном месте. Выберите раздел или воспользуйтесь поиском.')
                             );
        this.root.appendChild(hero);

        this.root.appendChild(this.renderSearchBar());
        this.root.appendChild(this.renderSections());

        AnimationManager.scanNew();
    }

    renderSearchBar() {
        const wrap = Utils.el('div', { class: 'search-wrap' });
        const box = document.createElement('div');
        box.className = 'search-box';
        box.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>
          </svg>
          <input type="text" id="searchInput" placeholder="Искать по темам, формулам, тегам…" autocomplete="off">
        `;
        const results = Utils.el('div', { class: 'search-results', id: 'searchResults' });
        wrap.appendChild(box);
        wrap.appendChild(results);

        requestAnimationFrame(() => {
            const input = document.getElementById('searchInput');
            input.focus();
            input.addEventListener('input', Utils.debounce(() => this.doSearch(input.value, results), 120));
        });

        return wrap;
    }

    renderSections() {
        const wrap = Utils.el('div', { class: 'catalog-sections' });
        this.catalog.sections.forEach(section => {
            const sec = Utils.el('div', { class: 'catalog-section' });
            const title = Utils.el('h2', { class: 'section-title' });
            title.innerHTML = `<span class="section-icon">${section.icon || '📘'}</span>${Utils.escape(section.name)}`;
            sec.appendChild(title);

            const grid = Utils.el('div', { class: 'topic-grid' });
            section.topics.forEach(t => {
                const card = Utils.el('a', { href: '#/topic/' + t.id, class: 'topic-card' });
                card.innerHTML = `
                 <h3>${Utils.escape(t.title)}</h3>
                 <div class="topic-tags">
                   ${(t.tags || []).slice(0, 5).map(tag => `<span class="chip">${Utils.escape(tag)}</span>`).join('')}
                 </div>
               `;
                grid.appendChild(card);
            });
            sec.appendChild(grid);
            wrap.appendChild(sec);
        });
        return wrap;
    }


    // ТЕМА:
    async loadTopic(id) {
        this.root.innerHTML = '<div class="loader">Загружаем конспект…</div>';
        let file = null;
        let section = '';
        for (const sec of this.catalog.sections) {
            const found = sec.topics.find(t => t.id === id);
            if (found) { file = found.file; section = sec.name; break; }
        }
        if (!file) return this.show404();

        try {
            let raw;
            if (this.topicsCache[id]) raw = this.topicsCache[id];
            else {
                raw = await Utils.loadText('topics/' + file);
                this.topicsCache[id] = raw;
            }
            const topic = TopicParser.parse(raw);
            if (!topic.meta.section) topic.meta.section = section;
            this.topSection.textContent = section;
            this.root.innerHTML = '';
            this.root.appendChild(Renderer.renderTopic(topic));
            window.scrollTo(0, 0);
            setTimeout(() => AnimationManager.scanNew(), 50);
        } catch (e) {
            this.showError('Не удалось загрузить тему: ' + e.message);
        }
    }


    // ПОИСК:
    buildBasicIndex() {
        this.searchIndex = [];
        this.catalog.sections.forEach(sec => {
            sec.topics.forEach(t => {
                this.searchIndex.push({
                    type: 'тема',
                    id: t.id,
                    title: t.title,
                    tags: t.tags || [],
                    section: sec.name,
                    haystack: (t.title + ' ' + (t.tags || []).join(' ') + ' ' + sec.name).toLowerCase()
                });
            });
        });
    }

    doSearch(q, container) {
        q = q.trim().toLowerCase();
        if (q.length < 2) { container.innerHTML = ''; return; }
        const hits = this.searchIndex.filter(i => i.haystack.includes(q)).slice(0, 10);
        if (!hits.length) {
            container.innerHTML = '<div class="search-empty">Ничего не найдено</div>';
            return;
        }
        container.innerHTML = hits.map(h => `
          <a href="#/topic/${h.id}" class="search-hit">
            <span class="search-hit-type">${h.type}</span>
            <span class="search-hit-title">${Utils.escape(h.title)}</span>
          </a>
        `).join('');
    }

    show404() {
        this.root.innerHTML = `
          <div style="text-align:center;padding:200px 20px">
            <h2 style="margin-bottom:20px">Тема не найдена</h2>
                <a href="#/" style="color:var(--mut);border-bottom:1px dotted var(--mut)">← Вернуться к каталогу</a>
          </div>
        `;
        this.topSection.textContent = '';
    }

    showError(msg) {
        this.root.innerHTML = `
          <div style="text-align:center;padding:200px 20px">
            <h2 style="margin-bottom:20px;color:var(--red)">Ошибка</h2>
            <p style="color:var(--mut)">${Utils.escape(msg)}</p>
          </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new PhysicsApp();
    app.init();
});
