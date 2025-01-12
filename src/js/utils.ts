import DataTables, { Api } from "datatables.net-bs5";
import * as echarts from "echarts";
import Joi from "joi";
import _ from "lodash";
import { marked } from "marked";
import {
  DataTransformOption,
  DimensionName,
  ExternalDataTransform,
  ExternalDataTransformParam,
} from "../types/transform-types";
import { getCurrentUserToken } from "./auth";

interface GeneralResponse {
  code: string;
  message: string;
}

interface CountByTransformOption extends DataTransformOption {
  type: "utils:count";
  config: {
    source: DimensionName;
  };
}

interface RenameKeyTransformOption extends DataTransformOption {
  type: "utils:renameKey";
  config: {
    map: Record<string, string>;
    exception?: string;
  };
}

interface ObjectSplitTransformOption extends DataTransformOption {
  type: "utils:objectSplit";
  config: {
    index?: number;
  };
}

interface PickTransformOption extends DataTransformOption {
  type: "utils:pick";
  config: {
    cols: string[];
  };
}

export type TransformType =
  | "utils:countBy"
  | "utils:renameKeys"
  | "utils:objectSplit"
  | "utils:flat"
  | "utils:pick";

export type RegisterTransformTypes = TransformType | "all";

export const countBy: ExternalDataTransform<CountByTransformOption> = {
  type: "utils:countBy",
  transform: (params: ExternalDataTransformParam<CountByTransformOption>) => {
    const { upstream, config } = params;
    const rawData = upstream.cloneRawData();
    const { source } = config || {};

    const grouped = _.countBy(rawData, source);
    console.log(grouped);

    return {
      data: [grouped],
    }; // input: data: ["a", "b", "b"] | output: data: [{"a":1,"b":2}]
  },
};

export const renameKeys: ExternalDataTransform<RenameKeyTransformOption> = {
  type: "utils:renameKeys",
  transform: (params: ExternalDataTransformParam<RenameKeyTransformOption>) => {
    const { upstream, config } = params;
    const rawData = upstream.cloneRawData();
    const { map, exception } = config || {};

    const resultData = rawData.map(function (o: Record<string, any>) {
      return _.mapKeys(o, function (v, k) {
        return map[k] || (exception ? exception : k);
      });
    });

    return {
      data: resultData,
    };
  },
};

export const objectSplit: ExternalDataTransform<ObjectSplitTransformOption> = {
  type: "utils:objectSplit",
  transform: (
    params: ExternalDataTransformParam<ObjectSplitTransformOption>
  ) => {
    const { upstream, config } = params;
    const rawData = upstream.cloneRawData();
    const { index } = config || {};

    return {
      data: _.map(_.toPairs(rawData[index ?? 0]), (pair) =>
        _.fromPairs([pair])
      ),
    }; // input: data: [{"a":1,"b":2}] | output: data: [{"a":1}, {"b":2}]
  },
};

export const flat: ExternalDataTransform<DataTransformOption> = {
  type: "utils:flat",
  transform: (params: ExternalDataTransformParam<DataTransformOption>) => {
    const { upstream } = params;
    const rawData = upstream.cloneRawData();

    return {
      data: _.flatMap(rawData, (obj: Record<string, any>) =>
        _.map(_.toPairs(obj), ([key, value]) => ({ name: key, value }))
      ),
    }; // input: data: [{"a":24},{"b":1}] | output: data: [{"name":"a","value":24},{"name":"b","value":1}]
  },
};

export const pick: ExternalDataTransform<DataTransformOption> = {
  type: "utils:pick",
  // @ts-ignore
  transform: (params: ExternalDataTransformParam<PickTransformOption>) => {
    const { upstream, config } = params;
    const rawData = upstream.cloneRawData();
    const { cols } = config || {};

    return {
      data: rawData.map((item) => _.pick(item, cols)),
    }; // input: data: [{"a":24},{"b":1}] | output: data: [{"name":"a","value":24},{"name":"b","value":1}]
  },
};

export type ExternalDataTransformWithCorrectType =
  ExternalDataTransform<DataTransformOption>;

export function registerTransforms(
  transformTypes: RegisterTransformTypes | RegisterTransformTypes[]
) {
  // Define the list of available transformations
  const allTransforms: Record<TransformType, ExternalDataTransform<any>> = {
    "utils:countBy": countBy,
    "utils:renameKeys": renameKeys,
    "utils:objectSplit": objectSplit,
    "utils:flat": flat,
    "utils:pick": pick,
  };

  if (
    transformTypes === "all" ||
    (Array.isArray(transformTypes) && transformTypes.includes("all"))
  ) {
    Object.values(allTransforms).forEach((transform) => {
      // @ts-ignore
      echarts.registerTransform(transform);
    });
  } else {
    const typesToRegister = Array.isArray(transformTypes)
      ? transformTypes
      : [transformTypes];
    typesToRegister.forEach((type) => {
      // @ts-ignore
      const transform = allTransforms[type];
      if (transform) {
        echarts.registerTransform(transform);
      } else {
        console.warn(`Transformation type "${type}" not found.`);
      }
    });
  }
}

type Action = "hidden" | "readonly" | "disabled" | "required" | "default";

interface ElementMapItem {
  selector: string;
  value?: string | number; // For setting value or textContent
  style?: Record<string, string | number>; // For setting CSS styles
  attribute?: Record<string, string>; // For setting attributes
  action?: Action;
  className?: string;
}

/**
 * Maps values and/or actions to HTML elements based on a list of mapping items.
 * @param map - A list of objects containing element IDs, optional values, and optional actions to apply.
 */
export function mapToElement(map: ElementMapItem[]): void {
  _.forEach(map, ({ selector, value, style, attribute, action, className }) => {
    const element = document.querySelector(selector);

    if (!element || !(element instanceof HTMLElement)) {
      console.warn(
        `Element with ID '${selector}' not found or not HTMLElement.`
      );
      return;
    }

    if (className) {
      element.classList.add(className);
    }

    if (value !== undefined) {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        element.value = value.toString();
      } else {
        element.innerHTML = value.toString();
      }
    }

    if (style && typeof style === "object") {
      Object.keys(style).forEach((styleKey) => {
        const styleValue = style[styleKey];
        element.style.setProperty(styleKey, styleValue.toString());
      });
    }

    if (attribute && typeof attribute === "object") {
      Object.keys(attribute).forEach((attrKey) => {
        const attrValue = attribute[attrKey];
        element.setAttribute(attrKey, attrValue);
      });
    }

    if (action) {
      switch (action) {
        case "hidden":
          element.style.display = "none";
          break;
        case "readonly":
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement
          ) {
            element.readOnly = true;
          } else {
            console.warn(
              `Readonly action is not applicable to element with ID '${selector}'.`
            );
          }
          break;
        case "disabled":
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLButtonElement ||
            element instanceof HTMLFieldSetElement
          ) {
            element.disabled = true;
          } else {
            console.warn(
              `Disabled action is not applicable to element with ID '${selector}'.`
            );
          }
          break;
        case "required":
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement
          ) {
            element.required = true;
          } else {
            console.warn(
              `Required action is not applicable to element with ID '${selector}'.`
            );
          }
          break;

        default:
          element.style.display = "";
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLTextAreaElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLButtonElement ||
            element instanceof HTMLFieldSetElement
          ) {
            element.disabled = false;
            if ("readOnly" in element) {
              element.readOnly = false;
            }
            if ("required" in element) {
              element.required = false;
            }
          }
      }
    }
  });
}

type TableActionType = "edit" | "delete";

export class TableAction {
  /**
   * Generates HTML for action icons with specified classes, data attributes, and callbacks.
   * @param type - The type of action (e.g., "edit", "delete").
   * @param className - Optional class to apply to the icon.
   * @param dataAttributes - Optional data attributes to add to the icon.
   * @returns A string containing the HTML for the specified action icon.
   */
  static generateActionHTML({
    type,
    className = "",
    dataAttributes = {},
  }: {
    type: TableActionType;
    className?: string;
    dataAttributes?: Record<string, string>;
  }): string {
    const attributes = this.generateAttributes(dataAttributes);
    switch (type) {
      case "edit":
        return `<i role="button" class="bi bi-pencil-fill ${className}" ${attributes}></i>`;
      case "delete":
        return `<i role="button" class="bi bi-trash ${className}" ${attributes}></i>`;
    }
  }

  /**
   * Attaches click listeners to specified elements based on their selector and executes the provided callback.
   * @param selector - The CSS selector for elements to attach the listener to.
   * @param table - The DataTable API instance to bind the event listener to.
   * @param callback - The function to execute when an element is clicked.
   */
  static attachListeners({
    selector,
    table,
    callback,
  }: {
    selector: string;
    table: Api<any>;
    callback: (this: HTMLElement, e: Event, data: any) => void;
  }): void {
    table.on("click", selector, function (event) {
      callback.call(this, event, table.row(this.closest("tr") as any).data());
    });
  }

  /**
   * Generates a string of HTML attributes from a key-value object.
   * @param attributes - A record of attribute names and values.
   * @returns A string of HTML attributes.
   */
  private static generateAttributes(
    attributes: Record<string, string>
  ): string {
    return Object.entries(attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");
  }

  /**
   * Generates configuration for export buttons in a table layout.
   * @param options - An object containing the button text, classes, and export configurations.
   * @returns An object representing the export button configuration.
   */
  static generateExportButtonConfig({
    text = '<i class="bi bi-arrow-bar-up fw-bold me-2"></i>Export',
    className = "btn-dark",
    columns = [],
  }: {
    text?: string;
    className?: string;
    columns?: number[];
  }) {
    return {
      extend: "collection",
      text,
      className,
      buttons: ["copy", "csv", "excel", "pdf", "print"].map((type) => ({
        extend: type,
        exportOptions: {
          columns,
        },
      })),
    };
  }
  /**
   * Returns a callback function that handles making an API request with dynamic success/error messages.
   * @param message - The message to display before making the request.
   * @param url - The URL of the API endpoint.
   * @param method - The HTTP method (default is POST).
   * @param token - The authentication token for the request.
   * @param contentType - The content type for the request (default is 'application/json').
   * @param response - The response object with customized messages and element for displaying them.
   * @returns A callback function that executes the request.
   */
  static createApiRequestCallback({
    message,
    url,
    method = "POST", // Default to POST method
    token,
    body,
    silent = false,
    contentType = "application/json", // Default to 'application/json'
    response = {}, // Default empty response object
  }: {
    message?: string;
    url: string;
    method?: string;
    token: string;
    silent?: boolean;
    body?: any;
    contentType?: string;
    response?: {
      element?: string; // Element to display the message
    };
  }) {
    const element = response.element ?? "#content-container";

    return async function () {
      let confirmAction = true;
      if (message) {
        confirmAction = confirm(message);
      }

      if (confirmAction) {
        try {
          const apiResponse = await fetch(url, {
            method: method,
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": contentType,
            },
            body: body,
          });

          if (apiResponse.ok) {
            const data = await apiResponse.json();
            if (!silent)
              showMessage(data.message, {
                type: MessageType.SUCCESS,
                element: element,
              });

            return await data;
          } else {
            throw await apiResponse.json();
          }
        } catch (error: any) {
          console.error("Error:", error);
          if (!silent)
            showMessage(error.message, {
              type: MessageType.DANGER,
              element: element,
            });
        }
      }
    };
  }
}
/**
 * A class that encapsulates form validation using Joi.
 */
export class FormValidator {
  private schema: Joi.ObjectSchema;
  private form: HTMLFormElement;
  private listenersMap: WeakMap<HTMLInputElement, EventListener>;

  constructor(schema: Joi.ObjectSchema, form: HTMLFormElement) {
    this.schema = schema;
    this.form = form;
    this.listenersMap = new WeakMap();
  }

  /**
   * Validates a single field using its specific Joi schema.
   * @param field The input field to validate.
   */
  private validateField(field: HTMLInputElement | HTMLSelectElement) {
    setTimeout(() => {
      // Skip validation if constant no-validate is enabled
      if (field.dataset.constantNoValidate === "true") {
        return;
      }

      // Skip validation temporarily if no-validate is enabled
      if (field.dataset.noValidate === "true") {
        field.dataset.noValidate = "false";
        return;
      }

      // Handle Tom Select fields
      let value: string | string[] | undefined;
      if (field instanceof HTMLSelectElement && "tomselect" in field) {
        const tomSelectControl = field.tomselect;
        if (tomSelectControl) {
          value = (tomSelectControl as any).getValue(); // Get value from Tom Select
        } else {
          value = field.value; // Fallback for regular select
        }
      } else {
        value = field.value; // Regular input fields
      }

      // Extract entire form data
      const formData = new FormData(field.form!);
      const formObject = Object.fromEntries(formData.entries()) as Record<
        string,
        any
      >;

      // Update form data with Tom Select values (if any)
      if (field.name && value) {
        formObject[field.name] = value;
      }

      // Validate full form with context
      const { error } = this.schema.validate(formObject, {
        abortEarly: false, // Get all errors
      });

      // Find specific error for this field
      const fieldError = error?.details.find(
        (e) => e.context?.key === field.name
      );

      // Clear previous feedback
      field.setCustomValidity("");
      const feedback = field.parentElement?.querySelector(".invalid-feedback");
      if (feedback) {
        feedback.textContent = "";
      }

      if (fieldError) {
        // Handle validation failure
        const message = fieldError.message;
        if (message) {
          field.setCustomValidity(message);
          if (feedback) {
            feedback.textContent = message;
          }
        }
        field.classList.add("is-invalid");
        field.classList.remove("is-valid");
      } else {
        // Validation succeeded
        field.classList.remove("is-invalid");
        field.classList.add("is-valid");
      }
    }, 200);
  }

  /**
   * Attaches blur validation to all input fields within the form.
   * Each field is validated individually when it loses focus.
   */
  public attachValidation() {
    const fields = this.form.querySelectorAll("input");
    fields.forEach((field) => {
      const listener = (evt: Event) =>
        this.validateField(field as HTMLInputElement);
      field.addEventListener("blur", listener);

      // Store the listener for later removal
      this.listenersMap.set(field as HTMLInputElement, listener);
    });
  }

  /**
   * Validates the entire form using the provided Joi schema.
   * Applies feedback messages and validation styles to all fields.
   * @returns The validated form data or null if validation fails.
   */
  public validateForm() {
    const data = new FormData(this.form);
    const formData: Record<string, any> = {};

    // Handle regular fields and Tom Select fields
    data.forEach((value, key) => {
      const field = this.form.querySelector(`[name="${key}"]`) as any;

      // Check if the field is a Tom Select instance
      if (field instanceof HTMLSelectElement && "tomselect" in field) {
        const tomSelectControl = field.tomselect as any;
        formData[key] = tomSelectControl.getValue();
      } else {
        const allValues = data.getAll(key);
        if (allValues.length > 1) {
          formData[key] = allValues;
        } else {
          formData[key] = value;
        }
      }
    });

    const { error, value } = this.schema.validate(formData, {
      abortEarly: false,
    });

    // Clear previous feedback
    const fields = this.form.querySelectorAll("input, select");
    fields.forEach((field) => {
      (field as HTMLInputElement).setCustomValidity("");
      field.classList.remove("is-invalid", "is-valid");
    });

    if (error) {
      console.error(error);

      error.details.forEach((detail) => {
        const field = this.form.querySelector(
          `[name="${detail.context?.key}"]`
        ) as HTMLInputElement | HTMLSelectElement;

        if (field) {
          // Set custom validity message
          field.setCustomValidity(detail.message);

          // If the form does not have `novalidate`, use browser's validation UI
          if (!this.form.hasAttribute("novalidate")) {
            field.reportValidity();
          } else {
            // Fallback to custom feedback for forms with `novalidate`
            const feedback =
              field.parentElement?.querySelector(".invalid-feedback");
            if (feedback) {
              feedback.textContent = detail.message;
            }
            field.classList.add("is-invalid");
          }
        }
      });

      this.form.classList.add("was-validated");
      return null; // Validation failed
    }

    // Mark fields as valid if no error
    fields.forEach((field) => {
      field.classList.add("is-valid");
      field.classList.remove("is-invalid");
    });

    return value; // Validation succeeded
  }

  /**
   * Resets the form by clearing all values, removing validation messages, and cleaning up form styles.
   * It also removes `was-validated` class and clears the `:invalid` states.
   */
  public resetForm() {
    const fields = this.form.querySelectorAll("input, select, textarea");

    fields.forEach((field) => {
      const f = field as HTMLInputElement;

      // Clear the values and reset validity
      f.value = "";
      f.setCustomValidity("");

      // Remove validation feedback and error classes
      const feedback = f.parentElement?.querySelector(".invalid-feedback");
      if (feedback) {
        feedback.textContent = "";
      }

      f.classList.remove("is-invalid");
      f.classList.remove("is-valid");
    });

    // Remove the "was-validated" class from the form
    this.form.classList.remove("was-validated");
  }

  /**
   * Return inner HTMLFormElement
   */
  public getElement() {
    return this.form;
  }

  /**
   * Disposes of all event listeners attached for field validation.
   * This is useful to clean up after the form is reset or when it's no longer needed.
   */
  public dispose() {
    const fields = this.form.querySelectorAll("input");
    fields.forEach((field) => {
      const listener = this.listenersMap.get(field as HTMLInputElement);
      if (listener) {
        field.removeEventListener("blur", listener);
        this.listenersMap.delete(field as HTMLInputElement);
      }
    });
  }
}

export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function blockElement(
  element: HTMLElement | string,
  {
    opacity = 1,
    type = "border", // New field: type
    small = false,
    primary = true,
    zIndex = 10000,
  }: {
    opacity?: number;
    type?: "grow" | "border" | "bar" | "none";
    small?: boolean;
    primary?: boolean;
    zIndex?: number;
  } = {}
) {
  const $element = $(element as any);

  // Spinner configuration
  const spinnerSizeClass = small ? "spinner-border-sm" : "";
  const spinnerColorClass = primary ? "text-primary" : "text-primary-emphasis";
  const spinnerType =
    type === "grow"
      ? "spinner-grow"
      : type === "border"
      ? "spinner-border"
      : "";

  if (type === "bar" || type === "none") {
    type === "bar" &&
      $element.addClass("container-loading-bar overflow-hidden");
    $element.block({
      message: null,
      overlayCSS: {
        backgroundColor: "#f8f9fa",
        opacity: opacity,
        zIndex: zIndex - 1,
      },
      css: {
        border: "none",
        backgroundColor: "transparent",
        cursor: "wait",
        zIndex: zIndex,
      },
    });
  } else {
    $element.block({
      message: `
      <div class="${spinnerType} ${spinnerSizeClass} ${spinnerColorClass} d-flex justify-content-center align-items-center position-fixed start-50 top-50" style="translate: -50% -50%;" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>`,
      centerX: false,
      centerY: false,
      overlayCSS: {
        backgroundColor: "#f8f9fa",
        opacity: opacity,
        zIndex: zIndex - 1,
      },
      css: {
        border: "none",
        backgroundColor: "transparent",
        cursor: "wait",
        zIndex: zIndex,
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
      },
    });
  }

  // $element.css("pointer-events", "none");
  // $element.prop("disabled", true);
}

export function unblockElement(element: HTMLElement | string) {
  const $element = $(element as any);
  $element.unblock({
    onUnblock(element, options) {
      $element.removeClass("container-loading-bar overflow-hidden");
      $element.css("pointer-events", "auto");
      $element.prop("disabled", false);
    },
  });
}

export function withBlock<T>(
  element: HTMLElement | string,
  blockParams: {
    opacity?: number;
    type?: "grow" | "border" | "bar" | "none";
    small?: boolean;
    primary?: boolean;
    zIndex?: number;
    minTime?: number;
  } = {}
): (target: (...args: any[]) => Promise<T>) => (...args: any[]) => Promise<T> {
  const applyBlock = (
    target: (...args: any[]) => Promise<T>
  ): ((...args: any[]) => Promise<T>) => {
    return async (...args: any[]) => {
      const startTime = Date.now();
      try {
        blockElement(element, blockParams);

        const result = await target(...args);
        const elapsedTime = Date.now() - startTime;
        if (blockParams.minTime && elapsedTime < blockParams.minTime) {
          const remainingTime = blockParams.minTime - elapsedTime;
          await new Promise((resolve) => setTimeout(resolve, remainingTime));
        }

        return result;
      } finally {
        unblockElement(element);
      }
    };
  };

  // Return a function that wraps the target
  return (target: (...args: any[]) => Promise<T>) => applyBlock(target);
}

export enum MessageType {
  SUCCESS = "success",
  DANGER = "danger",
  WARNING = "warning",
  INFO = "info",
}

export function showMessage(
  message: string,
  {
    element = "body",
    type = MessageType.INFO,
    position = "prepend",
    animated = true,
    timeout = 5000,
    mode = "alert", // 'alert' or 'toast'
  } = {}
) {
  // Validate alert type
  if (!Object.values(MessageType).includes(type)) {
    console.error(`Invalid message type: ${type}`);
    return;
  }

  // Create message container
  const messageDiv = document.createElement("div");

  if (mode === "alert") {
    // Alert Mode
    messageDiv.className = `alert alert-${type} alert-dismissible mb-0`;
    messageDiv.setAttribute("role", "alert");
  } else if (mode === "toast") {
    if (position === "bottom-right") {
      messageDiv.style.bottom = "16px";
      messageDiv.style.right = "16px";

      messageDiv.className = `toast position-fixed align-items-center text-bg-${type} border-0`;
    } else {
      messageDiv.style.top = "16px";
      messageDiv.className = `toast position-fixed start-50 translate-middle-x align-items-center text-bg-${type} border-0`;
    }
    messageDiv.setAttribute("role", "alert");
    messageDiv.setAttribute("aria-live", "assertive");
    messageDiv.setAttribute("aria-atomic", "true");
  } else {
    console.error(`Invalid mode: ${mode}`);
    return;
  }

  // Add content
  messageDiv.innerHTML = `
    <div class="d-flex">
      <div class="toast-body flex-grow-1">${message}</div>
      <button type="button" class="btn-close me-2 mt-2 mb-auto" aria-label="Close"></button>
    </div>
  `;

  const elm = $(element);

  // Position handling for alert
  if (mode === "alert" && position === "fixed-top") {
    messageDiv.style.position = "fixed";
    messageDiv.style.top = "0";
    messageDiv.style.left = "0";
    messageDiv.style.width = "100%";
    elm.append(messageDiv);
  } else if (mode === "alert") {
    elm.prepend(messageDiv);
  } else if (mode === "toast") {
    elm.append(messageDiv);
  }

  const $messageDiv = $(messageDiv);

  // Show animation
  if (animated) {
    if (mode === "alert") $messageDiv.slideDown(300);
    if (mode === "toast") $messageDiv.fadeIn(300);
  } else {
    $messageDiv.show();
  }

  messageDiv.style.zIndex = "9998";

  // Close button event
  $messageDiv.find(".btn-close").on("click", function () {
    if (animated) {
      if (mode === "alert")
        $messageDiv.slideUp(300, () => $messageDiv.remove());
      if (mode === "toast")
        $messageDiv.fadeOut(300, () => $messageDiv.remove());
    } else {
      $messageDiv.remove();
    }
  });

  // Auto-dismiss
  setTimeout(() => {
    if (animated) {
      if (mode === "alert")
        $messageDiv.slideUp(300, () => $messageDiv.remove());
      if (mode === "toast")
        $messageDiv.fadeOut(300, () => $messageDiv.remove());
    } else {
      $messageDiv.remove();
    }
  }, timeout);
}

export class PasswordToggle {
  private input: HTMLInputElement;
  private toggleButton: HTMLElement;
  private eventListener: () => void;
  private boundUpdatePosition: () => void;

  constructor(input: HTMLInputElement) {
    if (
      !input ||
      input.type !== "password" ||
      !(input instanceof HTMLInputElement)
    ) {
      throw new Error("Provided element is not a password input field.");
    }

    this.input = input;
    this.toggleButton = document.createElement("i");
    this.eventListener = this.toggleVisibility.bind(this);
    this.boundUpdatePosition = this.updatePosition.bind(this);
    this.init();
  }

  init() {
    // Insert the toggle button into the DOM directly after the input
    this.input.parentElement?.appendChild(this.toggleButton);

    // Set up the toggle button styles
    this.toggleButton.className = "bi bi-eye-slash-fill";
    this.toggleButton.style.position = "absolute";
    this.toggleButton.style.cursor = "pointer";
    this.toggleButton.style.fontSize = "18px";
    this.toggleButton.tabIndex = -1;

    // Calculate and set the button's position

    // Position the button initially
    this.boundUpdatePosition();

    // Recalculate the position on window resize to handle layout changes
    window.addEventListener("resize", this.boundUpdatePosition);

    // Attach the click event listener
    this.toggleButton.addEventListener("click", this.eventListener);

    // Clean up when disposing
    this.dispose = () => {
      this.toggleButton.removeEventListener("click", this.eventListener);
      window.removeEventListener("resize", this.boundUpdatePosition);
      this.toggleButton.remove();
    };
  }

  updatePosition() {
    const inputRect = this.input.getBoundingClientRect();
    const parentRect = this.input.parentElement?.getBoundingClientRect() ?? {
      left: 0,
      top: 0,
    };

    this.toggleButton.style.top = `${
      inputRect.top - parentRect.top + inputRect.height / 2
    }px`;
    this.toggleButton.style.left = `${
      inputRect.right - parentRect.left - 25
    }px`;
    this.toggleButton.style.transform = "translateY(-50%)";
  }

  toggleVisibility() {
    this.input.dataset.noValidate = "true";
    console.log("b");
    if (this.input.type === "password") {
      this.input.type = "text";
      this.toggleButton.className = "bi bi-eye-fill";
    } else {
      this.input.type = "password";
      this.toggleButton.className = "bi bi-eye-slash-fill";
    }
  }

  dispose() {
    this.toggleButton.removeEventListener("click", this.eventListener);
  }
}

export function decodeHtml(html: string) {
  var txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

export interface ChartSuggestion {
  type: "chart";
  title: string;
  chartId: string;
}

export interface TableSuggestion {
  type: "table";
  tableId: string;
  title: string;
  sort: { [column: string]: "asc" | "desc" };
  drop?: string[];
  filter?: { [column: string]: string };
  topN: number;
}

export type MixedSuggestion = ChartSuggestion | TableSuggestion;

export class ChatManager {
  private static instance: ChatManager;
  private $drawer!: JQuery<HTMLElement>;
  private $chatInput!: JQuery<HTMLElement>;
  private _isDrawerOpen!: boolean;
  private _data?: Partial<
    Record<"table" | "chart", string | object | string[]>
  >;
  private chatConversations: { input: string; output: string }[] = [];
  private _suggestion?: MixedSuggestion[];
  private _initialized: boolean = false;

  private constructor(suggestions: MixedSuggestion[]) {
    this._suggestion = suggestions;
    this._initDrawer();
    if (!this._initialized) {
      this._initTextArea();
      this._insertDefaultContent();
    }
    this._initialized = true;
  }

  public static getOrCreateInstance(suggestions: MixedSuggestion[]) {
    if (!ChatManager.instance) {
      ChatManager.instance = new ChatManager(suggestions);
    }
    ChatManager.instance._initDrawer();
    return ChatManager.instance;
  }

  private _initDrawer(): void {
    this.$drawer = $(`#${this._drawerId}`);
    this._isDrawerOpen = false;

    this.$drawer.css({
      bottom: $(`#${this._chatFormId}`).outerHeight() ?? 0 + 10,
      maxHeight: 0,
      overflow: "hidden",
      transition: "none",
      padding: 0,
    });

    $(`#${this._chatAttachmentId}`).on("click", async (e) => {
      e.stopPropagation();
      if (this.$drawer.css("maxHeight") === "0px") {
        this._showDrawer();
      } else {
        await this._collapseDrawer();
      }
    });

    $(document).on("click", async (e) => {
      e.stopPropagation();
      if (
        !$(e.target).closest(`#${this._chatAttachmentId}, #${this._drawerId}`)
          .length
      ) {
        await this._collapseDrawer();
      }
    });

    this._renderDrawer();
  }

  private _collapseDrawer(): Promise<void> {
    this._isDrawerOpen = false;

    return new Promise<void>((resolve) => {
      this.$drawer.css({
        transition: "max-height 0.3s ease-in",
        maxHeight: 0,
      });
      this.$drawer.on(
        "transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd",
        () => {
          this.$drawer.off();
          resolve();
        }
      );
    });
  }

  private _showDrawer(): void {
    if (this._isDrawerOpen) return;
    const drawerHeight = this.$drawer[0].scrollHeight;
    const maxDrawerHeight = Math.min(drawerHeight, window.innerHeight * 0.4);

    this.$drawer.css({
      bottom: $(`#${this._chatFormId}`).outerHeight() ?? 0 + 10,
      transition: "max-height 0.3s ease-out",
      maxHeight: maxDrawerHeight + "px",
    });

    this._isDrawerOpen = true;
  }

  private _renderDrawer(title?: string) {
    if (!this._data) {
      if (!this._suggestion) {
        return;
      }

      const listItems: string[] = [];

      this._suggestion?.forEach((suggestion, index) => {
        listItems.push(
          `<button type="button" id="suggestion-${index}" class="btn btn-primary text-transform-inherit text-start shadow-0 list-group-item px-3 active">${suggestion.title}</button>`
        );
      });

      $(`#${this._chatAttachmentContentId}`).html(
        `<div class="list-group">${listItems.join("")}</div>`
      );

      this._attachSuggestionListener();
    } else {
      console.log(this._data.table);

      if (this._data.table) {
        $(`#${this._chatAttachmentContentId}`).html(
          `<figure
          class="bg-white p-3 rounded border-start border-4 border-primary">
          ${
            title &&
            `<figcaption class="blockquote-footer mb-0 overflow-x-hidden font-italic">
            ${title}
          </figcaption>`
          }
          <blockquote class="blockquote small overflow-x-hidden">
            <small>
              <pre style="font-size: 0.8rem" class="m-0">${JSON.stringify(
                this._data,
                null,
                2
              )}</pre>
            </small>
          </blockquote>
        </figure>`
        );
      }
    }
  }

  private _attachSuggestionListener() {
    $(`#${this._chatAttachmentContentId}`).on(
      "click",
      ".list-group-item",
      async (event) => {
        const $element = $(event.target).closest(".list-group-item");
        const index = parseInt($element.attr("id")!.split("-")[1]);
        const suggestion = this._suggestion?.at(index);
        if (suggestion) {
          if (suggestion.type === "table") {
            const table = new DataTables(`#${suggestion.tableId}`);
            let data = table.rows().data().toArray();

            if (suggestion.sort) {
              data = _.orderBy(
                data,
                [Object.keys(suggestion.sort)[0]],
                [Object.values(suggestion.sort)[0]]
              );
            }

            if (suggestion.filter) {
              data = _.filter(data, (row) => {
                return Object.entries(suggestion.filter!).every(
                  ([column, value]) => {
                    return row[column] === value;
                  }
                );
              });
            }

            if (suggestion.drop) {
              data = data.map((row) => _.omit(row, suggestion.drop!));
            }

            data = data.slice(0, suggestion.topN);
            this._detachSuggestionListener();
            this.setData({ table: data }, suggestion.title);
          }
        }
      }
    );
  }

  public async setData(
    data: Partial<Record<"table" | "chart", string | object | string[]>>,
    title: string
  ) {
    this._data = data;
    const isOpen = this._isDrawerOpen;
    isOpen && (await this._collapseDrawer());
    this._renderDrawer(title);
    isOpen && this._showDrawer();
  }

  private _detachSuggestionListener(): void {
    $(`#${this._chatAttachmentContentId}`).off("click", ".list-group-item");
  }

  private _initTextArea() {
    this.$chatInput = $(`#${this._chatInputId}`);

    this.$chatInput.height(this.$chatInput[0].scrollHeight);

    const resizeChatInput = () => {
      this.$chatInput.height("auto");
      this.$drawer.css({
        bottom: $(`#${this._chatFormId}`).outerHeight() ?? 0 + 10,
      });
      const computedStyle = window.getComputedStyle(this.$chatInput[0]);
      const maxHeight = parseInt(computedStyle.maxHeight);
      const minHeight = parseInt(computedStyle.minHeight);

      const scrollHeight = this.$chatInput[0].scrollHeight;
      let newHeight = scrollHeight;

      if (newHeight < minHeight) {
        newHeight = minHeight;
      } else if (newHeight > maxHeight) {
        newHeight = maxHeight;
      }

      this.$chatInput.height(newHeight);

      if (newHeight >= maxHeight) {
        this.$chatInput.css({
          overflowY: "scroll",
        });
        this.$chatInput[0].scrollTop = this.$chatInput[0].scrollHeight;
      } else {
        this.$chatInput.css({
          overflowY: "hidden",
        });
      }
    };

    this.$chatInput.on("input", resizeChatInput);

    const $chatContent = $(`#${this._chatContentId}`);
    const $chatForm = $(`#${this._chatFormId}`);
    const $userMessageTemplate = $(`#${this._userTemplate}`);
    const $userReplyTemplate = $(`#${this._userReply}`);

    const onChatSubmit = async (evt: any) => {
      evt.preventDefault();

      if (this.chatConversations.length === 0) {
        $chatContent.html("");
      }

      const data = new FormData($chatForm.get(0) as HTMLFormElement);
      const inputText = data.get("chat-input") as string;

      ($chatForm.get(0) as HTMLFormElement).reset();
      resizeChatInput();

      const userMessage = $($userMessageTemplate.html());
      const userMessageElement = userMessage.find(".user-message");

      console.assert(
        userMessageElement.length > 0,
        "userMessageElement undefined or not HTMLElement"
      );

      userMessageElement.html(data.get("chat-input") as string);
      $chatContent.append(userMessage);
      $chatContent[0].scrollIntoView(false);

      let query = this.chatConversations
        .map((conv) => `User: ${conv.input}\nBot: ${conv.output}`)
        .join("\n");
      query += `\nUser: ${inputText}`;

      const response = await fetch("/consult", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getCurrentUserToken()}`,
        },
        body: JSON.stringify({
          input: JSON.stringify({ data: this._data, query: query }),
        }),
      });

      assert(response.ok, `HTTP error! status: ${response.status}`);

      const userReply = $($userReplyTemplate.html());

      let reply = "";
      $chatContent.append(userReply);

      const reader = response.body?.getReader();

      assert(reader, "Reader undefined or not supported");

      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        reply += chunk;
        userReply.html(await marked(reply));
        $chatContent[0].scrollIntoView(false);
      }
      $chatContent[0].scrollIntoView(false);

      this.chatConversations.push({ input: inputText, output: reply });
    };

    $chatForm.on("submit", onChatSubmit);
  }

  private _insertDefaultContent() {
    $(`#${this._chatContentId}`).html("");

    $(`#${this._chatContentId}`).html(
      $(`#${this._chatContentTemplateId}`).clone().html()
    );
  }

  private _drawerId: string = "chat-drawer";
  private _chatContentId: string = "chat-content";
  private _chatContentTemplateId: string = "chat-content-template";
  private _chatFormId: string = "chat-form";
  private _chatAttachmentId: string = "chat-attachment";
  private _chatAttachmentContentId: string = "chat-drawer-content";
  private _chatInputId: string = "chat-input";
  private _userTemplate: string = "user-message-template";
  private _userReply: string = "user-reply-template";
}

// export class ChatManager {
//   private static instance: ChatManager;
//   private data: string | string[] | object | null = null;
//   private dataType: "image" | "json" | null = null;
//   private readonly maxImages: number = 5;
//   private chatConversations: { input: string; output: string }[] = [];
//   private readonly listContainerId: string = "data-list-container";
//   private readonly chatAttachmentId: string = "chat-drawer-content";
//   private isDrawerOpen: boolean;

//   // Private drawer properties
//   private $drawer: JQuery<HTMLElement>;
//   private chatFormHeight: number;

//   private constructor() {
//     this.$drawer = $("#chat-drawer"); // Selecting the drawer element
//     this.chatFormHeight = $("#chat-form").outerHeight() ?? 0;
//     this.isDrawerOpen = false;
//     const chatInput = document.querySelector("#chat-input");

//     assert(
//       chatInput instanceof HTMLTextAreaElement,
//       "chatInput undefined or not HTMLTextAreaElement"
//     );

//     chatInput.style.height = `${chatInput.scrollHeight}px`;

//     const resizeChatInput = () => {
//       chatInput.style.height = "auto";

//       const computedStyle = getComputedStyle(chatInput);
//       const maxHeight = parseInt(computedStyle.maxHeight);

//       assert(!isNaN(maxHeight), "Invalid maxHeight in computed styles");

//       // Resize based on scrollHeight
//       if (chatInput.scrollHeight > maxHeight) {
//         chatInput.style.overflowY = "scroll";
//         chatInput.style.height = `${maxHeight}px`;
//         chatInput.scrollTop = chatInput.scrollHeight;
//       } else {
//         chatInput.style.overflowY = "hidden";
//         chatInput.style.height = `${chatInput.scrollHeight}px`;
//       }
//     };

//     const chatOnInput = (event: Event) => {
//       const target = event.target;

//       assert(
//         target instanceof HTMLTextAreaElement,
//         "Chat input event target undefined or not HTMLTextAreaElement"
//       );

//       resizeChatInput();
//     };

//     chatInput.addEventListener("input", chatOnInput);

//     const chatForm = document.querySelector("#chat-form");
//     const chatContent = document.querySelector("#chat-content");
//     const defaultChatContent = document.querySelector("#chat-content-template");
//     const userMessageTemplate = document.querySelector(
//       "#user-message-template"
//     );
//     const userReplyTemplate = document.querySelector("#user-reply-template");

//     assert(
//       chatForm instanceof HTMLFormElement,
//       "chatInputContainer undefined or not HTMLFormElement"
//     );

//     assert(
//       chatContent instanceof HTMLElement,
//       "chatContent undefined or not HTMLElement"
//     );

//     assert(
//       defaultChatContent instanceof HTMLTemplateElement,
//       "defaultChatContent undefined or not HTMLTemplateElement"
//     );

//     assert(
//       userMessageTemplate instanceof HTMLTemplateElement,
//       "userMessageTemplate undefined or not HTMLTemplateElement"
//     );

//     assert(
//       userReplyTemplate instanceof HTMLTemplateElement,
//       "userReplyTemplate undefined or not HTMLTemplateElement"
//     );

//     let reset = false;

//     function insertDefaultContent() {
//       reset = false;
//       chatContent!.innerHTML = "";
//       chatContent!.appendChild(
//         (defaultChatContent as HTMLTemplateElement).content.cloneNode(true)
//       );
//     }

//     insertDefaultContent();

//     const onChatSubmit = async (evt: SubmitEvent) => {
//       evt.preventDefault();

//       if (!reset) {
//         chatContent!.innerHTML = "";
//         reset = true;
//       }

//       const data = new FormData(chatForm);
//       const inputText = data.get("chat-input") as string;
//       chatForm.reset();
//       resizeChatInput();

//       const userMessage = userMessageTemplate.content.cloneNode(true);
//       const userMessageElement = (userMessage as HTMLElement).querySelector(
//         ".user-message"
//       );

//       assert(
//         userMessageElement instanceof HTMLElement,
//         "userMessageElement undefined or not HTMLElement"
//       );

//       userMessageElement.innerHTML = data.get("chat-input") as string;
//       chatContent.appendChild(userMessage);
//       chatContent.scrollIntoView(false);

//       const response = await fetch("/consult", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${await getCurrentUserToken()}`,
//         },
//         body: JSON.stringify({
//           input: JSON.stringify({ data: this.data, query: inputText }),
//         }),
//       });

//       assert(response.ok, `HTTP error! status: ${response.status}`);

//       const userReply = userReplyTemplate.content.cloneNode(true);
//       const userReplyContent = (userReply as HTMLElement).querySelector(
//         ".user-reply"
//       );

//       assert(
//         userReplyContent instanceof HTMLElement,
//         "userReplyContent undefined or not HTMLElement"
//       );

//       userReplyContent.innerHTML = "";
//       let reply = "";
//       chatContent!.appendChild(userReplyContent);

//       const reader = response.body?.getReader();
//       assert(reader, "Reader undefined or not supported");

//       const decoder = new TextDecoder("utf-8");

//       while (true) {
//         console.log(reply);
//         const { done, value } = await reader.read();
//         if (done) break;
//         const chunk = decoder.decode(value, { stream: true });
//         reply += chunk;
//         userReplyContent.innerHTML = await marked(reply);
//         chatContent.scrollIntoView(false);
//       }
//       chatContent.scrollIntoView(false);

//       this.chatConversations.push({ input: inputText, output: reply });
//     };

//     chatForm.addEventListener("submit", onChatSubmit);

//     this.initDrawer();
//   }

//   public static getInstance(): ChatManager {
//     if (!ChatManager.instance) {
//       ChatManager.instance = new ChatManager();
//     }
//     return ChatManager.instance;
//   }

//   // Initialize the drawer state
//   private initDrawer(): void {
//     this.$drawer.css({
//       bottom: this.chatFormHeight - 0.8,
//       maxHeight: 0,
//       overflow: "hidden",
//       transition: "none",
//       padding: 0,
//     });
//     $("#chat-attachment").on("click", async (e) => {
//       e.stopPropagation();
//       if (this.$drawer.css("maxHeight") === "0px") {
//         this.showDrawer(); // Show the drawer if it's currently collapsed
//       } else {
//         await this.collapseDrawer(); // Collapse the drawer if it's currently expanded
//       }
//     });

//     // Listener to collapse the drawer when clicking outside of it
//     $(document).on("click", async (e) => {
//       e.stopPropagation();
//       if (!$(e.target).closest("#chat-attachment, #chat-drawer").length) {
//         await this.collapseDrawer();
//       }
//     });
//     this.render();
//   }

//   // Show the drawer with smooth transition
//   private collapseDrawer(): Promise<void> {
//     this.isDrawerOpen = false;

//     return new Promise<void>((resolve) => {
//       this.$drawer.css({
//         transition: "max-height 0.3s ease-in",
//         maxHeight: 0, // Set max-height to 0 to collapse the drawer
//       });
//       this.$drawer.on(
//         "transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd",
//         () => {
//           this.$drawer.off();
//           console.log(this.isDrawerOpen);

//           resolve();
//         }
//       );
//     });
//   }

//   // Show the drawer with the content
//   private showDrawer(): void {
//     if (this.isDrawerOpen) return;

//     const drawerHeight = this.$drawer[0].scrollHeight;
//     const maxDrawerHeight = Math.min(drawerHeight, window.innerHeight * 0.4);

//     // Apply the max-height to show the drawer
//     this.$drawer.css({
//       transition: "max-height 0.3s ease-out",
//       maxHeight: maxDrawerHeight + "px",
//     });

//     // Set the state after showing the drawer
//     this.isDrawerOpen = true;
//     console.log(this.isDrawerOpen);
//   }
//   // Add or replace data
//   public async setData(
//     dataType: "image" | "json",
//     data: string | object,
//     title?: string
//   ): Promise<void> {
//     if (this.dataType !== dataType) {
//       this.dataType = dataType;
//       this.data = dataType === "image" ? [data as string] : data;
//     } else if (dataType === "image" && Array.isArray(this.data)) {
//       if (this.data.length < this.maxImages) {
//         this.data.push(data as string);
//       } else {
//         throw new Error("Maximum image limit reached");
//       }
//     } else {
//       this.data = data;
//     }

//     // Detach any previous event listeners
//     this.detachListeners();

//     const isOpen = this.isDrawerOpen;
//     console.log(isOpen);
//     isOpen && (await this.collapseDrawer());
//     // Re-render content
//     this.render(title);

//     isOpen && this.showDrawer();
//   }

//   // Retrieve data
//   public getData(): string | string[] | object | null {
//     return this.data;
//   }

//   // Append to chat conversations
//   public appendChat(input: string, output: string): void {
//     this.chatConversations.push({ input, output });
//     this.saveChatToLocalStorage();
//   }

//   // Reset chat conversations
//   public resetChat(): void {
//     this.chatConversations = [];
//     this.saveChatToLocalStorage();
//   }

//   // Clear all data and chat
//   public clearAll(): void {
//     this.data = null;
//     this.dataType = null;
//     this.resetChat();
//     this.detachListeners();
//   }

//   // Save chat to local storage
//   private saveChatToLocalStorage(): void {
//     localStorage.setItem(
//       "chatConversations",
//       JSON.stringify(this.chatConversations)
//     );
//   }

//   // Load chat from local storage
//   public loadChatFromLocalStorage(): void {
//     const storedChats = localStorage.getItem("chatConversations");
//     if (storedChats) {
//       this.chatConversations = JSON.parse(storedChats);
//     }
//   }

//   // Render HTML based on data type
//   public render(title?: string) {
//     let attachment = "<p>No data available</p>";

//     if (!this.data) {
//       const elements = document.querySelectorAll("[data-chat-input]");
//       const listItems: string[] = [];

//       elements.forEach((element) => {
//         const inputType = element.getAttribute("data-chat-input");
//         const inputTitle = element.getAttribute("data-chat-input-title");
//         const tableTarget = element.getAttribute("data-table-target");

//         if (inputType === "table" && inputTitle && tableTarget) {
//           listItems.push(
//             `Select top 10 of <strong>${tableTarget}</strong> data from <strong>${inputTitle}.</strong>`
//           );
//         } else if (inputType === "chart" && inputTitle) {
//           listItems.push(`Attach image from ${inputTitle}`);
//         }
//         attachment = `<div id="${
//           this.listContainerId
//         }" class="list-group bg-primary-subtle">${listItems
//           .map(
//             (item) => `
//             <button type="button" data-chat-id="${element.id}" data-chat-input="${inputType}" data-chat-input-title="${inputTitle}" data-table-target="${tableTarget}" class="btn btn-primary text-transform-inherit text-start shadow-0 list-group-item px-3">
//               ${item}
//             </button>`
//           )
//           .join("")}</div>`;
//       });

//       $(`#${this.chatAttachmentId}`).html(attachment);
//       this.attachListeners(listItems);

//       return;
//     }

//     // Handle other data types like image or JSON
//     if (this.dataType === "image" && Array.isArray(this.data)) {
//       attachment = this.data
//         .map((img) => `<img src="${img}" alt="image" />`)
//         .join("");
//     } else if (this.dataType === "json" && this.data) {
//       attachment = `
//         <figure
//           class="bg-white p-3 rounded border-start border-4 border-primary">
//           ${
//             title &&
//             `<figcaption class="blockquote-footer mb-0  font-italic">
//            ${title}
//           </figcaption>`
//           }
//           <blockquote class="blockquote small">
//             <small>
//               <pre style="font-size: 0.8rem" class="m-0">${JSON.stringify(
//                 this.data,
//                 null,
//                 2
//               )}</pre>
//             </small>
//           </blockquote>
//         </figure>`;
//     }

//     $(`#${this.chatAttachmentId}`).html(attachment);

//     // Show the drawer after rendering content
//     this.showDrawer();
//   }

//   // Attach listeners to list items
//   private attachListeners(items: string[]): void {
//     console.log(`#${this.listContainerId} .list-group-item`);
//     const listElements = document.querySelectorAll(
//       `#${this.listContainerId} .list-group-item`
//     );
//     listElements.forEach((element, index) => {
//       element.addEventListener("click", () => {
//         const inputType = element.getAttribute("data-chat-input");
//         const inputTitle = element.getAttribute("data-chat-input-title");
//         const tableTarget = element.getAttribute("data-table-target");
//         const id = element.getAttribute("data-chat-id");
//         const tableExclude = element.getAttribute("data-table-exlucde");

//         if (inputType === "table" && inputTitle && tableTarget) {
//           const table = new DataTables(`#${id}`);
//           const allData = table.rows().data().toArray();
//           const excludeList = tableExclude ? tableExclude.split(/\s+/) : [];
//           const top10 = _(allData)
//             .orderBy([tableTarget], ["desc"])
//             .take(10)
//             .filter((row) => {
//               return !excludeList.includes(row[tableTarget]);
//             })
//             .value();

//           this.setData("json", top10, inputTitle);
//           return;
//         }
//       });
//     });
//   }

//   // Detach listeners from list items
//   private detachListeners(): void {
//     const listElements = document.querySelectorAll(
//       `#${this.listContainerId} .list-group-item`
//     );
//     listElements.forEach((element) => {
//       const newElement = element.cloneNode(true);
//       element.parentNode?.replaceChild(newElement, element);
//     });
//   }
// }
