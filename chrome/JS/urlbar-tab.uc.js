console.log("DEBUG: Iniciando urlbar-tab.uc.js (URL flotante debajo de la pestana activa)...");
// @ignorecache

(function () {
  if (typeof gBrowser === "undefined") {
    console.log("DEBUG: No es la ventana principal. Cancelando urlbar-tab.uc.js.");
    return;
  }

  window.__urlbarTabFloatMode = true;

  function initUrlbarFloat() {
    const urlbarContainer = document.getElementById("urlbar-container");
    const urlbarInput = document.getElementById("urlbar-input");
    const tabsContainer = document.getElementById("tabbrowser-tabs");

    if (!urlbarContainer || !urlbarInput || !tabsContainer || !window.gURLBar) {
      setTimeout(initUrlbarFloat, 500);
      return;
    }

    const starButton = document.getElementById("star-button");

    let wrapper = document.getElementById("urlbar-tab-float-wrapper");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "urlbar-tab-float-wrapper";
      document.documentElement.appendChild(wrapper);

      if (urlbarContainer) {
        // Mover el contenedor completo para mantener el selector de buscador y la UI nativa.
        wrapper.appendChild(urlbarContainer);
      } else {
        wrapper.appendChild(urlbarInput);
      }

      if (starButton) {
        const bookmarkProxy = document.createElement("button");
        bookmarkProxy.id = "urlbar-bookmark-proxy";
        bookmarkProxy.type = "button";
        bookmarkProxy.title = "Añadir esta página a marcadores";
        bookmarkProxy.setAttribute("aria-label", bookmarkProxy.title);

        const syncBookmarkProxy = () => {
          const isBookmarked = starButton.hasAttribute("starred");
          bookmarkProxy.classList.toggle("bookmarked", isBookmarked);
          bookmarkProxy.textContent = String.fromCodePoint(isBookmarked ? 0x2605 : 0x2606);
          bookmarkProxy.title = isBookmarked
            ? "Editar este marcador"
            : "Añadir esta página a marcadores";
          bookmarkProxy.setAttribute("aria-label", bookmarkProxy.title);
        };

        syncBookmarkProxy();
        new MutationObserver(syncBookmarkProxy).observe(starButton, {
          attributes: true,
          attributeFilter: ["starred"]
        });

        bookmarkProxy.addEventListener("click", () => {
          try {
            if (typeof PlacesCommandHook !== "undefined" && typeof PlacesCommandHook.toggleBookmark === "function") {
              PlacesCommandHook.toggleBookmark();
              return;
            }
            if (typeof PlacesCommandHook !== "undefined" && typeof PlacesCommandHook.bookmarkPage === "function") {
              PlacesCommandHook.bookmarkPage();
              return;
            }
            if (starButton && typeof starButton.click === "function") {
              starButton.click();
              return;
            }
            if (starButton && typeof starButton.dispatchEvent === "function") {
              starButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            }
          } catch (e) {
            console.log("DEBUG: Error al delegar el clic del star-button:", e);
          }
        });

        wrapper.appendChild(bookmarkProxy);
        if (starButton) {
          starButton.hidden = true;
          starButton.setAttribute("aria-hidden", "true");
        }
      }

      const searchModeArrow = document.createElement("span");
      searchModeArrow.id = "urlbar-searchmode-arrow-proxy";
      searchModeArrow.textContent = "▾";
      searchModeArrow.setAttribute("aria-hidden", "true");
      wrapper.appendChild(searchModeArrow);

      console.log("DEBUG: Envoltorio flotante creado con selector de buscador y proxy de estrella.");
    }

    let isFloating = false;
    let closeSuspendUntil = 0;
    let pointerCloseTimer = null;
    let keepOpenThroughTabSelectUntil = 0;
    const suggestionPanel = document.createElement("div");
    suggestionPanel.id = "urlbar-tab-float-suggestions";
    suggestionPanel.style.cssText = [
      "position: absolute",
      "top: 48px",
      "left: 0",
      "width: 100%",
      "box-sizing: border-box",
      "padding: 6px",
      "border: 1px solid rgba(128, 128, 128, .35)",
      "border-radius: 12px",
      "background: color-mix(in srgb, Canvas 88%, transparent)",
      "box-shadow: 0 10px 28px rgba(0, 0, 0, .28)",
      "backdrop-filter: blur(18px)",
      "z-index: 10002",
      "color: CanvasText",
      "font-size: 15px"
    ].join(";");
    suggestionPanel.hidden = true;
    wrapper.appendChild(suggestionPanel);

    let suggestionResults = [];
    let suggestionTimer = null;
    let suggestionRequestId = 0;

    function resizeFloatingPanel() {
      const baseHeight = 96;
      const suggestionsHeight = suggestionPanel.hidden ? 0 : suggestionPanel.scrollHeight + 8;
      const height = Math.min(window.innerHeight - 40, baseHeight + suggestionsHeight);
      wrapper.style.setProperty("height", `${Math.max(baseHeight, height)}px`, "important");
      if (isFloating) positionBelowActiveTab();
    }

    function hideSuggestions() {
      suggestionResults = [];
      suggestionPanel.replaceChildren();
      suggestionPanel.hidden = true;
      resizeFloatingPanel();
    }

    function getSuggestionText(result) {
      const payload = result && result.payload ? result.payload : {};
      return payload.suggestion || result.title || payload.title || payload.url || payload.displayUrl || "";
    }

    function getSuggestionUrl(result) {
      const payload = result && result.payload ? result.payload : {};
      return payload.url || payload.suggestion || payload.title || "";
    }

    function renderSuggestions(results) {
      if (!isFloating || !gURLBar.value.trim()) {
        hideSuggestions();
        return;
      }

      suggestionResults = results.filter((result) => getSuggestionText(result)).slice(0, 8);
      suggestionPanel.replaceChildren();
      if (!suggestionResults.length) {
        suggestionPanel.hidden = true;
        resizeFloatingPanel();
        return;
      }

      suggestionResults.forEach((result, index) => {
        const item = document.createElement("div");
        const text = getSuggestionText(result);
        const url = getSuggestionUrl(result);
        item.className = "urlbar-tab-float-suggestion";
        item.dataset.index = String(index);
        item.title = url;

        const label = document.createElement("span");
        label.className = "urlbar-tab-float-suggestion-label";
        label.textContent = text;
        item.appendChild(label);

        if (url && url !== text) {
          const detail = document.createElement("span");
          detail.className = "urlbar-tab-float-suggestion-detail";
          detail.textContent = url;
          item.appendChild(detail);
        }

        item.addEventListener("mousedown", (event) => {
          event.preventDefault();
          gURLBar.value = url;
          gURLBar.focus();
          hideSuggestions();
            try {
              gURLBar.handleCommand();
            } catch (error) {
              console.log("DEBUG: No se pudo ejecutar la sugerencia:", error);
            }
        });
        suggestionPanel.appendChild(item);
      });
      suggestionPanel.hidden = false;
      resizeFloatingPanel();
    }

    function getHistorySuggestions(searchString) {
      try {
        const { PlacesUtils } = ChromeUtils.importESModule(
          "resource://gre/modules/PlacesUtils.sys.mjs"
        );
        const query = PlacesUtils.history.getNewQuery();
        query.searchTerms = searchString;
        const options = PlacesUtils.history.getNewQueryOptions();
        options.maxResults = 8;
        options.sortingMode = options.SORT_BY_DATE_DESCENDING;

        const result = PlacesUtils.history.executeQuery(query, options);
        const root = result.root;
        root.containerOpen = true;
        const matches = [];
        for (let index = 0; index < root.childCount; index++) {
          const node = root.getChild(index);
          if (node.uri) {
            matches.push({
              title: node.title || node.uri,
              payload: { url: node.uri }
            });
          }
        }
        root.containerOpen = false;
        return matches;
      } catch (error) {
        console.log("DEBUG: No se pudo consultar el historial:", error);
        return [];
      }
    }

    async function getSearchSuggestions(searchString) {
      try {
        const response = await fetch(
          `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(searchString)}`
        );
        if (!response.ok) return [];
        const data = await response.json();
        return (data[1] || []).slice(0, 5).map((suggestion) => ({
          title: suggestion,
          payload: { suggestion }
        }));
      } catch (error) {
        console.log("DEBUG: No se pudieron consultar sugerencias web:", error);
        return [];
      }
    }

    async function refreshSuggestions(searchString) {
      const requestId = ++suggestionRequestId;
      const historyMatches = getHistorySuggestions(searchString);
      const searchMatches = await getSearchSuggestions(searchString);
      if (requestId === suggestionRequestId) {
        renderSuggestions([...historyMatches, ...searchMatches]);
      }
    }

    const suggestionListener = {
      onQueryResult(queryContext) {
        renderSuggestions(queryContext.results || []);
      }
    };

    try {
      gURLBar.controller.addQueryListener(suggestionListener);
    } catch (error) {
      console.log("DEBUG: No se pudo conectar el listener de sugerencias:", error);
    }

    const MIN_WIDTH = 520;
    const DEFAULT_GAP = 80;
    const EXTRA_GAP_AFTER_TOOLTIP = 24;
    const POINTER_CLOSE_DELAY = 1000;

    function isSearchPickerElement(el) {
      if (!el || typeof el.closest !== "function") return false;
      return [
        "#search-one-offs-container",
        ".search-one-offs-container",
        ".search-one-offs",
        ".urlbar-engine-one-off-item",
        ".searchbar-engine",
        "#urlbar-one-offs-search-buttons",
        "#PopupSearchAutoComplete"
      ].some((selector) => !!el.closest(selector));
    }

    function cancelPointerClose() {
      if (pointerCloseTimer) {
        clearTimeout(pointerCloseTimer);
        pointerCloseTimer = null;
      }
    }

    function schedulePointerClose() {
      cancelPointerClose();
      pointerCloseTimer = setTimeout(() => {
        pointerCloseTimer = null;
        if (isFloating && !wrapper.matches(":hover")) {
          hideFloatingUrlbar();
        }
      }, POINTER_CLOSE_DELAY);
    }

    function suspendCloseFor(ms) {
      closeSuspendUntil = Date.now() + ms;
    }

    function isIgnoredUiElement(el) {
      if (!el || typeof el.closest !== "function") return false;
      return [
        "#urlbar",
        "#urlbar-container",
        "#urlbar-tab-float-wrapper",
        "#urlbar-one-off-buttons",
        "#search-one-offs-container",
        ".search-one-offs-container",
        ".urlbar-engine-one-off-item",
        "#star-button",
        "#star-button-box",
        ".urlbar-page-action",
        "#nav-bar",
        "#nav-bar-customization-target",
        "toolbarbutton",
        ".urlbarView"
      ].some((selector) => !!el.closest(selector));
    }

    function positionBelowActiveTab() {
      const tab = gBrowser.selectedTab;
      if (!tab) return;

      const width = Math.min(710, window.innerWidth - 40);
      const height = Math.min(
        window.innerHeight - 40,
        96 + (suggestionPanel && !suggestionPanel.hidden ? suggestionPanel.scrollHeight + 8 : 0)
      );

      const tabsRect = tabsContainer.getBoundingClientRect();
      const top = Math.max(20, tabsRect.bottom + 24);

      const left = Math.max(20, (window.innerWidth - width) / 2);

      wrapper.style.setProperty("left", `${left}px`, "important");
      wrapper.style.setProperty("top", `${top}px`, "important");
      wrapper.style.setProperty("width", `${width}px`, "important");
      wrapper.style.setProperty("height", `${height}px`, "important");
    }

    function showFloatingUrlbar() {
      if (isFloating) return;
      isFloating = true;
      positionBelowActiveTab();
      wrapper.classList.add("urlbar-floating-active");
      requestAnimationFrame(() => {
        if (document.activeElement !== gURLBar) {
          gURLBar.focus();
          gURLBar.select();
        }
      });
      console.log("DEBUG: URL flotante mostrada debajo de la pestana activa.");
    }

    function hideFloatingUrlbar() {
      if (!isFloating) return;
      cancelPointerClose();
      isFloating = false;
      hideSuggestions();
      wrapper.classList.remove("urlbar-floating-active");
      console.log("DEBUG: URL flotante ocultada.");
    }

    function closeIfFocusLeft() {
      if (Date.now() < closeSuspendUntil) return;
      if (!isFloating) return;

      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) {
        hideFloatingUrlbar();
        return;
      }

      const isInsideUrlbar = !!(active && (active.closest("#urlbar") || active.closest("#urlbar-container") || wrapper.contains(active)));
      if (isInsideUrlbar) return;
      if (active && isIgnoredUiElement(active)) return;
      if (active && tabsContainer.contains(active)) return;

      hideFloatingUrlbar();
    }

    function isEmptyTab(tab) {
      if (!tab || !tab.linkedBrowser) return false;
      const spec = tab.linkedBrowser.currentURI && tab.linkedBrowser.currentURI.spec;
      return spec === "about:blank"
        || spec === "about:home"
        || spec === "about:newtab";
    }

    let tabAtMouseDown = null;
    let tabWasActiveAtMouseDown = false;
    let suppressTabSelectOpenUntil = 0;
    tabsContainer.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        tabAtMouseDown = null;
        tabWasActiveAtMouseDown = false;
        return;
      }

      tabAtMouseDown = event.target.closest(".tabbrowser-tab");
      tabWasActiveAtMouseDown = tabAtMouseDown === gBrowser.selectedTab;
      if (tabAtMouseDown && tabAtMouseDown !== gBrowser.selectedTab) {
        suppressTabSelectOpenUntil = Date.now() + 700;
        hideFloatingUrlbar();
      }
    }, true);

    tabsContainer.addEventListener("click", (event) => {
      const tab = event.target.closest(".tabbrowser-tab");
      const wasActiveTab = tab && tab === tabAtMouseDown && tabWasActiveAtMouseDown;
      tabAtMouseDown = null;
      tabWasActiveAtMouseDown = false;
      if (!wasActiveTab) return;
      if (event.target.closest(".tab-close-button")) return;
      if (event.button !== 0) return;

      if (isFloating) {
        hideFloatingUrlbar();
      } else {
        keepOpenThroughTabSelectUntil = Date.now() + 300;
        showFloatingUrlbar();
      }
    }, true);

    // Cerrar un segundo después de salir de la caja, salvo al pasar al
    // selector de buscadores para poder elegir otro motor con comodidad.
    wrapper.addEventListener("mouseenter", cancelPointerClose);
    wrapper.addEventListener("mouseleave", (event) => {
      if (!isSearchPickerElement(event.relatedTarget)) {
        schedulePointerClose();
      }
    });

    document.addEventListener("mouseover", (event) => {
      if (isSearchPickerElement(event.target)) {
        cancelPointerClose();
      }
    }, true);

    document.addEventListener("mouseout", (event) => {
      if (isSearchPickerElement(event.target)
          && !isSearchPickerElement(event.relatedTarget)
          && !wrapper.contains(event.relatedTarget)) {
        schedulePointerClose();
      }
    }, true);

    gURLBar.addEventListener("blur", (event) => {
      const related = event.relatedTarget;
      if (related && isIgnoredUiElement(related)) {
        suspendCloseFor(500);
        return;
      }
      setTimeout(closeIfFocusLeft, 80);
    });

    gURLBar.addEventListener("focusout", (event) => {
      const related = event.relatedTarget;
      if (related && isIgnoredUiElement(related)) {
        suspendCloseFor(500);
        return;
      }
      setTimeout(closeIfFocusLeft, 80);
    });

    // Al estar fuera de la barra de navegacion, Firefox no siempre abre su
    // vista de resultados automaticamente al recibir el primer caracter.
    gURLBar.addEventListener("input", () => {
      if (!isFloating || !gURLBar.value.trim()) {
        hideSuggestions();
        return;
      }
      clearTimeout(suggestionTimer);
      suggestionTimer = setTimeout(() => {
        refreshSuggestions(gURLBar.value.trim());
      }, 120);
    });

    gURLBar.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Escape") {
        setTimeout(() => {
          if (document.activeElement !== gURLBar && !isIgnoredUiElement(document.activeElement)) {
            hideFloatingUrlbar();
          }
        }, 80);
      }
    });

    document.addEventListener("mousedown", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;

      if (target.closest("#star-button") || target.closest(".urlbar-engine-one-off-item") || target.closest("#search-one-offs-container") || target.closest("#urlbar-one-off-buttons")) {
        suspendCloseFor(700);
        return;
      }

      if (!wrapper.contains(target) && !tabsContainer.contains(target) && !target.closest("#urlbar") && !target.closest("#urlbar-container") && isFloating) {
        hideFloatingUrlbar();
      }
    }, true);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isFloating) hideFloatingUrlbar();
    });

    window.addEventListener("resize", () => {
      if (isFloating) positionBelowActiveTab();
    });

    gBrowser.tabContainer.addEventListener("TabOpen", (event) => {
      const tab = event.target;
      setTimeout(() => {
        if (tab === gBrowser.selectedTab && isEmptyTab(tab)) {
          keepOpenThroughTabSelectUntil = Date.now() + 500;
          showFloatingUrlbar();
        }
      }, 50);
    });

    gBrowser.tabContainer.addEventListener("TabSelect", () => {
      if (Date.now() < keepOpenThroughTabSelectUntil) return;
      hideFloatingUrlbar();
    });

    console.log("DEBUG: urlbar-tab.uc.js listo (caja flotante debajo de la pestana).")
  }

  if (document.readyState === "complete") {
    setTimeout(initUrlbarFloat, 500);
  } else {
    window.addEventListener("load", () => setTimeout(initUrlbarFloat, 500), { once: true });
  }
})();
