import { defineStore } from 'pinia'

export const useSettingStore = defineStore('setting', {
    state: () => ({
        domainList: [],
        settings: {
            r2Domain: '',
            loginOpacity: 1.00,
        },
        languages: ['en', 'zh', 'id'],
        lang: '',
    }),
    actions: {

    },
    persist: {
        pick: ['lang'],
    },
})
