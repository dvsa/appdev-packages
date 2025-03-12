import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

type AcceptableDate = DateTime | string | Date | null;

export class DateTime {
	private instance!: dayjs.Dayjs;
	private static readonly UKLocalDateTimeFormat = "DD/MM/YYYY HH:mm:ss";
	private static readonly UKLocalDateFormat = "DD/MM/YYYY";

	constructor(
		sourceDateTime?: AcceptableDate,
		format: string | undefined = undefined,
	) {
		dayjs.extend(customParseFormat);

		if (sourceDateTime === undefined || sourceDateTime === null) {
			this.instance = dayjs();
		} else if (
			typeof sourceDateTime === "string" ||
			sourceDateTime instanceof Date
		) {
			this.instance = dayjs(sourceDateTime, format);
		} else {
			this.instance = dayjs(sourceDateTime.instance, format);
		}
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
		this.instance = this.instance.add(amount, unit);
		return this;
	}

	subtract(amount: number, unit: dayjs.ManipulateType): DateTime {
		this.instance = this.instance.subtract(amount, unit);
		return this;
	}

	format(formatString: string): string {
		return this.instance.format(formatString);
	}

	day(): number {
		return this.instance.day();
	}

	toString(): string {
		return this.instance.toString();
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
		return dayjs().toDate();
	}
}
