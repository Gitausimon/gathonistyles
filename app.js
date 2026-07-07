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
  monitorAuthState, 
  loginAdmin, 
  logoutAdmin 
} from "./js/db.js";
import { renderSilhouette, highlightZone } from "./js/components/Silhouette.js";
import { renderMeasurementForm, bindFormEvents, requiredMeasurements, measurementRanges } from "./js/components/MeasurementForm.js";

// Tailor's contact number (Nairobi country code +254)
const TAILOR_WHATSAPP_PHONE = "254758519041";

let currentAdminUser = null;

// Premium Lookbook Collection Catalog
const CATALOG_ITEMS = [
  {
    id: "signature-column-dress",
    name: "Signature Column Dress",
    category: "dresses",
    price: 7200,
    type: "dress",
    image: "assets/dress_editorial.png",
    description: "An elegant, floor-skimming column gown sculpted for a dramatic yet minimal silhouette. Crafted from premium breathable cotton-linen blend, perfect for both corporate elegance and formal evening dinners in Nairobi."
  },
  {
    id: "wool-blend-power-suit",
    name: "Wool-Blend Power Suit",
    category: "official",
    price: 12500,
    type: "official",
    image: "assets/official_editorial.png",
    description: "A sharp, structured double-breasted blazer and high-waisted trouser set. Designed to empower. Made with high-grade tropical wool-blend fabric, tailored precisely to sit flat on the shoulders and waist."
  },
  {
    id: "pleated-wrap-skirt",
    name: "Pleated Wrap Skirt",
    category: "casual",
    price: 4800,
    type: "skirt",
    image: "assets/casual_editorial.png",
    description: "A versatile modern wrap skirt featuring hand-pressed pleats and an adjustable waist tie. Cut in a flattering mid-length silhouette that flows naturally. Can be dressed up for weddings or down for brunch."
  },
  {
    id: "cowl-neck-slip-dress",
    name: "Cowl-Neck Slip Dress",
    category: "dresses",
    price: 6900,
    type: "dress",
    image: "assets/hero_editorial.png",
    description: "A bias-cut cowl neck slip dress that fluidly contours your body curves. Features thin adjustable straps and an open back design. Extremely luxurious feel, hand-finished using high-end Nairobi silk-satin."
  }
];

// App State
let activeFilters = "all";

// -------------------------------------------------------------
// APP INITIALIZATION
// -------------------------------------------------------------
function initApp() {
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

let _heroAnimated = false;
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

    // Detect mobile layout (vertical)
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    // Stagger the nodes in
    nodes.forEach((node, i) => {
      ScrollTrigger.create({
        trigger: section,
        start: "top 80%",
        onEnter: () => {
          setTimeout(() => {
            node.classList.add("is-visible");
          }, i * 180);
        },
        once: true
      });
    });

    // Animate track fill and activate nodes on scroll
    ScrollTrigger.create({
      trigger: section,
      start: "top 70%",
      end: "bottom 40%",
      scrub: 0.5,
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
          const threshold = (i + 0.5) / nodes.length;
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
  }
}

// -------------------------------------------------------------
// SPA ROUTER
// -------------------------------------------------------------
function initRouter() {
  const handleRouting = () => {
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
      } else {
        showView("view-login");
        setActiveNavLink("link-admin");
      }
    } else {
      showView("view-home");
      setActiveNavLink("link-home");
    }

    window.scrollTo(0, 0);
    
    // Refresh scroll triggers as page layout height has changed
    if (window.ScrollTrigger) {
      setTimeout(() => ScrollTrigger.refresh(), 100);
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
      showToast("Subscribed to Maison Nairobi releases.", "success");
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
      banner.textContent = `Current production wait time: ${days} ${days === 1 ? 'day' : 'days'}`;
    } else {
      banner.className = "wait-time-banner high-demand";
      banner.textContent = `High demand: Current production wait time is ${days} days`;
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
        <img src="${item.image}" alt="${item.name} - Custom tailoring Nairobi" loading="lazy" />
        <div class="product-overlay">
          <span class="view-details-text">View Details</span>
        </div>
      </div>
      <div class="product-info">
        <h3 class="product-name">${item.name}</h3>
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

  // Mount components
  document.getElementById("pdp-silhouette-container").innerHTML = renderSilhouette();
  document.getElementById("pdp-form-container").innerHTML = renderMeasurementForm(product.type);
  
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
      
      const colorInput = document.getElementById("garment-color");
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
        
        setTimeout(() => {
          window.open(waLink, "_blank");
        }, 1200);

      } catch (err) {
        console.error("Order submission failure:", err);
        showToast("Checkout pipeline error. Please try again.", "error");
      }
    };
  }
}

// WhatsApp Link Generator compiler
export function generateWhatsAppLink(productName, garmentColor, measurements, price, clientName) {
  let text = `Hello Maison Nairobi! I'd like to order a custom-tailored *${productName}* in *${garmentColor}* (Ksh ${formatPrice(price)}).\n\n`;
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

      orderCard.innerHTML = `
        <div class="order-row-header">
          <div>
            <h4 class="order-client-name">${order.customerName}</h4>
            <span class="order-date">${orderDate} (EAT)</span>
          </div>
          <span class="order-price">Ksh ${formatPrice(order.price)}</span>
        </div>
        
        <div class="order-row-body">
          <div class="order-details-meta">
            <span class="order-product-name">${order.productName}</span>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">ID: ${order.id}</span>
          </div>
          <div class="order-measurements-grid">
            ${measureItemsHtml}
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
          
          <button class="btn-row-whatsapp" data-client="${order.customerName}" data-product="${order.productName}">
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

      const waButton = orderCard.querySelector(".btn-row-whatsapp");
      if (waButton) {
        waButton.addEventListener("click", () => {
          const clientName = waButton.getAttribute("data-client");
          const productName = waButton.getAttribute("data-product");
          const chatMsg = `Hello ${clientName}, this is Maison Nairobi. Regarding your custom order for the *${productName}*, we would like to confirm some details...`;
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
function formatPrice(number) {
  return Number(number).toLocaleString("en-KE");
}

function capitalize(str) {
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
