"use strict";
self["webpackHotUpdate"]("dev_dashboard",{

/***/ "./src/js/dev_dashboard.js":
/*!*********************************!*\
  !*** ./src/js/dev_dashboard.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var bootstrap__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! bootstrap */ "./node_modules/bootstrap/dist/js/bootstrap.esm.js");
/* harmony import */ var bootstrap_dist_css_bootstrap_min_css__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! bootstrap/dist/css/bootstrap.min.css */ "./node_modules/bootstrap/dist/css/bootstrap.min.css");
/* harmony import */ var boxicons_css_boxicons_min_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! boxicons/css/boxicons.min.css */ "./node_modules/boxicons/css/boxicons.min.css");
/* harmony import */ var datatables_net__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! datatables.net */ "./node_modules/datatables.net/js/dataTables.mjs");
/* harmony import */ var datatables_net_bs5__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! datatables.net-bs5 */ "./node_modules/datatables.net-bs5/js/dataTables.bootstrap5.mjs");
/* harmony import */ var datatables_net_bs5_css_dataTables_bootstrap5_min_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! datatables.net-bs5/css/dataTables.bootstrap5.min.css */ "./node_modules/datatables.net-bs5/css/dataTables.bootstrap5.min.css");
/* harmony import */ var datatables_net_responsive__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! datatables.net-responsive */ "./node_modules/datatables.net-responsive/js/dataTables.responsive.mjs");
/* harmony import */ var datatables_net_responsive_bs5__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! datatables.net-responsive-bs5 */ "./node_modules/datatables.net-responsive-bs5/js/responsive.bootstrap5.mjs");
/* harmony import */ var datatables_net_responsive_bs5_css_responsive_bootstrap5_min_css__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css */ "./node_modules/datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css");
/* harmony import */ var echarts__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! echarts */ "./node_modules/echarts/index.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! jquery */ "./node_modules/jquery/dist/jquery.js");
/* harmony import */ var jquery__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(jquery__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var _style_dev_dashboard_scss__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../style/dev_dashboard.scss */ "./src/style/dev_dashboard.scss");
/* harmony import */ var _assets_logo_only_svg__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ../assets/logo only.svg */ "./src/assets/logo only.svg");
















jquery__WEBPACK_IMPORTED_MODULE_10___default()(function () {
  const table = new datatables_net_bs5__WEBPACK_IMPORTED_MODULE_4__["default"]("#example", {
    pageLength: 5,
    lengthMenu: [5, 10, 15],
    responsive: true,
  });

  new datatables_net_bs5__WEBPACK_IMPORTED_MODULE_4__["default"]("#example1", {
    pageLength: 5,
    lengthMenu: [5, 10, 15],
    responsive: true,
  });

  const companyModal = new bootstrap__WEBPACK_IMPORTED_MODULE_0__.Modal("#companyManageModal");

  jquery__WEBPACK_IMPORTED_MODULE_10___default()("#example tbody").on("click", "tr", function () {
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
    (tooltipTriggerEl) => new bootstrap__WEBPACK_IMPORTED_MODULE_0__.Tooltip(tooltipTriggerEl)
  );

  let myChart = echarts__WEBPACK_IMPORTED_MODULE_9__.init(document.getElementById("main"));

  const rootStyles = getComputedStyle(document.documentElement);
  const primaryColor = rootStyles.getPropertyValue("--bs-primary").trim();
  const warningColor = rootStyles.getPropertyValue("--bs-warning").trim();
  const dangerColor = rootStyles.getPropertyValue("--bs-danger").trim();

  myChart.setOption({
    title: {
      text: "Token usage",
      padding: [20, 0],
    },
    tooltip: {
      trigger: "item",
    },
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

  jquery__WEBPACK_IMPORTED_MODULE_10___default()(window).on("resize", function () {
    myChart.resize();
  });
});


/***/ })

},
/******/ function(__webpack_require__) { // webpackRuntimeModules
/******/ /* webpack/runtime/getFullHash */
/******/ (() => {
/******/ 	__webpack_require__.h = () => ("537a79246b73106c1964")
/******/ })();
/******/ 
/******/ }
);
//# sourceMappingURL=dev_dashboard.21b78c139b623b1fc441.hot-update.js.map