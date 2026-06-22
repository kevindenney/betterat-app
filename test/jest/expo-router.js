/* global jest */

const router = {
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  navigate: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  setParams: jest.fn(),
};

module.exports = {
  Link: 'Link',
  Redirect: 'Redirect',
  Stack: 'Stack',
  Tabs: 'Tabs',
  router,
  useFocusEffect: jest.fn(),
  useGlobalSearchParams: jest.fn(() => ({})),
  useLocalSearchParams: jest.fn(() => ({})),
  useNavigation: jest.fn(() => router),
  usePathname: jest.fn(() => '/'),
  useRouter: jest.fn(() => router),
  useSegments: jest.fn(() => []),
};
