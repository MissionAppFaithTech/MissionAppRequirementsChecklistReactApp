export function initNavigation() {
  const body = document.body;
  const menuButton = document.querySelector("[data-menu-toggle]");
  const overlay = document.querySelector("[data-sidebar-overlay]");
  const sidebarLinks = document.querySelectorAll(".sidebar-nav a");
  const btnTopContainer = document.getElementById("btn-top-container");
  const btnTop = document.getElementById("btn-top");
  const tooltip = document.getElementById("btn-top-tooltip");
  let hasShownTooltip = false;
  let tooltipTimeout;

  function closeSidebar() {
    body.classList.remove("sidebar-open");
    menuButton?.setAttribute("aria-expanded", "false");
  }

  function toggleSidebar() {
    const isOpen = body.classList.toggle("sidebar-open");
    menuButton?.setAttribute("aria-expanded", String(isOpen));
  }

  function showTooltipTemporarily() {
    if (!tooltip) {
      return;
    }

    tooltip.classList.add("active");
    clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
      tooltip.classList.remove("active");
    }, 3000);
  }

  menuButton?.addEventListener("click", toggleSidebar);
  overlay?.addEventListener("click", closeSidebar);

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", closeSidebar);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebar();
    }
  });

  window.addEventListener("scroll", () => {
    if (!btnTopContainer || !tooltip) {
      return;
    }

    if (window.scrollY > 300) {
      if (!btnTopContainer.classList.contains("visible")) {
        btnTopContainer.classList.add("visible");

        if (!hasShownTooltip) {
          showTooltipTemporarily();
          hasShownTooltip = true;
        }
      }
    } else {
      btnTopContainer.classList.remove("visible");
      hasShownTooltip = false;
      clearTimeout(tooltipTimeout);
      tooltip.classList.remove("active");
    }
  });

  btnTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
