import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

interface TabBarVisibilityContextValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  /**
   * Scroll-driven hide progress: 0 = fully visible, 1 = fully hidden.
   * Written on the UI thread by scroll handlers (see useScrollHideChrome)
   * and read by FloatingTabBar to slide the bar away as the user scrolls,
   * without triggering React re-renders per frame.
   */
  scrollHidden: SharedValue<number>;
}

const noopShared = { value: 0 } as SharedValue<number>;

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  hidden: false,
  setHidden: () => {},
  scrollHidden: noopShared,
});

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const scrollHidden = useSharedValue(0);
  const value = useMemo(
    () => ({ hidden, setHidden, scrollHidden }),
    [hidden, scrollHidden],
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext);
}

export function useHideTabBar(hidden: boolean) {
  const { setHidden } = useTabBarVisibility();

  useEffect(() => {
    setHidden(hidden);
    return () => setHidden(false);
  }, [hidden, setHidden]);
}
