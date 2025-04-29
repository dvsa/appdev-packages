import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

type AcceptableDate = DateTime | string | Date | null;

/**
 * DateTime utility class for handling dates with UK timezone support
 */
export class DateTime {
	private instance!: dayjs.Dayjs;
	private static readonly UKLocalDateTimeFormat = "DD/MM/YYYY HH:mm:ss";
	private static readonly UKLocalDateFormat = "DD/MM/YYYY";
	private static readonly UK_TIMEZONE = "Europe/London";

	/**
	 * Creates a new DateTime instance
	 * @param sourceDateTime - Initial date/time (string, Date, or another DateTime)
	 * @param format - Optional format string for parsing string dates
	 */
	constructor(
		sourceDateTime?: AcceptableDate,
		format: string | undefined = undefined,
	) {
		// Set up dayjs plugins
		dayjs.extend(customParseFormat);
		dayjs.extend(timezone);
		dayjs.extend(utc);

		if (sourceDateTime === undefined || sourceDateTime === null) {
			// For current time, directly get the UK time but preserve the timezone
			this.instance = dayjs().tz(DateTime.UK_TIMEZONE);
		} else if (
			typeof sourceDateTime === "string" ||
			sourceDateTime instanceof Date
		) {
			// For string inputs, PRESERVE THE ORIGINAL TIME without timezone conversion
			// This is essential for test consistency
			if (format) {
				this.instance = dayjs(sourceDateTime, format);
			} else {
				this.instance = dayjs(sourceDateTime);
			}
		} else if (sourceDateTime instanceof DateTime) {
			// Clone a DateTime instance
			this.instance = sourceDateTime.instance.clone();
		} else {
			throw new Error("Invalid date input");
		}
	}

	/**
	 * Converts to a JavaScript Date object
	 * @returns Date object
	 */
	toDate(): Date {
		return this.instance.toDate();
	}

	/**
	 * Creates a new DateTime instance from a date source
	 * @param sourceDateTime - Source date/time
	 * @param format - Optional format string for parsing
	 * @returns New DateTime instance or null if source is null
	 */
	static at(
		sourceDateTime: AcceptableDate,
		format: string | undefined = undefined,
	): DateTime | null {
		if (!sourceDateTime) {
			return null;
		}
		return new DateTime(sourceDateTime, format);
	}

	/**
	 * Formats a date in UK local date time format (DD/MM/YYYY HH:mm:ss)
	 * @param sourceDateTime - Source date/time
	 * @returns Formatted string or null if source is null
	 */
	static StandardUkLocalDateTimeAdapter(
		sourceDateTime: AcceptableDate,
	): string | null {
		return (
			DateTime.at(sourceDateTime)?.format(DateTime.UKLocalDateTimeFormat) ||
			null
		);
	}

	/**
	 * Formats a date in UK local date format (DD/MM/YYYY)
	 * @param sourceDateTime - Source date/time
	 * @returns Formatted string or null if source is null
	 */
	static StandardUkLocalDateAdapter(
		sourceDateTime: AcceptableDate,
	): string | null {
		return (
			DateTime.at(sourceDateTime)?.format(DateTime.UKLocalDateFormat) || null
		);
	}

	/**
	 * Adds time to this DateTime instance (mutable operation)
	 * @param amount - Amount to add
	 * @param unit - Unit of time (day, month, year, etc.)
	 * @returns This instance for chaining
	 */
	add(amount: number, unit: dayjs.ManipulateType): DateTime {
		this.instance = this.instance.add(amount, unit);
		return this;
	}

	/**
	 * Subtracts time from this DateTime instance (mutable operation)
	 * @param amount - Amount to subtract
	 * @param unit - Unit of time (day, month, year, etc.)
	 * @returns This instance for chaining
	 */
	subtract(amount: number, unit: dayjs.ManipulateType): DateTime {
		this.instance = this.instance.subtract(amount, unit);
		return this;
	}

	/**
	 * Formats the date with a custom format string
	 * @param formatString - Format pattern
	 * @returns Formatted date string
	 */
	format(formatString: string): string {
		return this.instance.format(formatString);
	}

	/**
	 * Gets the day of week (0-6, Sunday is 0)
	 * @returns Day of week
	 */
	day(): number {
		return this.instance.day();
	}

	/**
	 * Sets the date to the start of a specified unit (mutable operation)
	 * @param unit - Unit of time (day, month, year, etc.)
	 * @returns This instance for chaining
	 */
	startOf(unit: dayjs.OpUnitType): DateTime {
		this.instance = this.instance.startOf(unit);
		return this;
	}

	/**
	 * Converts to string in UK date time format
	 * @returns Formatted date string
	 */
	toString(): string {
		return this.format(DateTime.UKLocalDateTimeFormat);
	}

	/**
	 * Gets ISO string representation
	 * @returns ISO format string
	 */
	toISOString(): string {
		return this.instance.toISOString();
	}

	/**
	 * Calculates the difference between dates
	 * @param targetDate - Target date to compare with
	 * @param unit - Unit for the difference calculation
	 * @param precise - Whether to return decimal result
	 * @returns Difference in specified units
	 */
	diff(
		targetDate: AcceptableDate,
		unit: dayjs.QUnitType,
		precise?: boolean,
	): number {
		const date = new DateTime(targetDate);
		return this.instance.diff(date.instance, unit, precise);
	}

	/**
	 * Calculates the difference in days
	 * @param targetDate - Target date to compare with
	 * @returns Difference in days
	 */
	daysDiff(targetDate: AcceptableDate): number {
		const date = new DateTime(targetDate);
		return this.instance
			.startOf("day")
			.diff(date.instance.startOf("day"), "day");
	}

	/**
	 * Calculates duration from this date to target
	 * @param targetDate - Target date
	 * @param unit - Unit for duration calculation
	 * @returns Duration in specified units
	 */
	compareDuration(targetDate: AcceptableDate, unit: dayjs.QUnitType): number {
		const date = new DateTime(targetDate);
		return date.instance.diff(this.instance, unit);
	}

	/**
	 * Checks if the date is valid
	 * @returns True if valid date
	 */
	isValid(): boolean {
		return this.instance.isValid();
	}

	/**
	 * Checks if this date is before the target date
	 * @param targetDate - Target date to compare with
	 * @returns True if this date is before target
	 */
	isBefore(targetDate: AcceptableDate): boolean {
		const date = new DateTime(targetDate);
		return this.instance.isBefore(date.instance);
	}

	/**
	 * Checks if this date is after the target date
	 * @param targetDate - Target date to compare with
	 * @returns True if this date is after target
	 */
	isAfter(targetDate: AcceptableDate): boolean {
		const date = new DateTime(targetDate);
		return this.instance.isAfter(date.instance);
	}

	/**
	 * Checks if this date is between start and end dates
	 * @param startDate - Start date of range
	 * @param endDate - End date of range
	 * @returns True if date is between start and end
	 */
	isBetween(startDate: AcceptableDate, endDate: AcceptableDate): boolean {
		const start = new DateTime(startDate);
		const end = new DateTime(endDate);
		return (
			this.instance.isAfter(start.instance) &&
			this.instance.isBefore(end.instance)
		);
	}

	/**
	 * Sets the timezone (mutable operation)
	 * @param tz - Timezone identifier
	 * @returns This instance for chaining
	 */
	setTimezone(tz: string): DateTime {
		this.instance = this.instance.tz(tz);
		return this;
	}

	/**
	 * Converts to UK timezone (mutable operation)
	 * @returns This instance for chaining
	 */
	toUKTime(): DateTime {
		this.instance = this.instance.tz(DateTime.UK_TIMEZONE);
		return this;
	}

	/**
	 * Gets the hour component
	 * @returns Hour (0-23)
	 */
	getHour(): number {
		return this.instance.hour();
	}

	/**
	 * Gets the minute component
	 * @returns Minute (0-59)
	 */
	getMinute(): number {
		return this.instance.minute();
	}

	/**
	 * Gets the second component
	 * @returns Second (0-59)
	 */
	getSecond(): number {
		return this.instance.second();
	}

	/**
	 * Creates a clone of this DateTime
	 * @returns New DateTime instance with the same date/time
	 */
	clone(): DateTime {
		return new DateTime(this);
	}

	/**
	 * Provides debug information about this DateTime
	 * @returns Object with diagnostic information
	 */
	debug(): object {
		return {
			formatted: this.format("DD/MM/YYYY HH:mm:ss"),
			isoString: this.toISOString(),
			hour: this.getHour(),
			utcOffset: this.instance.utcOffset(),
		};
	}
}
