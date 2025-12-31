import module from 'module';
import $ from '../jquery';
import Spaces from '../spacesLib';
import DdMenu from '../dd_menu';

import '../form_controls';
import { L } from '../utils';

import dayjs from 'dayjs';

const WEEK_DAYS = [L('Пн'), L('Вт'), L('Ср'), L('Чт'), L('Пт'), L('Сб'), L('Вс')];
const WEEK_NUM = [6, 0, 1, 2, 3, 4, 5];
const MONTHS = [
	L('Январь'), L('Февраль'), L('Март'),
	L('Апрель'), L('Май'), L('Июнь'),
	L('Июль'), L('Август'), L('Сентябрь'),
	L('Октябрь'), L('Ноябрь'), L('Декабрь')
];
const MONTHS_LABELS = [
	L('января'), L('февраля'), L('марта'),
	L('апреля'), L('мая'), L('июня'),
	L('июля'), L('августа'), L('сентября'),
	L('октября'), L('ноября'), L('декабря')
];

const tpl = {
	cell(data, selected, colored) {
		const classes = `${selected ? ' b' : ''}${colored ? ' blue' : ''}`;
		return `
			<div class="${classes}">
				<div class="fix"></div>
				<div>${data}</div>
			</div>
		`;
	},

	pagination(data) {
		return `
			<div class="pgn-wrapper">
				<div class="pgn">
					<table class="table__wrap pgn__table">
						<tr>
							<td class="table__cell" width="35%">
								<button type="submit"
									class="js-calendar_next pgn__button pgn__link_prev pgn__link_hover ${!data.hasPrev ? 'pgn__link_disabled' : ''}"
									${!data.hasPrev ? 'disabled="disabled"' : ''} data-dir="-1"
								>
									<span class="ico ico_arr_left"></span> ${data.prev}
								</button>
							</td>
							<td class="table__cell" style="cursor: pointer;">
								<div class="js-calendar_toggle pgn__counter pgn__range pgn__link_hover">${data.current}</div>
							</td>
							<td class="table__cell table__cell_last" width="35%">
								<button type="submit"
									class="js-calendar_next pgn__button pgn__link_next pgn__link_hover ${!data.hasNext ? 'pgn__link_disabled' : ''}"
									${!data.hasNext ? 'disabled="disabled"' : ''} data-dir="1"
								>
									${data.next} <span class="ico ico_arr_right"></span>
								</button>
							</td>
						</tr>
					</table>
				</div>
			</div>
		`;
	},

	monthList(data) {
		let html = `
			<div class="widgets-group dropdown-menu wbg">
				<table class="table__wrap t_center"><tr>
		`;

		MONTHS.forEach((label, index) => {
			const monthStart = data.date.startOf('month').month(index);

			const isSelected = data.value.isSame(monthStart, 'month');
			const isDisabled =
				(data.min && monthStart.isBefore(dayjs(data.min), 'month')) ||
				(data.max && monthStart.isAfter(dayjs(data.max), 'month'));

			html += `
				<td
					class="js-calendar_select list-link list-link_last list-link-darkblue
						${isDisabled ? ' user__tools-link_disabled' : ''}
						${isSelected ? ' clicked' : ''}"
					${isDisabled ? 'data-disabled="1"' : ''}
					data-value="${index}"
				>${label}</td>
			`;

			if (index % 2 !== 0) html += '</tr><tr>';
		});

		html += '</tr></table>';

		const nextYear = data.date.year() + 1;
		const prevYear = data.date.year() - 1;

		html += tpl.pagination({
			hasPrev: !data.min || data.min.year() <= prevYear,
			prev: prevYear,
			current: data.date.year(),
			hasNext: !data.max || data.max.year() >= nextYear,
			next: nextYear
		});

		html += '</div>';
		return html;
	},

	datepicker(data) {
		let html = '';

		let monthStart = data.date.startOf('month');
		let dayOfWeek = WEEK_NUM[monthStart.day()];

		html += `
			<div class="widgets-group dropdown-menu wbg">
				<div class="calendar-head">
					<table class="table__wrap calendar">
						<tr>
		`;

		WEEK_DAYS.forEach(label => {
			html += `<th>${tpl.cell(label)}</th>`;
		});

		html += `
						</tr>
					</table>
				</div>
				<table class="table__wrap calendar"><tr>
		`;

		for (let i = 0; i < dayOfWeek; i++) html += '<td></td>';

		const now = dayjs();

		while (monthStart.month() === data.date.month()) {
			const day = monthStart.date();
			dayOfWeek = WEEK_NUM[monthStart.day()];

			if (!dayOfWeek && day > 1) html += '</tr><tr>';

			const isCurrent = now.isSame(monthStart, 'day');
			const isSelected = data.value.isSame(monthStart, 'day');
			const isDisabled =
				(data.min && monthStart.isBefore(dayjs(data.min), 'day')) ||
				(data.max && monthStart.isAfter(dayjs(data.max), 'day'));

			html += `
				<td
					class="list-link list-link_last js-calendar_select
						${isSelected ? ' clicked' : ''}
						${isDisabled ? ' user__tools-link_disabled' : ''}"
					${isDisabled ? 'data-disabled="1"' : ''}
					data-value="${day}"
				>
					${tpl.cell(day, isCurrent, isCurrent && !isSelected && !isDisabled)}
				</td>
			`;

			monthStart = monthStart.add(1, 'day');
		}

		for (let i = dayOfWeek; i < 6; i++) html += '<td></td>';

		html += '</tr></table>';

		const prevMonth = data.date.subtract(1, 'month');
		const nextMonth = data.date.add(1, 'month');

		const isPrevDisabled = data.min && prevMonth.isBefore(dayjs(data.min), 'month');
		const isNextDisabled = data.max && nextMonth.isAfter(dayjs(data.max), 'month');

		html += tpl.pagination({
			hasPrev: !isPrevDisabled,
			prev: MONTHS[prevMonth.month()],
			current: `${MONTHS[data.date.month()]} ${data.date.year()}`,
			hasNext: !isNextDisabled,
			next: MONTHS[nextMonth.month()]
		});

		html += '</div>';

		return html;
	}
};

function getSelectedDate(root) {
	const form = root.parents('.js-date_selector');
	const yearInput = form.find('.js-date_year');
	const monthInput = form.find('.js-date_month');
	const dayInput = form.find('.js-date_day');

	let resultDate;
	if (!+yearInput.val() && !+monthInput.val() && !+dayInput.val()) {
		resultDate = dayjs().startOf('day');
	} else {
		resultDate = dayjs()
			.year(+yearInput.val())
			.month(+monthInput.val() - 1)
			.date(+dayInput.val())
			.startOf('day');
	}

	return clampDateRange(root, resultDate);
}

function setSelectedDate(root, date) {
	const form = root.parents('.js-date_selector');
	const yearInput = form.find('.js-date_year');
	const monthInput = form.find('.js-date_month');
	const dayInput = form.find('.js-date_day');

	let resultDate = date.startOf('day');
	resultDate = clampDateRange(root, resultDate);

	yearInput.val(resultDate.year());
	monthInput.val(resultDate.month() + 1);
	dayInput.val(resultDate.date());

	form.find('.js-date_label')
		.text(`${resultDate.date()} ${MONTHS_LABELS[resultDate.month()]} ${resultDate.year()}`);

	return resultDate;
}

function updateCalendar(root) {
	const minDate = root.data('min')
		? dayjs(root.data('min')).startOf('day')
		: undefined;

	const maxDate = root.data('max')
		? dayjs(root.data('max')).endOf('day')
		: undefined;

	if (root.data('mode')) {
		root.html(
			tpl.monthList({
				date: root.data('date'),
				value: getSelectedDate(root),
				min: minDate,
				max: maxDate
			})
		);
	} else {
		root.html(
			tpl.datepicker({
				date: root.data('date'),
				value: getSelectedDate(root),
				min: minDate,
				max: maxDate
			})
		);
	}
}

function clampDateRange(root, date) {
	const minDate = root.data('min') ? dayjs(root.data('min')).startOf('day') : undefined;
	const maxDate = root.data('max') ? dayjs(root.data('max')).endOf('day') : undefined;
	let result = date.startOf('day');
	if (minDate && result.isBefore(minDate))
		result = minDate;
	if (maxDate && result.isAfter(maxDate))
		result = maxDate;
	return result;
}

module.on('componentpage', () => {
	$('#main').on('dd_menu_open', '.js-date_picker', function () {
		const root = $(this);

		root.data('date', getSelectedDate(root));
		Spaces.view.setInputError(root, false);

		if (!root.data('inited')) {
			root.data('inited', true);

			root.on('click', '.js-calendar_next', function (e) {
				e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

				const btn = $(this);
				if (btn.attr('disabled')) return;

				const date = root.data('date');
				const direction = +btn.data('dir');

				if (root.data('mode')) {
					root.data('date', date.add(direction, 'year'));
				} else {
					root.data('date', date.add(direction, 'month'));
				}

				updateCalendar(root);
			})

			.on('click', '.js-calendar_toggle', function (e) {
				e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
				root.data('mode', !root.data('mode'));
				updateCalendar(root);
			})

			.on('click', '.js-calendar_select', function (e) {
				e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

				const btn = $(this);
				if (btn.data('disabled')) return;

				const val = +btn.data('value');

				if (root.data('mode')) {
					root.data('mode', false);
					root.data('date', root.data('date').month(val));
					updateCalendar(root);
				} else {
					root.data('date', root.data('date').date(val));
					setSelectedDate(root, root.data('date'));
					DdMenu.close();
				}
			});
		}

		updateCalendar(root);
	});
});
