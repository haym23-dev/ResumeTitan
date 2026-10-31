/* ==========================================================================
   templates/professional.js — JSON-Resume -> HTML for the preview document.

   Pure and framework-free: renderResume(resume) returns an HTML string with no
   side effects, so it can be reused for the preview iframe and a future
   print/PDF view. Ported in spirit from depr/client/src/templates/layouts/*.
   ========================================================================== */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text for safe interpolation into HTML. */
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** "2022-03" -> "03/2022". Empty/null -> "". */
function formatDate(iso) {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})/.exec(String(iso));
  return match ? `${match[2]}/${match[1]}` : esc(iso);
}

/** A date range: "03/2022 – Present" (end omitted when blank). */
function dateRange(start, end, current) {
  const from = formatDate(start);
  const to = current ? "Present" : formatDate(end);
  if (from && to) return `${from} \u2013 ${to}`;
  return from || to || "";
}

function join(parts, sep = " &middot; ") {
  return parts.filter(Boolean).join(sep);
}

/** A titled section, or "" when there is no body. */
function section(id, title, body) {
  if (!body) return "";
  return `
    <section class="resume-section" data-section="${esc(id)}">
      <h2 class="resume-section__title">${esc(title)}</h2>
      ${body}
    </section>`;
}

/** Render a list of bullet strings, or "" when empty. */
function bullets(items) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return "";
  return `<ul class="resume-list">${list.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function renderHeader(basics = {}) {
  const where = join([basics.location?.city, basics.location?.region]);
  const contact = join(
    [where, basics.phone, basics.email, basics.url].filter(Boolean),
  );
  const profiles = (basics.profiles || [])
    .filter((p) => p && (p.url || p.username))
    .map((p) => `<a class="resume-contact__link" href="${esc(p.url || "#")}">${esc(p.network || p.username)}</a>`)
    .join("");

  return `
    <header class="resume-header">
      <h1 class="resume-header__name">${esc(basics.name)}</h1>
      ${basics.label ? `<p class="resume-header__label">${esc(basics.label)}</p>` : ""}
      ${contact ? `<p class="resume-header__contact">${contact}</p>` : ""}
      ${profiles ? `<p class="resume-header__profiles">${profiles}</p>` : ""}
    </header>`;
}

function renderSummary(basics = {}) {
  return section("blurbs", "Professional Summary", basics.summary ? `<p class="resume-text">${esc(basics.summary)}</p>` : "");
}

function renderWork(work = []) {
  const body = (work || [])
    .map(
      (job) => `
      <article class="resume-entry">
        <div class="resume-entry__row">
          <h3 class="resume-entry__title">${esc(job.position || job.name)}</h3>
          <span class="resume-entry__dates">${dateRange(job.startDate, job.endDate, job.endDateCurrent)}</span>
        </div>
        ${job.position && job.name ? `<p class="resume-entry__sub">${esc(job.name)}${job.location ? ` &middot; ${esc(job.location)}` : ""}</p>` : job.location ? `<p class="resume-entry__sub">${esc(job.location)}</p>` : ""}
        ${bullets(job.highlights)}
      </article>`,
    )
    .join("");
  return section("work-experience", "Work Experience", body);
}

function renderProjects(projects = []) {
  const body = (projects || [])
    .map(
      (project) => `
      <article class="resume-entry">
        <div class="resume-entry__row">
          <h3 class="resume-entry__title">${esc(project.name)}</h3>
          <span class="resume-entry__dates">${dateRange(project.startDate, project.endDate, project.endDateCurrent)}</span>
        </div>
        ${project.organization ? `<p class="resume-entry__sub">${esc(project.organization)}</p>` : ""}
        ${project.description ? `<p class="resume-text">${esc(project.description)}</p>` : ""}
        ${bullets(project.highlights)}
      </article>`,
    )
    .join("");
  return section("projects", "Projects", body);
}

function renderEducation(education = []) {
  const body = (education || [])
    .map((edu) => {
      const degree = join([edu.studyType, edu.area], ", ");
      const meta = join([degree, edu.score ? `GPA ${edu.score}` : ""]);
      return `
      <article class="resume-entry">
        <div class="resume-entry__row">
          <h3 class="resume-entry__title">${esc(edu.institution)}</h3>
          <span class="resume-entry__dates">${dateRange(edu.startDate, edu.endDate)}</span>
        </div>
        ${meta ? `<p class="resume-entry__sub">${meta}</p>` : ""}
      </article>`;
    })
    .join("");
  return section("education", "Education", body);
}

function renderSkills(skills = []) {
  const body = (skills || [])
    .filter((group) => group && (group.name || (group.keywords || []).length))
    .map(
      (group) => `
      <p class="resume-skill"><span class="resume-skill__name">${esc(group.name)}</span>${group.name && (group.keywords || []).length ? ": " : ""}${esc((group.keywords || []).join(", "))}</p>`,
    )
    .join("");
  return section("skills", "Skills &amp; Interests", body);
}

function renderCertificates(certificates = []) {
  const body = (certificates || [])
    .map(
      (cert) => `
      <article class="resume-entry resume-entry--compact">
        <div class="resume-entry__row">
          <h3 class="resume-entry__title">${esc(cert.name)}</h3>
          <span class="resume-entry__dates">${formatDate(cert.date)}</span>
        </div>
        ${cert.issuer ? `<p class="resume-entry__sub">${esc(cert.issuer)}</p>` : ""}
      </article>`,
    )
    .join("");
  return section("certifications", "Certifications", body);
}

function renderAwards(awards = []) {
  const body = (awards || [])
    .map(
      (award) => `
      <article class="resume-entry resume-entry--compact">
        <div class="resume-entry__row">
          <h3 class="resume-entry__title">${esc(award.title)}</h3>
          <span class="resume-entry__dates">${formatDate(award.date)}</span>
        </div>
        ${award.awarder ? `<p class="resume-entry__sub">${esc(award.awarder)}</p>` : ""}
        ${award.summary ? `<p class="resume-text">${esc(award.summary)}</p>` : ""}
      </article>`,
    )
    .join("");
  return section("awards", "Awards &amp; Scholarships", body);
}

function renderVolunteer(volunteer = []) {
  const body = (volunteer || [])
    .map(
      (role) => `
      <article class="resume-entry">
        <div class="resume-entry__row">
          <h3 class="resume-entry__title">${esc(role.position || role.organization)}</h3>
          <span class="resume-entry__dates">${dateRange(role.startDate, role.endDate)}</span>
        </div>
        ${role.position && role.organization ? `<p class="resume-entry__sub">${esc(role.organization)}</p>` : ""}
        ${role.summary ? `<p class="resume-text">${esc(role.summary)}</p>` : ""}
        ${bullets(role.highlights)}
      </article>`,
    )
    .join("");
  return section("activities", "Volunteering &amp; Leadership", body);
}

function renderPublications(publications = []) {
  const body = (publications || [])
    .map(
      (pub) => `
      <article class="resume-entry resume-entry--compact">
        <div class="resume-entry__row">
          <h3 class="resume-entry__title">${esc(pub.name)}</h3>
          <span class="resume-entry__dates">${formatDate(pub.releaseDate)}</span>
        </div>
        ${pub.publisher ? `<p class="resume-entry__sub">${esc(pub.publisher)}</p>` : ""}
      </article>`,
    )
    .join("");
  return section("publications", "Publications", body);
}

/**
 * Render the resume body (no <html>/<head>). The preview module wraps this in
 * a full document.
 * @param {object} resume JSON-Resume document
 * @returns {string} HTML
 */
export function renderResume(resume = {}) {
  const basics = resume.basics || {};
  const ordered = [
    renderSummary(basics),
    renderWork(resume.work),
    renderEducation(resume.education),
    renderSkills(resume.skills),
    renderCertificates(resume.certificates),
    renderAwards(resume.awards),
    renderProjects(resume.projects),
    renderVolunteer(resume.volunteer),
    renderPublications(resume.publications),
  ].join("");

  return `${renderHeader(basics)}${ordered}`;
}
