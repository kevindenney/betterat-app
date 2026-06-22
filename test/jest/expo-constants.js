const constants = {
  expoConfig: {
    extra: {
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'test-anon-key',
    },
  },
  manifest2: {
    extra: {
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'test-anon-key',
    },
  },
};

module.exports = {
  __esModule: true,
  default: constants,
  ...constants,
};
