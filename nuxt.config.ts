// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	modules: ["@nuxt/test-utils/module"],

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
