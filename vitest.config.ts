// https://vitest.dev/guide/coverage
// https://nuxt.com/docs/4.x/getting-started/testing

const nuxtProjects = process.env.NUXT_ENABLE_TESTS === "true"
	? [await (await import("@nuxt/test-utils/config")).defineVitestProject({
			test: {
				name: "nuxt",
				include: ["tests/nuxt/*.{test,spec}.ts"],
				environment: "nuxt",
			},
		})]
	: [];

export default {
	test: {
		coverage: {
			reportsDirectory: "./tests/coverage",
			exclude: ["**/tests/**", "**/server/db/**", "**/server/utils/database/**"],
			reporter: ["text", "html", "clover", "json-summary", "json"],
			reportOnFailure: true,

			thresholds: {
				lines: 80,
				branches: 80,
				functions: 80,
				statements: 80,
			},
		},
		projects: [
			{
				test: {
					name: "unit",
					include: ["tests/unit/*.{test,spec}.ts"],
					environment: "node",
				},
			},
			{
				test: {
					name: "integration",
					include: ["tests/integration/*.{test,spec}.ts"],
					environment: "node",
				},
			},
			{
				test: {
					name: "e2e",
					include: ["tests/e2e/*.{test,spec}.ts"],
					environment: "node",
				},
			},
			...nuxtProjects,
		],
	},
};
