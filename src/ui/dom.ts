import { h, render as preactRender, type ComponentChild, type VNode } from 'preact';
import { html as htmBind } from 'htm/preact';

export const html = htmBind;
export const render = (vnode: VNode | ComponentChild, parent: Element) => {
  preactRender(vnode as VNode, parent);
};

export { h };
