module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testPathIgnorePatterns: ["/node_modules/"],
	testMatch: ["**/?(*.)+(spec|test).js", "**/?(*.)+(spec|test).ts"],
	verbose: true,
	transform: {
		"^.+\\.ts$": "ts-jest",
	},
	moduleFileExtensions: ["ts", "js", "json", "node"],
};
