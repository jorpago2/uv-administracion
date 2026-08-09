const ROUTES = Object.freeze([
  { id: "inicio", label: "Inicio", href: "" },
  { id: "resolver", label: "Resolver", href: "resolver/" },
  { id: "ambitos", label: "Ámbitos", href: "#domainsTitle", activePages: ["administracion", "carrera-pdi", "cumplimiento"] },
  { id: "docencia", label: "Docencia", href: "docencia/" },
  { id: "investigacion", label: "Investigación", href: "investigacion/" },
  { id: "gestion", label: "Gestión", href: "gestion/" },
  { id: "financiacion", label: "Financiación", href: "financiacion/" },
  { id: "herramientas", label: "Herramientas", href: "herramientas/" },
  { id: "manual", label: "Manual", href: "manual/" }
]);

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const root = document.body.dataset.root ?? "./";
    const current = document.body.dataset.page ?? "";
    this.innerHTML = `
      <header class="hub-masthead">
        <div class="hub-masthead__identity">
          <a class="hub-brand" href="${root}" aria-label="Guía operativa UV · inicio"><span>UV</span><strong>Guía operativa PDI</strong></a>
          <p>Uso personal · contenido no oficial</p>
          <button class="hub-menu-button" type="button" aria-expanded="false" aria-controls="hubPrimaryNav">Menú</button>
        </div>
        <nav class="hub-primary-nav" id="hubPrimaryNav" aria-label="Navegación principal">
          ${ROUTES.map((route) => `<a href="${root}${route.href}"${route.id === current || route.activePages?.includes(current) ? ' aria-current="page"' : ""}>${route.label}</a>`).join("")}
        </nav>
      </header>`;
    const button = this.querySelector(".hub-menu-button");
    const nav = this.querySelector(".hub-primary-nav");
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      nav.dataset.open = String(open);
    });
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        button.setAttribute("aria-expanded", "false");
        nav.dataset.open = "false";
      }
    });
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    const root = document.body.dataset.root ?? "./";
    this.innerHTML = `
      <footer class="hub-footer">
        <p><strong>Guía personal de <a href="https://www.uv.es/jorpago2">Jorge Parra</a>.</strong> No oficial; puede contener errores. Verifica siempre la fuente vigente.</p>
        <nav aria-label="Enlaces de cierre"><a href="${root}auditoria/">Auditoría</a><a href="${root}glosario/">Glosario</a><a href="${root}consulta.html">Vista completa</a><a href="${root}MANUAL_PROCEDIMIENTOS.md">Markdown</a></nav>
      </footer>`;
  }
}

if (!customElements.get("site-header")) customElements.define("site-header", SiteHeader);
if (!customElements.get("site-footer")) customElements.define("site-footer", SiteFooter);
