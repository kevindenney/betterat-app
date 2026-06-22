module.exports = {
  SafeAreaConsumer: 'SafeAreaConsumer',
  SafeAreaProvider: ({children}) => children,
  SafeAreaView: 'SafeAreaView',
  initialWindowMetrics: {
    frame: {x: 0,y: 0,width: 0,height: 0},
    insets: {top: 0,right: 0,bottom: 0,left: 0},
  },
  useSafeAreaFrame: () => ({x: 0,y: 0,width: 0,height: 0}),
  useSafeAreaInsets: () => ({top: 0,right: 0,bottom: 0,left: 0}),
};
