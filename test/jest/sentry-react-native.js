/* global jest */

const scope = {
  setExtras: jest.fn(),
};

module.exports = {
  __esModule: true,
  captureException: jest.fn(),
  init: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn((callback) => callback(scope)),
};
