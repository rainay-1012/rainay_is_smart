// import { getCurrentUserToken } from "./auth";
// import { assert } from "./utils";

import * as echarts from "echarts";
import { EChartOption } from "echarts";
import { initInput } from ".";
import { getCurrentUserToken } from "./auth";
import { chartsOption } from "./chart-options";
import { SocketDataManager } from "./socket";
import { assert, registerTransforms, withBlock } from "./utils";

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

  const chartContainer = document.getElementById("chart") as HTMLElement;

  const onWindowResize = () => {
    const chartInstance = echarts.getInstanceByDom(chartContainer);
    console.log(chartInstance);

    if (chartInstance) {
      chartInstance.resize();
    }
  };

  window.addEventListener("resize", onWindowResize);

  const chartSelect = document.getElementById(
    "chart-select"
  ) as HTMLSelectElement;

  chartSelect.addEventListener("change", async (event: Event) => {
    const selectedElement = event.target as HTMLSelectElement;

    const selectedValue = selectedElement.value;
    let dataManager;
    let initialData;

    switch (selectedValue) {
      case "itemCategory":
        dataManager = await SocketDataManager.getOrCreateInstance({
          item: "/get_item_data", // Endpoint for item data
        });
        initialData = dataManager.getDataCache("item").data;
        break;

      case "vendorReviewGred":
        dataManager = await SocketDataManager.getOrCreateInstance({
          vendor: "/get_vendor_data", // Endpoint for vendor data
        });
        initialData = dataManager.getDataCache("vendor").data;
        break;
      case "rfqCount":
      case "rfqResponseTime":
        dataManager = await SocketDataManager.getOrCreateInstance({
          rfq: "/get_rfq_data", // Endpoint for RFQ data
        });
        initialData = dataManager.getDataCache("rfq");
        break;

      default:
        console.error("Invalid chart selection");
        return;
    }

    const selectedChartOption = chartsOption[selectedValue];
    // @ts-ignore
    selectedChartOption.dataset[0].source = initialData;

    console.log("Updated Chart Options:", selectedChartOption);

    renderChart("chart", selectedChartOption);
  });

  const dataManager = await SocketDataManager.getOrCreateInstance({
    vendor: "/get_vendor_data",
  });
  let initialData = [];

  initialData = dataManager.getDataCache("vendor");
  const d = chartsOption.vendorReviewGred;
  // @ts-ignore
  d.dataset[0].source = initialData.data;
  renderChart("chart", d);

  return new Promise((resolve) => {
    resolve(() => {
      // addSourceBtn?.removeEventListener("click", onAddSourceClick);
      // popSourceBtn?.removeEventListener("click", onPopSourceClick);
      // dataSourceForm.removeEventListener("submit", onSourceFormSubmitted);
    });
  });
}
