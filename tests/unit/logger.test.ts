import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestURL, getQuery, useRuntimeConfig, createEvent } from "../setup";
import { useCreateRequestLogger } from "../../server/utils/logger/index";


describe("useCreateRequestLogger", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		const config = useRuntimeConfig();
		config.logging.include = [];
		config.logging.exclude = [];
		config.production = true;

		useRuntimeConfig.mockReturnValue(config);
		getRequestURL.mockReturnValue({ pathname: "/api/users" });
		getQuery.mockReturnValue({ page: "1" });

		vi.stubGlobal("useRuntimeConfig", () => useRuntimeConfig());

		vi.spyOn(performance, "now").mockReturnValue(125);
		vi.spyOn(console, "log").mockImplementation(() => undefined);
	});

	describe("happy paths", () => {
		it("should log request metadata and details when production logging is enabled", async () => {
			// arrange & act
			const logger = await useCreateRequestLogger(createEvent());
			logger.set({ userId: 42 }).finish();

			// assert
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("GET /api/users"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("requestId"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("query"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("userId"));
		});

		it("should log errors and use the default method when request values are missing", async () => {
			// arrange
			getQuery.mockReturnValue({});
			const event = createEvent("");
			
			event.context.requestId = undefined;
			event.context.requestIp = undefined;
			event.node.req.method = undefined;
			event.node.res.statusCode = 500;

			// act
			const logger = await useCreateRequestLogger(event);
			logger.set({ first: "value" }).set({ second: "value" }).finish();

			// assert
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("500"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("GET /api/users"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("├─"));
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("└─"));
		});

		it("should log only included routes and support wildcard route patterns", async () => {
			// arrange
			useRuntimeConfig().logging.include = ["/api/**"];

			// act
			const logger = await useCreateRequestLogger(createEvent());
			logger.finish();

			// assert
			expect(console.log).toHaveBeenCalledOnce();
		});

		it("should skip excluded routes", async () => {
			// arrange
			useRuntimeConfig().logging.exclude = ["/api"];
			
			// act
			const logger = await useCreateRequestLogger(createEvent());
			logger.finish();

			// assert
			expect(console.log).not.toHaveBeenCalled();
		});

		it("should skip logging outside production", async () => {
			// arrange
			useRuntimeConfig().production = false;

			// act
			const logger = await useCreateRequestLogger(createEvent());
			logger.finish();

			// assert
			expect(console.log).not.toHaveBeenCalled();
		});

		it("should skip routes that do not match the include configuration", async () => {
			// arrange
			useRuntimeConfig().logging.include = ["/admin"];

			// act
			const logger = await useCreateRequestLogger(createEvent());
			logger.finish();

			// assert
			expect(console.log).not.toHaveBeenCalled();
		});
	});

	describe("unhappy paths", () => {
		it("should not throw when formatting the request fails", async () => {
			
			// arrange
			getRequestURL.mockImplementation(() => {
				throw new Error("invalid request");
			});

			// act
			const logger = await useCreateRequestLogger(createEvent());

			// assert
			expect(() => logger.finish()).not.toThrow();
		});

		it("should add an error detail when request logger metadata cannot be serialized", async () => {
			
			// arrange
			const circularQuery: Record<string, unknown> = {};
			circularQuery.self = circularQuery;
			getQuery.mockReturnValue(circularQuery);

			// act
			const logger = await useCreateRequestLogger(createEvent());
			logger.finish();

			// assert
			expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Failed to set request logger details"));
		});
	});
});
