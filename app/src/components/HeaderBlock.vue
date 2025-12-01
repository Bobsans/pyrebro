<template>
  <header>
    <a href="/"><h1>PYREBRO</h1></a>
    <dropdown v-model="store.state.server" :items="state.servers"/>
    <dropdown v-model="store.state.database" :items="state.databases"/>
    <router-link :to="{name: 'info'}" class="button">Info</router-link>
  </header>
</template>

<script setup lang="ts">
  import { store } from "@/store.ts";
  import Dropdown from "@/components/Dropdown.vue";
  import { useApi } from "@/uses/api.ts";
  import { onMounted, reactive } from "vue";

  const api = useApi();

  const state = reactive({
    servers: [] as string[],
    databases: [] as string[]
  });

  onMounted(() => {
    api.endpoints.getServers().then(({ data }) => {
      state.servers = data;

      api.endpoints.getDatabases(store.state.server).then(({ data }) => {
        state.databases = data;
      });
    });
  });
</script>

<style lang="scss">
  header {
    position: relative;
    z-index: 10;
  }
</style>
