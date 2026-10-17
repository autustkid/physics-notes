// core/utils.js

const Utils = {
    escape(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    el(tag, attrs = {}, ...children) {
        const e = document.createElement(tag);
        for (const k in attrs) {
            if (k === 'class') e.className = attrs[k];
            else if (k === 'html') e.innerHTML = attrs[k];
            else e.setAttribute(k, attrs[k]);
        }
        children.forEach(c => {
            if (c == null) return;
            if (typeof c === 'string') e.appendChild(document.createTextNode(c));
            else e.appendChild(c);
        });
        return e;
    },

    async loadText(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Не удалось загрузить ${url}`);
        return res.text();
    },

    async loadJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Не удалось загрузить ${url}`);
        return res.json();
    },

    formatInline(text) {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<b class="term">$1</b>')
            .replace(/`(.+?)`/g, '<span class="u">$1</span>')
            .replace(/\$(.+?)\$/g, (_, expr) => FormulaRenderer.renderExpr(expr));
    },

    debounce(fn, delay = 200) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), delay);
        };
    }
};
