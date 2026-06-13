const mockGetChannels = jest.fn();
const mockRemoveChannel = jest.fn();
const mockChannelFactory = jest.fn();

type StatusHandler = (status: string) => void;
const statusHandlers = new Map<string, StatusHandler>();

jest.mock('../supabase', () => ({
  supabase: {
    getChannels: (...args: unknown[]) => mockGetChannels(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
    channel: (...args: unknown[]) => mockChannelFactory(...args),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { realtimeService } = require('../RealtimeService');

const createMockChannel = (name: string) => {
  const channel = {
    topic: `realtime:${name}`,
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn((statusCb?: StatusHandler) => {
      if (statusCb) {
        statusHandlers.set(name, statusCb);
      }
      return channel;
    }),
  };
  return channel;
};

describe('RealtimeService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    statusHandlers.clear();
    mockGetChannels.mockReset();
    mockRemoveChannel.mockReset();
    mockChannelFactory.mockReset();
    mockGetChannels.mockReturnValue([]);
    mockRemoveChannel.mockResolvedValue(undefined);
    mockChannelFactory.mockImplementation((name: string) => createMockChannel(name));
  });

  afterEach(() => {
    void realtimeService.cleanup();
    jest.useRealTimers();
  });

  it('recreates a channel when same name is subscribed with different config signature', async () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    realtimeService.subscribe('race-stream:user-1', { table: 'regattas' }, cb1);
    realtimeService.subscribe(
      'race-stream:user-1',
      { table: 'regattas', filter: 'created_by=eq.user-1' },
      cb2
    );

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);

    await realtimeService.cleanup();
  });

  it('schedules only one reconnect timer when repeated channel errors occur', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    realtimeService.subscribe('live-races:user-1', { table: 'regattas' }, jest.fn());
    const statusCb = statusHandlers.get('live-races:user-1');
    expect(statusCb).toBeDefined();

    statusCb?.('CHANNEL_ERROR');
    statusCb?.('TIMED_OUT');

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(realtimeService.getConnectionStatus()).toBe('reconnecting');

    await realtimeService.cleanup();
  });

  it('treats CLOSED as reconnecting when active channels remain', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    realtimeService.subscribe('live-races:user-2', { table: 'regattas' }, jest.fn());
    const statusCb = statusHandlers.get('live-races:user-2');
    expect(statusCb).toBeDefined();

    statusCb?.('CLOSED');

    expect(realtimeService.getConnectionStatus()).toBe('reconnecting');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    await realtimeService.cleanup();
  });

  it('returns to disconnected when the last channel is unsubscribed', async () => {
    const callback = jest.fn();
    realtimeService.subscribe('live-races:user-3', { table: 'regattas' }, callback);

    expect(realtimeService.getConnectionStatus()).toBe('disconnected');
    statusHandlers.get('live-races:user-3')?.('SUBSCRIBED');
    expect(realtimeService.getConnectionStatus()).toBe('connected');

    await realtimeService.unsubscribe('live-races:user-3', callback);

    expect(realtimeService.getConnectionStatus()).toBe('disconnected');
  });

  it('notifies and removes per-subscription status callbacks', async () => {
    const callback = jest.fn();
    const statusCallback = jest.fn();

    realtimeService.subscribe(
      'org-memberships:user-1',
      {
        table: 'organization_memberships',
        filter: 'user_id=eq.user-1',
        onStatus: statusCallback,
      },
      callback
    );

    statusHandlers.get('org-memberships:user-1')?.('SUBSCRIBED');
    expect(statusCallback).toHaveBeenCalledWith('SUBSCRIBED');

    await realtimeService.unsubscribe('org-memberships:user-1', callback, statusCallback);

    statusHandlers.get('org-memberships:user-1')?.('TIMED_OUT');
    expect(statusCallback).toHaveBeenCalledTimes(1);
  });

  it('allows scheduling a new reconnect after previous timer fires', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    realtimeService.subscribe('live-races:user-4', { table: 'regattas' }, jest.fn());
    const statusCb = statusHandlers.get('live-races:user-4');
    expect(statusCb).toBeDefined();

    statusCb?.('CHANNEL_ERROR');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);

    jest.runOnlyPendingTimers();

    statusCb?.('TIMED_OUT');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
  });
});
