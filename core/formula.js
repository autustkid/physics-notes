// core/formula.js

const FormulaRenderer = {
    render(block) {
        const data = this.parseBlock(block.body);
        const wrap = document.createElement('div');
        wrap.className = 'formula';

        const f = document.createElement('span');
        f.className = 'f';
        f.tabIndex = 0;
        f.innerHTML = this.renderExpr(data.expr);

        if (data.hover.title || Object.keys(data.hover.vars).length) {
            const ref = document.createElement('span');
            ref.className = 'ref';
            let html = '';
            if (data.hover.title) html += `<b>${Utils.escape(data.hover.title)}</b>`;
            for (const [k, v] of Object.entries(data.hover.vars)) {
                html += `<div><em>${this.renderExpr(k)}</em> — ${Utils.escape(v)}</div>`;
            }
            ref.innerHTML = html;
            f.appendChild(ref);
        }

        wrap.appendChild(f);
        return wrap;
    },

    parseBlock(body) {
        const result = { expr: '', hover: { title: '', vars: {} } };
        const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
        let inHover = false;
        for (const line of lines) {
            if (line.startsWith('expr:')) {
                result.expr = line.slice(5).trim();
            } else if (line === 'hover:') {
                inHover = true;
            } else if (inHover) {
                const m = line.match(/^(.+?):\s*(.+)/);
                if (m) {
                    if (m[1] === 'title') result.hover.title = m[2];
                    else result.hover.vars[m[1]] = m[2];
                }
            }
        }
        return result;
    },

    // Простой рендер выражения:
    //   V_0 → V с подстрочным 0
    //   t^2 → t в степени 2
    //   S/t → дробь
    //   {vec:V} → вектор
    //   греческие по именам: alpha, beta, phi, omega и т.д.
    renderExpr(expr) {
        if (!expr) return '';
        let s = expr;

        // Векторы: {vec:V} или {vec:F_1}
        s = s.replace(/\{vec:([^}]+)\}/g, (_, v) => {
            return `<i class="vec">${this.renderExpr(v)}</i>`;
        });

        // Греческие буквы
        const greek = {
            alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ',
            epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι',
            kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
            pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ',
            chi: 'χ', psi: 'ψ', omega: 'ω', Omega: 'Ω'
        };
        for (const [name, letter] of Object.entries(greek)) {
            s = s.replace(new RegExp('\\\\' + name + '\\b', 'g'), letter);
        }

        // Дроби (простая обработка): a/b, где a и b — переменная или число или скобки
        s = s.replace(/([A-Za-zα-ωΑ-Ω]+(?:_\w+)?|\([^)]+\))\s*\/\s*([A-Za-zα-ωΑ-Ω]+(?:_\w+)?|\([^)]+\))/g,
                      (_, a, b) => `<span class="fr"><span>${this.applySubSup(a)}</span><span>${this.applySubSup(b)}</span></span>`
                     );

        s = this.applySubSup(s);

        return s;
    },

    applySubSup(s) {
        // Степени: X^2
        s = s.replace(/([A-Za-zα-ωΑ-Ω0-9)])\^(\{[^}]+\}|\w+)/g, (_, base, exp) => {
            const e = exp.startsWith('{') ? exp.slice(1, -1) : exp;
            return `${base}<sup>${e}</sup>`;
        });

        // Подстрочные: X_0 или X_{abc}
        s = s.replace(/([A-Za-zα-ωΑ-Ω])_(\{[^}]+\}|\w+)/g, (_, base, sub) => {
            const b = sub.startsWith('{') ? sub.slice(1, -1) : sub;
            return `<i>${base}</i><sub>${b}</sub>`;
        });

        // Одиночные латинские/греческие буквы → курсив (если не внутри тега)
        s = s.replace(/(?<![<\w])([A-Za-zα-ωΑ-Ω])(?![>\w])/g, '<i>$1</i>');

        return s;
    }
};
