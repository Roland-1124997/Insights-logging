// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	modules: [...(process.env.NUXT_ENABLE_TESTS=== "true" ? ["@nuxt/test-utils/module"] : [])],
	ignore: ["**/tests/**"],

	runtimeConfig: {
		logging: {
			limit: 20,
			fail2ban: {
				window: 60 * 1000,
				duration: 10 * 60 * 1000,
			},
			include: [],
			exclude: ["/api/status", "/_", "/ping.txt", "/.well-known"],
		},
	},
});
