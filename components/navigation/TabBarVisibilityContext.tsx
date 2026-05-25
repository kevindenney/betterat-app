import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface TabBarVisibilityContextValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue>({
  hidden: false,
  setHidden: () => {},
});

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const value = useMemo(() => ({ hidden, setHidden }), [hidden]);

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
