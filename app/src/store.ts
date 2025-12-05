import { reactive, watch } from "vue";

const state = reactive({
  server: null! as string,
  database: 0,
  updateInterval: -1
});

const savedState = localStorage.getItem("state");
if (savedState) {
  Object.assign(state, JSON.parse(savedState));
}

watch(state, () => localStorage.setItem("state", JSON.stringify(state)));

export const store = reactive({
  state
});
