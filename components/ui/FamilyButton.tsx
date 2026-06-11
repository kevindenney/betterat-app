/**
 * FamilyButton Component
 *
 * A compound component that expands from a circular trigger to reveal content.
 * Uses Moti for spring animations and supports dynamic content height measurement.
 *
 * @example
 * <FamilyButton width={160} height={180}>
 *   <FamilyButton.Trigger>
 *     <Plus color="#047857" size={24} />
 *   </FamilyButton.Trigger>
 *   <FamilyButton.Content>
 *     <QuickAddRaceForm onSubmit={handleSubmit} onCancel={handleCancel} />
 *   </FamilyButton.Content>
 * </FamilyButton>
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from 'react';
import {
  View,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { MotiView } from 'moti';
import { TufteTokens } from '@/constants/designSystem';

// ============================================================================
// Types
// ============================================================================

interface FamilyButtonContextValue {
  isExpanded: boolean;
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  contentHeight: number;
  triggerSize: number;
}

export interface FamilyButtonRef {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  isExpanded: boolean;
}

interface FamilyButtonProps {
  children: React.ReactNode;
  /** Initial expanded state (uncontrolled mode) */
  defaultExpanded?: boolean;
  /** Controlled expanded state - when provided, component is controlled */
  expanded?: boolean;
  /** Callback when expanded state changes */
  onExpandChange?: (expanded: boolean) => void;
  variant?: 'default' | 'tufte';
  width?: number;
  height?: number;
}

interface FamilyButtonTriggerProps {
  children: React.ReactNode;
  size?: number;
  className?: string;
}

interface FamilyButtonContentProps {
  children: React.ReactNode;
  className?: string;
}

// ============================================================================
// Context
// ============================================================================

const FamilyButtonContext = createContext<FamilyButtonContextValue | null>(null);

const useFamilyButton = () => {
  const context = useContext(FamilyButtonContext);
  if (!context) {
    throw new Error('FamilyButton compound components must be used within FamilyButton');
  }
  return context;
};

// ============================================================================
// Animation Config
// ============================================================================

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 180,
  mass: 0.8,
};

// ============================================================================
// Trigger Component
// ============================================================================

const FamilyButtonTrigger: React.FC<FamilyButtonTriggerProps> = ({
  children,
  size = 56,
}) => {
  const { isExpanded, toggle } = useFamilyButton();

  if (isExpanded) {
    return null;
  }

  const handlePress = (e?: any) => {
    // Stop propagation to prevent parent handlers from firing
    if (e) {
      e.stopPropagation?.();
      e.preventDefault?.();
    }
    toggle();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[
        styles.trigger,
        Platform.OS === 'web' && styles.triggerWeb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Add race"
      accessibilityHint="Tap to expand and add a new race"
    >
      {children}
    </TouchableOpacity>
  );
};

// ============================================================================
// Content Component
// ============================================================================

const FamilyButtonContent: React.FC<FamilyButtonContentProps> = ({ children }) => {
  const { isExpanded, collapse } = useFamilyButton();

  if (!isExpanded) {
    return null;
  }

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        type: 'spring',
        ...SPRING_CONFIG,
      }}
      style={styles.contentWrapper}
    >
      {/* Close button */}
      <Pressable
        onPress={collapse}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.closeIcon}>
          <View style={[styles.closeLine, styles.closeLineLeft]} />
          <View style={[styles.closeLine, styles.closeLineRight]} />
        </View>
      </Pressable>

      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </MotiView>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const FamilyButtonComponent = forwardRef<FamilyButtonRef, FamilyButtonProps>(
  (
    {
      children,
      defaultExpanded = false,
      expanded: controlledExpanded,
      onExpandChange,
      variant = 'tufte',
      width = 160,
      height = 180,
    },
    ref
  ) => {
    // Support both controlled and uncontrolled modes
    const isControlled = controlledExpanded !== undefined;
    const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

    // Use controlled value if provided, otherwise use internal state
    const isExpanded = isControlled ? controlledExpanded : internalExpanded;

    const [contentHeight] = useState(0);
    const triggerSize = 56;

    const expand = useCallback(() => {
      if (!isControlled) {
        setInternalExpanded(true);
      }
      onExpandChange?.(true);
    }, [isControlled, onExpandChange]);

    const collapse = useCallback(() => {
      if (!isControlled) {
        setInternalExpanded(false);
      }
      onExpandChange?.(false);
    }, [isControlled, onExpandChange]);

    const toggle = useCallback(() => {
      const newState = !isExpanded;
      if (!isControlled) {
        setInternalExpanded(newState);
      }
      onExpandChange?.(newState);
    }, [isExpanded, isControlled, onExpandChange]);

    useImperativeHandle(ref, () => ({
      expand,
      collapse,
      toggle,
      isExpanded,
    }));

    const contextValue = useMemo<FamilyButtonContextValue>(
      () => ({
        isExpanded,
        expand,
        collapse,
        toggle,
        contentHeight,
        triggerSize,
      }),
      [isExpanded, expand, collapse, toggle, contentHeight, triggerSize]
    );

    const containerStyle = useMemo(
      () => [
        styles.container,
        variant === 'tufte' && styles.containerTufte,
        {
          width: isExpanded ? width : triggerSize,
          minHeight: isExpanded ? height : triggerSize,
        },
      ],
      [variant, isExpanded, width, height, triggerSize]
    );

    const content = (
      <FamilyButtonContext.Provider value={contextValue}>
        <MotiView
          animate={{
            width: isExpanded ? width : triggerSize,
            borderRadius: isExpanded ? TufteTokens.borderRadius.subtle : triggerSize / 2,
          }}
          transition={{
            type: 'spring',
            ...SPRING_CONFIG,
          }}
          style={containerStyle}
        >
          {children}
        </MotiView>
      </FamilyButtonContext.Provider>
    );

    // Wrap with KeyboardAvoidingView on iOS when expanded
    if (Platform.OS === 'ios' && isExpanded) {
      return (
        <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={100}>
          {content}
        </KeyboardAvoidingView>
      );
    }

    return content;
  }
);

FamilyButtonComponent.displayName = 'FamilyButton';

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: TufteTokens.backgrounds.paper,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...TufteTokens.shadows.subtle,
  },
  containerTufte: {
    borderWidth: TufteTokens.borders.hairline,
    borderColor: TufteTokens.borders.color,
  },
  trigger: {
    backgroundColor: '#ECFDF5', // green-50
    borderWidth: TufteTokens.borders.hairline,
    borderColor: '#BBF7D0', // green-200
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
  },
  triggerWeb: {
    // Web-specific styles for better click behavior
    cursor: 'pointer',
  } as any,
  contentWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  content: {
    padding: TufteTokens.spacing.standard,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLine: {
    position: 'absolute',
    width: 14,
    height: 1.5,
    backgroundColor: '#6B7280', // gray-500
    borderRadius: 1,
  },
  closeLineLeft: {
    transform: [{ rotate: '45deg' }],
  },
  closeLineRight: {
    transform: [{ rotate: '-45deg' }],
  },
});

// ============================================================================
// Export Compound Component
// ============================================================================

export const FamilyButton = Object.assign(FamilyButtonComponent, {
  Trigger: FamilyButtonTrigger,
  Content: FamilyButtonContent,
});

export default FamilyButton;
