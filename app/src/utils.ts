export const isFunction = (value: any): value is ((...args: any[]) => any) => typeof value === "function";
export const isObject = (value: any): value is Record<any, any> => value !== null && typeof value === "object" && !Array.isArray(value);

/* Make a random string of the specified length */
export const randomString = (len: number) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";

  for (let i = 0; i < len; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return text;
};


export const isSelfOrChildOf = (element: Element, parent: Element): boolean => {
  return element === parent || (Boolean(element.parentElement) && isSelfOrChildOf(element.parentElement!, parent));
};
