import * as React from 'react';
import Svg, { Circle, Rect } from 'react-native-svg';

interface BetterAtLogoProps {
  size?: number;
  variant?: 'white' | 'dark' | 'filled';
}

export const BetterAtLogo: React.FC<BetterAtLogoProps> = ({
  size = 100,
  variant = 'filled',
}) => {
  const colors = {
    white: { bg: '#0a1832', text: '#FFFFFF' },
    dark: { bg: '#0a1832', text: '#FFFFFF' },
    filled: { bg: '#0a1832', text: '#FFFFFF' },
  };

  const { text, bg } = colors[variant];

  // Geometric "b" matching the mobile app icon: straight stem + circular
  // bowl + underline. Drawn as vector shapes (no font dependency) so the web
  // mark renders identically to assets/images/icon.png.
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Rect x="0" y="0" width="100" height="100" rx="20" fill={bg} />
      {/* stem */}
      <Rect x="39" y="28" width="7" height="31" fill={text} />
      {/* bowl */}
      <Circle cx="50" cy="47.5" r="11.2" fill={text} />
      {/* counter (cut out of the bowl) */}
      <Circle cx="51.5" cy="48" r="5.7" fill={bg} />
      {/* underline */}
      <Rect x="30" y="67" width="40" height="4" rx="2" fill={text} />
    </Svg>
  );
};

export default BetterAtLogo;
