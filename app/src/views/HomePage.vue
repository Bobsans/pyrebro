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
  </main>
</template>

<script setup lang="ts">
  import { computed, reactive, watch } from "vue";
  import { store } from "@/store";
  import { useApi } from "@/uses/api";
  import type { RedisEntry } from "@/types";

  const api = useApi();

  const state = reactive({
    items: [] as RedisEntry[],
    selected: [] as string[],
    pattern: "*",
    sort: "key:asc"
  });

  const allSelected = computed({
    get: () => state.items.length === state.selected.length,
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

  const load = () => {
    api.endpoints.getEntries(store.state.server, store.state.database, state.pattern, state.sort).then(({ data }) => {
      state.items = data;
    });
  };

  const deleteSelected = () => {
    api.endpoints.deleteKeys(store.state.server, store.state.database, state.selected).then(() => load());
  };

  watch(() => [store.state.server, store.state.database], async () => {
    load();
  }, { immediate: true });
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
