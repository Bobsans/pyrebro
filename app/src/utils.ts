export const isSelfOrChildOf = (element: Element, parent: Element): boolean => {
  return element === parent || (Boolean(element.parentElement) && isSelfOrChildOf(element.parentElement!, parent));
};
