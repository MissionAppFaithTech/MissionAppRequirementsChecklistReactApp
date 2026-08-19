function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function initSearch() {
  const searchInput = document.getElementById("doc-search");
  const nav = document.getElementById("requirements-nav");
  const emptyMessage = document.getElementById("search-empty");

  if (!searchInput || !nav) {
    return;
  }

  const items = Array.from(nav.querySelectorAll("li"));

  searchInput.addEventListener("input", () => {
    const query = normalizeText(searchInput.value);
    let visibleCount = 0;

    items.forEach((item) => {
      const text = normalizeText(item.textContent || "");
      const isVisible = query === "" || text.includes(query);

      item.classList.toggle("is-hidden", !isVisible);

      if (isVisible && item.querySelector(":scope > a")) {
        visibleCount += 1;
      }
    });

    emptyMessage?.classList.toggle("is-visible", query !== "" && visibleCount === 0);
  });
}
