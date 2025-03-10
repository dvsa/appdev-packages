import { DateTime } from "../date-time";

jest.mock("dayjs", () => {
	const originalDayjs = jest.requireActual("dayjs");

	const mockDayjs = (...args: unknown[]) => originalDayjs(...args);

	Object.assign(mockDayjs, originalDayjs);

	mockDayjs.extend = (plugin: unknown) => originalDayjs.extend(plugin);

	return mockDayjs;
});

describe("DateTime", () => {
	let mockDate: Date;

	beforeEach(() => {
		mockDate = new Date(2023, 4, 15, 10, 30, 0); // Fixed date of May 15, 2023, 10:30:00
		jest.useFakeTimers();
		jest.setSystemTime(mockDate);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	describe("constructor", () => {
		it("should create a DateTime instance with current date when no parameters are provided", () => {
			const dateTime = new DateTime();
			expect(dateTime.toISOString()).toContain("2023-05-15");
		});

		it("should create a DateTime instance from string", () => {
			const dateTime = new DateTime("2023-01-01");
			expect(dateTime.format("YYYY-MM-DD")).toBe("2023-01-01");
		});

		it("should create a DateTime instance from string with custom format", () => {
			const dateTime = new DateTime("01/02/2023", "DD/MM/YYYY");
			expect(dateTime.format("YYYY-MM-DD")).toBe("2023-02-01");
		});

		it("should create a DateTime instance from Date object", () => {
			const date = new Date(2023, 0, 1);
			const dateTime = new DateTime(date);
			expect(dateTime.format("YYYY-MM-DD")).toBe("2023-01-01");
		});

		it("should create a DateTime instance from another DateTime object", () => {
			const originalDateTime = new DateTime("2023-01-01");
			const newDateTime = new DateTime(originalDateTime);
			expect(newDateTime.format("YYYY-MM-DD")).toBe("2023-01-01");
		});
	});

	describe("static methods", () => {
		describe("at", () => {
			it("should return null when sourceDateTime is null", () => {
				expect(DateTime.at(null)).toBeNull();
			});

			it("should return null when sourceDateTime is undefined", () => {
				expect(DateTime.at(undefined as unknown as null)).toBeNull();
			});

			it("should return a DateTime instance for valid input", () => {
				const result = DateTime.at("2023-01-01");
				expect(result).toBeInstanceOf(DateTime);
				expect(result?.format("YYYY-MM-DD")).toBe("2023-01-01");
			});

			it("should support custom format", () => {
				const result = DateTime.at("01/02/2023", "DD/MM/YYYY");
				expect(result?.format("YYYY-MM-DD")).toBe("2023-02-01");
			});
		});

		describe("StandardUkLocalDateTimeAdapter", () => {
			it("should return null when sourceDateTime is null", () => {
				expect(DateTime.StandardUkLocalDateTimeAdapter(null)).toBeNull();
			});

			it("should format date in UK local date time format", () => {
				const result = DateTime.StandardUkLocalDateTimeAdapter(
					"2023-05-15T10:30:00",
				);
				expect(result).toBe("15/05/2023 10:30:00");
			});
		});

		describe("StandardUkLocalDateAdapter", () => {
			it("should return null when sourceDateTime is null", () => {
				expect(DateTime.StandardUkLocalDateAdapter(null)).toBeNull();
			});

			it("should format date in UK local date format", () => {
				const result = DateTime.StandardUkLocalDateAdapter("2023-05-15");
				expect(result).toBe("15/05/2023");
			});
		});

		describe("today", () => {
			it("should return current date", () => {
				const today = DateTime.today();
				expect(today.getFullYear()).toBe(2023);
				// months are zero indexed
				expect(today.getMonth()).toBe(4); // May
				expect(today.getDate()).toBe(15);
			});
		});
	});

	describe("instance methods", () => {
		describe("add", () => {
			it("should add time to DateTime instance", () => {
				const dateTime = new DateTime("2023-01-01");
				const result = dateTime.add(1, "day");

				expect(result).toBe(dateTime);
				expect(dateTime.format("YYYY-MM-DD")).toBe("2023-01-02");
			});

			it("should support different units", () => {
				const dateTime = new DateTime("2023-01-01");
				dateTime.add(1, "month");
				expect(dateTime.format("YYYY-MM-DD")).toBe("2023-02-01");
			});
		});

		describe("subtract", () => {
			it("should subtract time from DateTime instance", () => {
				const dateTime = new DateTime("2023-01-02");
				const result = dateTime.subtract(1, "day");

				expect(result).toBe(dateTime); // Should return this for chaining
				expect(dateTime.format("YYYY-MM-DD")).toBe("2023-01-01");
			});

			it("should support different units", () => {
				const dateTime = new DateTime("2023-02-01");
				dateTime.subtract(1, "month");
				expect(dateTime.format("YYYY-MM-DD")).toBe("2023-01-01");
			});
		});

		describe("format", () => {
			it("should format date according to provided format string", () => {
				const dateTime = new DateTime("2023-05-15T10:30:00");
				expect(dateTime.format("YYYY-MM-DD")).toBe("2023-05-15");
				expect(dateTime.format("HH:mm")).toBe("10:30");
				expect(dateTime.format("DD/MM/YYYY")).toBe("15/05/2023");
			});
		});

		describe("day", () => {
			it("should return day of week", () => {
				// May 15, 2023 is a Monday (1)
				const dateTime = new DateTime("2023-05-15");
				expect(dateTime.day()).toBe(1);
			});
		});

		describe("toString", () => {
			it("should return string representation of date", () => {
				const dateTime = new DateTime("2023-05-15T10:30:00");
				expect(typeof dateTime.toString()).toBe("string");
				expect(dateTime.toString()).toContain("2023");
			});
		});

		describe("toISOString", () => {
			it("should return ISO string representation of date", () => {
				const dateTime = new DateTime("2023-05-15T10:30:00");
				expect(dateTime.toISOString()).toContain("2023-05-15T");
			});
		});

		describe("isAfter", () => {
			it("should return true when date is after target date", () => {
				const dateTime1 = new DateTime("2023-05-15");
				const dateTime2 = new DateTime("2023-05-14");
				expect(dateTime1.isAfter(dateTime2)).toBe(true);
			});

			it("should return false when date is before target date", () => {
				const dateTime1 = new DateTime("2023-05-14");
				const dateTime2 = new DateTime("2023-05-15");
				expect(dateTime1.isAfter(dateTime2)).toBe(false);
			});

			it("should accept various input types", () => {
				const dateTime = new DateTime("2023-05-15");
				expect(dateTime.isAfter("2023-05-14")).toBe(true);
				expect(dateTime.isAfter(new Date(2023, 4, 14))).toBe(true);
			});
		});

		describe("diff", () => {
			it("should calculate difference between dates in specified unit", () => {
				const dateTime1 = new DateTime("2023-05-15");
				const dateTime2 = new DateTime("2023-05-10");

				expect(dateTime1.diff(dateTime2, "day")).toBe(5);
				expect(dateTime1.diff(dateTime2, "hour")).toBe(120);
			});

			it("should support precise flag", () => {
				const dateTime1 = new DateTime("2023-05-15");
				const dateTime2 = new DateTime("2023-05-10");

				expect(dateTime1.diff(dateTime2, "day", true)).toBe(5);
			});
		});

		describe("daysDiff", () => {
			it("should calculate difference in days ignoring time portion", () => {
				const dateTime1 = new DateTime("2023-05-15T10:30:00");
				const dateTime2 = new DateTime("2023-05-10T15:45:00");

				expect(dateTime1.daysDiff(dateTime2)).toBe(5);
			});

			it("should handle same day with different times", () => {
				const dateTime1 = new DateTime("2023-05-15T10:30:00");
				const dateTime2 = new DateTime("2023-05-15T15:45:00");

				expect(dateTime1.daysDiff(dateTime2)).toBe(0);
			});
		});

		describe("compareDuration", () => {
			it("should calculate duration between dates from target perspective", () => {
				const dateTime1 = new DateTime("2023-05-10");
				const dateTime2 = new DateTime("2023-05-15");

				expect(dateTime1.compareDuration(dateTime2, "day")).toBe(5);
			});
		});

		describe("isBefore", () => {
			it("should return true when date is before target date", () => {
				const dateTime1 = new DateTime("2023-05-14");
				const dateTime2 = new DateTime("2023-05-15");
				expect(dateTime1.isBefore(dateTime2)).toBe(true);
			});

			it("should return false when date is after target date", () => {
				const dateTime1 = new DateTime("2023-05-15");
				const dateTime2 = new DateTime("2023-05-14");
				expect(dateTime1.isBefore(dateTime2)).toBe(false);
			});

			it("should accept various input types", () => {
				const dateTime = new DateTime("2023-05-14");
				expect(dateTime.isBefore("2023-05-15")).toBe(true);
				expect(dateTime.isBefore(new Date(2023, 4, 15))).toBe(true);
			});
		});
	});

	describe("integration tests", () => {
		it("should allow method chaining", () => {
			const dateTime = new DateTime("2023-01-01");
			const result = dateTime
				.add(1, "month")
				.add(5, "day")
				// subtract 2 hours here (i.e. 2023-02-06 00:00:00) results in going back to the previous day
				.subtract(2, "hour");

			expect(result).toBe(dateTime);
			expect(dateTime.format("YYYY-MM-DD")).toBe("2023-02-05");
		});

		it("should handle edge cases", () => {
			// Leap year
			const leapDateAdded = new DateTime("2024-02-28").add(1, "day");
			expect(leapDateAdded.format("YYYY-MM-DD")).toBe("2024-02-29");

			// Month crossing
			const monthEnd = new DateTime("2023-01-31").add(1, "day");
			expect(monthEnd.format("YYYY-MM-DD")).toBe("2023-02-01");

			// Year crossing
			const yearEnd = new DateTime("2023-12-31").add(1, "day");
			expect(yearEnd.format("YYYY-MM-DD")).toBe("2024-01-01");
		});
	});
});
