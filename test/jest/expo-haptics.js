/* global jest */

module.exports = {
  ImpactFeedbackStyle: {Medium: 'Medium'},
  NotificationFeedbackType: {Success: 'Success'},
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
};
