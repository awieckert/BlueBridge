export const Config = {
  // Update these to match your BlueBridge-Relay server
  API_BASE_URL: 'http://192.168.1.50:5067',
  API_ENDPOINT: '/api/messages/send',
  SIGNALR_HUB_URL: 'http://192.168.1.50:5067/hubs/messages',

  // Queue retry configuration
  MAX_RETRY_ATTEMPTS: 5,
  RETRY_DELAYS: [1000, 2000, 4000, 8000, 16000], // ms

  // UI configuration
  MESSAGE_BATCH_SIZE: 50, // Pagination size
  MAX_MESSAGE_LENGTH: 1000,
};
