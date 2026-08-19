export function initScrollSpy() {
  const links = Array.from(document.querySelectorAll(".sidebar-nav a[href^='#']"));
  const sections = links
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1);
      const section = id ? document.getElementById(id) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  if (!sections.length) {
    return;
  }

  function setActiveLink(id) {
    links.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${id}`);
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visibleEntries[0]) {
        setActiveLink(visibleEntries[0].target.id);
      }
    },
    {
      rootMargin: "-18% 0px -70% 0px",
      threshold: 0,
    }
  );

  sections.forEach(({ section }) => observer.observe(section));
}
