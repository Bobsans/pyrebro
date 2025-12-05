<template>
  <header>
    <div>
      <a href="/"><h1>PYREBRO</h1></a>
      <dropdown v-model="store.state.server" :items="state.servers"/>
      <dropdown v-model="store.state.database" :items="state.databases"/>
      <router-link :to="{name: 'info'}" class="button">Info</router-link>
    </div>
    <div>
      <dropdown v-model="store.state.updateInterval" :items="updateIntervalVariants" :to-value="(it) => it.value" class="update-interval-selector">
        <template #value="{item}">
          {{ item?.label }}
        </template>
        <template #item="{item}">
          {{ item?.label }}
        </template>
      </dropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
  import { store } from "@/store.ts";
  import Dropdown from "@/components/Dropdown.vue";
  import { useApi } from "@/uses/api.ts";
  import { onMounted, reactive } from "vue";
  import { updateIntervalVariants } from "@/data.ts";

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
    display: grid;
    grid-template-columns: 1fr 1fr;
    z-index: 10;

    > div {
      display: flex;
      align-items: center;
      justify-content: flex-start;

      &:last-child {
        justify-content: flex-end;
      }
    }

    .update-interval-selector {
      width: 100px;
    }
  }
</style>
