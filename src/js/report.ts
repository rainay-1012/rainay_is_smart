// import { getCurrentUserToken } from "./auth";
// import { assert } from "./utils";

import * as echarts from "echarts";
import { EChartOption } from "echarts";
import { initInput } from ".";
import { getCurrentUserToken } from "./auth";
import { assert, registerTransforms, withBlock } from "./utils";

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

interface OutputItem {
  source: string;
  echart_options: EChartOption;
}

async function fetchData(source: string): Promise<any[]> {
  try {
    const response = await fetch(source, {
      headers: {
        Authorization: `Bearer ${await getCurrentUserToken()}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch data from ${source}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error(`Error fetching data from ${source}:`, error);
    return [];
  }
}

export async function initReport() {
  initInput();

  registerTransforms("all");

  async function processOutputItem(
    outputItem: OutputItem
  ): Promise<EChartOption> {
    const { source, echart_options } = outputItem;

    // Fetch data from the source URL
    const data = await fetchData(source);
    console.log(data);
    if (data.length > 0) {
      return {
        ...echart_options,
        dataset: [
          {
            source: data,
          },
          ...(echart_options.dataset as any).slice(1),
        ],
      };
    } else {
      console.warn(
        `No data fetched from ${source}. Returning original options.`
      );
      return echart_options;
    }
  }

  function renderChart(divId: string, options: EChartOption) {
    const chart = echarts.init(document.getElementById(divId));
    chart.clear();
    chart.setOption(options, true);
  }

  async function processAndRender(outputItem: OutputItem, divId: string) {
    try {
      const updatedOptions = await processOutputItem(outputItem);

      // Render the chart in the specified div
      renderChart(divId, updatedOptions);
    } catch (error) {
      console.error("Error processing and rendering chart:", error);
    }
  }

  async function testGetDataSettings(query: string): Promise<void> {
    const url = "/get_data_settings";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    headers["Authorization"] = `Bearer ${await getCurrentUserToken()}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ query: query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error testing /get_data_settings route:", error);
    }
  }

  const chartForm = document.querySelector("#chart-form");

  assert(
    chartForm instanceof HTMLFormElement,
    "Chart form undefined or not HTMLFormElement"
  );

  const onChartFormSubmit = async (evt: SubmitEvent) => {
    evt.preventDefault();

    const data = new FormData(chartForm);

    await withBlock("#content", {
      opacity: 0.5,
      primary: true,
    })(async () => {
      const response = (await testGetDataSettings(
        data.get("query") as string
      )) as any;
      processAndRender(response[0], "chart");
      chartForm.reset();
    })();
  };

  chartForm.addEventListener("submit", onChartFormSubmit);

  const onWindowResize = () => {
    const chartInstance = echarts.getInstanceById("chart");

    // Check if the chart instance exists
    if (chartInstance) {
      // Resize the chart
      chartInstance.resize();
    }
  };

  window.addEventListener("resize", onWindowResize);

  // processAndRender(data[0], "main");
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

  return new Promise((resolve) => {
    resolve(() => {
      // addSourceBtn?.removeEventListener("click", onAddSourceClick);
      // popSourceBtn?.removeEventListener("click", onPopSourceClick);
      // dataSourceForm.removeEventListener("submit", onSourceFormSubmitted);
    });
  });
}
