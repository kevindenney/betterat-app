/**
 * AtlasMaps — stylized SVG map backdrops for the six canonical Atlas frames.
 *
 * Each map is a static, flat-style illustration matching the canonical
 * design's aesthetic — pale water, soft land masses, named place labels,
 * and pin overlays driven by the consuming frame. Not interactive; the
 * real MapLibre integration lands in Phase A1.
 *
 * Coordinate system: viewBox 0..360 × 0..480 to match the phone column.
 * Pins are absolute-positioned children rendered on top of the SVG.
 */

import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const WATER = '#D9E8F0';
const LAND = '#F1E9D8';
const LAND_DEEP = '#E8DEC8';
const LABEL = 'rgba(60, 60, 67, 0.32)';

// ---------------------------------------------------------------------------
// F1 — Hong Kong / Causeway Bay overview
// ---------------------------------------------------------------------------
export function HongKongOverviewMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 480" preserveAspectRatio="xMidYMid slice">
      {/* Water base */}
      <Path d="M0 0 H360 V480 H0 Z" fill={WATER} />

      {/* Kowloon — north peninsula */}
      <Path
        d="M0 0 H360 V120 C300 110, 240 130, 200 120 C160 110, 120 130, 80 125 C50 122, 25 135, 0 130 Z"
        fill={LAND}
      />
      {/* Hong Kong Island — south of harbour */}
      <Path
        d="M40 260 C80 245, 130 250, 180 248 C230 246, 280 252, 320 255 C340 256, 360 260, 360 280 V360 C320 365, 270 358, 220 360 C170 362, 120 360, 70 358 C40 357, 20 350, 0 348 V298 C12 282, 28 268, 40 260 Z"
        fill={LAND}
      />
      {/* Lamma island — bottom-left */}
      <Path d="M30 400 C50 392, 90 396, 110 408 C115 425, 95 445, 70 450 C45 452, 25 440, 22 420 Z" fill={LAND} />
      {/* Small island east */}
      <Path d="M260 220 C275 215, 290 220, 295 232 C292 240, 278 244, 268 240 C260 234, 258 226, 260 220 Z" fill={LAND_DEEP} />

      {/* Place labels */}
      <SvgText x="60" y="60" fill={LABEL} fontSize="9.5" fontWeight="500" letterSpacing="1">KOWLOON</SvgText>
      <SvgText x="40" y="310" fill={LABEL} fontSize="9.5" fontWeight="500" letterSpacing="1">HONG KONG IS.</SvgText>
      <SvgText x="33" y="436" fill={LABEL} fontSize="8" fontWeight="500" letterSpacing="1">LAMMA</SvgText>
      <SvgText x="130" y="200" fill={LABEL} fontSize="9.5" fontWeight="500" letterSpacing="1.2">VICTORIA HARBOUR</SvgText>
      <SvgText x="262" y="98" fill={LABEL} fontSize="8" fontWeight="500" letterSpacing="0.8">PORT</SvgText>
      <SvgText x="262" y="108" fill={LABEL} fontSize="8" fontWeight="500" letterSpacing="0.8">SHELTER</SvgText>
      <SvgText x="200" y="260" fill={LABEL} fontSize="7.5" fontWeight="500" letterSpacing="0.8">MIDDLE IS. CH.</SvgText>

      {/* Racing-area soft ovals — Victoria Harbour (highlighted/next) */}
      <Defs>
        <LinearGradient id="vhGlow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFC97A" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#FFC97A" stopOpacity="0.18" />
        </LinearGradient>
      </Defs>
      <G>
        <Path
          d="M70 200 C110 185, 230 185, 270 200 C300 215, 295 240, 240 248 C180 252, 120 250, 75 240 C60 232, 55 215, 70 200 Z"
          fill="url(#vhGlow)"
          stroke="#FFB347"
          strokeOpacity="0.65"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </G>
      {/* Port Shelter racing-area (dim) */}
      <Path
        d="M255 80 C290 70, 335 75, 350 95 C355 115, 335 125, 305 122 C275 118, 250 105, 255 80 Z"
        fill="rgba(0,0,0,0.04)"
        stroke="rgba(0,0,0,0.20)"
        strokeWidth="0.8"
        strokeDasharray="2 2"
      />
      {/* Middle Island channel racing area (dim) */}
      <Path
        d="M155 270 C200 268, 260 275, 280 290 C272 308, 230 312, 195 310 C165 308, 145 295, 155 270 Z"
        fill="rgba(0,0,0,0.04)"
        stroke="rgba(0,0,0,0.20)"
        strokeWidth="0.8"
        strokeDasharray="2 2"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// F2 — Victoria Harbour race-marks (zoom 14)
// ---------------------------------------------------------------------------
export function RaceMarksZoomMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 480" preserveAspectRatio="xMidYMid slice">
      {/* Pure water with sliver of land at top and bottom */}
      <Path d="M0 0 H360 V480 H0 Z" fill={WATER} />
      <Path d="M0 0 H360 V30 C260 28, 180 38, 100 32 C60 30, 30 36, 0 34 Z" fill={LAND} />
      <Path d="M0 410 H360 V480 H0 Z" fill={LAND} />

      <SvgText x="100" y="22" fill={LABEL} fontSize="9.5" fontWeight="500" letterSpacing="1.2">KOWLOON</SvgText>
      <SvgText x="105" y="460" fill={LABEL} fontSize="9" fontWeight="500" letterSpacing="1.2">HONG KONG IS.</SvgText>
      <SvgText x="105" y="80" fill={LABEL} fontSize="9" fontWeight="500" letterSpacing="1">VICTORIA HARBOUR</SvgText>

      {/* Wind arrow + label */}
      <G>
        <Line x1="60" y1="120" x2="60" y2="148" stroke="#94A3B8" strokeWidth="1.4" />
        <Path d="M60 152 L56 144 L64 144 Z" fill="#94A3B8" />
        <SvgText x="74" y="135" fill="rgba(60, 60, 67, 0.55)" fontSize="9" fontWeight="500">
          10KN ESE forecast
        </SvgText>
      </G>

      {/* Course geometry — three marks in a triangle, start line at bottom */}
      {/* Windward (TOP) */}
      <Circle cx="200" cy="140" r="5.5" fill="#E07A3C" stroke="#FFF" strokeWidth="1.5" />
      <SvgText x="212" y="144" fill="rgba(60, 60, 67, 0.7)" fontSize="9" fontWeight="600">
        WINDWARD MARK
      </SvgText>

      {/* Spreader (SC) */}
      <Circle cx="120" cy="250" r="5" fill="#E07A3C" stroke="#FFF" strokeWidth="1.5" />
      <SvgText x="40" y="270" fill="rgba(60, 60, 67, 0.62)" fontSize="9" fontWeight="600">
        SPREADER
      </SvgText>

      {/* Start line dashed amber between PIN END and Committee Boat */}
      <Line
        x1="120"
        y1="340"
        x2="260"
        y2="340"
        stroke="#FFA94D"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      {/* Pin end */}
      <Circle cx="120" cy="340" r="5" fill="#FFA94D" stroke="#FFF" strokeWidth="1.5" />
      <SvgText x="80" y="358" fill="rgba(60, 60, 67, 0.7)" fontSize="9" fontWeight="600">
        PIN END
      </SvgText>
      {/* Committee boat */}
      <Polygon points="260,335 270,345 250,345" fill="#FFA94D" stroke="#FFF" strokeWidth="1.5" />
      <SvgText x="252" y="368" fill="rgba(60, 60, 67, 0.7)" fontSize="9" fontWeight="600">
        COMMITTEE{`\n`}BOAT
      </SvgText>
      <SvgText x="252" y="378" fill="rgba(60, 60, 67, 0.7)" fontSize="9" fontWeight="600">
        BOAT
      </SvgText>

      {/* Course lines (dotted) */}
      <Line x1="200" y1="146" x2="125" y2="248" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" strokeDasharray="2 3" />
      <Line x1="120" y1="252" x2="125" y2="335" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" strokeDasharray="2 3" />
      <Line x1="260" y1="335" x2="205" y2="146" stroke="rgba(0,0,0,0.18)" strokeWidth="0.8" strokeDasharray="2 3" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// F3 — World Dragon
// ---------------------------------------------------------------------------
export function WorldDragonMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 480" preserveAspectRatio="xMidYMid slice">
      <Path d="M0 0 H360 V480 H0 Z" fill={WATER} />

      {/* North America blob */}
      <Path
        d="M-10 80 C40 60, 90 70, 130 95 C140 130, 110 170, 80 180 C50 175, 20 160, -10 150 Z"
        fill={LAND}
      />
      {/* Europe blob */}
      <Path
        d="M140 80 C190 70, 230 80, 240 100 C235 130, 220 145, 185 145 C160 138, 145 115, 140 80 Z"
        fill={LAND}
      />
      {/* Africa blob */}
      <Path
        d="M165 160 C200 155, 235 170, 240 220 C235 270, 215 310, 195 320 C175 305, 165 270, 162 230 Z"
        fill={LAND}
      />
      {/* Asia blob */}
      <Path
        d="M240 100 C290 80, 340 90, 370 130 C365 170, 340 200, 295 195 C260 180, 240 145, 240 100 Z"
        fill={LAND}
      />
      {/* Australia blob */}
      <Path
        d="M280 300 C320 290, 360 305, 365 335 C355 360, 320 365, 300 350 C285 335, 280 320, 280 300 Z"
        fill={LAND}
      />
      {/* South America blob */}
      <Path
        d="M50 230 C90 220, 120 240, 125 290 C115 340, 90 370, 70 360 C50 335, 45 285, 50 230 Z"
        fill={LAND}
      />

      {/* Continent labels */}
      <SvgText x="20" y="120" fill={LABEL} fontSize="9.5" fontWeight="500" letterSpacing="1.2">N. AMERICA</SvgText>
      <SvgText x="170" y="110" fill={LABEL} fontSize="9" fontWeight="500" letterSpacing="1.2">EUROPE</SvgText>
      <SvgText x="190" y="240" fill={LABEL} fontSize="9.5" fontWeight="500" letterSpacing="1.2">AFRICA</SvgText>
      <SvgText x="290" y="150" fill={LABEL} fontSize="9.5" fontWeight="500" letterSpacing="1.2">ASIA</SvgText>
      <SvgText x="305" y="335" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1.2">OCEANIA</SvgText>

      {/* Ocean labels */}
      <SvgText x="40" y="380" fill="rgba(60, 60, 67, 0.22)" fontSize="9" fontStyle="italic" letterSpacing="1.2">
        PACIFIC
      </SvgText>
      <SvgText x="180" y="395" fill="rgba(60, 60, 67, 0.22)" fontSize="9" fontStyle="italic" letterSpacing="1.2">
        INDIAN
      </SvgText>
      <SvgText x="125" y="200" fill="rgba(60, 60, 67, 0.22)" fontSize="9" fontStyle="italic" letterSpacing="1.2">
        ATLANTIC
      </SvgText>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// F4 — Baltimore cold (no JHU curation)
// ---------------------------------------------------------------------------
export function BaltimoreColdMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 480" preserveAspectRatio="xMidYMid slice">
      {/* Land base */}
      <Path d="M0 0 H360 V480 H0 Z" fill={LAND} />

      {/* Inner Harbor + Patapsco — water shapes */}
      <Path
        d="M120 270 C160 265, 220 275, 260 290 C275 305, 268 330, 230 338 C190 340, 150 332, 120 320 C100 308, 105 280, 120 270 Z"
        fill={WATER}
      />
      <Path
        d="M260 290 C300 285, 340 300, 360 320 V400 H280 C260 380, 250 350, 260 290 Z"
        fill={WATER}
      />

      {/* Neighborhood labels */}
      <SvgText x="38" y="85" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1">DRUID HILL</SvgText>
      <SvgText x="160" y="110" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1">BOLTON HILL</SvgText>
      <SvgText x="240" y="140" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1">E. BALTIMORE</SvgText>
      <SvgText x="140" y="225" fill={LABEL} fontSize="9" fontWeight="500" letterSpacing="1.2">DOWNTOWN</SvgText>
      <SvgText x="240" y="335" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1">FELLS PT.</SvgText>
      <SvgText x="140" y="355" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1">FEDERAL HILL</SvgText>
      <SvgText x="170" y="318" fill={LABEL} fontSize="8.5" fontStyle="italic" fontWeight="500" letterSpacing="0.6">
        INNER HARBOR
      </SvgText>

      {/* I-95 highway line */}
      <Line x1="0" y1="220" x2="360" y2="225" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" strokeDasharray="6 4" />
      <SvgText x="14" y="216" fill="rgba(60, 60, 67, 0.32)" fontSize="7.5" fontWeight="600">I-95</SvgText>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// F5 — JHU curated (closer zoom on East Baltimore)
// ---------------------------------------------------------------------------
export function JhuCuratedMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 480" preserveAspectRatio="xMidYMid slice">
      <Path d="M0 0 H360 V480 H0 Z" fill={LAND} />

      {/* Inner harbor at bottom */}
      <Path
        d="M0 380 C80 360, 200 365, 360 380 V480 H0 Z"
        fill={WATER}
      />

      {/* Institution ring — dashed boundary around the curated campus */}
      <Circle
        cx="220"
        cy="220"
        r="120"
        fill="none"
        stroke="rgba(120, 100, 180, 0.35)"
        strokeWidth="1.2"
        strokeDasharray="5 4"
      />

      <SvgText x="160" y="110" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1">BOLTON HILL</SvgText>
      <SvgText x="220" y="140" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1">E. BALTIMORE</SvgText>
      <SvgText x="140" y="265" fill={LABEL} fontSize="9" fontWeight="500" letterSpacing="1.2">DOWNTOWN</SvgText>
      <SvgText x="60" y="370" fill={LABEL} fontSize="8.5" fontWeight="500" letterSpacing="1">FELLS PT.</SvgText>
      <SvgText x="148" y="410" fill="rgba(60, 60, 67, 0.32)" fontSize="9" fontStyle="italic" fontWeight="500">
        INNER HARBOR
      </SvgText>
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// F6 — Commit-mode (Victoria Harbour focused)
// ---------------------------------------------------------------------------
export function CommitHarbourMap() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 480" preserveAspectRatio="xMidYMid slice">
      <Path d="M0 0 H360 V480 H0 Z" fill={WATER} />
      {/* Kowloon thin strip top */}
      <Path d="M0 0 H360 V30 C260 25, 180 38, 90 32 C50 30, 25 36, 0 35 Z" fill={LAND} />
      {/* HK Island */}
      <Path d="M0 360 C40 348, 100 354, 180 358 C240 360, 300 354, 360 358 V480 H0 Z" fill={LAND} />

      <SvgText x="14" y="22" fill={LABEL} fontSize="9" fontWeight="500" letterSpacing="1">KOWLOON</SvgText>
      <SvgText x="14" y="408" fill={LABEL} fontSize="9" fontWeight="500" letterSpacing="1">HONG KONG IS.</SvgText>

      {/* Race-4 racing area soft oval — context for the candidate pin */}
      <Path
        d="M80 180 C140 165, 240 168, 300 185 C315 200, 305 230, 245 245 C180 248, 110 244, 80 230 C60 215, 65 192, 80 180 Z"
        fill="rgba(110, 145, 200, 0.10)"
        stroke="rgba(110, 145, 200, 0.32)"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      <SvgText x="135" y="170" fill="rgba(60, 60, 67, 0.42)" fontSize="9" fontWeight="500" letterSpacing="1.2">
        VICTORIA HARBOUR
      </SvgText>

      {/* Faint peer pins */}
      <Circle cx="130" cy="215" r="3" fill="rgba(180, 50, 50, 0.45)" />
      <Circle cx="160" cy="200" r="3" fill="rgba(60, 60, 67, 0.35)" />
      <Circle cx="195" cy="220" r="3" fill="rgba(60, 60, 67, 0.35)" />
      <Circle cx="232" cy="210" r="3" fill="rgba(60, 60, 67, 0.35)" />
      <Circle cx="252" cy="225" r="3" fill="rgba(180, 50, 50, 0.45)" />
    </Svg>
  );
}
