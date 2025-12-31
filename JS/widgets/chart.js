import module from 'module';
import $ from '../jquery';
import page_loader from '../ajaxify';
import { getEffectiveTheme, onThemeChange } from '../core/theme';

import '../libs/jquery.flot';
import { L } from '../utils';
import { addEvent, removeEvent } from '../core/events';

let charts = [];

const CHART_THEME = {
	light: {
		axis:		'#dce2e5',
		line:		'#0e3c87',
		border:		'#c5d3e1',
		legend:		'#ffffff',
		
		line: {
			// standart colors
			blue:		'#0E3C87',
			green:		'#61a961',
			red:		'#993333',
			yellow:		'#FFA000',
			purple:		'#673ab7',
			grey:		'#617989',
			black:		'#323232',
		}
	},
	dark: {
		axis:		'#545454',
		line:		'#7cc3ff',
		border:		'#7c7f83',
		legend:		'#3e3f40',
		
		line: {
			// standart colors
			blue:		'#7cc3ff',
			green:		'#78d993',
			red:		'#ff8a66',
			yellow:		'#FFA000',
			purple:		'#b591eb',
			grey:		'#cccccc',
			black:		'#ffffff',
		}
	}
};

function setupTheme(options, series) {
	let theme = CHART_THEME[getEffectiveTheme()];
	options.grid.borderColor = theme.border;
	options.legend.backgroundColor = theme.legend;
	
	options.xaxis.color = theme.axis;
	options.xaxis.tickColor = theme.axis;
	options.yaxis.color = theme.axis;
	options.yaxis.tickColor = theme.axis;
	
	series.forEach((data) => {
		data.color = theme.line[data.colorKey];
	});
	
	if (options.xaxes) {
		options.xaxes.forEach((axis) => {
			axis.color = theme.axis;
			axis.tickColor = theme.axis;
		});
	}
	
	if (options.yaxes) {
		options.yaxes.forEach((axis) => {
			axis.color = theme.axis;
			axis.tickColor = theme.axis;
		});
	}
}

function updateCharts() {
	for (let i = 0; i < charts.length; i++) {
		let flot = charts[i];
		setupTheme(flot.getOptions(), flot.getData());
		flot.resize();
		flot.setupGrid();
		flot.draw();
	}
}

function setupChart(el) {
	el.removeClass('js-chart_new');
	
	let lines = el.data('lines');
	
	let series = lines.map((line) => {
		let data = line.data.map((v) => [new Date(v.date), v.value]); // временные костыли пока юзается flot
		return {
			label:		line.title,
			colorKey:	line.color || 'blue',
			data:		data,
		};
	});
	
	// let legend = $('<div class="pad_t_a">');
	// el.after(legend);
	
	let options = {
		grid: {
			borderWidth: 1,
		},
		legend: {
			show: true,
			//container: legend
		},
		series: {
			shadowSize: 3
		},
		xaxis: {
			mode: "time",
			timeformat: "%b %d",
			timeBase: "milliseconds",
			monthNames: [L("Янв"), L("Фев"), L("Мар"), L("Апр"), L("Май"), L("Июн"), L("Июл"), L("Авг"), L("Сен"), L("Окт"), L("Ноя"), L("Дек")]
		},
		yaxis: {
			minTickSize: 0.01,
			tickDecimals: 0
		}
	};
	
	setupTheme(options, series);
	
	charts.push($.plot(el, series, options));
}

onThemeChange(updateCharts);

module.on("componentpage", () => {
	addEvent(window, 'resize', updateCharts, true);
});

module.on("component", () => {
	let elements = document.getElementsByClassName('js-chart_new');
	for (let i = 0; i < elements.length; i++)
		setupChart($(elements[i]));
});

module.on("componentpagedone", () => {
	for (let i = 0; i < charts.length; i++) {
		let flot = charts[i];
		flot.shutdown();
	}
	charts = [];
	
	removeEvent(window, 'resize', updateCharts, true);
});
