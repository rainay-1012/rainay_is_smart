// mdb-ui-kit.d.ts

// Import Bootstrap types
import * as Bootstrap from "bootstrap";

// Declare module for 'mdb-ui-kit'
declare module "mdb-ui-kit" {
  export class Modal extends Bootstrap.Modal {}
  export class Carousel extends Bootstrap.Carousel {}
  export class Tooltip extends Bootstrap.Tooltip {}
  export class Popover extends Bootstrap.Popover {}
  export class Offcanvas extends Bootstrap.Offcanvas {}
  export class Collapse extends Bootstrap.Collapse {}
  export class Dropdown extends Bootstrap.Dropdown {}
  export class Input {
    constructor(element: Element, options?: any);
    [key: string]: any;
  }

  export class Tab {
    constructor(element: Element, options?: any);
    [key: string]: any;
  }

  export class Ripple {
    constructor(element: Element, options?: any);
    [key: string]: any;
  }

  // Utility function
  export function initMDB(options?: any): void;
  export function initMDB({});
}
