import React from 'react';

import { AddStepFab } from '../AddStepFab';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  TouchableOpacity: 'TouchableOpacity',
}));

describe('AddStepFab', () => {
  it('renders the canonical accessible add-step button', () => {
    const onPress = jest.fn();

    const element = AddStepFab({ onPress }) as React.ReactElement<any>;

    expect(element.props.accessibilityRole).toBe('button');
    expect(element.props.accessibilityLabel).toBe('Add a practice step');
    expect(element.props.accessibilityHint).toBe(
      'Opens options to build with AI Coach or start from a blueprint.',
    );

    element.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks the button disabled without changing the handler contract', () => {
    const onPress = jest.fn();

    const element = AddStepFab({ onPress, disabled: true }) as React.ReactElement<any>;

    expect(element.props.disabled).toBe(true);
    expect(element.props.onPress).toBe(onPress);
  });
});
