import { EChartOption } from "echarts";

export const chartsOption: Record<string, EChartOption> = {
  itemCategory: {
    dataset: [
      {
        source: [],
      },
      {
        // @ts-ignore
        transform: [
          {
            type: "utils:countBy",
            config: {
              source: "category",
            },
            print: true,
          },
          {
            type: "utils:flat",
            print: true,
          },
        ],
      },
    ],
    title: {
      text: "Item Distribution by Category",
      left: "center",
    },
    tooltip: {
      trigger: "item",
    },
    series: [
      {
        name: "Item Category",
        type: "pie",
        radius: "50%",
        datasetIndex: 1,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  },
  vendorReviewGred: {
    dataset: [
      {
        source: [],
      },
      {
        // @ts-ignore
        transform: [
          {
            type: "utils:pick",
            config: {
              cols: ["name", "gred"],
            },
            print: true,
          },
        ],
        fromTransform: true,
      },
    ],
    title: {
      text: "Vendor Review Grades",
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
    },
    xAxis: {
      type: "category",
    },
    yAxis: {
      type: "value",
      name: "Review Grade",
    },
    series: [
      {
        name: "Review Grade",
        type: "bar",
        datasetIndex: 1,
        encode: {
          x: "name", // Map vendor names to the x-axis
          y: "gred", // Map review grades to the y-axis
        },
        itemStyle: {
          color: "#5470C6",
        },
      },
    ],
  },
  rfqCount: {
    dataset: [
      {
        source: [],
      },
      {
        // @ts-ignore
        transform: [
          {
            type: "utils:countBy",
            config: {
              source: "date", // Count RFQs by date
            },
            print: true,
          },
          {
            type: "utils:flat",
            print: true,
          },
          {
            type: "utils:renameKeys",
            config: {
              map: {
                key: "date",
                value: "count",
              },
              print: true,
            },
          },
        ],
      },
    ],
    title: {
      text: "RFQ Count Over Time",
      left: "center",
    },
    tooltip: {
      trigger: "axis",
    },
    xAxis: {
      type: "time", // Use a time-based x-axis
    },
    yAxis: {
      type: "value",
      name: "Number of RFQs",
    },
    series: [
      {
        name: "RFQ Count",
        type: "line",
        datasetIndex: 1, // Use the transformed dataset
        encode: {
          x: "date", // Map dates to the x-axis
          y: "count", // Map RFQ counts to the y-axis
        },
      },
    ],
  },
};
