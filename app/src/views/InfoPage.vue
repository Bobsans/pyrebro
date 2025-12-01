<template>
  <main class="info-page">
    <div v-if="state.last_save">Last save: {{ state.last_save }}</div>

    <table v-for="(values, section) in state.info" :key="section">
      <thead>
        <tr>
          <th colspan="2" style="text-align:center">{{ section }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(value, key) in values" :key="key">
          <td style="width:50%">{{ key }}</td>
          <td style="width:50%">{{ value }}</td>
        </tr>
      </tbody>
    </table>
  </main>
</template>

<script setup lang="ts">
  import { onMounted, reactive } from "vue";
  import { store } from "@/store.ts";
  import { useApi } from "@/uses/api.ts";

  const api = useApi();

  const state = reactive({
    last_save: 0,
    info: {} as Record<string, Record<string, string | number>>
  });

  onMounted(() => {
    api.endpoints.getServerInfo(store.state.server).then(({ data }) => {
      Object.assign(state, data);
    });
  });
</script>

<style lang="scss">
  @use "sass:math";
  @use "@/assets/style/vars";

  .info-page {
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
