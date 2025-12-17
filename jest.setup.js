import "@testing-library/jest-dom";

// Mock environment variables
process.env.NODE_ENV = "test";

// Polyfill for Node.js environment in Jest
if (typeof globalThis !== "undefined" && !globalThis.ReadableStream) {
  globalThis.ReadableStream = class ReadableStream {};
}

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock Firebase/Firestore
jest.mock("./src/lib/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({
          exists: false,
          data: () => null,
        }),
      })),
    })),
  })),
  loadIMAPSettings: jest.fn().mockResolvedValue({
    mailbox: "[Gmail]/All Mail",
    maxMessages: 10000,
  }),
  saveIMAPProgress: jest.fn(),
}));

// Mock crypto module
jest.mock("./src/lib/crypto", () => ({
  PasswordEncryption: {
    decrypt: jest.fn().mockReturnValue("decrypted-password"),
    encrypt: jest.fn().mockReturnValue("encrypted-password"),
  },
}));

// Mock Google APIs
jest.mock("googleapis", () => ({
  google: {
    gmail: jest.fn(() => ({
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
        },
      },
    })),
    oauth2: jest.fn(() => ({
      userinfo: {
        get: jest.fn(),
      },
    })),
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
        getAccessToken: jest.fn().mockResolvedValue({ token: "mock-token" }),
        refreshAccessToken: jest.fn().mockResolvedValue({ tokens: { access_token: "mock-token" } }),
      })),
    },
  },
}));

// Mock external dependencies
jest.mock("imapflow", () => ({
  ImapFlow: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    mailboxOpen: jest.fn().mockResolvedValue(undefined),
    status: jest.fn().mockResolvedValue({ messages: 100 }),
    fetch: jest.fn().mockImplementation(async function* () {
      yield {
        envelope: {
          from: [{ address: "sender@example.com" }],
          to: [{ address: "recipient@example.com" }],
        },
      };
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Global test utilities
global.testUtils = {
  waitFor: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  createMockEmail: (overrides = {}) => ({
    id: "123",
    threadId: "thread123",
    labelIds: ["INBOX"],
    snippet: "Test email snippet",
    payload: {
      headers: [
        { name: "From", value: "sender@example.com" },
        { name: "To", value: "recipient@example.com" },
        { name: "Subject", value: "Test Subject" },
      ],
    },
    ...overrides,
  }),

  createMockGmailClient: () => ({
    users: {
      messages: {
        list: jest.fn().mockResolvedValue({
          data: {
            messages: [{ id: "msg1" }, { id: "msg2" }],
            nextPageToken: undefined,
          },
        }),
        get: jest.fn().mockResolvedValue({
          data: {
            payload: {
              headers: [
                { name: "From", value: "sender@example.com" },
                { name: "To", value: "recipient@example.com" },
              ],
            },
          },
        }),
      },
    },
  }),

  createMockIMAPConnection: () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    mailboxOpen: jest.fn().mockResolvedValue(undefined),
    status: jest.fn().mockResolvedValue({ messages: 100 }),
    fetch: jest.fn().mockImplementation(async function* () {
      yield {
        envelope: {
          from: [{ address: "sender@example.com" }],
          to: [{ address: "recipient@example.com" }],
        },
      };
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  }),
};
