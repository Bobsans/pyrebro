import { getCurrentInstance, type MaybeRefOrGetter, onMounted, onUnmounted, toValue } from "vue";

type HTMLMouseEvent = Omit<PointerEvent, "target"> & { target: HTMLElement };

let isListenerSet = false;
const handlers: ((e: HTMLMouseEvent) => void)[] = [];

export interface ClickOutsideOptions {
  element?: MaybeRefOrGetter<HTMLElement>;
}

export const useClickOutside = (callback: (e: HTMLMouseEvent, element: HTMLElement) => void, options: ClickOutsideOptions = {}) => {
  const currentInstance = getCurrentInstance();

  if (!isListenerSet) {
    document.addEventListener("click", (e) => {
      e.stopPropagation();
      handlers.forEach((it) => it(e as HTMLMouseEvent));
    });
    isListenerSet = true;
  }

  const handler = (e: HTMLMouseEvent) => {
    const element = toValue(options.element) ?? currentInstance?.vnode.el as HTMLElement;
    if (element !== e.target && !element?.contains(e.target)) {
      callback(e, element);
    }
  };

  onMounted(() => handlers.push(handler));
  onUnmounted(() => handlers.splice(handlers.indexOf(handler, 1)));
};
