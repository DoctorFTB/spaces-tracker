import module from 'module';
import $ from './jquery';
import * as pushstream from './core/lp';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import notifications from './notifications';
import {MsgFlowControl} from './msg_fc';
import {tick} from './utils';

const JOURNAL_REFRESH_INTERVAL = 60 * 1000;

let msg_fc, list, empty, on_page, counter, banners,
	recomm_updater, widget;

let inited_rotators = false, inited_journal = false;

function intiRotators() {
	inited_rotators = true;
	
	banners = $('.js-banner_rotator');
	
	if (banners.length) {
		page_loader.on('shutdown', 'banner_rotator', function () {
			banners.each(function () {
				var banner = $(this),
					curr = banner.data('current') + 1;
				
				if (curr >= banner.data('cnt'))
					curr = 0;
				
				banner.prop("src", banner.data('url').replace('{n}', curr)).data('current', curr);
			});
		}, true);
	}
	
	page_loader.on("pageloaded", "widgets_rotator", function () {
		var sames = $('#rightbar_sames');
		if (sames) {
			sames.remove();
			$('#rightbar_recomm').removeClass('hide');
			
			var rightbar_reklama = $("." + Spaces.params.ac + '2');
			if (!rightbar_reklama.next('div').length)
				rightbar_reklama.prev().before(rightbar_reklama);
		}
	}, false);
}

function destroyRotators() {
	inited_rotators = false;
	page_loader.off('shutdown', 'banner_rotator');
	page_loader.off("pageloaded", "widgets_rotator");
}

function initJournal() {
	inited_journal = true;
	
	list = $('#journal_right_bar');
	empty = $('#journal_right_bar_empty'),
	widget = list.parents('.js-container__block');
	on_page = list.data('onPage');
	counter = list.parents('.js-container__block').first().find('.js-cnt');
	
	msg_fc = new MsgFlowControl({
		interval: JOURNAL_REFRESH_INTERVAL,
		focus: true, // Обновляем журнал только когда таб активен
		onRefresh: function (e) { // Обновляем журнал целиком
			return Spaces.api("journal.getUnreadRecordsWidgetsByOL", {
				O: 0, L: on_page,
				Link_id: Spaces.params.link_id
			}, function (res) {
				if (res.code == 0) {
					e.done();
					widget.toggleClass('hide', !res.widgets.length);
					list.toggleClass('hide', !res.widgets.length);
					empty.toggleClass('hide', res.widgets.length > 0);
					list.html(res.widgets.join(''));
					
					counter.text(res.count).toggleClass('hide', !res.count);
				} else {
					console.error("[journal] " + Spaces.apiError(res));
					e.fail();
				}
			}, {
				retry: 10,
				onError: function (err) {
					console.error("[journal] " + err);
					e.fail();
				}
			});
		},
		onRequest: function (e) { // Обновляем или получем новые элементы
			var ids = e.queue;
			Spaces.api("journal.getRecordsWidgetsByIds", {
				RiDs: ids,
				Link_id: Spaces.params.link_id
			}, function (res) {
				if (res.code == 0) {
					e.done();
					ids.sort(function (a, b) {
						return a - b;
					});
					
					for (var i = 0; i < ids.length; ++i) {
						$('#rightbar_j' + ids[i]).remove();
						if (res.widgets[ids[i]])
							list.prepend(res.widgets[ids[i]]);
					}
					
					widget.removeClass('hide');
					list.removeClass('hide');
					empty.addClass('hide');
					
					// Удаляем лишние
					var items = list.children();
					for (var i = on_page; i < items.length; ++i)
						$(items[i]).remove();
					
					counter.text(+counter.text() + 1).removeClass('hide');
				} else {
					console.error("[journal] " + Spaces.apiError(res));
					e.fail();
				}
			}, {
				retry: 10,
				onError: function (err) {
					console.error("[journal] " + err);
					e.fail();
				}
			});
		}
	});
	
	pushstream.on('message', 'rightbar', function (data) {
		if (notifications && notifications.needIgnore(data)) // Игнорим событие
			return;
		
		if (data.act == pushstream.TYPES.UOBJ_RECOMMENDATIONS_UPDATE) {
			Spaces.cancelApi(recomm_updater);
			recomm_updater = Spaces.api("uobj_recomm.getRightBarWidget", {
				Link_id: Spaces.params.link_id
			}, function (res) {
				if (res.code == 0)
					$('#rightbar_recomm').replaceWith(res.widget);
			});
		}
		
		if (data.act == pushstream.TYPES.UPDATE_JOURNAL) {
			// console.log('UPDATE_JOURNAL', data.nid);
			msg_fc.get([data.nid]);
		}
		
		if (data.act == pushstream.TYPES.TOP_COUNTER_UPDATE) {
			if (data.clean) {
				list.empty();
				counter.val(0).addClass('hide');
				widget.addClass('hide');
				list.addClass('hide');
				empty.removeClass('hide');
			}
			if (data.deletedRecordsIds) {
				// console.log('deletedRecordsIds', data.deletedRecordsIds);
				var deleted = 0;
				for (var i = 0; i < data.deletedRecordsIds.length; ++i) {
					if ($('#rightbar_j' + data.deletedRecordsIds[i]).length)
						++deleted;
				}
				
				if (deleted)
					msg_fc.refresh();
			}
			if (data.recordsIds) {
				// console.log('recordsIds', data.recordsIds);
				msg_fc.get(data.recordsIds);
			}
		}
	});
	
	$('#journal_right_bar').on('click', '.list-link', function () {
		if (!pushstream.avail()) {
			page_loader.on('pageloaded', 'rightbar', function () {
				msg_fc.refresh();
			});
		}
	});
}

function destroyJournal() {
	inited_journal = false;
	
	if (msg_fc)
		msg_fc.destroy();
	
	Spaces.cancelApi(recomm_updater);
	
	pushstream.off('message', 'rightbar');
	page_loader.off('pageloaded', 'rightbar');
	$('#journal_right_bar').off();
}

module.on("component", function () {
	if (Spaces.params.nid) {
		inited_journal && destroyJournal();
		initJournal();
	}
	
	inited_rotators && destroyRotators();
	intiRotators();
});
