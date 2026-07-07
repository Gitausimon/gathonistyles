/**
 * Silhouette.js
 * Renders the interactive SVG mannequin and handles measurement zone highlights
 */

export function renderSilhouette() {
  return `
    <div class="silhouette-container">
      <svg viewBox="0 0 200 450" class="mannequin-svg" id="mannequin-svg" aria-label="Measurement Guide Silhouette">
        <defs>
          <!-- Soft glow filter for active lines -->
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Mannequin Stand Pole & Base (Aesthetic Background) -->
        <line x1="100" y1="340" x2="100" y2="430" class="mannequin-stand" />
        <path d="M 70 430 Q 100 425 130 430 L 135 435 L 65 435 Z" class="mannequin-base" />

        <!-- Mannequin Body Shape -->
        <!-- Neck, shoulders, bust curve, waist, hip flare, thighs, torso base -->
        <path d="
          M 90 40 
          Q 100 42 110 40 
          L 115 55 
          Q 120 70 135 78 
          C 145 83 145 105 138 120
          C 132 135 125 155 125 180
          C 125 210 148 240 145 270
          C 142 300 130 330 120 340
          L 80 340
          C 70 330 58 300 55 270
          C 52 240 75 210 75 180
          C 75 155 68 135 62 120
          C 55 105 55 83 65 78
          Q 80 70 85 55
          Z" 
          class="mannequin-body" 
        />
        
        <!-- Soft interior lines representing fabric seams for couture feel -->
        <path d="M 100 55 L 100 340" class="mannequin-seam" />
        <path d="M 78 180 Q 100 190 122 180" class="mannequin-seam" />
        <path d="M 68 120 Q 100 130 132 120" class="mannequin-seam" />

        <!-- MEASUREMENT LINES (INDICATORS) -->
        
        <!-- Shoulder Width -->
        <g id="zone-shoulder-width" class="measurement-zone">
          <line x1="64" y1="78" x2="136" y2="78" class="indicator-line" />
          <circle cx="64" cy="78" r="3" class="indicator-dot" />
          <circle cx="136" cy="78" r="3" class="indicator-dot" />
          <text x="100" y="70" class="indicator-text">Shoulders</text>
        </g>

        <!-- Bust -->
        <g id="zone-bust" class="measurement-zone">
          <line x1="58" y1="120" x2="142" y2="120" class="indicator-line" />
          <circle cx="58" cy="120" r="3" class="indicator-dot" />
          <circle cx="142" cy="120" r="3" class="indicator-dot" />
          <text x="100" y="112" class="indicator-text">Bust</text>
        </g>

        <!-- Waist -->
        <g id="zone-waist" class="measurement-zone">
          <line x1="72" y1="180" x2="128" y2="180" class="indicator-line" />
          <circle cx="72" cy="180" r="3" class="indicator-dot" />
          <circle cx="128" cy="180" r="3" class="indicator-dot" />
          <text x="100" y="172" class="indicator-text">Waist</text>
        </g>

        <!-- Hips -->
        <g id="zone-hips" class="measurement-zone">
          <line x1="54" y1="260" x2="146" y2="260" class="indicator-line" />
          <circle cx="54" cy="260" r="3" class="indicator-dot" />
          <circle cx="146" cy="260" r="3" class="indicator-dot" />
          <text x="100" y="252" class="indicator-text">Hips</text>
        </g>

        <!-- Length (Dashed vertical offset line) -->
        <g id="zone-length" class="measurement-zone">
          <path d="M 45 78 L 35 78 L 35 340 L 45 340" class="indicator-line-bracket" />
          <line x1="35" y1="78" x2="35" y2="340" class="indicator-line" style="stroke-dasharray: 4;" />
          <text x="25" y="215" class="indicator-text length-text" transform="rotate(-90 25 215)">Garment Length</text>
        </g>
      </svg>
    </div>
  `;
}

/**
 * Highlights a specific measurement zone on the mannequin
 * @param {string} zone - Name of the zone (e.g. 'bust', 'waist', 'hips', 'length', 'shoulder width')
 */
export function highlightZone(zone) {
  // Clear all active highlights
  document.querySelectorAll(".measurement-zone").forEach(el => {
    el.classList.remove("active");
  });

  if (!zone) return;

  // Format zone name to ID format: 'shoulder width' -> 'shoulder-width'
  const zoneId = zone.toLowerCase().trim().replace(/\s+/g, "-");
  const target = document.getElementById(`zone-${zoneId}`);
  if (target) {
    target.classList.add("active");
  }
}
