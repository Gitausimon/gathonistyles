/**
 * MeasurementForm.js
 * Dynamically renders the measurement forms based on garment type
 * and communicates focus events to the silhouette mannequin
 */

import { highlightZone } from "./Silhouette.js";

// Database mapping of required measurements per garment category
export const requiredMeasurements = {
  dress: ["shoulder width", "bust", "waist", "hips", "length"],
  skirt: ["waist", "hips", "length"],
  official: ["shoulder width", "bust", "waist", "hips", "length"],
  casual: ["bust", "waist", "hips", "length"]
};

// Help tips for how to measure each zone
const measurementInstructions = {
  "shoulder width": "Measure across your upper back from the tip of one shoulder bone to the tip of the other.",
  "bust": "Measure around the fullest part of your chest, keeping the tape snug but comfortable and parallel to the floor.",
  "waist": "Measure around your natural waistline (narrowest part of your torso, usually just above the belly button).",
  "hips": "Measure around the widest part of your hips and buttocks, keeping the tape flat and parallel to the ground.",
  "length": "For dresses/tops: Measure from the high point of your shoulder down to the desired hemline. For skirts: Measure from your natural waistline down."
};

// Default recommended ranges for inputs (in cm) to catch obvious typos
export const measurementRanges = {
  "shoulder width": { min: 30, max: 55, placeholder: "e.g. 38" },
  "bust": { min: 70, max: 140, placeholder: "e.g. 92" },
  "waist": { min: 55, max: 120, placeholder: "e.g. 74" },
  "hips": { min: 80, max: 150, placeholder: "e.g. 102" },
  "length": { min: 40, max: 180, placeholder: "e.g. 110" }
};

/**
 * Renders the HTML for the dynamic measurement form
 * @param {string} garmentType - The category of the item ('dress', 'skirt', 'official', 'casual')
 * @returns {string} HTML string
 */
export function renderMeasurementForm(garmentType) {
  const fields = requiredMeasurements[garmentType.toLowerCase()] || requiredMeasurements.dress;

  let fieldsHtml = "";

  fields.forEach(field => {
    const instruction = measurementInstructions[field] || "";
    const range = measurementRanges[field] || { min: 30, max: 200, placeholder: "e.g. 80" };
    const fieldId = field.replace(/\s+/g, "-");

    fieldsHtml += `
      <div class="form-group" data-field="${field}">
        <div class="form-label-row">
          <label for="input-${fieldId}">${capitalize(field)} <span class="required">*</span></label>
          <button type="button" class="tooltip-trigger" aria-label="Show measuring instructions" data-tip="${field}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            How to measure
          </button>
        </div>
        
        <div class="input-wrapper">
          <input 
            type="number" 
            id="input-${fieldId}" 
            name="${fieldId}" 
            min="${range.min}" 
            max="${range.max}" 
            step="0.5" 
            placeholder="${range.placeholder}" 
            required 
            class="measurement-input"
            data-zone="${field}"
          />
          <span class="unit-badge">cm</span>
        </div>

        <div class="inline-tip" id="tip-${fieldId}">
          ${instruction}
        </div>
      </div>
    `;
  });

  return `
    <form id="checkout-measurement-form" class="measurement-form">
      <h3 class="form-title">Enter Your Measurements</h3>
      <p class="form-subtitle">Custom-crafted garments require precise dimensions. Use a tape measure and reference the interactive guide.</p>
      
      <!-- Video Tutorial Trigger -->
      <div class="tutorial-banner">
        <div class="tutorial-banner-content">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <div>
            <strong>Confused about measuring?</strong>
            <p>Watch our 2-minute video guide</p>
          </div>
        </div>
        <button type="button" class="btn-tutorial-open" id="btn-open-video">Watch Video</button>
      </div>

      <!-- Rendered Inputs -->
      <div class="measurement-fields">
        ${fieldsHtml}
      </div>

      <!-- Liability disclaimer -->
      <div class="liability-card">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="warning-icon">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <p><strong>Measurement Liability Policy:</strong> Each garment is tailored exactly to your submitted numbers. We cannot offer returns or refunds for client measuring errors. Double-check before submitting!</p>
      </div>

      <!-- Color Selection -->
      <div class="form-group color-select-group" style="margin-bottom: 2rem;">
        <label for="garment-color">Garment Color <span class="required">*</span></label>
        <div class="input-wrapper" style="display: block;">
          <select id="garment-color" name="garment-color" required class="measurement-input" style="width: 100%; cursor: pointer;">
            <option value="" disabled selected>Select a color...</option>
            <option value="Red">Red</option>
            <option value="Blue">Blue</option>
            <option value="Green">Green</option>
            <option value="Purple">Purple</option>
            <option value="Black">Black</option>
            <option value="White">White</option>
          </select>
        </div>
      </div>

      <!-- Client Name (Required for orders tracking) -->
      <div class="form-group client-name-group">
        <label for="client-name">Your Full Name <span class="required">*</span></label>
        <input type="text" id="client-name" name="client-name" placeholder="e.g. Maria Kamau" required class="client-name-input" />
      </div>

      <!-- Submit Hand-off Button -->
      <button type="submit" class="btn-whatsapp-submit">
        <svg class="whatsapp-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"></path>
        </svg>
        Send Measurements to WhatsApp
      </button>
      <span class="trust-subtitle">No payment required until measurements are confirmed.</span>
    </form>

    <!-- Video Modal Container (Hidden by default) -->
    <div id="video-tutorial-modal" class="modal-overlay">
      <div class="modal-card">
        <button type="button" class="modal-close" id="btn-close-video" aria-label="Close tutorial">×</button>
        <h4 class="modal-title">How to Measure Yourself</h4>
        <div class="video-ratio-box">
          <!-- Unlisted-style sewing tutorial video embedding -->
          <iframe 
            src="https://www.youtube.com/embed/RAMvIQ9v9Zg" 
            title="Tailoring Measurement Video Guide" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            allowfullscreen>
          </iframe>
        </div>
        <div class="modal-footer">
          <p>Tip: Have a friend help you read the tape measure flat against your skin. Stand naturally; don't suck in your breath.</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Capitalizes input strings for labels
 */
function capitalize(str) {
  return str.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Binds DOM event listeners to the measurement form
 * @param {HTMLElement} formContainer - The container holding the form
 */
export function bindFormEvents(formContainer) {
  // Focus events for highlighting body zones
  const inputs = formContainer.querySelectorAll(".measurement-input");
  inputs.forEach(input => {
    input.addEventListener("focus", (e) => {
      const zone = e.target.getAttribute("data-zone");
      highlightZone(zone);
      
      // Expand inline tip
      const fieldId = zone.replace(/\s+/g, "-");
      const tip = formContainer.querySelector(`#tip-${fieldId}`);
      if (tip) tip.classList.add("visible");
    });

    input.addEventListener("blur", (e) => {
      // Don't clear immediately to allow scanning, or clear if clicking outside
      const zone = e.target.getAttribute("data-zone");
      const fieldId = zone.replace(/\s+/g, "-");
      const tip = formContainer.querySelector(`#tip-${fieldId}`);
      if (tip) tip.classList.remove("visible");
    });
  });

  // Tooltip icon click toggle (displays inline instructions)
  const tooltipButtons = formContainer.querySelectorAll(".tooltip-trigger");
  tooltipButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const zone = btn.getAttribute("data-tip");
      const fieldId = zone.replace(/\s+/g, "-");
      const tip = formContainer.querySelector(`#tip-${fieldId}`);
      if (tip) {
        tip.classList.toggle("visible");
      }
    });
  });

  // Video modal toggle
  const openVideoBtn = formContainer.querySelector("#btn-open-video");
  const closeVideoBtn = formContainer.querySelector("#btn-close-video");
  const modal = formContainer.querySelector("#video-tutorial-modal");

  if (openVideoBtn && modal) {
    openVideoBtn.addEventListener("click", () => {
      modal.classList.add("active");
    });
  }

  if (closeVideoBtn && modal) {
    closeVideoBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });
    
    // Close on overlay click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  }
}
