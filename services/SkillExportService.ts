/**
 * SkillExportService
 * Parses skill markdown content and converts it to Instagram-ready slide content
 */

import { SlideContent, SlideType } from '@/components/learn/InstagramSlide';

export interface SkillMetadata {
  name: string;
  description: string;
}

export interface ParsedSkill {
  metadata: SkillMetadata;
  title: string;
  description: string;
  sections: {
    title: string;
    content: string;
    subsections?: {
      title: string;
      content: string;
      items?: string[];
    }[];
    items?: string[];
  }[];
}

/**
 * Parse skill markdown into structured data
 */
export function parseSkillMarkdown(markdown: string): ParsedSkill {
  const lines = markdown.split('\n');
  
  // Parse frontmatter
  let metadata: SkillMetadata = { name: '', description: '' };
  let contentStart = 0;
  
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        contentStart = i + 1;
        break;
      }
      const match = lines[i]?.match(/^(\w+):\s*(.+)/);
      if (match) {
        const key = match[1] as keyof SkillMetadata;
        if (key === 'name' || key === 'description') {
          metadata[key] = match[2];
        }
      }
    }
  }

  // Parse main content
  const content = lines.slice(contentStart).join('\n');
  
  // Extract title (first h1)
  const titleMatch = content.match(/^#\s+(.+)/m);
  const title = titleMatch?.[1] || metadata.name;
  
  // Extract description (content under ## Description)
  const descMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);
  const description = descMatch?.[1]?.trim() || metadata.description;
  
  // Extract main sections (## headers)
  const sections: ParsedSkill['sections'] = [];
  const sectionRegex = /### \d+\.\s+(.+)\n([\s\S]*?)(?=\n### \d+\.|## Expected Outcomes|$)/g;
  
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    const sectionTitle = match[1].trim();
    const sectionContent = match[2].trim();
    
    // Extract items (bullet points)
    const items = sectionContent
      .split('\n')
      .filter(line => line.match(/^[-*]\s+/))
      .map(line => line.replace(/^[-*]\s+/, '').trim())
      .filter(item => item.length > 0 && item.length < 100); // Keep shorter items
    
    sections.push({
      title: sectionTitle,
      content: sectionContent.split('\n')[0] || '',
      items: items.slice(0, 6), // Limit items per section
    });
  }

  return {
    metadata,
    title,
    description,
    sections,
  };
}

/**
 * Convert parsed skill to Instagram carousel slides
 */
export function skillToInstagramSlides(skill: ParsedSkill, maxSlides = 10): SlideContent[] {
  const slides: SlideContent[] = [];
  
  // Slide 1: Hook slide
  slides.push({
    type: 'hook',
    emoji: getSkillEmoji(skill.title),
    title: skill.title.toUpperCase(),
    subtitle: getHookSubtitle(skill.title),
    content: truncateText(skill.description, 120),
  });
  
  // Generate content slides from sections
  for (const section of skill.sections.slice(0, maxSlides - 2)) {
    const slideType = determineSlideType(section);
    
    if (slideType === 'matrix' && section.content.includes('|')) {
      // Parse matrix content
      const matrix = parseMatrixFromContent(section.content);
      if (matrix) {
        slides.push({
          type: 'matrix',
          title: cleanSectionTitle(section.title),
          matrix,
        });
        continue;
      }
    }
    
    if (slideType === 'drill') {
      slides.push({
        type: 'drill',
        title: cleanSectionTitle(section.title),
        items: section.items?.slice(0, 5) || [],
        highlight: extractGoal(section.content),
      });
      continue;
    }
    
    if (section.items && section.items.length > 0) {
      slides.push({
        type: 'content',
        title: cleanSectionTitle(section.title),
        items: section.items.slice(0, 5),
        highlight: extractHighlight(section.content),
      });
    } else {
      // Extract key points from content
      const keyPoints = extractKeyPoints(section.content);
      if (keyPoints.length > 0) {
        slides.push({
          type: 'content',
          title: cleanSectionTitle(section.title),
          items: keyPoints.slice(0, 5),
        });
      }
    }
    
    if (slides.length >= maxSlides - 1) break;
  }
  
  // Final slide: CTA
  slides.push({
    type: 'cta',
    title: 'Master Your Racing',
    content: `Learn ${skill.title} and more with BetterAt's AI-powered sailing coach.`,
  });
  
  return slides;
}

/**
 * Generate slides specifically for mark rounding skill
 */
export function generateMarkRoundingSlides(): SlideContent[] {
  return [
    {
      type: 'hook',
      emoji: '🔄',
      title: 'MARK ROUNDING',
      subtitle: 'In wide, out close',
      content: 'Save 10-30 seconds at EVERY mark with this technique.',
    },
    {
      type: 'content',
      title: 'WHY "WIDE-AND-CLOSE" WORKS',
      items: [
        'Need ~2 boat length radius to carry speed',
        'Wide entry = smooth, fast arc',
        'Close exit = optimal position for next leg',
        'Proper rounding saves 10-30 seconds per mark',
      ],
      highlight: 'Speed through turns is everything',
    },
    {
      type: 'list',
      title: 'THE 3-PHASE EXECUTION',
      sections: [
        {
          title: 'APPROACH',
          items: [
            'Target 2 boat lengths wide',
            'Maintain speed into zone',
            'Begin turn 2-3 lengths before mark',
          ],
        },
        {
          title: 'MID-TURN',
          items: [
            'Steady turning radius',
            'Keep sails powered',
            'Adjust sheet tension',
          ],
        },
        {
          title: 'EXIT',
          items: [
            'Pass mark within 1 foot',
            'Establish course immediately',
            'Build speed instantly',
          ],
        },
      ],
    },
    {
      type: 'matrix',
      title: 'MARK TYPE QUICK REFERENCE',
      matrix: {
        headers: ['Mark', 'Entry', 'Exit', 'Speed'],
        rows: [
          { label: 'Windward', values: ['2L wide', '<1 foot', 'Med-High'] },
          { label: 'Leeward', values: ['2L wide', '<6 inch', 'HIGHEST'] },
          { label: 'Jibe', values: ['1.5L', '<1 foot', 'High'] },
          { label: 'Finish', values: ['Varies', 'N/A', 'Medium'] },
        ],
      },
    },
    {
      type: 'content',
      title: 'INSIDE POSITION STRATEGY',
      items: [
        'Leading → Outside is OK (freedom)',
        'Mid-pack → Inside preferred (protection)',
        'Trailing → Inside is CRITICAL',
      ],
      highlight: 'COMMIT by 5-8 boat lengths out. Don\'t change after 4 lengths.',
    },
    {
      type: 'content',
      title: 'RULE 18: MARK ROOM',
      items: [
        '3-length zone determines rights',
        'Inside overlap at zone = mark room',
        'No overlap at zone = no rights',
        'Seamanlike = 2 boat length radius',
      ],
      highlight: 'Call it early: "OVERLAP!" or "NO OVERLAP!"',
    },
    {
      type: 'drill',
      title: 'SOLO ROUNDING DRILL 🎯',
      items: [
        'Set a practice mark',
        'Round 10 times',
        'Focus on perfect wide-and-close',
        'Time each rounding',
      ],
      highlight: 'Goal: Consistent times within 2 seconds',
    },
    {
      type: 'content',
      title: 'ELITE BENCHMARKS',
      items: [
        'Positions gained per mark: +0.5 average',
        'Speed loss through turn: <5%',
        'Clean execution rate: >90%',
        'Mark touches: <5%',
      ],
    },
    {
      type: 'cta',
      title: 'Master Mark Roundings',
      content: 'Get personalized AI coaching, GPS tracking, and real-time tactics with BetterAt.',
    },
  ];
}

// Helper functions

function getSkillEmoji(title: string): string {
  const emojiMap: Record<string, string> = {
    'mark rounding': '🔄',
    'starting': '🏁',
    'upwind': '⬆️',
    'downwind': '⬇️',
    'tidal': '🌊',
    'strategy': '🧭',
    'finish': '🏆',
    'weather': '🌤️',
    'current': '💧',
  };
  
  const lower = title.toLowerCase();
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lower.includes(key)) return emoji;
  }
  return '⛵';
}

function getHookSubtitle(title: string): string {
  const subtitles: Record<string, string> = {
    'mark rounding': 'In wide, out close',
    'starting line': 'Win the start, win the race',
    'upwind': 'Play the shifts, not the fleet',
    'downwind': 'VMG is just math',
    'tidal': 'Current > Wind in heavy tide',
  };
  
  const lower = title.toLowerCase();
  for (const [key, subtitle] of Object.entries(subtitles)) {
    if (lower.includes(key)) return subtitle;
  }
  return 'Master the fundamentals';
}

function cleanSectionTitle(title: string): string {
  return title
    .replace(/^\d+\.\s*/, '')
    .replace(/\*\*/g, '')
    .trim()
    .toUpperCase();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trim() + '...';
}

function determineSlideType(section: { title: string; content: string }): SlideType {
  const lower = section.title.toLowerCase();
  
  if (lower.includes('drill') || lower.includes('practice')) return 'drill';
  if (section.content.includes('|') && section.content.split('|').length > 4) return 'matrix';
  
  return 'content';
}

function parseMatrixFromContent(content: string): SlideContent['matrix'] | null {
  const lines = content.split('\n').filter(l => l.includes('|'));
  if (lines.length < 2) return null;
  
  const parseRow = (line: string): string[] => 
    line.split('|').map(c => c.trim()).filter(c => c && !c.match(/^-+$/));
  
  const headers = parseRow(lines[0]);
  if (headers.length < 2) return null;
  
  const rows = lines
    .slice(1)
    .filter(l => !l.match(/^\s*\|?\s*-+/))
    .map(l => {
      const cells = parseRow(l);
      return {
        label: cells[0] || '',
        values: cells.slice(1),
      };
    })
    .filter(r => r.label && r.values.length > 0);
  
  if (rows.length === 0) return null;
  
  return { headers, rows };
}

function extractHighlight(content: string): string | undefined {
  // Look for **bold** text or text after "Decision Trigger:" or "Tip:"
  const boldMatch = content.match(/\*\*([^*]+)\*\*/);
  if (boldMatch) return boldMatch[1];
  
  const triggerMatch = content.match(/Decision Trigger:?\s*(.+)/i);
  if (triggerMatch) return triggerMatch[1].slice(0, 100);
  
  return undefined;
}

function extractGoal(content: string): string | undefined {
  const goalMatch = content.match(/Goal:?\s*(.+)/i);
  if (goalMatch) return goalMatch[1].slice(0, 80);
  
  const targetMatch = content.match(/Target:?\s*(.+)/i);
  if (targetMatch) return targetMatch[1].slice(0, 80);
  
  return undefined;
}

function extractKeyPoints(content: string): string[] {
  const points: string[] = [];
  
  // Extract bold items
  const boldMatches = content.matchAll(/\*\*([^*]+)\*\*:?\s*([^*\n]+)?/g);
  for (const match of boldMatches) {
    const point = match[2] ? `${match[1]}: ${match[2].trim()}` : match[1];
    if (point.length < 80) points.push(point);
  }
  
  // If no bold items, try to extract sentences
  if (points.length === 0) {
    const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 10 && s.trim().length < 100);
    points.push(...sentences.slice(0, 4).map(s => s.trim()));
  }
  
  return points;
}

export default {
  parseSkillMarkdown,
  skillToInstagramSlides,
  generateMarkRoundingSlides,
};
