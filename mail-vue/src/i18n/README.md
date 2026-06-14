# Internationalization (i18n) Guide

The frontend UI language system is **zero-config** for adding new languages, and the list of available languages (plus the default) is controlled from the worker's `wrangler.toml`.

## How it works

1. **Auto-registration** — `mail-vue/src/i18n/index.js` automatically imports every `*.js` file in this directory (except `index.js`) using Vite's `import.meta.glob`. The file name becomes the locale code (e.g. `id.js` -> `id`).

2. **Self-described labels** — Each locale file declares its own human-readable name via the `langName` key at the top of the object. The language selector on the Settings page reads this value, so the menu shows each language in its own language.

   ```js
   const id = {
       langName: 'Bahasa Indonesia',
       inbox: 'Kotak Masuk',
       // ...
   }
   export default id
   ```

3. **Runtime locale packs** — Day.js and Element Plus locale packages are loaded on demand at runtime:
   - `mail-vue/src/utils/day.js` dynamically loads `dayjs/locale/<code>.js`
   - `mail-vue/src/App.vue` dynamically loads `element-plus/es/locale/lang/<code>.mjs`

   For `zh` the code is mapped to `zh-cn`; `en` uses the built-in default. No manual imports are needed.

4. **Server control** — The worker exposes the allowed languages via the `websiteConfig` API, read from the `languages` variable in `wrangler.toml`. The frontend (`mail-vue/src/init/init.js`) resolves the active language as follows:
   - Use the user's previously saved language if it is still allowed.
   - Otherwise, use the browser language if it is in the allowed list.
   - Otherwise, fall back to the default (the **first** entry of `languages`).

## Controlling languages from wrangler

In each `wrangler*.toml`, under `[vars]`:

```toml
languages = ["id", "en", "zh", "es", "fr"]   # first item is the default language
```

- Only languages listed here are shown to users.
- The first item is the default for new visitors.
- Supported codes must have a matching locale file in `mail-vue/src/i18n/` and a corresponding Day.js / Element Plus locale pack (most ISO codes are bundled with both libraries).

## Adding a new language

1. Copy `en.js` to `<code>.js` (e.g. `es.js`) in `mail-vue/src/i18n/`.
2. Set `langName` to the language's own name (e.g. `'Español'`) and translate the values.
3. Add `"<code>"` to the `languages` array in your `wrangler*.toml` files.

That's it — no edits to `index.js`, `day.js`, `App.vue`, or the Settings page are required.

> Gotcha: in vue-i18n, `@` starts a "linked message" syntax. If a translation value contains a literal `@` (e.g. `@cloud_mail_bot`), escape it as `{'@'}` — for example `'Bot username, e.g. {\'@\'}cloud_mail_bot'` — otherwise the message will fail to compile.

> Note: the worker's own error messages (`mail-worker/src/i18n/`) currently support `en` and `zh` only and fall back to `zh`. Add a matching file there if you want translated API/error messages for the new language.
