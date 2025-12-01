<template>
  <div class="dropdown" @click.prevent="onClick">
    <div class="value">
      <slot name="value" :value="model">{{ model }}</slot>
    </div>
    <ul class="list" :class="{ 'open': state.open }">
      <li v-for="(item, i) in items" :key="i" @click="onClickItem(item)">
        <slot name="item" :item="item">{{ item }}</slot>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts" generic="V, TO">
  import { reactive, watch } from "vue";
  import { useClickOutside } from "@/uses/click-outside.ts";

  const props = withDefaults(defineProps<{
    items: TO[],
    toValue?: (item: TO) => V,
  }>(), {
    toValue: (item: TO) => item as unknown as V
  });

  const emit = defineEmits<{
    (event: "change", value: V): void
  }>();

  const model = defineModel<V>();

  const state = reactive({
    open: false,
    selected: null as TO | null
  });

  const onClick = () => {
    state.open = !state.open;
  };

  const onClickItem = (item: TO) => {
    model.value = props.toValue(item);
    emit("change", model.value);
  };

  useClickOutside(() => {
    state.open = false;
  });

  watch(() => [model.value, props.items], ([ov, oi], [nv, ni]) => {
    if ((nv && nv !== ov) || (ni && ni !== oi)) {
      for (const item of props.items ?? []) {
        if (props.toValue(item) === model.value) {
          state.selected = item as never;
          break;
        }
      }
    }
  });
</script>

<style lang="scss">
  @use "sass:color";
  @use "@/assets/style/vars";

  .dropdown {
    position: relative;
    padding: vars.$padding;
    border: vars.$default-border;
    width: 200px;
    margin-right: vars.$padding;
    cursor: pointer;

    .value {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;

      &:after {
        content: "▼";
        text-align: right;
      }
    }

    .list {
      position: absolute;
      left: -1px;
      width: calc(100% + 2px);
      top: 100%;
      overflow: hidden auto;
      opacity: 0;
      visibility: hidden;
      max-height: 200px;
      background: vars.$bg-primary;
      border: vars.$default-border;
      list-style: none;
      padding: 0;
      margin: 0;
      transform-origin: top center;
      transform: scaleY(0);
      transition: vars.$default-transition;

      &.open {
        opacity: 1;
        visibility: visible;
        transform: scaleY(1);
      }

      > li {
        padding: vars.$padding;

        &:hover {
          background: color.adjust(vars.$bg-primary, $lightness: -2%);
        }
      }
    }
  }
</style>
