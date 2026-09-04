console.log("DEBUG: Iniciando navbar-width.uc.js (ancho de pestanas segun addons)...");

(function () {
  if (typeof gBrowser === "undefined") {
    console.log("DEBUG: No es la ventana principal. Cancelando navbar-width.uc.js.");
    return;
  }

  function init() {
    const target = document.getElementById("nav-bar-customization-target");

    if (!target) {
      setTimeout(init, 500);
      return;
    }

    const EXTRA_GAP = 84;
    const MIN_SIZE = 4;

    function isMeasurable(el) {
      if (el.id === "urlbar-container") return false;
      if (el.localName === "toolbarseparator") return false;
      if (el.localName === "toolbarspring") return false;
      if (el.getAttribute && el.getAttribute("type") === "separator") return false;
      if (el.classList && el.classList.contains("toolbarbutton-spring")) return false;
      return true;
    }

    function update() {
      const children = target.querySelectorAll(":scope > *");
      let maxRight = 0;
      let winnerId = "(ninguno)";

      console.log("DEBUG-NAV: --- recalculando ---");
      console.log("DEBUG-NAV: target rect ->", JSON.stringify(target.getBoundingClientRect()));

      for (const el of children) {
        const rect = el.getBoundingClientRect();
        const measurable = isMeasurable(el);
        const tooSmall = rect.width < MIN_SIZE && rect.height < MIN_SIZE;
        console.log(
          "DEBUG-NAV: hijo ->", el.id || el.localName,
          "measurable:", measurable,
          "tooSmall:", tooSmall,
          "rect:", JSON.stringify({ left: rect.left, right: rect.right, width: rect.width, height: rect.height })
        );

        if (!measurable) continue;
        if (tooSmall) continue;
        if (rect.width === 0 && rect.height === 0) continue;

        if (rect.right > maxRight) {
          maxRight = rect.right;
          winnerId = el.id || el.localName;
        }
      }

      if (maxRight === 0) {
        maxRight = target.getBoundingClientRect().left + 40;
        winnerId = "(fallback)";
      }

      const px = Math.round(maxRight + EXTRA_GAP);
      const before = getComputedStyle(document.documentElement).getPropertyValue("--NavbarContentWidth");
      console.log("DEBUG-NAV: ganador ->", winnerId, "maxRight:", maxRight, "px final:", px, "valor anterior:", before);

      document.documentElement.style.setProperty("--NavbarContentWidth", `${px}px`);
    }

    let debounceTimer = null;
    function scheduleUpdate() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(update, 150);
    }

    const ro = new ResizeObserver(() => {
      console.log("DEBUG-NAV: ResizeObserver disparado");
      scheduleUpdate();
    });
    ro.observe(target);

    const mo = new MutationObserver(() => {
      console.log("DEBUG-NAV: MutationObserver disparado");
      scheduleUpdate();
    });
    mo.observe(target, { childList: true, subtree: true, attributes: true });

    window.addEventListener("resize", scheduleUpdate);

    update();
    setTimeout(update, 800);

    console.log("DEBUG: navbar-width.uc.js listo.");
  }

  if (document.readyState === "complete") {
    setTimeout(init, 500);
  } else {
    window.addEventListener("load", () => setTimeout(init, 500), { once: true });
  }
})();
