const Animated = {
  View: 'AnimatedView',
};

module.exports = {
  __esModule: true,
  default: Animated,
  runOnJS: (callback) => callback,
  useAnimatedStyle: (factory) => factory(),
};
