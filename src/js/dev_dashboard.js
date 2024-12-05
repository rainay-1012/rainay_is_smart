import { Collapse, Modal, Tooltip } from "bootstrap";
import "datatables.net";
import DataTable from "datatables.net-bs5";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";
import "datatables.net-buttons";
import "datatables.net-buttons-bs5";
import "datatables.net-buttons-bs5/css/buttons.bootstrap5.min.css";
import "datatables.net-buttons/js/buttons.html5.min.js";
import "datatables.net-buttons/js/buttons.print.min.js";
import "datatables.net-responsive";
import "datatables.net-responsive-bs5";
import "datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css";
import "datatables.net-select";
import * as echarts from "echarts";
import "jszip";
import "pdfmake";
import "pdfmake/build/vfs_fonts.js";
import "../assets/logo only.svg";
import "../style/dev_dashboard.scss";
import {
  authStateChangedListener,
  getCurrentUserToken,
  logout,
} from "./authentication.js";
import { navigate } from "./index.js";

export async function initDeveloper() {
  authStateChangedListener(async (user) => {
    if (!user) {
      console.log("User is not authenticated");
      window.location.replace("/");
      return;
    }

    let lastScrollTop = 0;
    const header = document.querySelector("header");
    let headerHeight = $(header).outerHeight();
    const headerCollapse = new Collapse(header);

    $(window).on("scroll", function () {
      let currentScroll = window.screenY || document.documentElement.scrollTop;

      if (currentScroll <= headerHeight) {
        headerCollapse.show();
        lastScrollTop = currentScroll;
        return;
      }

      if (currentScroll >= lastScrollTop) {
        headerCollapse.hide();
      } else {
        headerCollapse.show();
      }

      lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
    });

    const onLogoutClick = async () => {
      await logout();
      await navigate("/login", {
        blockParams: { grow: true },
      });
    };

    const logoutBtn = document.getElementById("logout");
    logoutBtn.addEventListener("click", onLogoutClick);

    const rootStyles = getComputedStyle(document.documentElement);
    const primaryColor = rootStyles.getPropertyValue("--bs-primary").trim();
    const warningColor = rootStyles.getPropertyValue("--bs-warning").trim();
    const dangerColor = rootStyles.getPropertyValue("--bs-danger").trim();

    const companyTable = new DataTable("#companyTable", {
      ajax: {
        url: `/get_company_data`,
        dataSrc: "",
        headers: {
          Authorization: `Bearer ${await getCurrentUserToken()}`,
        },
        error: function (jqXHR, textStatus, errorThrown) {
          console.error(
            "Error fetching company data:",
            textStatus,
            errorThrown
          );
        },
      },
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
        { data: "email" },
        { data: "address" },
        { data: "package" },
        { data: "join_date" },
      ],
      columnDefs: [{ targets: "_all", defaultContent: "N/A" }],
    });

    let companyData = null;

    const companyChart = echarts.init(document.querySelector("#companyChart"));
    companyChart.setOption({
      legend: {
        padding: [0, 0, 100, 0],
      },
      tooltip: {
        trigger: "axis",
        showContent: false,
      },
      dataset: {
        source: [],
      },
      xAxis: {
        type: "category",
        axisLabel: {
          interval: 0, // Display all months
        },
      },

      yAxis: { gridIndex: 0 },
      grid: { top: "55%", bottom: "5%" },
      series: [
        {
          type: "line",
          smooth: true,
          seriesLayoutBy: "row",
          emphasis: { focus: "series" },
        },
        {
          type: "line",
          smooth: true,
          seriesLayoutBy: "row",
          emphasis: { focus: "series" },
        },
        {
          type: "line",
          smooth: true,
          seriesLayoutBy: "row",
          emphasis: { focus: "series" },
        },
        {
          type: "pie",
          id: "pie",
          radius: "30%",
          center: ["50%", "25%"],
          emphasis: {
            focus: "self",
          },
          label: {
            formatter: "{b}: {@Basic} ({d}%)",
          },
          encode: {
            itemName: "month",
            value: "Basic",
            tooltip: "Basic",
          },
        },
      ],
    });
    companyChart.on("updateAxisPointer", function (event) {
      const xAxisInfo = event.axesInfo[0];
      if (xAxisInfo) {
        const dimension = xAxisInfo.value + 1;
        companyChart.setOption({
          series: {
            id: "pie",
            label: {
              formatter: "{b}: {@[" + dimension + "]} ({d}%)",
            },
            encode: {
              value: dimension,
              tooltip: dimension,
            },
          },
        });
      }
    });
    function updateCompanyChart() {
      function getMonth(dateString) {
        const date = new Date(dateString);
        return (
          date.getFullYear() +
          "-" +
          (date.getMonth() + 1).toString().padStart(2, "0")
        );
      }

      // Initialize package counts structure
      const packageCounts = {
        Basic: {},
        Premium: {},
        Deluxe: {},
      };

      // Track the earliest and latest months
      let earliestMonth = "9999-12";
      let latestMonth = "0000-01";

      // Loop through the company data and calculate package counts for each month
      companyData.forEach((company) => {
        const month = getMonth(company.join_date); // Get the month of the join_date
        const packageName = company.package;

        // Track the range of months
        if (month < earliestMonth) earliestMonth = month;
        if (month > latestMonth) latestMonth = month;

        // Initialize the month object if not already present
        if (!packageCounts[packageName][month]) {
          packageCounts[packageName][month] = 0;
        }
        packageCounts[packageName][month]++;
      });

      // Generate a list of months from earliest to latest
      const months = [];
      const startDate = new Date(earliestMonth + "-01");
      const endDate = new Date(latestMonth + "-01");
      console.log(`startDate :${startDate}`);

      while (startDate <= endDate) {
        const monthString =
          startDate.getFullYear() +
          "-" +
          (startDate.getMonth() + 1).toString().padStart(2, "0");
        months.push(monthString);
        startDate.setMonth(startDate.getMonth() + 1);
      }

      // Prepare the data for the chart
      const packageCountsForChart = {
        Basic: [],
        Premium: [],
        Deluxe: [],
      };

      months.forEach((month) => {
        packageCountsForChart.Basic.push(packageCounts.Basic[month] || 0);
        packageCountsForChart.Premium.push(packageCounts.Premium[month] || 0);
        packageCountsForChart.Deluxe.push(packageCounts.Deluxe[month] || 0);
      });

      companyChart.setOption({
        dataset: {
          source: [
            ["month", ...months], // X-axis labels (months)
            ["Basic", ...packageCountsForChart.Basic], // Data for Basic package
            ["Premium", ...packageCountsForChart.Premium], // Data for Premium package
            ["Deluxe", ...packageCountsForChart.Deluxe], // Data for Deluxe package
          ],
        },
      });
    }

    const infoNumbers = document.querySelectorAll(".info-number");
    const infoDeltas = document.querySelectorAll(".info-delta");

    function updateInfoPanels() {
      const today = new Date();
      const packageCounts = {
        within7Days: {
          Total: 0,
          Basic: 0,
          Premium: 0,
          Deluxe: 0,
        },
        previous7Days: {
          Total: 0,
          Basic: 0,
          Premium: 0,
          Deluxe: 0,
        },
      };

      // Loop through company data to calculate the package counts
      companyData.forEach((company) => {
        const joinDate = new Date(company.join_date);
        const diffTime = today - joinDate; // Time difference in milliseconds
        const diffDays = diffTime / (1000 * 3600 * 24); // Convert to days

        // Get package name
        const packageName = company.package.name;

        // Categorize based on the join date
        if (diffDays <= 7) {
          packageCounts.within7Days["Total"]++;
          packageCounts.within7Days[packageName]++;
        } else if (diffDays > 7 && diffDays <= 14) {
          packageCounts.previous7Days["Total"]++;
          packageCounts.previous7Days[packageName]++;
        }
      });

      // Update the info-number and info-delta for each category
      infoNumbers.forEach((infoNumber, index) => {
        const category = infoNumber.getAttribute("data-category"); // Get the category from data attribute
        const withinCount = packageCounts.within7Days[category] || 0;
        const previousCount = packageCounts.previous7Days[category] || 0;

        // Update info-number: Total of within7Days and previous7Days
        const total = withinCount + previousCount;
        infoNumber.innerHTML = total;

        function changeState(elm, state) {
          if (state === "increase") {
            elm.classList.remove("text-danger");
            elm.classList.add("text-success");
          } else if (state === "decrease") {
            elm.classList.add("text-danger");
            elm.classList.remove("text-success");
          } else {
            infoDeltas[index].classList.remove("text-success");
            infoDeltas[index].classList.remove("text-danger");
          }
        }

        // Update info-delta: Difference between within7Days and previous7Days
        let delta = ((withinCount - previousCount) / previousCount) * 100;
        if (delta === Infinity) {
          infoDeltas[index].innerHTML = `+ ${withinCount - previousCount}`;
          changeState(infoDeltas[index], "increase");
        } else if (delta > 0) {
          infoDeltas[index].innerHTML = `↑ ${delta}%`;
          changeState(infoDeltas[index], "increase");
        } else if (delta < 0) {
          infoDeltas[index].innerHTML = `↓ ${delta}%`;
          changeState(infoDeltas[index], "decrease");
        } else {
          infoDeltas[index].innerHTML = `N/A`;
          changeState(infoDeltas[index], null);
        }
      });
    }

    async function updateCompanyData() {
      try {
        const response = await fetch("/get_company_data", {
          headers: {
            Authorization: `Bearer ${await getCurrentUserToken()}`,
          },
        });

        if (!response.ok) {
          console.log(response.statusText);
          return;
        }
        companyData = await response.json();
        companyTable.clear();
        companyTable.rows.add(companyData);
        companyTable.draw();
        updateInfoPanels();
        updateCompanyChart();
        console.log("Company data updated");
      } catch (e) {
        console.log(`Error fetching company data: ${e}`);
      }
    }

    updateCompanyData();
    setInterval(updateCompanyData, 10000);

    let tokenChart = echarts.init(document.getElementById("tokenChart"));

    function updateTokenChart() {
      let countNull = 0;
      let countNonNull = 0;
      tokenTable
        .column(3)
        .data()
        .each(function (value) {
          if (value === null || value === "N/A") {
            countNull++;
          } else {
            countNonNull++;
          }
        });
      tokenChart.setOption({
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
              {
                value: countNonNull,
                name: "Active",
                itemStyle: { color: primaryColor },
              },
              {
                value: countNull,
                name: "Inactive",
                itemStyle: { color: warningColor },
              },
              { value: 0, name: "Expired", itemStyle: { color: dangerColor } },
            ],
          },
        ],
      });
      tokenChart.resize();
    }

    const tokenTable = new DataTable("#tokenTable", {
      ajax: {
        url: `/get_token_data`,
        cache: false,
        headers: {
          Authorization: `Bearer ${await getCurrentUserToken()}`,
        },
        dataSrc: "",
        error: function (jqXHR, textStatus, errorThrown) {
          console.error("Error fetching token data:", textStatus, errorThrown);
        },
      },
      layout: {
        topStart: {
          buttons: [
            { extend: "copy", className: "text-light" },
            { extend: "csv", className: "text-light" },
            { extend: "excel", className: "text-light" },
            { extend: "pdf", className: "text-light" },
            { extend: "print", className: "text-light" },
          ],
        },
      },
      fixedColumns: { start: 2 },
      order: [[1, "asc"]],
      select: { style: "os", selector: "td:first-child" },
      processing: true,
      serverSide: false,
      responsive: true,
      paging: true,
      pageLength: 5,
      searching: true,
      ordering: true,
      lengthChange: false,
      columns: [
        {
          data: null,
          defaultContent: "",
          orderable: false,
          render: DataTable.render.select(),
        },
        { data: "id" },
        { data: "company_id" },
        { data: "user_id", defaultContent: "N/A" },
        { data: "position" },
      ],
      initComplete: () => {
        updateTokenChart();
      },
    });

    const onRefreshTokenListClick = () => {
      tokenTable.ajax.reload();
      updateTokenChart();
    };

    const refreshTokenListBtn = document.querySelector("#refreshTokenList");

    refreshTokenListBtn.addEventListener("click", onRefreshTokenListClick);

    const addCompanyModalElm = document.querySelector("#addCompanyModal");
    const addCompanyModal = new Modal(addCompanyModalElm);
    const addCompanyForm = addCompanyModalElm.getElementsByTagName("form")[0];

    const onFormSubmit = async (evt) => {
      evt.preventDefault();
      const formData = new FormData(addCompanyForm);
      await fetch(`/create_company`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      companyTable.ajax.reload();
      tokenTable.ajax.reload();
      updateTokenChart();
      addCompanyForm.reset();
      addCompanyModal.hide();
    };
    addCompanyForm.addEventListener("submit", onFormSubmit);

    const resetCompanyForm = () => addCompanyForm.reset();

    addCompanyModalElm.addEventListener("hidden.bs.modal", resetCompanyForm);

    const companyModal = new Modal("#companyManageModal");

    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]'
    );
    const tooltipList = [...tooltipTriggerList].map(
      (tooltipTriggerEl) => new Tooltip(tooltipTriggerEl)
    );

    const companyRowClickListener = function () {
      const data = companyTable.row(this).data();
      document.getElementById("_id").value = data["id"];
      document.getElementById("_name").value = data["name"];
      document.getElementById("_email").value = data["email"];
      document.getElementById("_address").value = data["address"];
      document.getElementById("_package").value = data["package"];
      const startDate = new Date(data["join_date"]);
      console.log(startDate);
      const formattedDate = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(startDate);

      document.getElementById("_startDate").textContent = formattedDate;

      companyModal.show();
    };

    $("#companyTable tbody").on("click", "tr", companyRowClickListener);

    const onRefreshCompanyListClick = () => companyTable.ajax.reload();

    const refreshCompanyListBtn = document.querySelector("#refreshCompanyList");

    refreshCompanyListBtn.addEventListener("click", onRefreshCompanyListClick);

    let navCompany = document.querySelector(
      'button[data-bs-target="#nav-company"]'
    );
    navCompany.addEventListener("shown.bs.tab", onRefreshTokenListClick);

    let navToken = document.querySelector(
      'button[data-bs-target="#nav-token"]'
    );
    navToken.addEventListener("shown.bs.tab", onRefreshTokenListClick);

    const onWindowResize = () => {
      tokenChart.resize();
      companyChart.resize();
    };
    window.addEventListener("resize", onWindowResize);

    return new Promise((resolve) => {
      resolve(() => {
        logoutBtn.removeEventListener("click", onLogoutClick);
        refreshTokenListBtn.removeEventListener(
          "click",
          onRefreshTokenListClick
        );
        refreshCompanyListBtn.removeEventListener(
          "click",
          onRefreshCompanyListClick
        );
        addCompanyModalElm.removeEventListener(
          "hidden.bs.modal",
          resetCompanyForm
        );
        $("#companyTable tbody").off("click", "tr", companyRowClickListener);
        addCompanyForm.removeEventListener("submit", onFormSubmit);
        window.removeEventListener("resize", onWindowResize);

        companyTable.destroy();
        tokenTable.destroy();
        tokenChart.dispose();
        companyModal.dispose();
        addCompanyModal.dispose();

        tooltipList.forEach((tooltip) => tooltip.dispose());
      });
    });
  });
}
