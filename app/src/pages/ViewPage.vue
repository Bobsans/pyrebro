<template>
  <main class="view-page">
    <div v-if="state.type === 'string'">{{ state.data }}</div>
    <table v-else-if="state.type === 'list' || state.type === 'set' || state.type === 'zset'">
      <thead>
        <tr>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, key) in state.data" :key="key">
          <td>{{ entry }}</td>
        </tr>
      </tbody>
    </table>
    <table v-else>
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, key) in state.data" :key="key">
          <td style="width: 50%;">{{ key }}</td>
          <td style="width: 50%;">{{ entry }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="state.size">Shown {{ loadedItemsCount }} of {{ state.size }} records</div>
  </main>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, reactive, watch } from "vue";
  import { store } from "@/store.ts";
  import { useApi } from "@/uses/api.ts";
  import { useRoute } from "vue-router";
  import type { RedisEntryData } from "@/types.ts";
  import { useWebsocket } from "@/uses/websocket.ts";

  const api = useApi();
  const ws = useWebsocket();
  const route = useRoute();

  const key = computed(() => route.params.key as string);

  const state = reactive<RedisEntryData>({
    type: null! as string,
    size: 0,
    data: null!
  });

  const loadedItemsCount = computed(() => {
    if (state.data) {
      return Array.isArray(state.data) ? state.data.length : typeof state.data === "object" ? Object.keys(state.data as Record<any, any>).length : 0;
    }
    return 0;
  });

  let _updateHandle: number | null = null;
  watch(() => store.state.updateInterval, (nv, ov) => {
    if (nv && nv !== ov) {
      if (_updateHandle) {
        clearInterval(_updateHandle);
      }
      if (nv > 0) {
        _updateHandle = setInterval(() => ws.request<RedisEntryData>("server:entry", {
          server: store.state.server,
          database: store.state.database,
          key: key.value
        }).then((data) => {
          Object.assign(state, data);
        }), nv);
      }
    }
  }, { immediate: true });

  onBeforeUnmount(() => {
    if (_updateHandle) {
      clearInterval(_updateHandle);
    }
  });

  onMounted(() => {
    api.endpoints.getData(store.state.server, store.state.database, key.value).then(({ data }) => {
      Object.assign(state, data);
    });
  });
</script>

<style lang="scss">
  @use "sass:math";
  @use "@/assets/style/vars";

  .view-page {
    table {
      width: 100%;
      border: vars.$default-border;
      padding: 0;
      margin: vars.$padding 0;
      border-spacing: 0;

      tr {
        &:nth-child(2n) {
          background-color: rgba(vars.$bg-secondary, 0.2);
        }

        th, td {
          text-align: left;
          padding: math.div(vars.$padding, 3) math.div(vars.$padding, 2);
        }

        th {
          background-color: vars.$bg-secondary;
          border-bottom: vars.$default-border;
          position: sticky;
          top: 0;
          cursor: pointer;
        }

        td {
          font-family: vars.$font-family-monospaced;
        }

        &:not(:last-child) {
          td {
            border-bottom: vars.$default-border;
          }
        }
      }
    }
  }
</style>
