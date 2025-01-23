module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testPathIgnorePatterns: ["/node_modules/"],
	setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
	testTimeout: 60000,
	testMatch: ["**/?(*.)+(spec|test).js", "**/?(*.)+(spec|test).ts"],
	verbose: true,
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
	moduleFileExtensions: ["ts", "js", "json", "node"],
};
