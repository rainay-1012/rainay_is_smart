import "datatables.net";
import DataTable from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";
import "datatables.net-responsive";
import "datatables.net-responsive-bs5";
import "datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css";
import "datatables.net-select";
import "dropzone/dist/dropzone.css";
import * as echarts from "echarts";
import $ from "jquery";
import "../style/vendor_management.scss";

let progress = document.getElementById("step-progress");
let steps = document.querySelectorAll(".step");
let stepContainers = document.querySelectorAll(".step-container");
let currentStep = 1;

console.log("done");

// document
//   .querySelector("#addCompanyBtn")
//   .addEventListener("click", async (evt) => {
//     await fetchMainContent(
//       "/vendor_add.html",
//       document.querySelector("#main-container")
//     );
//   });

function goToStep(step) {
  currentStep = step;
  let width = (100 / steps.length) * step;
  progress.style.width = `${width}%`;
  steps.forEach((elm, index) => {
    if (index < step - 1) {
      elm.innerHTML = '<i class="bx fs-4 bx-check"></i>';
      stepContainers[index].classList.add("disabled-container");
    } else {
      elm.innerHTML = index + 1;
      stepContainers[index].classList.remove("disabled-container");
    }
    if (index < step) {
      elm.classList.remove("bg-secondary-subtle");
      elm.classList.add("bg-primary");
    } else {
      elm.classList.remove("bg-primary");
      elm.classList.add("bg-secondary-subtle");
    }
  });
  stepContainers.forEach((elm, index) => {
    if (index == step - 1) {
      elm.classList.add("glowing");
    } else {
      elm.classList.remove("glowing");
    }
  });
}

document.getElementById("next").addEventListener("click", (evt) => {
  if (currentStep < steps.length) goToStep(currentStep + 1);
});

document.getElementById("prev").addEventListener("click", (evt) => {
  if (currentStep > 1) goToStep(currentStep - 1);
});

goToStep(currentStep);

let bar = echarts.init(document.getElementById("chart1"));

// Draw the chart
bar.setOption({
  grid: {
    bottom: 30,
  },
  responsive: true,
  maintainAspectRatio: false,
  title: {
    text: "Bar Chart",
  },
  tooltip: {},
  xAxis: {
    data: ["shirt", "cardigan", "chiffon", "pants", "heels", "socks"],
  },
  yAxis: {},
  series: [
    {
      name: "sales",
      type: "bar",
      data: [5, 20, 36, 10, 10, 20],
    },
  ],
});

let line = echarts.init(document.getElementById("chart2"));
line.setOption({
  grid: {
    bottom: 30,
  },
  responsive: true,
  maintainAspectRatio: false,
  title: {
    text: "Line Chart",
  },
  xAxis: {
    type: "category",
    data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  tooltip: {},
  yAxis: {
    type: "value",
  },
  series: [
    {
      data: [150, 230, 224, 218, 135, 147, 260],
      type: "line",
    },
  ],
});

$(window).on("resize", function () {
  bar.resize();
  line.resize();
});

new DataTable("#table");

//File Drop
