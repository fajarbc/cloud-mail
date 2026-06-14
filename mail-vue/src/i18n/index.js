import { createI18n } from 'vue-i18n';

const messages = {};
const modules = import.meta.glob('./*.js', { eager: true });

for (const path in modules) {
    if (path === './index.js') continue;
    const match = path.match(/\.\/([\w-]+)\.js$/);
    if (match) {
        messages[match[1]] = modules[path].default;
    }
}

export const availableLocales = Object.keys(messages);

const i18n = createI18n({
    legacy: false,
    messages,
});

export default i18n;