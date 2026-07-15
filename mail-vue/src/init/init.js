import {useUserStore} from "@/store/user.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {loginUserInfo} from "@/request/my.js";
import {permsToRouter} from "@/perm/perm.js";
import router from "@/router";
import {websiteConfig} from "@/request/setting.js";
import i18n, {availableLocales} from "@/i18n/index.js";
import {setExtend} from "@/utils/day.js";

function resolveLang(settingStore) {
    const configured = (settingStore.settings.languages && settingStore.settings.languages.length)
        ? settingStore.settings.languages
        : ['en', 'zh'];
    const languages = configured.filter(l => availableLocales.includes(l));
    const fallbackList = languages.length ? languages : availableLocales.slice();
    settingStore.settings.languages = fallbackList;

    const defaultLang = settingStore.settings.defaultLang && fallbackList.includes(settingStore.settings.defaultLang)
        ? settingStore.settings.defaultLang
        : fallbackList[0];

    let lang = settingStore.lang;

    if (!lang || !fallbackList.includes(lang)) {
        const navLang = navigator.language.split('-')[0];
        lang = fallbackList.includes(navLang) ? navLang : defaultLang;
    }

    settingStore.lang = lang;
    i18n.global.locale.value = lang;
    setExtend(lang === 'zh' ? 'zh-cn' : lang);
}

export async function init() {
    document.title = '\u200B'

    const settingStore = useSettingStore();
    const userStore = useUserStore();
    const accountStore = useAccountStore();

    const token = localStorage.getItem('token');

    let setting = null;

    if (token) {
        const userPromise = loginUserInfo().catch(e => {
            console.error(e);
            return null;
        });

        const [s, user] = await Promise.all([websiteConfig(), userPromise]);
        setting = s;
        settingStore.settings = setting;
        settingStore.domainList = setting.domainList;
        document.title = setting.title;

        resolveLang(settingStore);

        if (user) {
            accountStore.currentAccountId = user.account.accountId;
            accountStore.currentAccount = user.account;
            userStore.user = user;

            const routers = permsToRouter(user.permKeys);
            routers.forEach(routerData => {
                router.addRoute('layout', routerData);
            });
        }

    } else {
        setting = await websiteConfig();
        settingStore.settings = setting;
        settingStore.domainList = setting.domainList;
        document.title = setting.title;

        resolveLang(settingStore);
    }
}
