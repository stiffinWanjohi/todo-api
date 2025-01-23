import { config } from "dotenv";

config({ path: ".env.test" });

process.env.KAFKAJS_NO_PARTITIONER_WARNING = "1";
process.env.NODE_ENV === "test";

// Clear all mocks between tests
afterEach(() => {
	jest.clearAllMocks();
});
