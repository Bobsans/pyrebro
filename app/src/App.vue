<template>
  <header-block/>
  <router-view/>
</template>

<script setup lang="ts">
  import { RouterView } from "vue-router";
  import HeaderBlock from "@/components/HeaderBlock.vue";
</script>
