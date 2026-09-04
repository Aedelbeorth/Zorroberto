console.log("DEBUG: Iniciando sidebar.uc.js (Descargas integradas en Sidebar)...");
(function () {
  if (typeof gBrowser === "undefined") {
    console.log("DEBUG: No es la ventana principal. Cancelando.");
    return;
  }
  console.log("DEBUG: Ventana principal detectada.");

  function initSidebarIcons() {
    const header = document.getElementById("sidebar-header");
    if (!header) {
      setTimeout(initSidebarIcons, 500);
      return;
    }
    if (document.getElementById("sidebar-btn-bookmarks")) return;

    // ============================================================
    // FUNCIÓN PARA BOTONES DE SIDEBAR NORMALES
    // ============================================================
    function createSidebarButton(id, title, commandId) {
      const btn = document.createXULElement
        ? document.createXULElement("toolbarbutton")
        : document.createElement("toolbarbutton");
      btn.id = id;
      btn.setAttribute("title", title);
      btn.setAttribute("tooltiptext", title);
      btn.className = "sidebar-custom-icon";
      btn.addEventListener("click", () => {
        console.log("DEBUG: Clic en " + id + ". Abriendo sidebar: " + commandId);
        if (window.SidebarUI && typeof window.SidebarUI.show === "function") {
          window.SidebarUI.show(commandId);
          return;
        }
        if (window.SidebarController && typeof window.SidebarController.show === "function") {
          window.SidebarController.show(commandId);
          return;
        }
        const cmd = document.getElementById(commandId) || document.querySelector(`command[id="${commandId}"]`);
        if (cmd) { cmd.doCommand(); return; }
        
        let menuId = "";
        if (commandId === "viewBookmarksSidebar") menuId = "menu_bookmarksSidebar";
        else if (commandId === "viewHistorySidebar") menuId = "menu_historySidebar";
        else if (commandId === "viewTabsSidebar") menuId = "menu_tabsSidebar";
        const menuItem = document.getElementById(menuId);
        if (menuItem) { menuItem.click(); return; }
        
        console.error("DEBUG ERROR: Ningún método funcionó para " + commandId);
      });
      return btn;
    }

    // ============================================================
    // FUNCIÓN ESPECIAL: CARGAR DESCARGAS DENTRO DE LA SIDEBAR
    // ============================================================
    function createDownloadsButton() {
      const btn = document.createXULElement
        ? document.createXULElement("toolbarbutton")
        : document.createElement("toolbarbutton");
      btn.id = "sidebar-btn-downloads";
      btn.setAttribute("title", "Descargas");
      btn.setAttribute("tooltiptext", "Descargas");
      btn.className = "sidebar-custom-icon";
      
      btn.addEventListener("click", () => {
        console.log("DEBUG: Clic en Descargas. Inyectando about:downloads en la barra lateral.");
        
        // 1. Asegurarse de que la barra lateral esté abierta
        if (window.SidebarUI && typeof window.SidebarUI.show === "function") {
          if (!window.SidebarUI.isOpen) window.SidebarUI.show("viewBookmarksSidebar");
        } else if (window.SidebarController && typeof window.SidebarController.show === "function") {
          if (!window.SidebarController.isOpen) window.SidebarController.show("viewBookmarksSidebar");
        }
        
        // 2. Pequeño retraso para que el contenedor esté listo y luego inyectar la URL
        setTimeout(() => {
          const sidebarBrowser = document.getElementById("sidebar");
          if (sidebarBrowser) {
            try {
              // Método moderno y seguro para cargar URLs internas
              sidebarBrowser.loadURI("about:downloads", {
                triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
              });
            } catch (e) {
              // Fallback para versiones más antiguas
              sidebarBrowser.setAttribute("src", "about:downloads");
            }
          }
          
          // 3. Marcar nuestro comando personalizado para que el CSS sepa qué icono iluminar
          const sidebarBox = document.getElementById("sidebar-box");
          if (sidebarBox) {
            sidebarBox.setAttribute("sidebarcommand", "viewDownloadsSidebar");
          }
          
          updateActiveIcon("downloads");
        }, 150);
      });
      
      return btn;
    }

    // ============================================================
    // CREAR E INSERTAR LOS BOTONES
    // ============================================================
    const btnBookmarks = createSidebarButton("sidebar-btn-bookmarks", "Marcadores", "viewBookmarksSidebar");
    const btnHistory = createSidebarButton("sidebar-btn-history", "Historial", "viewHistorySidebar");
    const btnSync = createSidebarButton("sidebar-btn-sync", "Pestañas sincronizadas", "viewTabsSidebar");
    const btnDownloads = createDownloadsButton();

    header.insertBefore(btnDownloads, header.firstChild);
    header.insertBefore(btnSync, btnDownloads);
    header.insertBefore(btnHistory, btnSync);
    header.insertBefore(btnBookmarks, btnHistory);
    console.log("DEBUG: 4 botones insertados en el DOM.");

    // ============================================================
    // ZONA INVISIBLE DE DETECCIÓN
    // ============================================================
    const sidebarBox = document.getElementById("sidebar-box");
    if (sidebarBox) {
      const detectZone = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      detectZone.id = "sidebar-detect-zone";
      detectZone.style.cssText = `
        position: fixed !important; display: block !important;
        left: 0 !important; top: 0 !important; bottom: 0 !important;
        width: 15px !important; z-index: 9998 !important; cursor: default !important;
      `;
      detectZone.addEventListener("mouseenter", () => sidebarBox.classList.add("sidebar-force-open"));
      detectZone.addEventListener("mouseleave", () => sidebarBox.classList.remove("sidebar-force-open"));
      document.documentElement.appendChild(detectZone);
      console.log("DEBUG: Zona de detección creada.");
    }

    // ============================================================
    // ACTUALIZAR ICONO ACTIVO
    // ============================================================
    let currentActivePanel = null;
    
    function updateActiveIcon(forcedPanel = null) {
      const sidebarBox = document.getElementById("sidebar-box");
      if (!sidebarBox) return;
      
      if (forcedPanel) currentActivePanel = forcedPanel;
      
      const current = sidebarBox.getAttribute("sidebarcommand");
      
      [btnBookmarks, btnHistory, btnSync, btnDownloads].forEach(b => 
        b.classList.remove("sidebar-icon-active")
      );
      
      if (current === "viewBookmarksSidebar") btnBookmarks.classList.add("sidebar-icon-active");
      if (current === "viewHistorySidebar") btnHistory.classList.add("sidebar-icon-active");
      if (current === "viewTabsSidebar") btnSync.classList.add("sidebar-icon-active");
      
      // Resaltar descargas si está forzado o si el comando coincide
      if (current === "viewDownloadsSidebar" || currentActivePanel === "downloads") {
        btnDownloads.classList.add("sidebar-icon-active");
      }
    }

    if (sidebarBox) {
      const observer = new MutationObserver(() => updateActiveIcon());
      observer.observe(sidebarBox, { attributes: true, attributeFilter: ["sidebarcommand", "hidden"] });
    }
    
    setTimeout(updateActiveIcon, 500);
  }

  if (document.readyState === "complete") {
    setTimeout(initSidebarIcons, 500);
  } else {
    window.addEventListener("load", () => { setTimeout(initSidebarIcons, 500); }, { once: true });
  }
})();