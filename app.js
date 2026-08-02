/**
 * app.js
 * Main Single Page Application (SPA) controller and router.
 * Hosts Lenis smooth scrolling, GSAP animations, 3D Card Tilt, and Admin Stats ring.
 */

import {
  subscribeQueueStatus,
  updateQueueStatus,
  subscribeOrders,
  addOrder,
  updateOrderStatus,
  updateOrderAmountPaid,
  monitorAuthState,
  loginAdmin,
  logoutAdmin,
  subscribeCatalog,
  addProduct,
  deleteProduct,
  uploadProductImage,
  subscribeHomepageSettings,
  updateHomepageSettings,
  subscribeColors,
  addColor,
  deleteColor
} from "./js/db.js";
import { renderSilhouette, highlightZone } from "./js/components/Silhouette.js";
import { renderMeasurementForm, bindFormEvents, requiredMeasurements, measurementRanges } from "./js/components/MeasurementForm.js";

// Tailor's contact number (Nairobi country code +254)
const TAILOR_WHATSAPP_PHONE = "254758519041";

let currentAdminUser = null;

// Premium Lookbook Collection Catalog (populated dynamically)
let CATALOG_ITEMS = [];

// Dynamic Available Colors
let AVAILABLE_COLORS = [];

// Historical Orders for analytics and popular colors
let ADMIN_ORDERS = [];

// App State
let activeFilters = "all";

let _heroAnimated = false;

// -------------------------------------------------------------
// PROGRESSIVE WEB APP (PWA) INIT
// -------------------------------------------------------------
let deferredPrompt;
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, (err) => {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    
    // Update UI notify the user they can install the PWA
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
      installBtn.style.display = 'block';
      
      installBtn.addEventListener('click', async () => {
        // Hide the app provided install promotion
        installBtn.style.display = 'none';
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, throw it away
        deferredPrompt = null;
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    if (typeof gtag === "function") {
      gtag("event", "install", {
        app_name: "Styles by Gathoni Shop Admin"
      });
    }
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
      installBtn.style.display = 'none';
    }
    console.log('PWA was installed');
  });
}

// -------------------------------------------------------------
// APP INITIALIZATION
// -------------------------------------------------------------
function initApp() {
  // Subscribe to dynamic available colors
  subscribeColors((colors) => {
    AVAILABLE_COLORS = colors;
    if (currentAdminUser) {
      renderAdminColorsList();
    }
  });

  // Subscribe to public Dynamic Lookbook catalog changes from Database
  subscribeCatalog((items) => {
    CATALOG_ITEMS = items;

    // Auto-refresh main page views if active
    const hash = window.location.hash || "#home";
    if (hash === "#catalog") {
      renderCatalogGrid();
    } else if (hash.startsWith("#pdp")) {
      const urlParams = new URLSearchParams(hash.substring(hash.indexOf("?")));
      const productId = urlParams.get("id");
      if (CATALOG_ITEMS.some(p => p.id === productId)) {
        loadProductDetails(productId);
      } else {
        showToast("Garment not available.", "error");
        window.location.hash = "#catalog";
      }
    }

    // Auto-sync inventory items card list in admin panel
    if (currentAdminUser) {
      renderAdminInventoryList();
    }
  });

  monitorAuthState((user) => {
    currentAdminUser = user;
    window.dispatchEvent(new Event("hashchange")); // Re-route safely based on new auth state
  });

  initLenis();
  initRouter();
  initCatalogFilters();
  initQueueBanner();
  initAdminDashboard();
  initJourneyTimeline();
  initMobileNav();
  initNewsletter();

  // Add real-time listener stream mapping for global UI copy properties
  subscribeHomepageSettings((content) => {
    const titleEl = document.getElementById("live-hero-title");
    const subtextEl = document.getElementById("live-hero-subtext");

    if (titleEl && content.heroTitle) {
      // Replaces typed escape characters with HTML break elements gracefully
      titleEl.innerHTML = escapeHTML(content.heroTitle).replace(/\\n/g, "<br>").replace(/\n/g, "<br>");
    }
    if (subtextEl && content.heroSubtext) {
      subtextEl.textContent = content.heroSubtext;
    }

    // Hydrate active editor input text boxes if administrative panel routes are populated
    const inputTitle = document.getElementById("edit-hero-title");
    const inputSubtext = document.getElementById("edit-hero-subtext");
    if (inputTitle && inputSubtext) {
      inputTitle.value = content.heroTitle || "";
      inputSubtext.value = content.heroSubtext || "";
    }
  });

  // Initialize action bindings for form interaction fields
  initHomepageEditorForm();
  
  // Register Service Worker and PWA behavior
  initPWA();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// -------------------------------------------------------------
// MOTION ENGINE: LENIS & GSAP
// -------------------------------------------------------------
function initLenis() {
  if (window.Lenis) {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      gestureOrientation: "vertical",
      smoothWheel: true
    });

    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }
}

function runGSAPEntrance() {
  if (!window.gsap || _heroAnimated) return;
  _heroAnimated = true;

  // Hero elements reveal: slide and fade in
  gsap.from(".animate-hero", {
    opacity: 0,
    y: 60,
    duration: 1.2,
    stagger: 0.15,
    ease: "power4.out",
    clearProps: "all"
  });

  // Image frame entrance
  gsap.from(".animate-hero-image", {
    opacity: 0,
    scale: 0.94,
    y: 40,
    duration: 1.4,
    ease: "power3.out",
    delay: 0.3,
    clearProps: "all"
  });
}

// -------------------------------------------------------------
// JOURNEY TIMELINE SCROLL ANIMATION
// -------------------------------------------------------------
function initJourneyTimeline() {
  const section = document.getElementById("journey-timeline");
  const trackFill = document.getElementById("timeline-track-fill");
  const nodes = document.querySelectorAll(".timeline-node");

  if (!section || !trackFill || nodes.length === 0) return;

  // If GSAP ScrollTrigger is available, use it
  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    // Fade nodes in individually rather than staggered from section top
    nodes.forEach((node) => {
      ScrollTrigger.create({
        trigger: node,
        start: "top 85%",
        onEnter: () => {
          node.classList.add("is-visible");
        },
        once: true
      });
    });

    // Animate track fill and activate nodes on scroll
    ScrollTrigger.create({
      trigger: section,
      start: "top 60%",
      end: "bottom 85%",
      scrub: true,
      onUpdate: (self) => {
        const progress = self.progress;

        if (window.innerWidth <= 768) {
          trackFill.style.height = `${progress * 100}%`;
          trackFill.style.width = `100%`;
        } else {
          trackFill.style.width = `${progress * 100}%`;
          trackFill.style.height = `100%`;
        }

        // Activate nodes as the line reaches them
        nodes.forEach((node, i) => {
          const threshold = (i + 0.25) / nodes.length;
          if (progress >= threshold) {
            node.classList.add("is-active");
          } else {
            node.classList.remove("is-active");
          }
        });
      }
    });
  } else {
    // Fallback: show all nodes immediately
    nodes.forEach(node => {
      node.classList.add("is-visible", "is-active");
    });
    trackFill.style.width = "100%";
    trackFill.style.height = "100%";
  }
}

// -------------------------------------------------------------
// SPA ROUTER
// -------------------------------------------------------------
function initRouter() {
  const handleRouting = () => {
    // iOS PWA Start URL fix: Catch ?admin=true query parameter from admin webmanifest
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('admin') === 'true' && window.location.hash !== '#admin') {
      window.location.hash = '#admin';
      return; // Let the hashchange event handle the actual routing
    }

    const hash = window.location.hash || "#home";

    // Hide all views first
    document.querySelectorAll(".spa-view").forEach(view => {
      view.style.display = "none";
    });

    // Deactivate nav links
    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.remove("active");
    });

    // Handle view matching
    if (hash === "#home" || hash === "") {
      showView("view-home");
      setActiveNavLink("link-home");
      runGSAPEntrance();
    } else if (hash === "#catalog") {
      showView("view-catalog");
      setActiveNavLink("link-catalog");
      renderCatalogGrid();
    } else if (hash.startsWith("#pdp")) {
      showView("view-pdp");
      const urlParams = new URLSearchParams(hash.substring(hash.indexOf("?")));
      const productId = urlParams.get("id");
      loadProductDetails(productId);
    } else if (hash === "#admin") {
      if (currentAdminUser) {
        showView("view-admin");
        setActiveNavLink("link-admin");
        renderAdminInventoryList();
        renderAdminColorsList();
      } else {
        showView("view-login");
        setActiveNavLink("link-admin");
      }
    } else {
      showView("view-home");
      setActiveNavLink("link-home");
    }

    // Force address bar to include ?admin=true so iOS Safari Add to Homescreen captures it
    if (hash === "#admin" && !window.location.search.includes("admin=true")) {
      window.history.replaceState(null, "", "?admin=true#admin");
    } else if (hash !== "#admin" && window.location.search.includes("admin=true")) {
      window.history.replaceState(null, "", window.location.pathname + hash);
    }

    // Swap manifest dynamically so only admins get the admin PWA install prompt
    const manifestLink = document.getElementById("app-manifest");
    if (manifestLink) {
      if (hash === "#admin") {
        manifestLink.href = "assets/favicon/admin.webmanifest";
      } else {
        manifestLink.href = "assets/favicon/site.webmanifest";
      }
    }

    window.scrollTo(0, 0);

    // Refresh scroll triggers as page layout height has changed
    if (window.ScrollTrigger) {
      setTimeout(() => ScrollTrigger.refresh(), 100);
    }

    if (typeof gtag === "function") {
      gtag("event", "page_view", {
        page_location: window.location.href,
        page_path: window.location.pathname + hash
      });
    }
  };

  window.addEventListener("hashchange", handleRouting);
  handleRouting();

  // Hero explore button binding
  const exploreBtn = document.getElementById("btn-hero-explore");
  if (exploreBtn) {
    exploreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "#catalog";
    });
  }

  // Logo binding
  const logo = document.getElementById("nav-logo");
  if (logo) {
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.hash = "#home";
    });
  }

  // Admin Login Form
  const loginForm = document.getElementById("admin-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const pass = document.getElementById("login-password").value;

      try {
        await loginAdmin(email, pass);
        showToast("Authenticated successfully.", "success");
        // State change handled by monitorAuthState
      } catch (err) {
        console.error("Login failed:", err);
        showToast("Invalid credentials or server error.", "error");
      }
    });
  }

  // Admin Logout Button
  const logoutBtn = document.getElementById("btn-admin-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await logoutAdmin();
      showToast("Signed out safely.", "success");
      window.location.hash = "#home";
    });
  }
}

function showView(viewId) {
  const view = document.getElementById(viewId);
  if (view) {
    view.style.display = "block";
  }
}

function setActiveNavLink(linkId) {
  const link = document.getElementById(linkId);
  if (link) {
    link.classList.add("active");
  }
}

// -------------------------------------------------------------
// MOBILE NAVIGATION
// -------------------------------------------------------------
function initMobileNav() {
  const menuBtn = document.getElementById("mobile-menu-btn");
  const navLinks = document.getElementById("nav-links");

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("nav-active");
    });

    // Close menu when a link is clicked
    const links = navLinks.querySelectorAll("a");
    links.forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("nav-active");
      });
    });
  }
}

// -------------------------------------------------------------
// NEWSLETTER
// -------------------------------------------------------------
function initNewsletter() {
  const newsletterForm = document.getElementById("newsletter-form");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = newsletterForm.querySelector(".newsletter-input");
      if (input) input.value = "";
      showToast("Subscribed to Gathoni Styles releases.", "success");
    });
  }
}

// -------------------------------------------------------------
// CAPACITY Transparency BANNER STATE SYNCING
// -------------------------------------------------------------
function initQueueBanner() {
  const banner = document.getElementById("wait-time-banner");

  subscribeQueueStatus((days) => {
    if (!banner) return;

    // UI styling based on capacity load
    if (days <= 2) {
      banner.className = "wait-time-banner low-demand";
      banner.textContent = `Estimated wait time: ${days} ${days === 1 ? 'day' : 'days'}`;
    } else {
      banner.className = "wait-time-banner high-demand";
      banner.textContent = `Estimated wait time: ${days} days`;
    }

    // Update queue editor input in admin panel if present
    const queueInput = document.getElementById("queue-days");
    if (queueInput) {
      queueInput.value = days;
    }
  });
}

// -------------------------------------------------------------
// LOOKBOOK CATALOG CONTROLLER & 3D TILT ENGINE
// -------------------------------------------------------------
function initCatalogFilters() {
  const filterContainer = document.getElementById("catalog-filter-bar");
  if (!filterContainer) return;

  filterContainer.addEventListener("click", (e) => {
    const targetButton = e.target.closest(".filter-pill");
    if (!targetButton) return;

    filterContainer.querySelectorAll(".filter-pill").forEach(btn => {
      btn.classList.remove("active");
    });
    targetButton.classList.add("active");

    activeFilters = targetButton.getAttribute("data-category");
    renderCatalogGrid();

    if (typeof gtag === "function") {
      gtag("event", "select_content", {
        content_type: "filter",
        item_id: activeFilters
      });
    }
  });
}

function renderCatalogGrid() {
  const grid = document.getElementById("catalog-grid");
  if (!grid) return;

  grid.innerHTML = "";

  const filtered = CATALOG_ITEMS.filter(item => {
    return activeFilters === "all" || item.category === activeFilters;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 4rem 0;">No garments in this collection yet.</div>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "product-card glass";
    card.setAttribute("aria-label", `View details of ${item.name}`);
    card.innerHTML = `
      <div class="product-image-container">
        <img src="${item.image}" alt="${escapeHTML(item.name)} - Custom tailoring Nairobi" loading="lazy" />
        <div class="product-overlay">
          <span class="view-details-text">View Details</span>
        </div>
      </div>
      <div class="product-info">
        <h3 class="product-name">${escapeHTML(item.name)}</h3>
        <span class="product-price">Ksh ${formatPrice(item.price)}</span>
      </div>
      <div class="card-shine"></div>
    `;

    card.addEventListener("click", () => {
      window.location.hash = `#pdp?id=${item.id}`;
    });

    // Apply Apple 3D card tilt event listeners
    bindCardTilt(card);

    grid.appendChild(card);
  });

  // Stagger reveal products using GSAP
  if (window.gsap) {
    gsap.from(".product-card", {
      opacity: 0,
      y: 60,
      duration: 0.8,
      stagger: 0.08,
      ease: "power3.out"
    });
  }
}

/**
 * Attaches Apple-style 3D cursor tilt logic to elements
 */
function bindCardTilt(card) {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Normalize coordinates to ranges between -0.5 and 0.5
    const px = (x / rect.width) - 0.5;
    const py = (y / rect.height) - 0.5;

    // Specular shine overlay tracking variables
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);

    // Rotations degrees (max 6 degrees tilt)
    const rotateX = -py * 12;
    const rotateY = px * 12;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
  });
}

// -------------------------------------------------------------
// PRODUCT DETAIL PAGE (PDP) & CHECKOUT PIPELINE
// -------------------------------------------------------------
function loadProductDetails(productId) {
  const product = CATALOG_ITEMS.find(p => p.id === productId);

  if (!product) {
    showToast("Garment not found in catalog", "error");
    window.location.hash = "#catalog";
    return;
  }

  // Populate static fields
  document.getElementById("pdp-product-image").src = product.image;
  document.getElementById("pdp-product-image").alt = `${product.name} modeled by African custom fitting boutique`;
  document.getElementById("pdp-product-category").textContent = product.category;
  document.getElementById("pdp-product-title").textContent = product.name;
  document.getElementById("pdp-product-price").textContent = `Ksh ${formatPrice(product.price)}`;
  document.getElementById("pdp-product-description").textContent = product.description;

  // Dynamic SEO Updates
  document.title = `${product.name} | Styles by Gathoni`;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", product.description || `Bespoke tailored ${product.name} at Styles by Gathoni.`);

  // Inject Dynamic Product JSON-LD Schema
  let productSchema = document.getElementById("product-ld-schema");
  if (!productSchema) {
    productSchema = document.createElement("script");
    productSchema.id = "product-ld-schema";
    productSchema.type = "application/ld+json";
    document.head.appendChild(productSchema);
  }
  
  const schemaData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": [product.image],
    "description": product.description || `Bespoke custom ${product.name}`,
    "sku": product.id,
    "offers": {
      "@type": "Offer",
      "url": `https://stylesbygathoni.com/#pdp?id=${product.id}`,
      "priceCurrency": "KES",
      "price": product.price,
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "Styles by Gathoni"
      }
    }
  };
  productSchema.textContent = JSON.stringify(schemaData);

  if (typeof gtag === "function") {
    gtag("event", "view_item", {
      currency: "KES",
      value: product.price,
      items: [{
        item_id: product.id,
        item_name: product.name,
        item_category: product.category,
        price: product.price
      }]
    });
  }

  // Mount components
  document.getElementById("pdp-silhouette-container").innerHTML = renderSilhouette();
  document.getElementById("pdp-form-container").innerHTML = renderMeasurementForm(product.type, AVAILABLE_COLORS);

  // Bind form focus zone highlighter scripts
  bindFormEvents(document.getElementById("pdp-form-container"));

  // Stagger details elements using GSAP
  if (window.gsap) {
    gsap.from(".pdp-sticky-left", {
      opacity: 0,
      scale: 0.96,
      duration: 1,
      ease: "power3.out"
    });

    gsap.from(".pdp-scroll-right > *", {
      opacity: 0,
      y: 40,
      duration: 0.8,
      stagger: 0.1,
      ease: "power3.out"
    });
  }

  // Back button binding
  const backBtn = document.getElementById("btn-back-to-catalog");
  if (backBtn) {
    backBtn.onclick = () => {
      window.location.hash = "#catalog";
    };
  }

  // Form submission handler
  const form = document.getElementById("checkout-measurement-form");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();

      const clientNameInput = document.getElementById("client-name");
      const clientName = clientNameInput ? clientNameInput.value.trim() : "Anonymous";

      const colorInput = form.querySelector('input[name="garment-color"]:checked');
      const garmentColor = colorInput ? colorInput.value : "Not specified";

      const measurements = {};
      const fields = requiredMeasurements[product.type] || requiredMeasurements.dress;

      let validationError = null;

      fields.forEach(field => {
        const fieldId = field.replace(/\s+/g, "-");
        const valInput = document.getElementById(`input-${fieldId}`);
        const val = valInput ? Number(valInput.value) : 0;

        const range = measurementRanges[field];
        if (range && (val < range.min || val > range.max)) {
          validationError = `Invalid ${field}. Must be between ${range.min} and ${range.max} cm.`;
        }
        measurements[field] = val;
      });

      if (validationError) {
        showToast(validationError, "error");
        return;
      }

      const waWindow = window.open('', '_blank');
      
      if (typeof gtag === "function") {
        gtag("event", "begin_checkout", {
          currency: "KES",
          value: product.price,
          items: [{
            item_id: product.id,
            item_name: product.name,
            item_category: product.category,
            price: product.price
          }]
        });
      }

      try {
        const orderData = {
          customerName: clientName,
          productName: product.name,
          color: garmentColor,
          price: product.price,
          measurements: measurements,
          status: "consultation"
        };

        showToast("Saving measurements sheet...", "success");
        await addOrder(orderData);

        const waLink = generateWhatsAppLink(product.name, garmentColor, measurements, product.price, clientName);

        showToast("Consultation ready. Opening WhatsApp chat...", "success");

        if (waWindow) {
          waWindow.location.href = waLink;
        } else {
          window.location.href = waLink;
        }

      } catch (err) {
        if (waWindow) waWindow.close();
        console.error("Order submission failure:", err);
        showToast("Checkout pipeline error. Please try again.", "error");
      }
    };
  }
}

// WhatsApp Link Generator compiler
export function generateWhatsAppLink(productName, garmentColor, measurements, price, clientName) {
  let text = `Hello Gathoni Styles! I'd like to order a custom-tailored *${productName}* in *${garmentColor}* (Ksh ${formatPrice(price)}).\n\n`;
  text += `*Client Name:* ${clientName}\n`;
  text += `*My Measurements (in cm):*\n`;

  for (const [key, val] of Object.entries(measurements)) {
    const prettyKey = key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    text += `- ${prettyKey}: ${val} cm\n`;
  }

  text += `\nNo payment is required until measurements are reviewed and confirmed over our chat.`;

  return `https://wa.me/${TAILOR_WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;
}

// -------------------------------------------------------------
// TAILOR OPERATIONS / ADMIN PANEL CONTROLLER
// -------------------------------------------------------------
function initAdminDashboard() {
  // Tabs Switch Navigation
  const tabBtnConsultation = document.getElementById("tab-btn-consultations");
  const tabBtnCatalog = document.getElementById("tab-btn-catalog");
  const paneConsultation = document.getElementById("admin-pane-consultations");
  const paneCatalog = document.getElementById("admin-pane-catalog");

  if (tabBtnConsultation && tabBtnCatalog && paneConsultation && paneCatalog) {
    tabBtnConsultation.addEventListener("click", () => {
      tabBtnConsultation.classList.add("active");
      tabBtnCatalog.classList.remove("active");
      paneConsultation.style.display = "block";
      paneCatalog.style.display = "none";
    });

    tabBtnCatalog.addEventListener("click", () => {
      tabBtnCatalog.classList.add("active");
      tabBtnConsultation.classList.remove("active");
      paneConsultation.style.display = "none";
      paneCatalog.style.display = "block";
      renderAdminInventoryList();
    });
  }

  // Cloudinary image upload integration
  const photoUpload = document.getElementById('photoUpload');
  if (photoUpload) {
    photoUpload.addEventListener('change', async function (event) {
      const file = event.target.files[0];
      if (!file) return;

      // Show immediate local preview
      const uploadPreview = document.getElementById('upload-preview');
      if (uploadPreview) {
        uploadPreview.src = URL.createObjectURL(file);
        uploadPreview.style.display = "block";
      }

      const uploadStatus = document.getElementById('upload-status');
      if (uploadStatus) {
        uploadStatus.textContent = "Uploading image...";
        uploadStatus.style.color = "var(--text-secondary)";
      }

      try {
        // Attempt compression with a timeout — skip if it takes too long or fails
        let fileToUpload = file;

        // Only compress if the file is larger than 1MB
        if (file.size > 1024 * 1024) {
          try {
            const compressedBlob = await Promise.race([
              compressImage(file, 1200, 1200, 0.85),
              new Promise((_, reject) => setTimeout(() => reject(new Error("Compression timeout")), 10000))
            ]);
            fileToUpload = new File([compressedBlob], "photo.jpg", { type: "image/jpeg" });
          } catch (compressErr) {
            console.warn("Compression skipped, uploading original:", compressErr.message);
          }
        }

        if (uploadStatus) {
          uploadStatus.textContent = "Sending to cloud...";
        }

        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('upload_preset', 'gathoni styles');

        const cloudName = 'vbe25dhd';
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

        const response = await fetch(cloudinaryUrl, {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "Cloudinary upload failed");
        }

        const imageUrl = data.secure_url;
        console.log("Permanent image link:", imageUrl);

        document.getElementById('new-product-url').value = imageUrl;
        if (uploadStatus) {
          uploadStatus.textContent = "Upload successful!";
          uploadStatus.style.color = "var(--success, #28a745)";
        }
      } catch (error) {
        console.error("Upload failed:", error);
        document.getElementById('new-product-url').value = "";

        if (uploadPreview) uploadPreview.style.display = "none";

        if (uploadStatus) {
          uploadStatus.textContent = "Upload failed: " + error.message;
          uploadStatus.style.color = "var(--error, #dc3545)";
        }
        showToast("Image upload failed. " + error.message, "error");
      }
    });
  }

  // Advanced Color Workspace Modal Logic
  const advancedColorModal = document.getElementById("advanced-color-modal");
  const btnOpenAdvColor = document.getElementById("btn-open-advanced-color");
  const advCloseBtn = document.getElementById("adv-close-btn");
  const hexInput = document.getElementById("new-color-hex");

  let colorPicker = null;

  if (advancedColorModal && btnOpenAdvColor) {
    btnOpenAdvColor.addEventListener("click", () => {
      advancedColorModal.classList.add("active");
      
      // Lazy init iro.js picker
      if (!colorPicker && window.iro) {
        colorPicker = new iro.ColorPicker("#iro-picker-container", {
          width: 250,
          color: hexInput ? hexInput.value : "#FF0000",
          layout: [
            { component: iro.ui.Box },
            { component: iro.ui.Slider, options: { sliderType: 'hue' } },
            { component: iro.ui.Slider, options: { sliderType: 'alpha' } }
          ]
        });

        let nameFetchTimeout;

        const updateAdvUI = (color) => {
          const hexString = color.hexString.toUpperCase();
          const rgb = color.rgb;
          const hsl = color.hsl;
          
          document.getElementById("adv-val-hex").textContent = hexString;
          document.getElementById("adv-val-rgb").textContent = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
          document.getElementById("adv-val-hsl").textContent = `${hsl.h}, ${hsl.s}%, ${hsl.l}%`;
          
          document.getElementById("adv-color-swatch-mini").style.backgroundColor = hexString;
          document.getElementById("adv-large-preview").style.backgroundColor = hexString;
          document.getElementById("adv-large-hex").textContent = hexString;

          const nameSpan = document.getElementById("adv-val-name");
          if (nameSpan) {
            nameSpan.textContent = "Scanning...";
            clearTimeout(nameFetchTimeout);
            nameFetchTimeout = setTimeout(async () => {
              try {
                const response = await fetch(`https://www.thecolorapi.com/id?hex=${hexString.replace("#", "")}`);
                const data = await response.json();
                if (data && data.name && data.name.value) {
                  nameSpan.textContent = data.name.value;
                } else {
                  nameSpan.textContent = "Custom Colors";
                }
              } catch(e) {
                nameSpan.textContent = "Custom Colors";
              }
            }, 600);
          }

          // If chroma is available, calculate OKLCH and Harmony
          if (window.chroma) {
            const ch = chroma(hexString);
            const oklch = ch.oklch();
            // oklch values: L (0-1), C (~0-0.4), H (0-360)
            const l = (oklch[0] || 0).toFixed(2);
            const c = (oklch[1] || 0).toFixed(2);
            const h = (oklch[2] || 0).toFixed(2);
            document.getElementById("adv-val-oklch").textContent = `${l}, ${c}, ${h}`;
            
            updateHarmony(ch);
          }
        };

        colorPicker.on('color:change', updateAdvUI);
        // initial call
        updateAdvUI(colorPicker.color);

        // Bind random palette button
        const randomBtn = document.getElementById("adv-random-btn");
        if (randomBtn) {
          randomBtn.addEventListener("click", () => {
            if(window.chroma) {
              colorPicker.color.hexString = chroma.random().hex();
            }
          });
        }
        
        // Bind harmony select
        const harmonySelect = document.getElementById("adv-harmony-select");
        if (harmonySelect) {
          harmonySelect.addEventListener("change", () => {
            if(window.chroma) {
              updateHarmony(chroma(colorPicker.color.hexString));
            }
          });
        }

        function updateHarmony(baseColor) {
          const mode = document.getElementById("adv-harmony-select").value;
          const container = document.getElementById("adv-harmony-preview");
          const paletteContainer = document.getElementById("adv-color-palette");
          container.innerHTML = "";
          paletteContainer.innerHTML = "";
          
          if (mode === "none") return;

          let harmonyHexes = [];
          
          if (mode === "analogous") {
            harmonyHexes = [
              baseColor.set('hsl.h', '-30').hex(),
              baseColor.hex(),
              baseColor.set('hsl.h', '+30').hex()
            ];
          } else if (mode === "complementary") {
            harmonyHexes = [
              baseColor.hex(),
              baseColor.set('hsl.h', '+180').hex()
            ];
          } else if (mode === "triadic") {
            harmonyHexes = [
              baseColor.hex(),
              baseColor.set('hsl.h', '+120').hex(),
              baseColor.set('hsl.h', '+240').hex()
            ];
          }

          harmonyHexes.forEach(hex => {
            const div = document.createElement("div");
            div.className = "adv-harmony-color";
            div.style.backgroundColor = hex;
            div.title = hex;
            container.appendChild(div);
            
            // tiny palette
            const strip = document.createElement("div");
            strip.className = "adv-color-palette-stripe";
            strip.style.backgroundColor = hex;
            paletteContainer.appendChild(strip);
          });
        }
      } else if (colorPicker && hexInput) {
        colorPicker.color.hexString = hexInput.value;
      }
    });

    advCloseBtn.addEventListener("click", () => {
      advancedColorModal.classList.remove("active");
    });
    
    // Apply bulk export action (Add straight to DB)
    const exportBtn = document.getElementById("adv-export-btn");
    exportBtn.addEventListener("click", async () => {
      if (colorPicker) {
        const selectedHex = colorPicker.color.hexString.toUpperCase();
        let colorName = document.getElementById("adv-val-name")?.textContent;
        if (!colorName || colorName === "Scanning..." || colorName === "Unknown" || colorName === "Error") {
           colorName = "Custom";
        }
        
        try {
          await addColor({ name: colorName, value: selectedHex });
          showToast(`Color ${colorName} saved to catalog!`, "success");
        } catch (error) {
          console.error("Color addition failed:", error);
          showToast("Failed to add color.", "error");
        }
      }
      
      // Close modal as requested by user
      advancedColorModal.classList.remove("active");
    });
    
    // Auto-fetch on blur for the manual hex input
    if (hexInput) {
      hexInput.addEventListener("blur", async (e) => {
        const val = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          try {
            const hexClean = val.replace("#", "");
            const nameInput = document.getElementById("new-color-name");
            if (nameInput && !nameInput.value) {
              nameInput.placeholder = "Detecting...";
              const response = await fetch(`https://www.thecolorapi.com/id?hex=${hexClean}`);
              const data = await response.json();
              if (data && data.name && data.name.value) {
                nameInput.value = data.name.value;
              }
            }
          } catch(e) {
            console.error("Fetch name failed", e);
          }
        }
      });
    }
  }

  // Submit new color
  const addColorForm = document.getElementById("form-add-color");
  if (addColorForm) {
    addColorForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("new-color-name").value.trim();
      const value = hexInput ? hexInput.value.toUpperCase() : "#FF0000";

      if (!name) return;

      showToast("Adding color...", "success");

      try {
        await addColor({ name, value });
        showToast(`Color ${name} added!`, "success");
        addColorForm.reset();
        if (hexInput) hexInput.value = "#FF0000";
      } catch (error) {
        console.error("Color addition failed:", error);
        showToast("Failed to add color.", "error");
      }
    });
  }

  // Submit new product
  const addProductForm = document.getElementById("form-add-product");
  if (addProductForm) {
    addProductForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("new-product-name").value.trim();
      const category = document.getElementById("new-product-category").value;
      const type = document.getElementById("new-product-type").value;
      const price = Number(document.getElementById("new-product-price").value);
      const description = document.getElementById("new-product-description").value.trim();

      let imageUrl = "";

      showToast("Syncing new item...", "success");

      try {
        imageUrl = document.getElementById("new-product-url").value.trim();
        if (!imageUrl || imageUrl === "undefined" || !imageUrl.startsWith("http")) {
          showToast("Please wait for the image upload to complete fully, or try re-uploading.", "error");
          return;
        }

        const productData = {
          name,
          category,
          type,
          price,
          description,
          image: imageUrl
        };

        await addProduct(productData);
        showToast(`Item "${name}" uploaded!`, "success");

        // Reset inputs
        addProductForm.reset();
        
        // Hide preview
        const uploadPreview = document.getElementById('upload-preview');
        if (uploadPreview) uploadPreview.style.display = "none";
        document.getElementById('upload-status').textContent = "";
        document.getElementById('new-product-url').value = "";

      } catch (err) {
        console.error("Garment write error:", err);
        showToast("Failed to upload new garment.", "error");
      }
    });
  }

  const queueForm = document.getElementById("form-queue-editor");
  if (queueForm) {
    queueForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputVal = document.getElementById("queue-days").value;
      try {
        await updateQueueStatus(Number(inputVal));
        showToast("Production schedule synced successfully!", "success");
      } catch (err) {
        showToast("Error updating boutique workload.", "error");
      }
    });
  }

  // Subscribe to real-time database orders changes
  const ordersListContainer = document.getElementById("admin-orders-list");

  subscribeOrders((orders) => {
    ADMIN_ORDERS = orders;
    
    // Sync DB status indicator badge
    const dbBadge = document.getElementById("db-status-badge");
    if (dbBadge) {
      dbBadge.textContent = "Synced Live Mode";
      dbBadge.style.borderColor = "var(--success)";
      dbBadge.style.color = "var(--success)";
    }

    // Run dashboard analytical calculation loops
    updateAnalyticsCards(orders);

    if (!ordersListContainer) return;
    ordersListContainer.innerHTML = "";

    if (orders.length === 0) {
      ordersListContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-secondary); padding: 3rem 0;">
          No customer inquiries recorded in database.
        </div>
      `;
      return;
    }

    orders.forEach(order => {
      const orderCard = document.createElement("div");
      orderCard.className = "order-row-card";

      const orderDate = new Date(order.timestamp).toLocaleString("en-KE", {
        timeZone: "Africa/Nairobi",
        dateStyle: "medium",
        timeStyle: "short"
      });

      let measureItemsHtml = "";
      for (const [key, val] of Object.entries(order.measurements)) {
        measureItemsHtml += `
          <div class="measurement-pill-data">
            ${capitalize(key)} <span>${val}cm</span>
          </div>
        `;
      }

      const amtPaid = Number(order.amountPaid || 0);
      const price = Number(order.price);
      const balance = price - amtPaid;
      
      let balanceDisplay = `Ksh ${formatPrice(balance)}`;
      let balanceColor = 'var(--text-primary)';
      
      if (balance === 0) {
        balanceDisplay = 'Complete Payment';
        balanceColor = '#4ade80'; // Green
      } else if (balance < 0) {
        balanceDisplay = `Overpaid (Ksh ${formatPrice(Math.abs(balance))})`;
        balanceColor = '#fb923c'; // Accent Orange
      }

      orderCard.innerHTML = `
        <div class="order-row-header">
          <div>
            <h4 class="order-client-name">${escapeHTML(order.customerName)}</h4>
            <span class="order-date">${orderDate} (EAT)</span>
          </div>
          <span class="order-price">Ksh ${formatPrice(order.price)}</span>
        </div>
        
        <div class="order-row-body">
          <div class="order-details-meta">
            <span class="order-product-name">${escapeHTML(order.productName)}</span>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">ID: ${order.id}</span>
          </div>
          <div class="order-measurements-grid">
            ${measureItemsHtml}
          </div>
        </div>

        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            <label style="font-size: 0.72rem; font-weight: 800; color: var(--text-secondary); letter-spacing: 0.05em;">LOG A PAYMENT (Ksh)</label>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="number" min="0" placeholder="e.g. 500" class="amount-paid-input measurement-input" data-order-id="${order.id}" style="width: 120px; height: 36px; padding: 0.5rem;" />
              <button class="btn-save-amount btn-outline" data-order-id="${order.id}" data-current-paid="${amtPaid}" style="height: 36px; padding: 0 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); border-style: dashed;">Add</button>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: -0.2rem;">Total paid so far: Ksh ${formatPrice(amtPaid)}</div>
          </div>
          <div style="text-align: right; padding-right: 0.5rem;">
            <label style="font-size: 0.72rem; font-weight: 800; color: var(--text-secondary); letter-spacing: 0.05em;">BALANCE</label>
            <div style="font-size: 1.1rem; font-weight: 700; color: ${balanceColor};">
              ${balanceDisplay}
            </div>
          </div>
        </div>

        <div class="order-row-actions">
          <div>
            <label style="font-size: 0.72rem; font-weight: 800; color: var(--text-secondary); display: block; margin-bottom: 0.3rem; letter-spacing: 0.05em;">WORKLOAD STATUS</label>
            <select class="status-selector" data-order-id="${order.id}">
              <option value="consultation" ${order.status === 'consultation' ? 'selected' : ''}>Awaiting Consultation</option>
              <option value="deposit-paid" ${order.status === 'deposit-paid' ? 'selected' : ''}>Deposit Paid</option>
              <option value="in-production" ${order.status === 'in-production' ? 'selected' : ''}>In Production</option>
              <option value="ready-delivery" ${order.status === 'ready-delivery' ? 'selected' : ''}>Ready for Delivery</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
          </div>
          
          <button class="btn-row-whatsapp" data-client="${escapeHTML(order.customerName)}" data-product="${escapeHTML(order.productName)}" data-status="${escapeHTML(order.status)}">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path>
            </svg>
            Review Chat
          </button>
        </div>
      `;

      const selector = orderCard.querySelector(".status-selector");
      if (selector) {
        selector.addEventListener("change", async (e) => {
          const newStatus = e.target.value;
          const orderId = e.target.getAttribute("data-order-id");
          try {
            await updateOrderStatus(orderId, newStatus);
            showToast("Order status updated!", "success");
          } catch (err) {
            showToast("Failed to write status update.", "error");
          }
        });
      }

      const saveAmountBtn = orderCard.querySelector(".btn-save-amount");
      if (saveAmountBtn) {
        saveAmountBtn.addEventListener("click", async (e) => {
          const orderId = e.target.getAttribute("data-order-id");
          const input = orderCard.querySelector(`.amount-paid-input[data-order-id="${orderId}"]`);
          const amountToAdd = Math.abs(Number(input.value));
          if (amountToAdd === 0) return; // Ignore empty/zero saves
          
          const currentPaid = Number(saveAmountBtn.getAttribute("data-current-paid"));
          const newTotalAmount = currentPaid + amountToAdd;
          
          try {
            await updateOrderAmountPaid(orderId, newTotalAmount);
            showToast("Payment logged successfully!", "success");
          } catch (err) {
            showToast("Failed to update amount.", "error");
          }
        });
      }

      const waButton = orderCard.querySelector(".btn-row-whatsapp");
      if (waButton) {
        waButton.addEventListener("click", () => {
          const clientName = waButton.getAttribute("data-client");
          const productName = waButton.getAttribute("data-product");
          const status = waButton.getAttribute("data-status");
          
          let chatMsg = `Hello ${clientName}, this is Gathoni Styles. `;
          
          switch(status) {
            case 'consultation':
              chatMsg += `Regarding your custom order for the *${productName}*, we would like to confirm some details and finalize your measurements before starting production.`;
              break;
            case 'deposit-paid':
              chatMsg += `We have received your deposit for the *${productName}*. Production will begin shortly!`;
              break;
            case 'in-production':
              chatMsg += `Just a quick update: your *${productName}* is currently in production. We are meticulously crafting your garment!`;
              break;
            case 'ready-delivery':
              chatMsg += `Great news! Your *${productName}* is ready for delivery. Please let us know your preferred delivery details.`;
              break;
            case 'completed':
              chatMsg += `We hope you love your *${productName}*! Thank you for shopping with Gathoni Styles. Please let us know if you need any further assistance.`;
              break;
            default:
              chatMsg += `Regarding your custom order for the *${productName}*, we would like to confirm some details...`;
          }

          const chatUrl = `https://wa.me/${TAILOR_WHATSAPP_PHONE}?text=${encodeURIComponent(chatMsg)}`;
          window.open(chatUrl, "_blank");
        });
      }

      ordersListContainer.appendChild(orderCard);
    });
  });
}

/**
 * Calculates and updates dashboard stats and ring displays
 */
function updateAnalyticsCards(orders) {
  let consultationsCount = 0;
  let productionCount = 0;
  let completedCount = 0;

  orders.forEach(order => {
    if (order.status === "completed") {
      completedCount++;
    } else if (order.status === "in-production") {
      productionCount++;
    } else {
      consultationsCount++;
    }
  });

  const activeCount = orders.length - completedCount;

  // Animate counter values
  animateCounterValue("analytics-active-count", activeCount);
  animateCounterValue("count-consultations", consultationsCount);
  animateCounterValue("count-production", productionCount);
  animateCounterValue("count-completed", completedCount);

  // Sync circular path fill
  const progressRing = document.getElementById("analytics-progress-ring");
  if (progressRing) {
    const total = orders.length || 1;
    const progressPercent = Math.round((completedCount / total) * 100);
    // stroke-dasharray format: "completed_dash, 100"
    progressRing.style.strokeDasharray = `${progressPercent}, 100`;
  }
}

function animateCounterValue(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const startValue = Number(el.textContent) || 0;
  if (startValue === targetValue) return;

  if (window.gsap) {
    const countObj = { val: startValue };
    gsap.to(countObj, {
      val: targetValue,
      duration: 0.8,
      roundProps: "val",
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = countObj.val;
      }
    });
  } else {
    // Fallback static update
    el.textContent = targetValue;
  }
}

// -------------------------------------------------------------
// UI TOAST ALERTS (APPLE-STYLE CAPSULES)
// -------------------------------------------------------------
function showToast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icon = type === "success"
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  toast.innerHTML = `
    <div class="toast-icon-box">${icon}</div>
    <div class="toast-text">${msg}</div>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Transition slide in
  setTimeout(() => {
    toast.classList.add("show");
  }, 20);

  // Shrink Apple progress line countdown
  const progressLine = toast.querySelector(".toast-progress");
  progressLine.style.transformOrigin = "left center";
  progressLine.style.transition = "transform 3.5s linear";
  progressLine.style.transform = "scaleX(1)";

  setTimeout(() => {
    progressLine.style.transform = "scaleX(0)";
  }, 50);

  // Self deletion
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 450);
  }, 3500);
}

// -------------------------------------------------------------
// GENERAL UTILS
// -------------------------------------------------------------
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function formatPrice(number) {
  return Number(number).toLocaleString("en-KE");
}

function capitalize(str) {
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Syncs and renders collection catalog components in administrative view
 */
function renderAdminInventoryList() {
  const container = document.getElementById("admin-inventory-list");
  if (!container) return;

  container.innerHTML = "";

  if (CATALOG_ITEMS.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 3rem 0;">
        No garments in lookbook collection.
      </div>
    `;
    return;
  }

  CATALOG_ITEMS.forEach(product => {
    const itemRow = document.createElement("div");
    itemRow.className = "inventory-item";
    itemRow.innerHTML = `
      <img src="${product.image}" alt="${escapeHTML(product.name)}" class="inventory-thumb" />
      <div class="inventory-details">
        <h4>${escapeHTML(product.name)}</h4>
        <p>${escapeHTML(product.description).substring(0, 120)}${product.description.length > 120 ? '...' : ''}</p>
        <div class="inventory-meta">
          <span class="inventory-category">${escapeHTML(product.category)}</span>
          <span class="inventory-type">${escapeHTML(product.type)}</span>
          <span style="color: var(--text-primary); font-weight: 750;">Ksh ${formatPrice(product.price)}</span>
        </div>
      </div>
      <button class="btn-remove-inventory" data-id="${product.id}" data-name="${product.name}">
        Remove
      </button>
    `;

    const deleteBtn = itemRow.querySelector(".btn-remove-inventory");
    deleteBtn.addEventListener("click", async () => {
      const pId = deleteBtn.getAttribute("data-id");
      const pName = deleteBtn.getAttribute("data-name");

      if (confirm(`Are you sure you want to permanently remove "${pName}" from the catalog?`)) {
        try {
          showToast(`Deleting "${pName}"...`, "success");
          await deleteProduct(pId);
          showToast("Garment removed successfully.", "success");
        } catch (err) {
          console.error("Failed to delete product:", err);
          showToast("Error deleting garment.", "error");
        }
      }
    });

    container.appendChild(itemRow);
  });
}

function renderAdminColorsList() {
  const container = document.getElementById("admin-colors-list");
  if (!container) return;

  container.innerHTML = "";

  // 1. Calculate Popular Colors from ADMIN_ORDERS
  const colorCounts = {};
  if (ADMIN_ORDERS && Array.isArray(ADMIN_ORDERS)) {
    ADMIN_ORDERS.forEach(order => {
      if (order.color && order.color !== "Not specified") {
        colorCounts[order.color] = (colorCounts[order.color] || 0) + 1;
      }
    });
  }
  
  const sortedColors = Object.entries(colorCounts).sort((a,b) => b[1] - a[1]);
  
  if (sortedColors.length > 0) {
    const popularSection = document.createElement("div");
    popularSection.style.marginBottom = "2.5rem";
    let popularHTML = `<h3 style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">Popular Choices (From Orders)</h3>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">`;
    
    // Show top 6 popular colors
    sortedColors.slice(0, 6).forEach(([hex, count]) => {
      // Find friendly name
      const known = AVAILABLE_COLORS.find(c => c.value.toLowerCase() === hex.toLowerCase());
      const cName = known ? known.name : hex;
      popularHTML += `
        <div style="background: rgba(15,23,42,0.02); padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid rgba(15,23,42,0.06); display: flex; align-items: center; gap: 0.6rem;">
          <div style="width: 14px; height: 14px; border-radius: 50%; background-color: ${hex}; border: 1px solid rgba(0,0,0,0.1);"></div>
          <div>
            <div style="font-size: 0.75rem; font-weight: 600;">${escapeHTML(cName)}</div>
            <div style="font-size: 0.65rem; color: var(--text-secondary);">${count} orders</div>
          </div>
        </div>
      `;
    });
    popularHTML += `</div>`;
    popularSection.innerHTML = popularHTML;
    container.appendChild(popularSection);
  }

  // 2. Render Full Catalog
  const availableSection = document.createElement("div");
  availableSection.innerHTML = `<h3 style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">Catalog Palette</h3>`;
  
  if (AVAILABLE_COLORS.length === 0) {
    availableSection.innerHTML += `
      <div style="text-align: center; color: var(--text-secondary); padding: 1.5rem 0; font-size: 0.85rem; background: rgba(15,23,42,0.02); border-radius: var(--radius-sm); border: 1px dashed rgba(15,23,42,0.15);">
        No custom colors added yet. Open the workspace below to start building your palette!
      </div>
    `;
    container.appendChild(availableSection);
    return;
  }

  const listDiv = document.createElement("div");
  listDiv.style.display = "flex";
  listDiv.style.flexDirection = "column";
  listDiv.style.gap = "0.5rem";

  AVAILABLE_COLORS.forEach(color => {
    const itemRow = document.createElement("div");
    itemRow.style.display = "flex";
    itemRow.style.alignItems = "center";
    itemRow.style.justifyContent = "space-between";
    itemRow.style.padding = "0.75rem 1rem";
    itemRow.style.borderRadius = "var(--radius-sm)";
    itemRow.style.border = "1px solid rgba(15, 23, 42, 0.08)";
    itemRow.style.background = "#ffffff";
    itemRow.style.transition = "transform 0.2s, box-shadow 0.2s";
    
    // Add simple hover effect wrapper inside list logic
    itemRow.onmouseenter = () => itemRow.style.boxShadow = "0 8px 15px rgba(0,0,0,0.05)";
    itemRow.onmouseleave = () => itemRow.style.boxShadow = "none";

    itemRow.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.8rem;">
        <span style="display: inline-block; width: 28px; height: 28px; border-radius: 50%; background-color: ${color.value}; border: 1px solid rgba(0,0,0,0.1);"></span>
        <span style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin-right: 0.5rem;">${escapeHTML(color.name)}</span>
        <span style="font-size: 0.75rem; color: var(--text-secondary); background: #f0f0f0; padding: 0.15rem 0.5rem; border-radius: 12px; font-family: monospace;">${color.value}</span>
      </div>
      <button class="btn-remove-color" data-id="${color.id}" data-name="${color.name}" title="Remove color" style="background: none; border: none; color: #ef4444; font-size: 1rem; cursor: pointer; padding: 0.2rem 0.5rem; transition: transform 0.2s;">
        &times;
      </button>
    `;

    const deleteBtn = itemRow.querySelector(".btn-remove-color");
    deleteBtn.addEventListener("click", async () => {
      const cId = deleteBtn.getAttribute("data-id");
      const cName = deleteBtn.getAttribute("data-name");

      if (confirm(`Remove the color "${cName}" from your active catalog?`)) {
        try {
          showToast(`Removing "${cName}"...`, "success");
          await deleteColor(cId);
          showToast("Color removed.", "success");
        } catch (err) {
          console.error("Failed to delete color:", err);
          showToast("Error deleting color.", "error");
        }
      }
    });

    listDiv.appendChild(itemRow);
  });
  
  availableSection.appendChild(listDiv);
  container.appendChild(availableSection);
}

/**
 * Resizes and compresses image files on the client side using HTML5 Canvas
 */
async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas compression failed"));
          }
        }, "image/jpeg", quality);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function initHomepageEditorForm() {
  const editorForm = document.getElementById("form-homepage-editor");
  if (!editorForm) return;

  editorForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const heroTitle = document.getElementById("edit-hero-title").value.trim();
    const heroSubtext = document.getElementById("edit-hero-subtext").value.trim();

    try {
      showToast("Syncing public page configurations...", "success");
      await updateHomepageSettings({ heroTitle, heroSubtext });
      showToast("Homepage adjustments deployed live!", "success");
    } catch (err) {
      console.error(err);
      showToast("Error updating corporate display profiles.", "error");
    }
  });
}
