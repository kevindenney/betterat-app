/**
 * InstagramSlide Component
 * Renders a single Instagram-ready slide with BetterAt branding
 * Designed for 1080x1080 (square) or 1080x1350 (portrait) export
 */

import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type SlideType = 'hook' | 'content' | 'list' | 'matrix' | 'drill' | 'cta';

export interface SlideContent {
  type: SlideType;
  title: string;
  subtitle?: string;
  emoji?: string;
  content?: string;
  items?: string[];
  sections?: {
    title: string;
    items: string[];
  }[];
  matrix?: {
    headers: string[];
    rows: { label: string; values: string[] }[];
  };
  highlight?: string;
  footer?: string;
}

interface InstagramSlideProps {
  slide: SlideContent;
  slideNumber: number;
  totalSlides: number;
  aspectRatio?: 'square' | 'portrait';
  theme?: 'ocean' | 'sunset' | 'dark' | 'regatta';
  /** When true, renders at full 1080px size for export (no scaling) */
  exportMode?: boolean;
}

const THEMES = {
  ocean: {
    gradient: ['#0F172A', '#1E3A5F', '#0C4A6E'],
    accent: '#38BDF8',
    text: '#F8FAFC',
    muted: '#94A3B8',
  },
  sunset: {
    gradient: ['#1F1147', '#4C1D95', '#7C2D12'],
    accent: '#F97316',
    text: '#FEF3C7',
    muted: '#D6D3D1',
  },
  dark: {
    gradient: ['#030712', '#111827', '#1F2937'],
    accent: '#10B981',
    text: '#F9FAFB',
    muted: '#6B7280',
  },
  regatta: {
    gradient: ['#0C1929', '#1E3A5F', '#0A4570'],
    accent: '#3B82F6',
    text: '#FFFFFF',
    muted: '#93C5FD',
  },
};

// Use fixed dimensions for export (will be captured at this size)
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT_SQUARE = 1080;
const EXPORT_HEIGHT_PORTRAIT = 1350;

// Generous padding for Instagram (safe zone) - ~12% margin on each side
const PADDING_H = 130;
const PADDING_V = 70;

export const InstagramSlide = forwardRef<View, InstagramSlideProps>(
  ({ slide, slideNumber, totalSlides, aspectRatio = 'square', theme = 'regatta', exportMode = false }, ref) => {
    const colors = THEMES[theme];
    const height = aspectRatio === 'square' ? EXPORT_HEIGHT_SQUARE : EXPORT_HEIGHT_PORTRAIT;
    
    // Scale factor for preview (fit on screen) - not used in export mode
    const screenWidth = Dimensions.get('window').width;
    const scale = exportMode ? 1 : Math.min(screenWidth * 0.9 / EXPORT_WIDTH, 0.4);

    const renderHookSlide = () => (
      <View style={styles.hookContent}>
        {slide.emoji && <Text style={styles.hookEmoji}>{slide.emoji}</Text>}
        <Text style={[styles.hookTitle, { color: colors.text }]}>{slide.title}</Text>
        {slide.subtitle && (
          <Text style={[styles.hookSubtitle, { color: colors.accent }]}>
            "{slide.subtitle}"
          </Text>
        )}
        {slide.content && (
          <Text style={[styles.hookDescription, { color: colors.muted }]}>
            {slide.content}
          </Text>
        )}
        <View style={styles.swipeHint}>
          <Text style={[styles.swipeText, { color: colors.accent }]}>Swipe to learn</Text>
          <MaterialCommunityIcons name="chevron-right" size={28} color={colors.accent} />
        </View>
      </View>
    );

    const renderContentSlide = () => (
      <View style={styles.contentSlide}>
        <Text style={[styles.contentTitle, { color: colors.accent }]}>{slide.title}</Text>
        {slide.content && (
          <Text style={[styles.contentText, { color: colors.text }]}>{slide.content}</Text>
        )}
        {slide.items && (
          <View style={styles.itemList}>
            {slide.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={[styles.bullet, { backgroundColor: colors.accent }]} />
                <Text style={[styles.itemText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {slide.highlight && (
          <View style={[styles.highlightBox, { borderColor: colors.accent, backgroundColor: `${colors.accent}15` }]}>
            <MaterialCommunityIcons name="lightbulb-outline" size={24} color={colors.accent} />
            <Text style={[styles.highlightText, { color: colors.text }]}>{slide.highlight}</Text>
          </View>
        )}
      </View>
    );

    const renderListSlide = () => (
      <View style={styles.listSlide}>
        <Text style={[styles.listTitle, { color: colors.accent }]}>{slide.title}</Text>
        {slide.sections?.map((section, sIdx) => (
          <View key={sIdx} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
            {section.items.map((item, iIdx) => (
              <View key={iIdx} style={styles.numberedItem}>
                <Text style={[styles.itemNumber, { color: colors.accent }]}>{iIdx + 1}.</Text>
                <Text style={[styles.numberedText, { color: colors.muted }]}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    );

    const renderMatrixSlide = () => (
      <View style={styles.matrixSlide}>
        <Text style={[styles.matrixTitle, { color: colors.accent }]}>{slide.title}</Text>
        {slide.matrix && (
          <View style={[styles.matrixTable, { borderColor: colors.accent }]}>
            <View style={[styles.matrixHeader, { backgroundColor: `${colors.accent}30` }]}>
              {slide.matrix.headers.map((header, idx) => (
                <Text 
                  key={idx} 
                  style={[
                    styles.matrixHeaderCell, 
                    { color: colors.text, flex: idx === 0 ? 1.3 : 1 }
                  ]}
                >
                  {header}
                </Text>
              ))}
            </View>
            {slide.matrix.rows.map((row, rIdx) => (
              <View 
                key={rIdx} 
                style={[
                  styles.matrixRow, 
                  { borderBottomColor: `${colors.accent}40` },
                  rIdx % 2 === 0 && { backgroundColor: `${colors.accent}10` }
                ]}
              >
                <Text style={[styles.matrixLabel, { color: colors.text, flex: 1.3 }]}>
                  {row.label}
                </Text>
                {row.values.map((val, vIdx) => (
                  <Text key={vIdx} style={[styles.matrixCell, { color: colors.muted, flex: 1 }]}>
                    {val}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>
    );

    const renderDrillSlide = () => (
      <View style={styles.drillSlide}>
        <MaterialCommunityIcons name="target" size={56} color={colors.accent} />
        <Text style={[styles.drillTitle, { color: colors.accent }]}>{slide.title}</Text>
        {slide.items && (
          <View style={styles.drillSteps}>
            {slide.items.map((item, idx) => (
              <View key={idx} style={styles.drillStep}>
                <View style={[styles.stepNumber, { backgroundColor: colors.accent }]}>
                  <Text style={styles.stepNumberText}>{idx + 1}</Text>
                </View>
                <Text style={[styles.drillStepText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {slide.highlight && (
          <View style={[styles.goalBox, { backgroundColor: `${colors.accent}20`, borderColor: colors.accent }]}>
            <Text style={[styles.goalLabel, { color: colors.accent }]}>GOAL</Text>
            <Text style={[styles.goalText, { color: colors.text }]}>{slide.highlight}</Text>
          </View>
        )}
      </View>
    );

    const renderCtaSlide = () => (
      <View style={styles.ctaSlide}>
        <MaterialCommunityIcons name="sail-boat" size={72} color={colors.accent} />
        <Text style={[styles.ctaTitle, { color: colors.text }]}>{slide.title}</Text>
        {slide.content && (
          <Text style={[styles.ctaContent, { color: colors.muted }]}>{slide.content}</Text>
        )}
        <View style={[styles.ctaButton, { backgroundColor: colors.accent }]}>
          <Text style={styles.ctaButtonText}>Get BetterAt</Text>
        </View>
      </View>
    );

    const renderSlideContent = () => {
      switch (slide.type) {
        case 'hook':
          return renderHookSlide();
        case 'list':
          return renderListSlide();
        case 'matrix':
          return renderMatrixSlide();
        case 'drill':
          return renderDrillSlide();
        case 'cta':
          return renderCtaSlide();
        case 'content':
        default:
          return renderContentSlide();
      }
    };

    return (
      <View style={exportMode ? undefined : { transform: [{ scale }] }}>
        <View
          ref={ref}
          style={[styles.slideContainer, { width: EXPORT_WIDTH, height }]}
        >
          <LinearGradient
            colors={colors.gradient as [string, string, ...string[]]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="sail-boat" size={32} color={colors.accent} />
              <Text style={[styles.logoText, { color: colors.text }]}>BetterAt</Text>
            </View>
            <View style={[styles.slideCounter, { backgroundColor: `${colors.accent}30` }]}>
              <Text style={[styles.counterText, { color: colors.accent }]}>
                {slideNumber}/{totalSlides}
              </Text>
            </View>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            {renderSlideContent()}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.muted }]}>
              {slide.footer || 'better.at'}
            </Text>
          </View>
        </View>
      </View>
    );
  }
);

InstagramSlide.displayName = 'InstagramSlide';

const styles = StyleSheet.create({
  slideContainer: {
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PADDING_H,
    paddingTop: PADDING_V,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  slideCounter: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  counterText: {
    fontSize: 18,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: PADDING_H,
    paddingVertical: 30,
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: PADDING_V,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 18,
    letterSpacing: 2,
    opacity: 0.8,
  },

  // Hook slide styles
  hookContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  hookEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  hookTitle: {
    fontSize: 56,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    marginBottom: 20,
  },
  hookSubtitle: {
    fontSize: 34,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 28,
  },
  hookDescription: {
    fontSize: 24,
    textAlign: 'center',
    lineHeight: 36,
    maxWidth: 750,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
  },
  swipeText: {
    fontSize: 24,
    fontWeight: '600',
  },

  // Content slide styles
  contentSlide: {
    flex: 1,
    justifyContent: 'center',
  },
  contentTitle: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 32,
    letterSpacing: -0.5,
  },
  contentText: {
    fontSize: 24,
    lineHeight: 36,
    marginBottom: 28,
  },
  itemList: {
    gap: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  bullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 10,
  },
  itemText: {
    flex: 1,
    fontSize: 24,
    lineHeight: 34,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 32,
    padding: 24,
    borderWidth: 2,
    borderRadius: 16,
  },
  highlightText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 30,
  },

  // List slide styles
  listSlide: {
    flex: 1,
    justifyContent: 'center',
  },
  listTitle: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 36,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  numberedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  itemNumber: {
    fontSize: 20,
    fontWeight: '700',
    width: 28,
  },
  numberedText: {
    flex: 1,
    fontSize: 20,
    lineHeight: 30,
  },

  // Matrix slide styles
  matrixSlide: {
    flex: 1,
    justifyContent: 'center',
  },
  matrixTitle: {
    fontSize: 34,
    fontWeight: '700',
    marginBottom: 28,
    textAlign: 'center',
  },
  matrixTable: {
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  matrixHeader: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  matrixHeaderCell: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  matrixRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  matrixLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  matrixCell: {
    fontSize: 18,
    textAlign: 'center',
  },

  // Drill slide styles
  drillSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drillTitle: {
    fontSize: 36,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 32,
    textAlign: 'center',
  },
  drillSteps: {
    gap: 20,
    width: '100%',
  },
  drillStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  stepNumber: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  drillStepText: {
    flex: 1,
    fontSize: 24,
    lineHeight: 32,
  },
  goalBox: {
    marginTop: 32,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  goalText: {
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 32,
  },

  // CTA slide styles
  ctaSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 44,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  ctaContent: {
    fontSize: 24,
    textAlign: 'center',
    maxWidth: 700,
    marginBottom: 40,
    lineHeight: 36,
  },
  ctaButton: {
    paddingHorizontal: 44,
    paddingVertical: 18,
    borderRadius: 36,
  },
  ctaButtonText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default InstagramSlide;
