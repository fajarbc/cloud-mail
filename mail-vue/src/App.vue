<template>
  <el-config-provider :locale="elLocale">
    <router-view />
  </el-config-provider>
</template>
<script setup>
import { useI18n } from "vue-i18n";
import { ref, watch } from "vue";
import {useSettingStore} from "@/store/setting.js";
const settingStore = useSettingStore()
import('@/icons/index.js')
const { locale } = useI18n()
const elLocale = ref(null)
const localeModules = import.meta.glob('../node_modules/element-plus/es/locale/lang/*.mjs')

function elementLocaleName(lang) {
  if (lang === 'zh') return 'zh-cn'
  return lang || 'en'
}

watch(() => settingStore.lang, async (lang) => {
  locale.value = lang
  const name = elementLocaleName(lang)
  if (name === 'en') {
    elLocale.value = null
    return
  }
  const loader = localeModules[`../node_modules/element-plus/es/locale/lang/${name}.mjs`]
  if (!loader) {
    elLocale.value = null
    return
  }
  elLocale.value = (await loader()).default
}, { immediate: true })
</script>
