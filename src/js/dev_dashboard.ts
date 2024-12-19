import { Collapse, Modal, Tooltip } from "bootstrap";
import "datatables.net";
import "datatables.net-bs5/css/dataTables.bootstrap5.min.css";
import "datatables.net-buttons";
import "datatables.net-buttons-bs5";
import DataTable from "datatables.net-buttons-bs5";
import "datatables.net-buttons-bs5/css/buttons.bootstrap5.min.css";
import "datatables.net-buttons/js/buttons.html5.min.js";
import "datatables.net-buttons/js/buttons.print.min.js";
import "datatables.net-responsive";
import "datatables.net-responsive-bs5";
import "datatables.net-responsive-bs5/css/responsive.bootstrap5.min.css";
import "datatables.net-select";
import "dropzone/dist/dropzone.css";
import * as echarts from "echarts";
import "jszip";
import _ from "lodash";
import "pdfmake";
import "pdfmake/build/vfs_fonts.js";
import {
  AlertType,
  assert,
  ContentResponse,
  getCurrentRoute,
  navigate,
  replaceContent,
  routes,
  showAlert,
  updateHistoryState,
  withBlock,
} from ".";
import "../assets/logo only.svg";
import "../style/dev_dashboard.scss";
import { authStateChangedListener, getCurrentUserToken, logout } from "./auth";
import { registerTransforms } from "./utils";

enum PackageType {
  Basic = "Basic",
  Premium = "Premium",
  Deluxe = "Deluxe",
}

interface Company {
  id: string;
  name: string;
  email: string;
  address: string;
  package: PackageType;
  join_date: string;
}

interface AxisInfo {
  axisDim: string;
  axisIndex: number;
  value: number;
}

interface UpdateAxisPointerEvent {
  seriesIndex: number;
  dataIndexInside: number;
  dataIndex: number;
  axesInfo: AxisInfo[];
  type: "updateaxispointer";
}

enum Position {
  Manager,
  Executive,
}

interface Token {
  id: string;
  company_id: string;
  user_id: string | null;
  position: Position;
}

export async function initDeveloper() {
  const photoElement = document.querySelector("#photo");
  authStateChangedListener(async (user) => {
    if (!user) {
      console.log("User is not authenticated");
      window.location.replace("/");
      return;
    }

    let lastScrollTop = 0;
    const header = document.querySelector("header");

    assert(
      header instanceof HTMLElement,
      "Header undefined or not HTMLElement"
    );

    let headerHeight = $(header).outerHeight();

    assert(
      typeof headerHeight == "number",
      "Header height undefined or not number"
    );

    const headerCollapse = new Collapse(header, { toggle: false });

    const main = document.querySelector("main") as HTMLElement;
    main.style.paddingTop = `${headerHeight}px`;

    headerCollapse.show();

    headerCollapse.hide();

    const onScroll = () => {
      let currentScroll = window.screenY || document.documentElement.scrollTop;

      if (currentScroll > lastScrollTop) {
        if (currentScroll > headerHeight) {
          headerCollapse.hide();
        }
      } else {
        headerCollapse.show();
      }

      lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
    };

    const logoutBtn = document.getElementById("logout");

    const onLogoutClick = async () => {
      await logout();
      await navigate(routes.login, {
        blockParams: { grow: true },
      });
    };

    assert(
      logoutBtn instanceof HTMLElement,
      "Logout button undefined or not HTMLElement"
    );

    async function updateCompanyData() {
      try {
        const response = await fetch("/get_company_data", {
          headers: {
            Authorization: `Bearer ${await getCurrentUserToken()}`,
          },
        });

        if (!response.ok) {
          const errorResponse: ContentResponse = await response.json();
          await replaceContent(errorResponse.content, "main");
          updateHistoryState(getCurrentRoute().path, true);
          return;
        }

        const data: Company[] = await response.json();
        companyTable.clear();
        companyTable.rows.add(data);
        companyTable.draw();
        updateInfoPanels(data);
        companyChart.setOption({ dataset: parseCompanyChartDataset(data) });
        companyChart.resize();
        console.log("Company data updated");
      } catch (e) {
        if (e instanceof Error) {
          console.error(e.stack);
        }
      }
    }

    const infoNumbers = document.querySelectorAll(".info-number");
    const infoDeltas = document.querySelectorAll(".info-delta");

    enum InfoTrend {
      Increase,
      Decrease,
      Neutral,
    }

    function updateInfoPanels(data: Company[]) {
      const today = new Date();

      const categorizedData = _.groupBy(data, (company) => {
        const joinDate = new Date(company.join_date);
        const diffTime = today.getTime() - joinDate.getTime();
        const diffDays = diffTime / (1000 * 3600 * 24);

        if (diffDays <= 7) return "within7Days";
        else return "previous7Days";
      });

      const within7Days = _.countBy(
        categorizedData.within7Days || [],
        "package"
      );
      const previous7Days = _.countBy(
        categorizedData.previous7Days || [],
        "package"
      );
      within7Days["Total"] = within7Days.length;
      previous7Days["Total"] = previous7Days.length;

      infoNumbers.forEach((infoNumber, index) => {
        const category = infoNumber.getAttribute("data-category");

        assert(category, `Category ${category} is not valid type of package`);

        const withinCount = within7Days[category] || 0;
        const previousCount = previous7Days[category] || 0;

        const total = withinCount + previousCount;
        infoNumber.innerHTML = total.toString();

        function changeState(elm: Element, state: InfoTrend) {
          switch (state) {
            case InfoTrend.Increase:
              elm.classList.remove("text-danger");
              elm.classList.add("text-success");
              break;
            case InfoTrend.Decrease:
              elm.classList.add("text-danger");
              elm.classList.remove("text-success");
              break;
            default:
              elm.classList.remove("text-success");
              elm.classList.remove("text-danger");
              break;
          }
        }

        let delta = ((withinCount - previousCount) / previousCount) * 100;
        if (delta === Infinity) {
          infoDeltas[index].innerHTML = `+ ${withinCount - previousCount}`;
          changeState(infoDeltas[index], InfoTrend.Increase);
        } else if (delta > 0) {
          infoDeltas[index].innerHTML = `↑ ${delta}%`;
          changeState(infoDeltas[index], InfoTrend.Increase);
        } else if (delta < 0) {
          infoDeltas[index].innerHTML = `↓ ${delta}%`;
          changeState(infoDeltas[index], InfoTrend.Decrease);
        } else {
          infoDeltas[index].innerHTML = `N/A`;
          changeState(infoDeltas[index], InfoTrend.Neutral);
        }
      });
    }

    function parseCompanyChartDataset(
      data: Company[]
    ): echarts.EChartOption.Dataset {
      const groupedByYearMonthAndPackage = _.mapValues(
        _.groupBy(data, ({ join_date }) => {
          const date = new Date(join_date);
          return `${date.getFullYear()}-${(date.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;
        }),
        (group) => _.countBy(group, "package")
      );

      const months = _.keys(groupedByYearMonthAndPackage);
      const basicCounts = months.map(
        (month) => groupedByYearMonthAndPackage[month].Basic || 0
      );
      const premiumCounts = months.map(
        (month) => groupedByYearMonthAndPackage[month].Premium || 0
      );
      const deluxeCounts = months.map(
        (month) => groupedByYearMonthAndPackage[month].Deluxe || 0
      );

      return {
        source: [
          ["month", ...months],
          ["Basic", ...basicCounts],
          ["Premium", ...premiumCounts],
          ["Deluxe", ...deluxeCounts],
        ],
      };
    }

    const companyTable = new DataTable("#company-table", {
      ajax: {
        url: "/get_company_data",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        dataSrc: "",
        error: function (xhr, textStatus, errorThrown) {
          console.error("Failed to fetch data for the DataTable");
          console.error(`Status: ${textStatus}`);
          console.error(`Error: ${errorThrown}`);
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

    const companyChart = echarts.init(document.querySelector("#company-chart"));
    const companyChartOption: echarts.EChartOption = {
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
          interval: 0,
        },
      },

      yAxis: { gridIndex: 0 },
      grid: { top: "55%", bottom: "5%" },
      series: [
        {
          type: "line",
          smooth: true,
          seriesLayoutBy: "row",
        },
        {
          type: "line",
          smooth: true,
          seriesLayoutBy: "row",
        },
        {
          type: "line",
          smooth: true,
          seriesLayoutBy: "row",
        },
        {
          type: "pie",
          id: "pie",
          radius: "30%",
          center: ["50%", "25%"],
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
    };
    companyChart.setOption(companyChartOption);

    companyChart.on(
      "updateAxisPointer",
      function (event: UpdateAxisPointerEvent) {
        const xAxisInfo = event.axesInfo[0];
        if (xAxisInfo) {
          const dimension = xAxisInfo.value + 1;
          companyChart.setOption({
            series: [
              {
                id: "pie",
                type: "pie",
                label: {
                  formatter: "{b}: {@[" + dimension + "]} ({d}%)",
                },
                encode: {
                  value: dimension,
                  tooltip: dimension,
                },
              },
            ],
          });
        }
      }
    );

    await updateCompanyData();

    const onRefreshCompanyListClick = async () => updateCompanyData();

    const refreshCompanyListBtn = document.querySelector("#refreshCompanyList");
    assert(
      refreshCompanyListBtn instanceof HTMLElement,
      "Refresh company button undefined or not HTMLElement"
    );

    registerTransforms("all");

    async function updateTokenData() {
      try {
        const response = await fetch("/get_token_data", {
          headers: {
            Authorization: `Bearer ${await user?.getIdToken()}`,
          },
        });

        if (!response.ok) {
          const errorResponse: ContentResponse = await response.json();
          await replaceContent(errorResponse.content, "main");
          updateHistoryState(getCurrentRoute().path, true);
          return;
        }

        const data: Token[] = await response.json();
        tokenTable.clear();
        tokenTable.rows.add(data);
        tokenTable.draw();
        console.log(parseTokenChartData(data));
        tokenChart.setOption({
          dataset: [
            { source: data },
            {
              // @ts-ignore
              transform: [
                {
                  type: "utils:countBy",
                  config: { source: "user_id" },
                  print: true,
                },
                {
                  type: "utils:renameKeys",
                  config: {
                    map: { null: "Not activated" },
                    exception: "Activated",
                  },
                  print: true,
                },
                {
                  print: true,
                  type: "utils:flat",
                },
              ],
            },
          ],
        });
        tokenChart.resize();
        console.log("Token data updated");
      } catch (e) {
        if (e instanceof Error) {
          console.error(e.stack);
        }
      }
    }

    function parseTokenChartData(data: Token[]): echarts.EChartOption.Dataset {
      const countActive = _.countBy(data, "user_id");
      return {
        source: [_.map(_.toPairs(countActive), (pair) => _.fromPairs([pair]))],
      };
    }

    const tokenTable = new DataTable("#token-table", {
      ajax: {
        url: "/get_token_data",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        dataSrc: "",
        error: function (xhr, textStatus, errorThrown) {
          console.error("Failed to fetch data for the DataTable");
          console.error(`Status: ${textStatus}`);
          console.error(`Error: ${errorThrown}`);
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
      // @ts-ignore
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
      initComplete: async () => {
        await updateTokenData();
      },
    });

    const tokenChart = echarts.init(document.getElementById("token-chart"));
    const tokenChartOption: echarts.EChartOption &
      echarts.EChartsResponsiveOption = {
      tooltip: {
        trigger: "item",
      },
      grid: {
        bottom: 30,
      },
      legend: {
        top: "5%",
        left: "center",
      },
      series: [
        {
          name: "Token usage",
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
          datasetIndex: 1,
        },
      ],
    };

    tokenChart.setOption(tokenChartOption);

    updateTokenData();

    const onRefreshTokenListClick = async () => updateTokenData();

    const refreshTokenListBtn = document.querySelector("#refreshTokenList");

    assert(
      refreshTokenListBtn instanceof HTMLElement,
      "Refresh token button undefined or not HTMLElement"
    );

    const companyModalElm = document.querySelector("#company-modal");

    assert(
      companyModalElm instanceof HTMLFormElement,
      "Company modal undefined or not HTMLFormElement"
    );

    const companyModalTitle = companyModalElm?.querySelector(".modal-title");

    assert(
      companyModalTitle instanceof HTMLElement,
      "Company modal title undefined or not HTMLElement"
    );

    const idInput = companyModalElm.querySelector("#id");
    const nameInput = companyModalElm.querySelector("#name");
    const emailInput = companyModalElm.querySelector("#email");
    const addressInput = companyModalElm.querySelector("#address");
    const packageInput = companyModalElm.querySelector("#package");
    const startDateElm = document.querySelector("#start-date");

    assert(
      idInput instanceof HTMLInputElement &&
        nameInput instanceof HTMLInputElement &&
        nameInput instanceof HTMLInputElement &&
        emailInput instanceof HTMLInputElement &&
        addressInput instanceof HTMLInputElement &&
        packageInput instanceof HTMLSelectElement,
      "One of the fields within company modal is undefinied or not HTMLInputElement/HTMLSelectElement"
    );

    assert(
      startDateElm instanceof HTMLElement,
      "Start date element undefined or not HTMLElement"
    );

    const companyModal = new Modal(companyModalElm);

    const onFormSubmit = async (evt: SubmitEvent) => {
      evt.preventDefault();
      const formData = new FormData(companyModalElm);

      assert(evt.submitter, "Missing submit event submitter");

      await withBlock(evt.submitter, {
        small: true,
        type: "grow",
      })(async () => {
        try {
          const response = await fetch(`/create_company`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${await getCurrentUserToken()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(Object.fromEntries(formData)),
          });
          if (!response.ok) {
            const errorResponse: ContentResponse = await response.json();
            await replaceContent(errorResponse.content, "main");
            updateHistoryState(getCurrentRoute().path, true);
            return;
          }
        } catch (error) {
          console.trace(error);
        }
      })();

      await updateCompanyData();
      await updateTokenData();
    };

    const addCompanyBtn = document.querySelector(
      '[data-bs-target="#company-modal"]'
    );

    assert(
      addCompanyBtn instanceof HTMLElement,
      "Add company button undefined or HTMLElement"
    );

    const onAddCompanyClick = () => {
      companyModalElm.querySelectorAll(".d-add-none").forEach((elm) => {
        elm.classList.add("d-none");
      });
      packageInput.disabled = false;
      companyModalTitle.textContent = "Company registration";
    };

    const companyRowClickListener = function (this: HTMLTableRowElement) {
      const data: Company = companyTable.row(this).data();

      const startDate = new Date(data["join_date"]);
      const formattedDate = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(startDate);

      idInput.value = data["id"];
      nameInput.value = data["name"];
      emailInput.value = data["email"];
      addressInput.value = data["address"];
      packageInput.value = data["package"];
      startDateElm.textContent = formattedDate;

      companyModalElm.querySelectorAll(".d-add-none").forEach((elm) => {
        elm.classList.add("d-none");
      });
      packageInput.disabled = true;
      companyModalTitle.textContent = "Company Management";
      companyModal.show();
    };

    const resetCompanyForm = () => companyModalElm.reset();

    const navCompany = document.querySelector(
      'button[data-bs-target="#nav-company"]'
    );

    assert(
      navCompany instanceof HTMLButtonElement,
      "Nav company undefined or not HTMLButtonElement"
    );

    const navToken = document.querySelector(
      'button[data-bs-target="#nav-token"]'
    );

    assert(
      navToken instanceof HTMLButtonElement,
      "Nav company undefined or not HTMLButtonElement"
    );

    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]'
    );
    const tooltipList = [...tooltipTriggerList].map(
      (tooltipTriggerEl) => new Tooltip(tooltipTriggerEl)
    );

    $(window).on("scroll", onScroll);
    logoutBtn.addEventListener("click", onLogoutClick);
    const companyDataInterval = setInterval(updateCompanyData, 10000);
    const tokenDataInterval = setInterval(updateTokenData, 10000);

    refreshCompanyListBtn.addEventListener("click", onRefreshCompanyListClick);
    refreshTokenListBtn.addEventListener("click", onRefreshTokenListClick);

    const onWindowResize = () => {
      tokenChart.resize();
      companyChart.resize();
    };
    window.addEventListener("resize", onWindowResize);

    companyModalElm.addEventListener("submit", onFormSubmit);
    addCompanyBtn.addEventListener("click", onAddCompanyClick);
    companyModalElm.addEventListener("hidden.bs.modal", resetCompanyForm);

    $("#companyTable tbody").on("click", "tr", companyRowClickListener);

    navCompany.addEventListener("show.bs.tab", onRefreshCompanyListClick);
    navToken.addEventListener("show.bs.tab", onRefreshTokenListClick);

    // user
    const userElm = document.querySelector("#user-table");

    //@ts-ignore
    $.fn.dataTable.Buttons.defaults.dom.button.className = "btn";

    if (!userElm) {
      console.log(`User table elm: ${userElm}`);
      return;
    }

    const userTable = new DataTable(userElm, {
      ajax: {
        dataSrc: "",
        url: "/get_user_data",
        headers: { Authorization: `Bearer ${await getCurrentUserToken()}` },
      },
      rowId: "id",
      layout: {
        topStart: {
          buttons: [
            {
              extend: "collection",
              text: `<i class="bi bi-arrow-bar-up fw-bold me-2"></i>Export`,
              className: " btn-dark",
              buttons: [
                {
                  extend: "copy",
                  exportOptions: {
                    columns: [1, 3, 4, 5],
                  },
                },
                {
                  extend: "csv",
                  exportOptions: {
                    columns: [1, 3, 4, 5],
                  },
                },
                {
                  extend: "excel",
                  exportOptions: {
                    columns: [1, 3, 4, 5],
                  },
                },
                {
                  extend: "pdf",
                  exportOptions: {
                    columns: [1, 3, 4, 5],
                  },
                },
                {
                  extend: "print",
                  exportOptions: {
                    columns: [1, 3, 4, 5],
                  },
                },
              ],
            },
          ],
        },
      },
      processing: true,
      serverSide: false,
      responsive: true,
      paging: true,
      pageLength: 3,
      lengthChange: false,
      searching: true,
      ordering: true,
      columns: [
        { data: "id", title: "ID" },
        {
          data: "photo",
          title: "Photo",
          orderable: false,
          render: function (data) {
            return `<img src="${data}" alt="User Photo" class="rounded-circle object-fit-cover" width="75" height="75" style="border-radius: 50%; object-fit: cover;" />`;
          },
        },
        { data: "company", title: "Company Name" },
        { data: "name", title: "Full Name" },
        { data: "username", title: "Username" },
        { data: "phoneNo", title: "Phone No" },
        { data: "email", title: "Email" },
        { data: "position", title: "Position" },
        { data: "date", title: "Date" },
        {
          data: null,
          title: "Action",
          orderable: false,
          render: function (data, type, row) {
            const editIcon = `<i role="button" class="bi bi-pencil-fill edit-icon" data-id="${data.id}"></i>`;
            const deleteIcon = `<i role="button" class="bi bi-trash delete-icon" data-id="${data.id}"></i>`;

            return `${editIcon} ${deleteIcon}`;
          },
        },
      ],
      drawCallback: function () {
        document.querySelectorAll(".edit-icon").forEach((icon: Element) => {
          icon.addEventListener("click", async () => {
            const userId = (icon as HTMLElement).dataset.id;

            assert(
              typeof userId === "string",
              `User id is not string: ${userId}`
            );

            console.log(userId);

            const rowData = userTable.row(`#${userId}`).data();

            const fieldsToUpdate = [
              "company",
              "name",
              "username",
              "phoneNo",
              "email",
              "position",
            ];

            fieldsToUpdate.forEach((field) => {
              const input = document.getElementById(field);
              if (input && input instanceof HTMLInputElement) {
                input.value = rowData[field] || "";
              } else {
                console.warn(`Field '${field}' not found in the modal.`);
              }
            });

            const photoPreview = document.getElementById("user-photo-preview");
            if (photoPreview && photoPreview instanceof HTMLImageElement) {
              photoPreview.src = rowData.photo || "default-avatar.png";
            }

            const dateInput = document.getElementById("date");
            if (dateInput && dateInput instanceof HTMLInputElement) {
              dateInput.value = rowData.date || "";
            }

            const editUserModalElm = document.getElementById("edit-user-modal");

            assert(
              editUserModalElm instanceof Element,
              "Edit user modal undefined or not Element"
            );

            const editUserModal = new Modal(editUserModalElm);
            editUserModal.show();
          });
        });

        document.querySelectorAll(".delete-icon").forEach((icon) => {
          icon.addEventListener("click", async function () {
            //@ts-ignore

            const userId = this.getAttribute("data-id");
            const confirmDelete = confirm(
              "Are you sure you want to delete this user?"
            );

            if (confirmDelete) {
              try {
                const response = await fetch(`/delete_user/${userId}`, {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${await getCurrentUserToken()}`,
                    "Content-Type": "application/json",
                  },
                });

                const result = await response.json();

                if (response.ok) {
                  showAlert("User has been successfully deleted.", {
                    type: AlertType.SUCCESS,
                    element: "#content-container",
                  });
                  userTable.ajax.reload();
                } else {
                  showAlert(
                    "An error occurred while trying to delete the user. Please try again.",
                    {
                      type: AlertType.DANGER,
                      element: "#content-container",
                    }
                  );
                }
              } catch (error) {
                console.error("Error:", error);
                showAlert(
                  "An error occurred while trying to delete the user. Please try again.",
                  {
                    type: AlertType.DANGER,
                    element: "#content-container",
                  }
                );
              }
            }
          });
        });
        document
          .querySelector("#edit-user-modal")
          .addEventListener("submit", async function (event) {
            event.preventDefault(); // Prevent default form submission

            assert(
              editUserModalElm instanceof Element,
              "Edit user modal undefined or not Element"
            );

            const formData = new FormData(event.target); // Collect form data
            try {
              const response = await fetch("/upsert_user", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${await getCurrentUserToken()}`,
                },
                body: formData,
              });

              const result = await response.json();

              if (response.ok) {
                showAlert("User updated successfully!", {
                  type: AlertType.SUCCESS,
                });
                userTable.ajax.reload();
              } else {
                showAlert(result.message || "An error occurred.", {
                  type: AlertType.DANGER,
                });
              }
            } catch (error) {
              console.error(error);
              showAlert("An unexpected error occurred.", {
                type: AlertType.DANGER,
              });
            }
          });
      },

      initComplete: (settings, object) => {
        const wrapperDiv = document.createElement("div");
        wrapperDiv.classList.add("card", "p-3", "bg-white");

        userElm.parentNode &&
          userElm.parentNode.insertBefore(wrapperDiv, userElm);
        wrapperDiv.appendChild(userElm);
        document.querySelectorAll(".dt-buttons").forEach((elm) => {
          elm.classList.remove("btn-group");
        });
        $("#searchbox").on("keyup search input paste cut", function (evt) {
          //@ts-ignore
          userTable.search(evt.target.value).draw();
        });
      },
    });
    // user

    return new Promise<() => void>((resolve) => {
      resolve(() => {
        $(window).off("scroll", onScroll);
        logoutBtn.removeEventListener("click", onLogoutClick);

        clearInterval(companyDataInterval);
        refreshCompanyListBtn.removeEventListener(
          "click",
          onRefreshCompanyListClick
        );
        companyTable.destroy();
        // companyChart.dispose();

        clearInterval(tokenDataInterval);
        tokenTable.destroy();
        tokenChart.dispose();
        refreshTokenListBtn.removeEventListener(
          "click",
          onRefreshTokenListClick
        );

        window.removeEventListener("resize", onWindowResize);

        companyModalElm.removeEventListener("submit", onFormSubmit);
        addCompanyBtn.removeEventListener("click", onAddCompanyClick);
        companyModalElm.removeEventListener(
          "hidden.bs.modal",
          resetCompanyForm
        );
        $("#companyTable tbody").off("click", "tr", companyRowClickListener);
        companyModal.dispose();

        navCompany.removeEventListener(
          "show.bs.tab",
          onRefreshCompanyListClick
        );
        navToken.removeEventListener("show.bs.tab", onRefreshTokenListClick);

        tooltipList.forEach((tooltip) => tooltip.dispose());

        console.warn("Developer dashboard disposed.");
      });
    });

    return;
  });
}
