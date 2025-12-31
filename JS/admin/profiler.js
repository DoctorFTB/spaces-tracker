import module from 'module';
import Spaces from '../spacesLib';
import $ from '../jquery';

let current_sort = 'real_time';
let current_order = 'DESC';

module.on("componentpage", () => {
	toggleFullscreenMode(true);
	
	loadCheckpoints($('<div>'), $('#telemetry_checkpoints'), 0, 0, false);
	loadCheckpoints($('<div>'), $('#telemetry_checkpoints_flat'), 0, 0, true);
	
	$('#telemetry').on('click', '.js-expand', function (e) {
		e.preventDefault();
		let el = $(this);
		let parent = el.parents('.js-checkpoint').first().find('.js-checkpoints_list');
		loadCheckpoints(el, parent, el.data('hcid'), el.data('depth'), el.data('flat'));
	}).on('click', '.js-checkpoints_sort', function (e) {
		e.preventDefault();
		
		let el = $(this);
		if (el.data('sort') != current_sort) {
			current_sort = el.data('sort');
			current_order = 'DESC';
		} else {
			current_order = current_order == 'DESC' ? 'ASC' : 'DESC';
		}
		
		updateSort();
	});
});

module.on("componentpagedone", () => {
	toggleFullscreenMode(false);
});

function toggleFullscreenMode(enable) {
	if (enable) {
		$('#page_sidebar').css("display", "none");
		$('#rightbar').css("display", "none");
		$('#wrap_all').css('max-width', '100%');
	} else {
		$('#page_sidebar').css("display", "");
		$('#rightbar').css("display", "");
		$('#wrap_all').css('max-width', "");
	}
}

function loadCheckpoints(el, parent, hcid, depth, flat) {
	if (el.data('disabled'))
		return;
	
	if (el.data('expanded')) {
		parent.hide();
		el.find('.js-icon').text('+');
		el.data('expanded', false);
		return;
	} else if (el.data('loaded')) {
		parent.show();
		el.find('.js-icon').text('-');
		el.data('expanded', true);
		return;
	}
	
	if (parent.data('busy'))
		return;
	
	parent.data('busy', true);
	
	el.find('.js-icon').addClass('checkpoint-expand_loading').removeClass('checkpoint-expand_err');
	
	let onFail = () => {
		el.find('.js-icon').removeClass('checkpoint-expand_loading').addClass('checkpoint-expand_err');
		parent.data('busy', false);
	};
	
	Spaces.api("system_prof.getCheckpoints", {
		Hcid: hcid,
		Flat: flat ? 1 : 0,
		From: $('#telemetry').data('from'),
		To: $('#telemetry').data('to'),
	}, (res) => {
		if (res.code != 0) {
			onFail();
			return;
		}
		
		el.find('.js-icon').removeClass('checkpoint-expand_loading').text('-');
		el.data('loaded', true);
		el.data('expanded', true);
		
		for (var checkpoint of res.data)
			renderCheckPoint(parent, checkpoint, depth + 1, flat);
		
		doCheckpointsSort(parent);
	}, {
		onError(err) {
			onFail();
		}
	});
}

function renderCheckPoint(parent, checkpoint, depth, flat) {
	let color = 255 - (depth - 1) * 10;
	let plus = checkpoint.empty ? '&nbsp;' : '+';
	
	parent.append(`
		<div
			class="checkpoint js-checkpoint" style="background:rgb(${color}, ${color}, ${color})"
			data-cnt="${+checkpoint.cnt}"
			data-cnt_pct="${+checkpoint.cnt_pct}"
			data-real_time="${+checkpoint.real_time}"
			data-real_time_pct="${+checkpoint.real_time_pct}"
			data-real_time_avg="${+checkpoint.real_time_avg}"
		>
			<div class="checkpoint-header js-expand"
					data-flat="${flat ? 1 : 0}" data-hcid="${checkpoint.hcid}" data-depth="${depth}" data-disabled="${+checkpoint.empty}">
				<div class="checkpoint-expand js-icon">${plus}</div>
				<span style="${checkpoint.hcid < 0 ? 'color:red;' : ''}">
					${checkpoint.name}
				</span>
				<b class="checkpoint-value long" title="${(+checkpoint.cnt_pct).toFixed(1)}% от кол-ва">${checkpoint.cnt}</b>
				<b class="checkpoint-value long">${(+checkpoint.real_time).toFixed(4)} s</b>
				<b class="checkpoint-value">${(+checkpoint.real_time_avg * 1000).toFixed(2)} ms</b>
				<b class="checkpoint-value">${(+checkpoint.real_time_pct).toFixed(1)}%</b>
			</div>
			
			<div class="js-checkpoints_list"></div>
		</div>
	`);
}

function updateSort() {
	$('.js-checkpoints_sort .js-ico').remove();
	$('.js-checkpoints_sort[data-sort="' + current_sort + '"]').append(`
		<span class="js-ico">${current_order == 'DESC' ? '▾' : '▴'}</span>
	`);
	
	let lists = $('.js-checkpoints_list').toArray();
	let sortChunk = () => {
		doCheckpointsSort($(lists.pop()));
		if (lists.length)
			setTimeout(sortChunk, 0);
	};
	if (lists.length)
		sortChunk();
}

function doCheckpointsSort(parent) {
	let items = parent.children();
	items.detach().sort(function (a, b) {
		let a_v = +a.dataset[current_sort];
		let b_v = +b.dataset[current_sort];
		
		if (a_v == b_v)
			return 0;
		
		return current_order == 'DESC' ? (b_v > a_v ? 1 : -1) : (a_v > b_v ? 1 : -1);
	});
	parent.append(items);
}
