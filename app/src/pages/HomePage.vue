<template>
  <main class="home-page">
    <div class="actions">
      <div>
        Search: <input v-model="state.pattern" type="text" @keydown.enter="load">
      </div>
      <div>
        <button @click="deleteSelected">Delete</button>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 10px"><input v-model="allSelected" type="checkbox"></th>
          <th @click="changeOrdering('key')" :class="getOrderingClass('key')"><span>Key</span></th>
          <th @click="changeOrdering('type')" class="minimal" :class="getOrderingClass('type')"><span>Type</span></th>
          <th @click="changeOrdering('size')" class="minimal" :class="getOrderingClass('size')"><span>Size</span></th>
          <th @click="changeOrdering('ttl')" class="minimal" :class="getOrderingClass('ttl')"><span>Ttl</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in state.items" :key="item.key">
          <td>
            <input v-model="state.selected" type="checkbox" :value="item.key">
          </td>
          <td>
            <router-link :to="{name: 'view', params: {key: item.key}}">{{ item.key }}</router-link>
          </td>
          <td>{{ item.type }}</td>
          <td>{{ item.size }}</td>
          <td>{{ item.ttl }}</td>
        </tr>
      </tbody>
    </table>
    <div ref="loadTrigger" role="status" aria-live="polite">
      <span v-if="state.loading">Loading…</span>
      <template v-else-if="state.error">
        {{ state.error }} <button @click="loadMore(retryRefresh)">Retry</button>
      </template>
      <span v-else-if="!state.hasMore">All keys loaded ({{ state.items.length }})</span>
    </div>
  </main>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
  import { store } from "@/store";
  import { useApi, type EntriesPage } from "@/uses/api";
  import type { RedisEntry } from "@/types";
  import { useWebsocket } from "@/uses/websocket";

  const api = useApi();
  const ws = useWebsocket();

  const state = reactive({
    items: [] as RedisEntry[],
    selected: [] as string[],
    pattern: "*",
    sort: "key:asc",
    loading: false,
    hasMore: true,
    error: ""
  });

  const loadTrigger = ref<HTMLElement | null>(null);
  let observer: IntersectionObserver | null = null;
  let generation = 0;
  let offset = 0;
  let appliedPattern = state.pattern;
  let retryRefresh = false;

  const allSelected = computed({
    get: () => state.items.length > 0 && state.items.length === state.selected.length,
    set: (value) => {
      if (value) {
        state.selected = state.items.map(it => it.key);
      } else {
        state.selected = [];
      }
    }
  });

  const changeOrdering = (field: keyof RedisEntry) => {
    if (state.sort.startsWith(`${field}:`)) {
      state.sort = `${field}:${state.sort.split(":")[1] === "asc" ? "desc" : "asc"}`;
    } else {
      state.sort = `${field}:asc`;
    }

    load();
  };

  const getOrderingClass = (field: keyof RedisEntry) => ({
    "asc": state.sort === `${field}:asc`,
    "desc": state.sort === `${field}:desc`
  });

  const readPage = async (pageOffset: number, refresh: boolean): Promise<EntriesPage> => {
    const page = refresh
      ? await ws.request<EntriesPage>("server:entries", {
        server: store.state.server, database: store.state.database,
        pattern: appliedPattern, sort: state.sort, offset: pageOffset, limit: 500
      })
      : await api.endpoints.getEntries(store.state.server, store.state.database, appliedPattern, state.sort, pageOffset)
        .then(({ response, data }) => {
          if (!response.ok) throw new Error("Failed to load keys.");
          return data;
        });
    if (!Array.isArray(page?.items) || typeof page.has_more !== "boolean") {
      throw new Error("Failed to load keys.");
    }
    return page;
  };

  const loadMore = async (refresh = false) => {
    if (state.loading || !store.state.server || (!refresh && !state.hasMore)) return;
    const currentGeneration = generation;
    state.loading = true;
    state.error = "";
    try {
      const items = refresh ? [] : [...state.items];
      let nextOffset = refresh ? 0 : offset;
      const target = refresh ? Math.max(offset, 500) : offset + 500;
      let page: EntriesPage;
      do {
        page = await readPage(nextOffset, refresh);
        if (currentGeneration !== generation) return;
        items.push(...page.items);
        nextOffset += page.items.length;
      } while (refresh && page.has_more && page.items.length > 0 && nextOffset < target);
      state.items = [...new Map(items.map(item => [item.key, item])).values()];
      offset = nextOffset;
      state.hasMore = page.has_more;
      const keys = new Set(state.items.map(item => item.key));
      state.selected = state.selected.filter(key => keys.has(key));
    } catch {
      if (currentGeneration === generation) {
        retryRefresh = refresh;
        state.error = "Failed to load keys.";
      }
    } finally {
      if (currentGeneration === generation) {
        state.loading = false;
        await nextTick();
        if (currentGeneration === generation && !state.error && state.hasMore &&
          loadTrigger.value && loadTrigger.value.getBoundingClientRect().top <= window.innerHeight + 200) {
          void loadMore();
        }
      }
    }
  };

  const load = () => {
    generation++;
    offset = 0;
    appliedPattern = state.pattern;
    state.items = [];
    state.selected = [];
    state.hasMore = true;
    state.loading = false;
    state.error = "";
    void loadMore();
  };

  const deleteSelected = () => {
    api.endpoints.deleteKeys(store.state.server, store.state.database, state.selected).then(() => load());
  };

  watch(() => [store.state.server, store.state.database], () => {
    load();
  }, { immediate: true });

  let _updateHandle: number | null = null;
  watch(() => store.state.updateInterval, (interval) => {
    if (_updateHandle !== null) clearInterval(_updateHandle);
    _updateHandle = interval > 0 ? window.setInterval(() => {
      if (!state.error) void loadMore(true);
    }, interval) : null;
  }, { immediate: true });

  onMounted(() => {
    observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !state.error) void loadMore();
    }, { rootMargin: "200px" });
    if (loadTrigger.value) observer.observe(loadTrigger.value);
  });

  onBeforeUnmount(() => {
    generation++;
    observer?.disconnect();
    if (_updateHandle) {
      clearInterval(_updateHandle);
    }
  });
</script>

<style lang="scss">
  @use "sass:math";
  @use "@/assets/style/vars";

  .home-page {
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

          > span {
            display: flex;
            width: 100%;
            align-items: center;
            justify-content: space-between;
          }

          &.minimal {
            width: 150px;
          }

          &.asc {
            > span::after {
              content: "▲";
            }
          }

          &.desc {
            > span::after {
              content: "▼";
            }
          }
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
