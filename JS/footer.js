import $ from './jquery';
import Device from './device';
import * as pushstream from './core/lp';
import Spaces from './spacesLib';
import {L} from './utils';

var TAB_ID = Date.now();

var is_expanded = false,	
	is_editing = false,
	updater = false,
	placeholder_tile;

let sortable;

$(function () {
	init();
});

function init() {
	var footer_wrap = $('#navi_footer_wrap');
	footer_wrap
		.on('click', '#footer_more_link', function (e) {
			e.preventDefault();
			toggleFooter();
		})
		.on('click', '#footer_settings_link', function (e) {
			if ($(window).innerHeight() < 500 && !is_editing)
				return;
			
			e.preventDefault();
			toggleSettings();
		})
		.on('click', '#footer_text_link', function (e) {
			e.preventDefault();
			toggleText();
		})
		.on('click', '.js-footer_link', function (e) {
			if (!is_editing)
				return;
			
			e.preventDefault();
			
			var el = $(this);
			el.toggleClass('footer__link_on').toggleClass('footer__link_off');
			
			Spaces.api("settings.navi", {
				L:	el.data('id'),
				S:	el.hasClass('footer__link_on') ? 1 : 0,
				Ti:	TAB_ID,
				CK:	null
			});
		})
		.on('sortableEnd', function (e) {
			if (e.offset != 0) {
				Spaces.api("settings.navi", {
					L: e.element.data('id'),
					M: e.offset,
					Ti:	TAB_ID,
					CK:	null
				});
			}
		});
	
	if (pushstream) {
		pushstream.on("message", "footer", function (data) {
			if (data.act == pushstream.TYPES.REFRESH_WIDGETS) {
				if ((data.widgets & Spaces.WIDGETS.FOOTER) && data.tab_id != TAB_ID) {
					if (updater) {
						Spaces.cancelApi(updater);
						updater = false;
					}

					updater = Spaces.api("settings.navi", {
						Rw:	1,
						Ti:	TAB_ID,
						Link_id: Spaces.params.link_id,
						CK:	null
					}, function (res) {
						updater = false;

						if (res.code == 0)
							updateFooter(res.widget);
					}, {
						onError: function () {
							updater = false;
						}
					});
				}
			}
		});
	}
	
	update();
}

function update() {
	var footer = $('#footer'),
		more = $('#footer_more_link'),
		max_visible = footer.data('maxVisible');
	
	more.detach();
	
	var footer_links = footer.find('.footer__link_on')
	if (footer_links.length > max_visible) {
		$(footer_links[max_visible - 2]).after(more);
	} else {
		$('#footer_links').append(more);
	}
	
	more.removeClass('hide');
}

function _toggleSettings(flag) {
	var settings_link = $('#footer_settings_link'),
		footer = $('#footer'),
		more = $('#footer_more_link');
	
	if (flag) {
		if (!placeholder_tile)
			placeholder_tile = $('#footer_placeholder').removeClass('hide').detach();
		
		footer.data('busy', false);
		
		settings_link.find('.js-ico').removeClass('ico_spinner_white');
		settings_link.addClass('footer__link_active');
		footer.removeClass('footer_read').addClass('footer_edit');
		
		// Убираем "Ещё" подальше
		more.addClass('hide');
		footer.append(more);
		
		if (Device.type == 'desktop')
			footer.addClass('footer_shake');
		
		settings_link.find('.js-text').text(L('Сохранить настройки'));
		
		sortable.startSortable($('#footer_links')[0], {
			autoWidth:			false,
			autoHeight:			false,
			customPlaceholder:	placeholder_tile
		});
		
		$('html, body').scrollTop(footer.offset().top);
	} else {
		settings_link.removeClass('footer__link_active');
		footer.removeClass('footer_edit footer_shake').addClass('footer_read');
		settings_link.find('.js-text').text(L('Настроить меню'));
		
		sortable.stopSortable($('#footer_links')[0]);
		
		update();
	}
}

function toggleSettings() {
	var settings_link = $('#footer_settings_link'),
		footer = $('#footer');
	
	if (footer.data('busy'))
		return;
	
	is_editing = !is_editing;
	
	if (is_editing) {
		var toggle_loading = function (flag) {
			footer.data('busy', flag);
			settings_link.find('.js-ico').toggleClass('ico_spinner_white', flag);
		};
		
		toggle_loading(true);
		
		let deps_promises = [
			import("./sortable"),
			import("Common/Footer.css")
		];
		Promise.all(deps_promises).then(function (modules) {
			sortable = modules[0];
			
			Spaces.api("settings.navi", {
				Rw:	1,
				Ti:	TAB_ID,
				Link_id: Spaces.params.link_id,
				CK:	null
			}, function (res) {
				if (res.code == 0) {
					updateLinks(res.widget);
					_toggleSettings(true);
				} else {
					toggle_loading(false);
					Spaces.showApiError(res);
				}
			}, {
				onError: function (err) {
					toggle_loading(false);
					Spaces.showError(err);
				}
			});
		});
	} else {
		_toggleSettings(false);
	}
}

function toggleFooter() {
	is_expanded = !is_expanded;
	
	var footer = $('#footer'),
		more = $('#footer_more_link'),
		max_visible = footer.data('maxVisible');
	more.toggleClass('footer__link_active', is_expanded);
	
	$('#footer_settings').toggleClass('hide', !is_expanded);
	
	if (is_expanded) {
		$('#footer_links').children().removeClass('hide');
	} else {
		var links = $('#footer_links').children('.footer__link_on');
		for (var i = max_visible, l = links.length; i < l; i++)
			$(links[i]).addClass('hide');
	}
}

function toggleText() {
	var footer = $('#footer'),
		el = $('#footer_text_link .form-toggle__wrap'),
		enabled = el.hasClass('form-toggle__wrap_off');
	el.toggleClass('form-toggle__wrap_off', !enabled);
	footer.toggleClass('footer_text-hide', !enabled);
	
	Spaces.api("settings.navi", {
		Ht:	enabled ? 0 : 1,
		Ti:	TAB_ID,
		CK:	null
	});
}

function updateLinks(html) {
	var old_is_expanded = is_expanded;
	if (old_is_expanded)
		toggleFooter();
	
	 $('#navi_footer_wrap').html(html);
	 update();
	 
	 if (old_is_expanded)
		toggleFooter();
}

function updateFooter(html) {
	if (is_editing)
		toggleSettings();
	
	updateLinks(html);
}

let Footer = {update: updateFooter};
export default Footer;
