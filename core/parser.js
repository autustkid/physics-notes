// core/parser.js

const TopicParser = {
    parse(raw) {
        const result = {
            meta: {},
            sections: [],
            tasks: []
        };


        const metaMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
        if (metaMatch) {
            result.meta = this.parseMeta(metaMatch[1]);
            raw = raw.slice(metaMatch[0].length);
        }


        const blocks = raw.split(/\n(?=## [^#])/);
        for (const block of blocks) {
            const trimmed = block.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('## ')) {
                const parsed = this.parseSection(trimmed);
                if (parsed) {
                    parsed.content = parsed.content.filter(b => {
                        if (b.type === 'task') {
                            result.tasks.push(b);
                            return false;
                        }
                        return true;
                    });
                    if (parsed.content.length) result.sections.push(parsed);
                }
            }
        }

        return result;
    },

    parseMeta(text) {
        const meta = {};
        text.split('\n').forEach(line => {
            const m = line.match(/^(\w+):\s*(.+)$/);
            if (!m) return;
            let [, k, v] = m;
            v = v.trim();
            if (v.startsWith('[') && v.endsWith(']')) {
                v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
            } else {
                v = v.replace(/^["']|["']$/g, '');
            }
            meta[k] = v;
        });
        return meta;
    },

    parseSection(text) {
        const lines = text.split('\n');
        const header = lines[0].match(/^##\s+(?:(\d+)\s*\|\s*)?(.+)$/);
        if (!header) return null;

        const section = {
            num: header[1] || '',
            title: header[2].trim(),
            content: []
        };

        let i = 1;
        while (i < lines.length) {
            const line = lines[i];

            // Специальный блок @type
            if (line.trim().startsWith('@') && !line.trim().startsWith('@end')) {
                const result = this.parseBlockDirective(lines, i);
                if (result) {
                    section.content.push(result.block);
                    i = result.next;
                    continue;
                }
            }

            // Подзаголовок ###
            if (line.startsWith('### ')) {
                section.content.push({ type: 'h3', text: line.slice(4).trim() });
                i++;
                continue;
            }

            // Нумерованный список
            if (line.match(/^\d+\.\s/)) {
                const items = [];
                while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
                    items.push(lines[i].replace(/^\d+\.\s*/, '').trim());
                    i++;
                }
                section.content.push({ type: 'ol', items });
                continue;
            }

            // Чипсы: - item1 | item2 | item3  (если строка начинается с - и есть |)
            if (line.startsWith('@chips:')) {
                const chips = line.slice(7).split('|').map(s => s.trim()).filter(Boolean);
                section.content.push({ type: 'chips', items: chips });
                i++;
                continue;
            }

            // Параграф (может быть многострочный до пустой строки)
            if (line.trim()) {
                let para = line.trim();
                i++;
                while (i < lines.length && lines[i].trim() &&
                       !lines[i].startsWith('@') &&
                       !lines[i].startsWith('###') &&
                       !lines[i].match(/^\d+\.\s/)) {
                    para += ' ' + lines[i].trim();
                    i++;
                }
                section.content.push({ type: 'p', text: para });
                continue;
            }

            i++;
        }

        return section;
    },

    parseBlockDirective(lines, start) {
        const header = lines[start].trim();
        const m = header.match(/^@(\w+)(.*)$/);
        if (!m) return null;

        const type = m[1];
        const params = {};

        // Параметры: @draw | width: 400 | height: 200 | caption: Текст
        if (m[2]) {
            m[2].split('|').map(s => s.trim()).filter(Boolean).forEach(p => {
                const kv = p.match(/^(\w+)\s*:\s*(.+)$/);
                if (kv) params[kv[1]] = kv[2].trim();
            });
        }

        // Тело до @end
        let i = start + 1;
        const body = [];
        while (i < lines.length && lines[i].trim() !== '@end') {
            body.push(lines[i]);
            i++;
        }

        return {
            block: { type, params, body: body.join('\n') },
            next: i + 1
        };
    }
};
