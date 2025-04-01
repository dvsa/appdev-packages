import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

type AcceptableDate = DateTime | string | Date | null;

export class DateTime {
	private instance!: dayjs.Dayjs;
	private static readonly UKLocalDateTimeFormat = "DD/MM/YYYY HH:mm:ss";
	private static readonly UKLocalDateFormat = "DD/MM/YYYY";
	private static readonly UK_TIMEZONE = "Europe/London";

	constructor(
		sourceDateTime?: AcceptableDate,
		format: string | undefined = undefined,
	) {
		dayjs.extend(customParseFormat);
		dayjs.extend(timezone);
		dayjs.extend(utc);

		if (sourceDateTime === undefined || sourceDateTime === null) {
			this.instance = dayjs().tz(DateTime.UK_TIMEZONE);
		} else if (
			typeof sourceDateTime === "string" ||
			sourceDateTime instanceof Date
		) {
			if (format) {
				this.instance = dayjs.tz(sourceDateTime, format, DateTime.UK_TIMEZONE);
			} else {
				this.instance = dayjs.tz(sourceDateTime, DateTime.UK_TIMEZONE);
			}
		} else {
			this.instance = dayjs(sourceDateTime.toDate()).tz(DateTime.UK_TIMEZONE);
		}
	}

	toDate(): Date {
		return this.instance.toDate();
	}

	static at(
		sourceDateTime: AcceptableDate,
		format: string | undefined = undefined,
	): DateTime | null {
		if (!sourceDateTime) {
			return null;
		}
		return new DateTime(sourceDateTime, format);
	}

	static StandardUkLocalDateTimeAdapter(
		sourceDateTime: AcceptableDate,
	): string | null {
		return (
			DateTime.at(sourceDateTime)?.format(DateTime.UKLocalDateTimeFormat) ||
			null
		);
	}

	static StandardUkLocalDateAdapter(
		sourceDateTime: AcceptableDate,
	): string | null {
		return (
			DateTime.at(sourceDateTime)?.format(DateTime.UKLocalDateFormat) || null
		);
	}

	add(amount: number, unit: dayjs.ManipulateType): DateTime {
		const result = new DateTime();
		result.instance = this.instance.add(amount, unit);
		return result;
	}

	subtract(amount: number, unit: dayjs.ManipulateType): DateTime {
		const result = new DateTime();
		result.instance = this.instance.subtract(amount, unit);
		return result;
	}

	format(formatString: string): string {
		return this.instance.format(formatString);
	}

	day(): number {
		return this.instance.day();
	}

	toString(): string {
		return this.format(DateTime.UKLocalDateTimeFormat);
	}

	toISOString(): string {
		return this.instance.toISOString();
	}

	diff(
		targetDate: AcceptableDate,
		unit: dayjs.QUnitType,
		precise?: boolean,
	): number {
		const date = new DateTime(targetDate);
		return this.instance.diff(date.instance, unit, precise);
	}

	daysDiff(targetDate: AcceptableDate): number {
		const date = new DateTime(targetDate);
		return this.instance
			.startOf("day")
			.diff(date.instance.startOf("day"), "day");
	}

	compareDuration(targetDate: AcceptableDate, unit: dayjs.QUnitType): number {
		const date = new DateTime(targetDate);
		return date.instance.diff(this.instance, unit);
	}

	isValid(): boolean {
		return this.instance.isValid();
	}

	isBefore(targetDate: AcceptableDate): boolean {
		const date = new DateTime(targetDate);
		return this.instance.isBefore(date.instance);
	}

	isAfter(targetDate: AcceptableDate): boolean {
		const date = new DateTime(targetDate);
		return this.instance.isAfter(date.instance);
	}

	isBetween(startDate: AcceptableDate, endDate: AcceptableDate): boolean {
		const start = new DateTime(startDate);
		const end = new DateTime(endDate);
		return (
			this.instance.isAfter(start.instance) &&
			this.instance.isBefore(end.instance)
		);
	}

	static today(): Date {
		return dayjs().tz(DateTime.UK_TIMEZONE).startOf("day").toDate();
	}

	setTimezone(tz: string): DateTime {
		const result = new DateTime();
		result.instance = this.instance.tz(tz);
		return result;
	}

	toUKTime(): DateTime {
		const result = new DateTime();
		result.instance = this.instance.tz(DateTime.UK_TIMEZONE);
		return result;
	}

	getHour(): number {
		return this.instance.hour();
	}

	getMinute(): number {
		return this.instance.minute();
	}

	getSecond(): number {
		return this.instance.second();
	}
}
