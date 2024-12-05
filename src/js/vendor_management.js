import { Modal } from "bootstrap";
import DataTable from "datatables.net";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";
import "datatables.net-responsive";
import "datatables.net-responsive-bs5";
import "datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css";
import "datatables.net-select";
import "dropzone/dist/dropzone.css";
import * as echarts from "echarts";
import "../style/vendor_management.scss";

export async function initVendorManagement() {
  // let progress = document.getElementById("step-progress");
  // let steps = document.querySelectorAll(".step");
  // let stepContainers = document.querySelectorAll(".step-container");
  // let currentStep = 1;

  // function goToStep(step) {
  //   currentStep = step;
  //   let width = (100 / steps.length) * step;
  //   progress.style.width = `${width}%`;
  //   steps.forEach((elm, index) => {
  //     if (index < step - 1) {
  //       elm.innerHTML = '<i class="bx fs-4 bx-check"></i>';
  //       stepContainers[index].classList.add("disabled-container");
  //     } else {
  //       elm.innerHTML = index + 1;
  //       stepContainers[index].classList.remove("disabled-container");
  //     }
  //     if (index < step) {
  //       elm.classList.remove("bg-secondary-subtle");
  //       elm.classList.add("bg-primary");
  //     } else {
  //       elm.classList.remove("bg-primary");
  //       elm.classList.add("bg-secondary-subtle");
  //     }
  //   });
  //   stepContainers.forEach((elm, index) => {
  //     if (index == step - 1) {
  //       elm.classList.add("glowing");
  //     } else {
  //       elm.classList.remove("glowing");
  //     }
  //   });
  // }

  // document.getElementById("next").addEventListener("click", (evt) => {
  //   if (currentStep < steps.length) goToStep(currentStep + 1);
  // });

  // document.getElementById("prev").addEventListener("click", (evt) => {
  //   if (currentStep > 1) goToStep(currentStep - 1);
  // });

  // goToStep(currentStep);

  const vendorTable = new DataTable("#vendor-table", {
    // ajax: {
    //   url: `/get_company_data`,
    //   dataSrc: "",
    //   headers: {
    //     Authorization: `Bearer ${await getCurrentUserToken()}`,
    //   },
    //   error: function (jqXHR, textStatus, errorThrown) {
    //     console.error("Error fetching company data:", textStatus, errorThrown);
    //   },
    // },
    layout: {
      topStart: {
        buttons: [
          {
            extend: "collection",
            text: "Export",
            className: "text-light",
            buttons: ["copy", "csv", "excel", "pdf", "print"],
          },
        ],
      },
    },
    processing: true,
    serverSide: false,
    responsive: true,
    paging: true,
    pageLength: 5,
    lengthChange: false,
    searching: true,
    ordering: true,
    columns: [
      { data: "id" },
      { data: "name" },
      { data: "address" },
      { data: "picname" },
      { data: "picemail" },
      { data: "piccontact" },
      { data: "gred" },
    ],
    // columnDefs: [{ targets: "_all", defaultContent: "N/A" }],
  });

  let vendorData = [
    {
      name: "Starbucks Sdn Bhd",
      address: "Kedah",
      picname: "Anna",
      picemail: "anna@gmail.com",
      piccontact: "012-3456789",
    },
  ];

  const addVendorForm = document.querySelector("#add-vendor-form");
  const addVendorModalelm = document.querySelector("#addVendorModal");
  const addVendorModal = new Modal(addVendorModalelm);

  function resetAddVendorForm() {
    addVendorForm.reset();
  }

  addVendorModalelm.addEventListener("hide.bs.modal", resetAddVendorForm);

  const vendorManageModal = new Modal("#vendorManageModal");

  const vendorRowClickListener = function () {
    const data = vendorTable.row(this).data();
    console.log(data);
    document.getElementById("_id").value = data["id"];
    document.getElementById("_name").value = data["name"];
    document.getElementById("_address").value = data["address"];
    document.getElementById("_picname").value = data["picname"];
    document.getElementById("_picemail").value = data["picemail"];
    document.getElementById("_piccontact").value = data["piccontact"];

    vendorManageModal.show();
  };

  const editVendorForm = document.querySelector("#edit-vendor-form");

  function onEditVendorFormSubmit(evt) {
    evt.preventDefault();
    if (!editVendorForm.checkValidity()) {
      return;
    }

    const data = new FormData(editVendorForm);
    console.log(Object.fromEntries(data));
    // const response = await fetch("/edit_vendor", {
    //   headers: {
    //     Authorization: `Bearer ${await getCurrentUserToken()}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(data)
    // })
    addVendorModal.hide();
  }

  editVendorForm.addEventListener("submit", onEditVendorFormSubmit);

  $("#vendor-table tbody").on("click", "tr", vendorRowClickListener);

  async function onAddVendorFormSubmit(evt) {
    evt.preventDefault();
    if (!addVendorForm.checkValidity()) {
      return;
    }
    const data = new FormData(addVendorForm);
    vendorData.push(Object.fromEntries(data));
    console.log(vendorData);

    // const response = await fetch("/create_vendor", {
    //   headers: {
    //     Authorization: `Bearer ${await getCurrentUserToken()}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(data)
    // })
    addVendorModal.hide();
  }

  addVendorForm.addEventListener("submit", onAddVendorFormSubmit);
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

  return new Promise((resolve) => {
    resolve(() => {
      // sidebarToggler.removeEventListener("click", toggleChat);
      // mediaQuery.removeEventListener("change", handleMediaQueryChange);
      // chatInput.removeEventListener("input", chatInput);
    });
  });
}
