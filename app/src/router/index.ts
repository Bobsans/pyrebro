import { createRouter, createWebHistory } from "vue-router";
import HomePage from "@/views/HomePage.vue";
import InfoPage from "@/views/InfoPage.vue";
import ViewPage from "@/views/ViewPage.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomePage
    }, {
      path: "/info",
      name: "info",
      component: InfoPage
    }, {
      path: "/view/:key",
      name: "view",
      component: ViewPage
    }
  ]
});

export default router;
