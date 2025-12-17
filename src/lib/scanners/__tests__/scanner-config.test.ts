import {
  SCANNER_CONFIGS,
  getScannerConfig,
  getIMAPConfig,
  getGmailAPIConfig,
  SCANNER_PRESETS,
} from "../scanner-config";

describe("Scanner Configuration", () => {
  describe("SCANNER_CONFIGS", () => {
    it("should have valid IMAP configuration", () => {
      expect(SCANNER_CONFIGS.imap).toEqual({
        maxMessages: 10000,
        mailbox: "[Gmail]/All Mail",
        batchSize: 1000,
        delayBetweenBatches: 100,
        usePersistence: true,
        scannerType: "imap",
      });
    });

    it("should have valid Gmail API configuration", () => {
      expect(SCANNER_CONFIGS.gmailApi).toEqual({
        maxMessages: 2000,
        query: "",
        batchSize: 50,
        delayBetweenBatches: 1000,
        usePersistence: true,
        scannerType: "gmail-api",
      });
    });
  });

  describe("getScannerConfig", () => {
    it("should return base config without overrides", () => {
      const config = getScannerConfig("imap");
      expect(config).toEqual(SCANNER_CONFIGS.imap);
    });

    it("should merge overrides with base config", () => {
      const config = getScannerConfig("imap", { maxMessages: 1000, batchSize: 500 });
      expect(config).toEqual({
        ...SCANNER_CONFIGS.imap,
        maxMessages: 1000,
        batchSize: 500,
      });
    });

    it("should work with Gmail API config", () => {
      const config = getScannerConfig("gmailApi", { maxMessages: 500 });
      expect(config).toEqual({
        ...SCANNER_CONFIGS.gmailApi,
        maxMessages: 500,
      });
    });
  });

  describe("getIMAPConfig", () => {
    it("should return IMAP config with overrides", () => {
      const config = getIMAPConfig({ maxMessages: 10000 });
      expect(config.scannerType).toBe("imap");
      expect(config.maxMessages).toBe(10000);
      expect(config.mailbox).toBe("[Gmail]/All Mail");
    });
  });

  describe("getGmailAPIConfig", () => {
    it("should return Gmail API config with overrides", () => {
      const config = getGmailAPIConfig({ query: "newer_than:1y" });
      expect(config.scannerType).toBe("gmail-api");
      expect(config.query).toBe("newer_than:1y");
      expect(config.maxMessages).toBe(2000);
    });
  });

  describe("SCANNER_PRESETS", () => {
    it("should have valid imapFast preset", () => {
      expect(SCANNER_PRESETS.imapFast).toEqual({
        ...SCANNER_CONFIGS.imap,
        maxMessages: 1000,
        batchSize: 100,
      });
    });

    it("should have valid imapThorough preset", () => {
      expect(SCANNER_PRESETS.imapThorough).toEqual({
        ...SCANNER_CONFIGS.imap,
        maxMessages: 100000,
        batchSize: 2000,
      });
    });

    it("should have valid gmailRecent preset", () => {
      expect(SCANNER_PRESETS.gmailRecent).toEqual({
        ...SCANNER_CONFIGS.gmailApi,
        maxMessages: 1000,
        query: "newer_than:30d",
      });
    });

    it("should have valid gmailFull preset", () => {
      expect(SCANNER_PRESETS.gmailFull).toEqual({
        ...SCANNER_CONFIGS.gmailApi,
        maxMessages: 2000,
      });
    });
  });

  describe("Configuration validation", () => {
    it("should maintain type safety for all configs", () => {
      const imapConfig = getIMAPConfig();
      const gmailConfig = getGmailAPIConfig();

      // Type checks
      expect(typeof imapConfig.maxMessages).toBe("number");
      expect(typeof imapConfig.batchSize).toBe("number");
      expect(typeof imapConfig.usePersistence).toBe("boolean");
      expect(imapConfig.scannerType).toBe("imap");

      expect(typeof gmailConfig.maxMessages).toBe("number");
      expect(typeof gmailConfig.batchSize).toBe("number");
      expect(typeof gmailConfig.usePersistence).toBe("boolean");
      expect(gmailConfig.scannerType).toBe("gmail-api");
      expect(gmailConfig.query).toBeDefined();
    });
  });
});
