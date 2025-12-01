<template>
  <main class="view-page">
    <div v-if="state.type === 'string'">{{ state.value }}</div>
    <table v-else-if="state.type === 'list' || state.type === 'set' || state.type === 'zset'">
      <thead>
        <tr>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, key) in state.value" :key="key">
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
        <tr v-for="(entry, key) in state.value" :key="key">
          <td style="width: 50%;">{{ key }}</td>
          <td style="width: 50%;">{{ entry }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive } from "vue";
  import { store } from "@/store.ts";
  import { useApi } from "@/uses/api.ts";
  import { useRoute } from "vue-router";

  const api = useApi();
  const route = useRoute();

  const key = computed(() => route.params.key as string);

  const state = reactive({
    type: null! as string,
    value: null!
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
