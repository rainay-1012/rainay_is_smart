import "bootstrap";
import { Modal, Tooltip } from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "boxicons/css/boxicons.min.css";
import "datatables.net";
import DataTable from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";
import "datatables.net-responsive";
import "datatables.net-responsive-bs5";
import "datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css";
import "datatables.net-select";
import * as echarts from "echarts";
import $ from "jquery";
import "../assets/logo only.svg";
import "../style/dev_dashboard.scss";

$(function () {
  const table = new DataTable("#example", {
    pageLength: 5,
    lengthMenu: [5, 10, 15],
    responsive: true,
  });

  const tokenTable = new DataTable("#example1", {
    pageLength: 5,
    lengthMenu: [5, 10, 15],
    responsive: true,
    columnDefs: [
      { orderable: false, render: DataTable.render.select(), targets: 0 },
    ],
    fixedColumns: { start: 2 },
    order: [[1, "asc"]],
    select: { style: "os", selector: "td:first-child" },
  });

  const companyModal = new Modal("#companyManageModal");

  $("#example tbody").on("click", "tr", function () {
    console.log("clicked: " + table.row(this).data());
    const data = table.row(this).data();
    document.getElementById("_id").value = data[0];
    document.getElementById("_name").value = data[1];
    document.getElementById("_email").value = data[2];
    document.getElementById("_address").value = data[3];
    document.getElementById("_package").value = data[4];
    console.log(document.getElementById("_startDate"));
    const startDate = new Date(data[5]);
    const formattedDate = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(startDate);

    document.getElementById("_startDate").textContent = formattedDate;

    companyModal.show();
  });

  const tooltipTriggerList = document.querySelectorAll(
    '[data-bs-toggle="tooltip"]'
  );
  const tooltipList = [...tooltipTriggerList].map(
    (tooltipTriggerEl) => new Tooltip(tooltipTriggerEl)
  );

  let myChart = echarts.init(document.getElementById("main"));

  const rootStyles = getComputedStyle(document.documentElement);
  const primaryColor = rootStyles.getPropertyValue("--bs-primary").trim();
  const warningColor = rootStyles.getPropertyValue("--bs-warning").trim();
  const dangerColor = rootStyles.getPropertyValue("--bs-danger").trim();

  myChart.setOption({
    tooltip: {
      trigger: "item",
    },
    grid: {
      bottom: 30,
    },
    responsive: true,
    maintainAspectRatio: false,
    legend: {
      top: "5%",
      left: "center",
    },
    series: [
      {
        name: "Access From",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: "center",
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 40,
            fontWeight: "bold",
          },
        },
        center: ["50%", "55%"],
        labelLine: {
          show: false,
        },
        data: [
          { value: 1048, name: "Active", itemStyle: { color: primaryColor } },
          { value: 580, name: "Inactive", itemStyle: { color: warningColor } },
          { value: 735, name: "Expired", itemStyle: { color: dangerColor } },
        ],
      },
    ],
  });

  let userChart = echarts.init(document.getElementById("userChart"));

  function randomData() {
    now = new Date(+now + oneDay);
    value = value + Math.random() * 21 - 10;
    return {
      name: now.toString(),
      value: [
        [now.getFullYear(), now.getMonth() + 1, now.getDate()].join("/"),
        Math.round(value),
      ],
    };
  }

  let data = [];
  let now = new Date(1997, 9, 3);
  let oneDay = 24 * 3600 * 1000;
  let value = Math.random() * 1000;

  for (var i = 0; i < 1000; i++) {
    data.push(randomData());
  }

  let option = {
    grid: {
      top: 30,
      bottom: 30,
    },
    responsive: true,
    maintainAspectRatio: false,
    tooltip: {
      trigger: "axis",
      formatter: function (params) {
        params = params[0];
        var date = new Date(params.name);
        return (
          date.getDate() + "/" + (date.getMonth() + 1) + "/" + params.value[1]
        );
      },
      axisPointer: {
        animation: false,
      },
    },
    xAxis: {
      type: "time",
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: "value",
      boundaryGap: [0, "100%"],
      splitLine: {
        show: false,
      },
    },
    series: [
      {
        name: "Fake Data",
        type: "line",
        showSymbol: false,
        data: data,
      },
    ],
  };

  userChart.setOption(option);

  setInterval(function () {
    for (var i = 0; i < 5; i++) {
      data.shift();
      data.push(randomData());
    }
    userChart.setOption({
      series: [
        {
          data: data,
        },
      ],
    });
  }, 1000);

  $(window).on("resize", function () {
    myChart.resize();
    userChart.resize();
  });
});
