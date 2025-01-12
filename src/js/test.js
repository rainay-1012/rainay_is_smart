// report
// import { assert } from "./utils";

// enum Processing {
//   count,
//   group,
//   flat,
// }

// interface ChatOption {
//   processing: Record<Processing, string>[];
// }

// interface GPTResponse {
//   options: ChatOption[];
// }

// export async function initReport() {
//   async function fetchMetadata() {
//     const response = await fetch("/get_metadata", {
//       headers: {
//         Authorization: `Bearer ${await getCurrentUserToken()}`,
//       },
//     });
//     if (!response.ok) {
//       alert(`Error fetching metadata: ${response.statusText}`);
//     }
//     return await response.json();
//   }

//   const metadata = await fetchMetadata();

//   console.log(metadata);

//   const sourceList = document.querySelector("#source-list");
//   const sourceTemplate = document.querySelector("#source-template");

//   assert(
//     sourceList instanceof HTMLElement &&
//       sourceTemplate instanceof HTMLTemplateElement,
//     "Source list/ template undefined or not HTMLElement"
//   );

//   function addSource(
//     sourceList: HTMLElement,
//     sourceTemplate: HTMLTemplateElement
//   ) {
//     if (sourceList.children.length >= 2) {
//       return;
//     }
//     const sourceNode = sourceTemplate.content.cloneNode(true);

//     const sourceSelect = (sourceNode as HTMLElement).querySelector(
//       'select[name="source"]'
//     );
//     const targetSelect = (sourceNode as HTMLElement).querySelector(
//       'select[name="target"]'
//     );

//     assert(
//       sourceSelect instanceof HTMLSelectElement &&
//         targetSelect instanceof HTMLSelectElement,
//       "Source select/target undefined or not HTMLSelectElement"
//     );

//     const defaultSource = document.createElement("option");
//     defaultSource.selected = true;
//     defaultSource.value = "";
//     defaultSource.disabled = true;
//     defaultSource.textContent = "Select an data source";
//     sourceSelect.appendChild(defaultSource);

//     for (const key in metadata) {
//       const option = document.createElement("option");
//       option.value = key;
//       option.textContent = key;
//       sourceSelect.appendChild(option);
//     }

//     const defaultTarget = document.createElement("option");
//     defaultTarget.selected = true;
//     defaultTarget.disabled = true;
//     defaultTarget.value = "";
//     defaultTarget.textContent = "Select an target attribute";
//     targetSelect.appendChild(defaultTarget);

//     sourceSelect.addEventListener("change", () => {
//       const selectedSource = sourceSelect.value;
//       targetSelect.innerHTML = "";
//       Object.keys(metadata[selectedSource].columns).forEach((value) => {
//         const option = document.createElement("option");
//         option.value = value;
//         option.textContent = value;
//         targetSelect.appendChild(option);
//       });
//     });

//     sourceList.appendChild(sourceNode);
//   }

//   function popSource(sourceList: HTMLElement) {
//     sourceList.children.length <= 1 &&
//       sourceList.lastElementChild &&
//       sourceList?.removeChild(sourceList.lastElementChild);
//   }

//   addSource(sourceList, sourceTemplate);

//   const addSourceBtn = document.querySelector("#add-source-btn");

//   assert(
//     addSourceBtn instanceof HTMLElement,
//     "Add source button undefined or not HTMLElement"
//   );

//   const onAddSourceClick = () => addSource(sourceList, sourceTemplate);

//   const popSourceBtn = document.querySelector("#remove-source-btn");

//   assert(
//     popSourceBtn instanceof HTMLElement,
//     "Pop source button undefined or not HTMLElement"
//   );

//   const onPopSourceClick = () => popSource(sourceList);

//   const dataSourceForm = document.querySelector("#data-source-form");

//   assert(
//     dataSourceForm instanceof HTMLFormElement,
//     "Data source form undefine or not HTMLFormElement"
//   );

//   const onSourceFormSubmitted = async (evt: SubmitEvent) => {
//     evt.preventDefault();
//     const data = new FormData(dataSourceForm);

//     const formattedData: Record<string, Set<string>> = {};

//     let k: string | undefined;
//     for (const [key, value] of data.entries()) {
//       console.log(key, value);
//       if (key === "source" && !formattedData[value.toString()]) {
//         formattedData[value.toString()] = new Set();
//         k = value.toString();
//       } else if (key === "target") {
//         assert(k, `Key of target undefined for value ${value.toString()}`);
//         formattedData[k].add(value.toString());
//       }
//     }

//     const serializableData = Object.fromEntries(
//       Object.entries(formattedData).map(([key, value]) => [
//         key,
//         Array.from(value),
//       ])
//     );

//     const response = await fetch("/get_data_settings", {
//       method: "post",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${await getCurrentUserToken()}`,
//       },
//       body: JSON.stringify(serializableData),
//     });
//     if (!response.ok) {
//       alert(`Error fetching metadata: ${response.statusText}`);
//     }
//     console.log(await response.json());
//     // const responseData = await response.json();
//     // dataSetting.show();
//   };

//   // const dataContent = new Tab(
//   //   document.querySelector("[data-bs-target='#data-content']")
//   // );
//   // const dataSetting = new Tab(
//   //   document.querySelector("[data-bs-target='#data-setting']")
//   // );

//   // document.querySelector("#back-btn")?.addEventListener("click", (evt) => {
//   //   dataContent.show();
//   // });

//   // const tooltipTriggerList = document.querySelectorAll(
//   //   '[data-bs-toggle="tooltip"]'
//   // );
//   // const tooltipList = [...tooltipTriggerList].map(
//   //   (tooltipTriggerEl) => new Tooltip(tooltipTriggerEl)
//   // );

//   addSourceBtn.addEventListener("click", onAddSourceClick);
//   popSourceBtn.addEventListener("click", onPopSourceClick);
//   dataSourceForm.addEventListener("submit", onSourceFormSubmitted);

//   return new Promise((resolve) => {
//     resolve(() => {
//       addSourceBtn?.removeEventListener("click", onAddSourceClick);
//       popSourceBtn?.removeEventListener("click", onPopSourceClick);
//       dataSourceForm.removeEventListener("submit", onSourceFormSubmitted);
//     });
//   });
// }
