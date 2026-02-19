/**
 * Shared index page and overview HTML generation for Dashbuild.
 *
 * Used by both scripts/dev.js and compile/scripts/assemble-site.js
 * to generate the dashboard index.md with module overview cards.
 */

// ─── HTML escaping ───────────────────────────────────────────────────

/**
 * Escape a string for safe inclusion in HTML.
 */
export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Overview section ────────────────────────────────────────────────

/**
 * Build the overview HTML section from an array of overview objects.
 * Returns an empty string if there are no overviews.
 */
export function buildOverviewSection(overviews) {
  if (!overviews || overviews.length === 0) return "";

  const overviewCards = overviews
    .map((ov) => {
      const cols = Math.min(ov.summaries.length, 4);
      const name = escapeHtml(ov.moduleName);
      const path = escapeHtml(ov.modulePath);
      const bg = escapeHtml(ov.backgroundColor);
      const border = escapeHtml(ov.borderColor);
      const box = escapeHtml(ov.boxColor);
      const text = escapeHtml(ov.textColor);
      const title = escapeHtml(ov.titleColor || ov.textColor);

      const summaryItems = ov.summaries
        .map(
          (s) =>
            `      <div style="background: ${box}; border: 1px solid ${border}; border-radius: 8px; padding: 0.75rem 1rem;">
        <div style="color: ${text}; opacity: 0.6; font-size: 0.7rem; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem;">${escapeHtml(s.label)}</div>
        <div style="color: ${text}; font-size: 1.35rem; font-weight: 600;">${escapeHtml(s.value)}</div>
      </div>`,
        )
        .join("\n");

      return `  <a class="overview-module" href="${path}" style="display: block; text-decoration: none; background: ${bg}; border: 1px solid ${border}; border-radius: 10px; padding: 1.25rem;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
      <div style="color: ${title}; font-size: 1.15rem; font-weight: 700;">${name}</div>
      <svg class="overview-nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${text}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.2; flex-shrink: 0; transition: opacity 0.15s ease;"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg>
    </div>
    <div style="display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 0.5rem;">
${summaryItems}
    </div>
  </a>`;
    })
    .join("\n");

  return `<style>
.overview-module { transition: border-color 0.15s ease, box-shadow 0.15s ease; font-family: 'Inter', sans-serif; }
.overview-module:hover { box-shadow: 0 2px 12px rgba(255,255,255,0.04); filter: brightness(1.05); }
.overview-module:hover .overview-nav-icon { opacity: 0.6 !important; }
</style>

<div class="dash-section" style="--si:1">
<div style="display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 1.5rem;">
${overviewCards}
</div>
</div>`;
}

// ─── Index page ──────────────────────────────────────────────────────

/**
 * Build the full index.md content.
 *
 * @param {object} options
 * @param {string} options.title         — Page title (front matter)
 * @param {string} options.subtitle      — Subtitle displayed next to DASHBUILD
 * @param {string} options.overviewSection — Pre-built overview HTML (or empty string)
 * @param {string} [options.footer]      — Optional footer HTML
 */
export function buildIndexPage({
  title = "Dashboard",
  subtitle = "Development Report",
  overviewSection = "",
  footer = "",
}) {
  const safeSubtitle = escapeHtml(subtitle);

  return `---
title: ${title}
toc: false
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&display=swap');
:root { --stagger-delay: 30ms; }
.dash-section { opacity: 0; animation: dashFadeIn 150ms ease-out forwards; animation-delay: calc(var(--si, 0) * var(--stagger-delay)); }
</style>

<div class="dash-section" style="--si:0">
<div style="display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 1.5rem;">
  <span style="font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 2rem; letter-spacing: 0.04em; color: #fff;">DASHBUILD</span>
  <span style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 1.1rem; color: rgba(255,255,255,0.5); letter-spacing: 0.02em;">${safeSubtitle}</span>
</div>
</div>

${overviewSection}
${footer}`;
}

// ─── Sidebar pages ───────────────────────────────────────────────────

/**
 * Group pages by section for Observable Framework sidebar navigation.
 * Pages in the "Reports" section are placed at the top level (no collapsible group).
 * All other sections become collapsible groups.
 */
export function buildPagesList(pages) {
  const topLevel = [];
  const sectionMap = new Map();

  for (const page of pages) {
    if (!page.section || page.section === "Reports") {
      topLevel.push({ name: page.name, path: page.path });
    } else {
      if (!sectionMap.has(page.section)) {
        sectionMap.set(page.section, []);
      }
      sectionMap.get(page.section).push({ name: page.name, path: page.path });
    }
  }

  const result = [...topLevel];

  for (const [sectionName, sectionPages] of sectionMap) {
    result.push({
      name: sectionName,
      collapsible: true,
      open: true,
      pages: sectionPages,
    });
  }

  return result;
}
