import { supabase } from "./supabaseClient.js";

(function () {
  var state = {
    resources: [],
    categories: [],
    query: "",
    category: "all",
    type: "all"
  };

  var els = {
    totalResources: document.getElementById("totalResources"),
    totalCategories: document.getElementById("totalCategories"),
    totalSize: document.getElementById("totalSize"),
    searchInput: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    typeFilter: document.getElementById("typeFilter"),
    clearFilters: document.getElementById("clearFilters"),
    categoryGrid: document.getElementById("categoryGrid"),
    resourceGrid: document.getElementById("resourceGrid"),
    activeSummary: document.getElementById("activeSummary"),
    resultCount: document.getElementById("resultCount"),
    emptyState: document.getElementById("emptyState"),
    modal: document.getElementById("previewModal"),
    previewTitle: document.getElementById("previewTitle"),
    previewMeta: document.getElementById("previewMeta"),
    previewBody: document.getElementById("previewBody"),
    openGithub: document.getElementById("openGithub"),
    downloadFile: document.getElementById("downloadFile")
  };

  var typeLabels = {
    pdf: "PDF",
    document: "Word",
    presentation: "PowerPoint",
    spreadsheet: "Spreadsheet",
    image: "Image",
    video: "Video",
    archive: "Archive",
    text: "Text",
    other: "Other"
  };

  var badgeLabels = {
    pdf: "PDF",
    document: "DOC",
    presentation: "PPT",
    spreadsheet: "XLS",
    image: "IMG",
    video: "VID",
    archive: "ZIP",
    text: "TXT",
    other: "FILE"
  };

  var titleCollator = new Intl.Collator("en", {
    numeric: true,
    sensitivity: "base"
  });

  initializeAuth();

  fetch("./resources.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Unable to load resources.json");
      }
      return response.json();
    })
    .then(function (data) {
      state.resources = (Array.isArray(data.resources) ? data.resources : []).slice().sort(compareResources);
      state.categories = (Array.isArray(data.categories) ? data.categories : []).slice().sort(compareCategories);
      renderFilters();
      render();
    })
    .catch(function (error) {
      els.activeSummary.textContent = error.message;
      els.resourceGrid.innerHTML = "";
      els.emptyState.hidden = false;
    });

  els.searchInput.addEventListener("input", function (event) {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  els.categoryFilter.addEventListener("change", function (event) {
    state.category = event.target.value;
    render();
  });

  els.typeFilter.addEventListener("change", function (event) {
    state.type = event.target.value;
    render();
  });

  els.clearFilters.addEventListener("click", function () {
    state.query = "";
    state.category = "all";
    state.type = "all";
    els.searchInput.value = "";
    els.categoryFilter.value = "all";
    els.typeFilter.value = "all";
    render();
  });

  els.categoryGrid.addEventListener("click", function (event) {
    var card = event.target.closest("[data-category]");
    if (!card) {
      return;
    }
    state.category = card.getAttribute("data-category");
    els.categoryFilter.value = state.category;
    render();
    document.getElementById("resourcesTitle").scrollIntoView({ block: "start" });
  });

  els.resourceGrid.addEventListener("click", function (event) {
    var previewButton = event.target.closest("[data-preview-id]");
    if (previewButton) {
      var previewResource = state.resources.find(function (item) {
        return item.id === previewButton.getAttribute("data-preview-id");
      });
      if (previewResource) {
        openPreview(previewResource);
      }
      return;
    }

    var downloadLink = event.target.closest("[data-download-id]");
    if (!downloadLink) {
      return;
    }
    var downloadResource = state.resources.find(function (item) {
      return item.id === downloadLink.getAttribute("data-download-id");
    });
    if (downloadResource) {
      logResourceEvent(downloadResource, "download");
    }
  });

  els.modal.addEventListener("click", function (event) {
    if (event.target.hasAttribute("data-close-modal")) {
      closePreview();
    }
  });

  els.downloadFile.addEventListener("click", function () {
    var resource = state.resources.find(function (item) {
      return item.id === els.downloadFile.getAttribute("data-download-id");
    });
    if (resource) {
      logResourceEvent(resource, "download");
    }
  });

  els.previewBody.addEventListener("click", function (event) {
    var modeButton = event.target.closest("[data-preview-mode]");
    if (!modeButton) {
      return;
    }
    var resource = state.resources.find(function (item) {
      return item.id === modeButton.getAttribute("data-preview-resource-id");
    });
    if (resource) {
      renderFramePreview(resource, modeButton.getAttribute("data-preview-mode"));
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !els.modal.hidden) {
      closePreview();
    }
  });

  function renderFilters() {
    els.categoryFilter.innerHTML = '<option value="all">All subjects</option>' + state.categories.map(function (category) {
      return '<option value="' + escapeHtml(category.id) + '">' + escapeHtml(category.title) + '</option>';
    }).join("");

    var types = unique(state.resources.map(function (resource) {
      return resource.fileType;
    })).sort();

    els.typeFilter.innerHTML = '<option value="all">All types</option>' + types.map(function (type) {
      return '<option value="' + escapeHtml(type) + '">' + escapeHtml(typeLabels[type] || type) + '</option>';
    }).join("");
  }

  function render() {
    var totalSize = state.resources.reduce(function (sum, resource) {
      return sum + (Number(resource.fileSize) || 0);
    }, 0);

    els.totalResources.textContent = String(state.resources.length);
    els.totalCategories.textContent = String(state.categories.length);
    els.totalSize.textContent = formatSize(totalSize);

    renderCategories();

    var filtered = state.resources.filter(matchesFilters).sort(compareResources);
    els.activeSummary.textContent = summarizeActiveFilters(filtered.length);
    els.resultCount.textContent = filtered.length + " shown";
    els.emptyState.hidden = filtered.length > 0;
    els.resourceGrid.innerHTML = filtered.map(renderResourceCard).join("");
  }

  function renderCategories() {
    els.categoryGrid.innerHTML = state.categories.map(function (category) {
      var active = state.category === category.id ? " is-active" : "";
      return [
        '<button class="category-card' + active + '" type="button" data-category="' + escapeHtml(category.id) + '" style="--accent: ' + escapeHtml(category.accent || "#2265d8") + '">',
        '  <span class="category-topline">',
        '    <span class="category-icon" aria-hidden="true">' + escapeHtml(category.shortLabel || category.title.slice(0, 2)) + '</span>',
        '    <span class="category-count">' + category.count + ' files</span>',
        '  </span>',
        '  <span>',
        '    <h3>' + escapeHtml(category.title) + '</h3>',
        '    <p>' + escapeHtml(category.description || "") + '</p>',
        '  </span>',
        '  <span class="category-size">' + escapeHtml(category.totalSizeLabel || "") + '</span>',
        '</button>'
      ].join("");
    }).join("");
  }

  function renderResourceCard(resource) {
    var badge = badgeLabels[resource.fileType] || "FILE";
    return [
      '<article class="resource-card">',
      '  <span class="file-badge" data-kind="' + escapeHtml(resource.fileType) + '">' + escapeHtml(badge) + '</span>',
      '  <div class="resource-content">',
      '    <h3>' + escapeHtml(resource.title) + '</h3>',
      '    <div class="resource-meta">',
      '      <span>' + escapeHtml(resource.category) + '</span>',
      '      <span>' + escapeHtml(resource.fileTypeLabel || typeLabels[resource.fileType] || resource.extension) + '</span>',
      '      <span>' + escapeHtml(resource.fileSizeLabel) + '</span>',
      '    </div>',
      '    <p class="resource-description">' + escapeHtml(resource.description || "") + '</p>',
      '    <div class="resource-actions">',
      '      <button class="ghost-button" type="button" data-preview-id="' + escapeHtml(resource.id) + '">Preview</button>',
      '      <a class="primary-button" href="' + escapeAttribute(resource.downloadUrl) + '" target="_blank" rel="noreferrer" data-download-id="' + escapeAttribute(resource.id) + '">Download</a>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join("");
  }

  function matchesFilters(resource) {
    var query = state.query;
    var categoryMatch = state.category === "all" || resource.categoryId === state.category;
    var typeMatch = state.type === "all" || resource.fileType === state.type;
    var queryText = [
      resource.title,
      resource.category,
      resource.fileType,
      resource.extension,
      resource.originalFilename,
      resource.description
    ].join(" ").toLowerCase();
    var queryMatch = !query || queryText.includes(query);
    return categoryMatch && typeMatch && queryMatch;
  }

  function summarizeActiveFilters(count) {
    var parts = [];
    if (state.category !== "all") {
      var category = state.categories.find(function (item) {
        return item.id === state.category;
      });
      if (category) {
        parts.push(category.title);
      }
    }
    if (state.type !== "all") {
      parts.push(typeLabels[state.type] || state.type);
    }
    if (state.query) {
      parts.push('"' + state.query + '"');
    }
    if (!parts.length) {
      return count + " resources across all subjects";
    }
    return count + " resources matching " + parts.join(" / ");
  }

  function openPreview(resource) {
    logResourceEvent(resource, "preview");
    els.previewTitle.textContent = resource.title;
    els.previewMeta.textContent = [resource.category, resource.fileTypeLabel || typeLabels[resource.fileType], resource.fileSizeLabel].filter(Boolean).join(" / ");
    els.openGithub.href = resource.githubUrl;
    els.openGithub.textContent = "Open file page";
    els.downloadFile.href = resource.downloadUrl;
    els.downloadFile.setAttribute("data-download-id", resource.id || "");
    els.previewBody.innerHTML = "";

    if (hasFramePreview(resource)) {
      renderFramePreview(resource, defaultPreviewMode(resource));
    } else if (resource.previewMode === "image") {
      els.previewBody.innerHTML = '<img alt="' + escapeAttribute(resource.title) + '" src="' + escapeAttribute(resource.previewUrl) + '">';
    } else if (resource.previewMode === "video") {
      els.previewBody.innerHTML = '<video controls src="' + escapeAttribute(resource.previewUrl) + '"></video>';
    } else if (resource.previewMode === "text") {
      els.previewBody.innerHTML = '<pre>Loading preview...</pre>';
      fetch(resource.previewUrl)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Preview failed");
          }
          return response.text();
        })
        .then(function (text) {
          els.previewBody.innerHTML = '<pre>' + escapeHtml(text) + '</pre>';
        })
        .catch(function () {
          renderUnsupportedPreview(resource);
        });
    } else {
      renderUnsupportedPreview(resource);
    }

    els.modal.hidden = false;
    document.body.classList.add("no-scroll");
  }

  function renderFramePreview(resource, mode) {
    var modes = previewModes(resource);
    var activeMode = modes.some(function (item) {
      return item.id === mode;
    }) ? mode : modes[0].id;
    var active = modes.find(function (item) {
      return item.id === activeMode;
    });
    var controls = modes.map(function (item) {
      var selected = item.id === activeMode ? " is-active" : "";
      return [
        '<button class="preview-mode-button' + selected + '" type="button"',
        ' data-preview-resource-id="' + escapeAttribute(resource.id) + '"',
        ' data-preview-mode="' + escapeAttribute(item.id) + '">',
        escapeHtml(item.label),
        '</button>'
      ].join("");
    }).join("");

    els.previewBody.innerHTML = [
      '<div class="preview-frame-shell">',
      '  <div class="preview-toolbar">',
      '    <div class="preview-mode-group" aria-label="Preview mode">' + controls + '</div>',
      '    <p>Preview is loading. If it stays blank, switch viewer or open the file page.</p>',
      '  </div>',
      '  <iframe class="preview-frame" title="' + escapeAttribute(resource.title) + '" src="' + escapeAttribute(active.url) + '"></iframe>',
      '</div>'
    ].join("");
  }

  function hasFramePreview(resource) {
    return resource.previewMode === "pdf" || (resource.previewMode === "none" && ["document", "presentation", "spreadsheet"].includes(resource.fileType));
  }

  function defaultPreviewMode(resource) {
    if (resource.previewMode === "pdf") {
      return "pdfjs";
    }
    return "office";
  }

  function previewModes(resource) {
    var encodedUrl = encodeURIComponent(resource.previewUrl);
    if (resource.previewMode === "pdf") {
      return [
        {
          id: "pdfjs",
          label: "PDF viewer",
          url: "https://mozilla.github.io/pdf.js/web/viewer.html?file=" + encodedUrl
        },
        {
          id: "google",
          label: "Google viewer",
          url: "https://docs.google.com/gview?embedded=1&url=" + encodedUrl
        },
        {
          id: "raw",
          label: "Raw file",
          url: resource.previewUrl
        }
      ];
    }
    return [
      {
        id: "office",
        label: "Office viewer",
        url: "https://view.officeapps.live.com/op/embed.aspx?src=" + encodedUrl
      },
      {
        id: "google",
        label: "Google viewer",
        url: "https://docs.google.com/gview?embedded=1&url=" + encodedUrl
      }
    ];
  }

  function renderUnsupportedPreview(resource) {
    els.previewBody.innerHTML = [
      '<div class="preview-message">',
      '  <div>',
      '    <h3>Preview is not available for this file type.</h3>',
      '    <p>' + escapeHtml(resource.fileTypeLabel || resource.extension || "This resource") + ' files may need to be downloaded and opened with a compatible app.</p>',
      '  </div>',
      '</div>'
    ].join("");
  }

  function closePreview() {
    els.modal.hidden = true;
    els.previewBody.innerHTML = "";
    document.body.classList.remove("no-scroll");
  }

  async function getCurrentUser() {
    var result = await supabase.auth.getUser();
    if (result.error) {
      console.warn("Unable to get current user:", result.error.message);
      return null;
    }
    return result.data.user;
  }

  function setAuthMessage(message, isError) {
    var messageElement = document.getElementById("authMessage");
    if (!messageElement) {
      return;
    }
    messageElement.textContent = message || "";
    messageElement.classList.toggle("is-error", Boolean(isError));
  }

  function renderAuthState(user) {
    var signedOut = document.getElementById("authSignedOut");
    var signedIn = document.getElementById("authSignedIn");
    var userEmail = document.getElementById("authUserEmail");

    if (!signedOut || !signedIn || !userEmail) {
      return;
    }

    if (user) {
      signedOut.hidden = true;
      signedIn.hidden = false;
      userEmail.textContent = "Signed in as " + user.email;
    } else {
      signedOut.hidden = false;
      signedIn.hidden = true;
      userEmail.textContent = "";
    }
  }

  function setupAuthUI() {
    var emailInput = document.getElementById("authEmail");
    var passwordInput = document.getElementById("authPassword");
    var signInButton = document.getElementById("signInButton");
    var signUpButton = document.getElementById("signUpButton");
    var signOutButton = document.getElementById("signOutButton");

    if (!emailInput || !passwordInput || !signInButton || !signUpButton || !signOutButton) {
      console.warn("Auth UI elements not found.");
      return;
    }

    signInButton.addEventListener("click", async function () {
      var email = emailInput.value.trim();
      var password = passwordInput.value;

      if (!email || !password) {
        setAuthMessage("Please enter both email and password.", true);
        return;
      }

      setAuthMessage("Signing in...");
      var result = await supabase.auth.signInWithPassword({ email: email, password: password });
      if (result.error) {
        setAuthMessage(result.error.message, true);
        return;
      }

      setAuthMessage("Signed in successfully.");
    });

    signUpButton.addEventListener("click", async function () {
      var email = emailInput.value.trim();
      var password = passwordInput.value;

      if (!email || !password) {
        setAuthMessage("Please enter both email and password.", true);
        return;
      }

      setAuthMessage("Creating account...");
      var result = await supabase.auth.signUp({ email: email, password: password });
      if (result.error) {
        setAuthMessage(result.error.message, true);
        return;
      }

      setAuthMessage("Account created. If email confirmation is enabled, please check your inbox.");
    });

    signOutButton.addEventListener("click", async function () {
      setAuthMessage("Signing out...");
      var result = await supabase.auth.signOut();
      if (result.error) {
        setAuthMessage(result.error.message, true);
        return;
      }

      setAuthMessage("Signed out.");
    });
  }

  async function initializeAuth() {
    setupAuthUI();

    try {
      var result = await supabase.auth.getSession();
      if (result.error) {
        console.warn("Unable to get auth session:", result.error.message);
      }
      var session = result.data && result.data.session;
      renderAuthState(session ? session.user : null);
    } catch (error) {
      console.warn("Unable to initialize auth:", error);
      renderAuthState(null);
    }

    supabase.auth.onAuthStateChange(function (_event, session) {
      renderAuthState(session ? session.user : null);
    });
  }

  async function logResourceEvent(resource, eventType) {
    try {
      var user = await getCurrentUser();
      if (!user) {
        return;
      }

      var resourceId = resource.id || resource.originalFilename || resource.title || resource.downloadUrl || "unknown-resource";
      var result = await supabase.from("bp_resource_events").insert({
        user_id: user.id,
        resource_id: String(resourceId),
        event_type: eventType
      });

      if (result.error) {
        console.warn("Failed to log resource event:", result.error.message);
      }
    } catch (error) {
      console.warn("Unexpected error while logging resource event:", error);
    }
  }

  function unique(values) {
    return values.filter(function (value, index, array) {
      return value && array.indexOf(value) === index;
    });
  }

  function compareResources(a, b) {
    var categoryCompare = compareCategories({ title: a.category }, { title: b.category });
    if (categoryCompare) {
      return categoryCompare;
    }
    var titleCompare = titleCollator.compare(normalizeTitleForSort(a.title), normalizeTitleForSort(b.title));
    if (titleCompare) {
      return titleCompare;
    }
    return titleCollator.compare(a.originalFilename || "", b.originalFilename || "");
  }

  function compareCategories(a, b) {
    return titleCollator.compare(a.title || "", b.title || "");
  }

  function normalizeTitleForSort(title) {
    return String(title || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatSize(bytes) {
    if (!bytes) {
      return "0 B";
    }
    var units = ["B", "KB", "MB", "GB"];
    var size = bytes;
    var unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit += 1;
    }
    return (unit === 0 ? size : size.toFixed(size >= 10 ? 1 : 2)) + " " + units[unit];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
