import module from 'module';
import $ from './jquery';
import Spaces from './spacesLib';
import {L, tick} from './utils';

var tpl = {
	deleted: function (data) {
		return '<div class="content-item3 wbg content-bl__sep js-violators_item_revert">' + data.text + 
			'<a href="#" data-action="' + data.action + '" data-revert="1" class="js-action_link">' + L('Отменить') + '</a>' + 
		'</div>';
	},
	wrapper: function () {
		return '<div class="hide js-violators_item_inner">';
	}
};

module.on("componentpage", function (e) {
	$('#main').action('retain_dating delete_dating_block dating_block retain_dating_block', function (e) {
		e.preventDefault();
		var el = $(this),
			parent = el.parents('.js-violators_item'),
			user_id = parent.data('user_id'),
			reason = parent.find('.js-dating_reason').val(),
			comment = parent.find('.js-dating_comment').val(),
			is_accept = (e.linkAction == 'retain_dating' || e.linkAction == 'delete_dating_block');
		el.prepend('<span class="ico ico_spinner js-spinner">');
		
		Spaces.api(is_accept ? "dating.applyAnketa" : "dating.denyAnketa", {User: user_id, CK: null, Reason: reason, comment: comment}, function (res) {
			if (res.code == 0) {
				if (!el.data('revert'))
					$('.js-violators_item.js-deleted').remove();
				if (el.data('revert')) {
					var inner = parent.find('.js-violators_item_inner'),
						revert = parent.find('.js-violators_item_revert');
					parent.append(inner.children());
					inner.remove(); revert.remove();
					parent.removeClass('js-deleted');
				} else {
					parent.children().wrapAll(tpl.wrapper());
					parent.append(tpl.deleted({
						text:		is_accept ? L('Пользователь добавлен в знакомства.') : L('Пользователь удалён из знакомств.'),
						action:		is_accept ? 'dating_block' : 'retain_dating',
					}));
					parent.addClass('js-deleted');
					
					tick(function () {
						var scroll = $(window).scrollTop(),
							new_scroll = el.offset().top - scroll;
						$('html, body').scrollTop(parent.offset().top - new_scroll);
					});
				}
				parent.find('.js-spinner').remove();
			} else {
				Spaces.showApiError(res);
			}
		}, {
			onError: function (err) {
				Spaces.showError(err);
			}
		});
	});
	
	$('#main').action('violator_skip violator_unskip', function (e) {
		e.preventDefault();
		var el = $(this),
			parent = el.parents('.js-violators_item'),
			user_id = parent.data('user_id');
		el.prepend('<span class="ico ico_spinner js-spinner">');
		Spaces.api(e.linkAction == 'violator_skip' ? "violators.skip" : "violators.unskip", {User: user_id, CK: null}, function (res) {
			if (res.code == 0) {
				if (!el.data('revert'))
					$('.js-violators_item.js-deleted').remove();
				if (el.data('revert')) {
					var inner = parent.find('.js-violators_item_inner'),
						revert = parent.find('.js-violators_item_revert');
					parent.append(inner.children());
					inner.remove(); revert.remove();
					parent.removeClass('js-deleted');
				} else {
					parent.children().wrapAll(tpl.wrapper());
					parent.append(tpl.deleted({
						text:		e.linkAction == 'violator_skip' ? L('Нарушитель скрыт. ') : L('Нарушитель вернут в список. '),
						action:		e.linkAction == 'violator_skip' ? 'violator_unskip' : 'violator_skip',
					}));
					parent.addClass('js-deleted');
					
					tick(function () {
						var scroll = $(window).scrollTop(),
							new_scroll = el.offset().top - scroll;
						$('html, body').scrollTop(parent.offset().top - new_scroll);
					});
				}
				parent.find('.js-spinner').remove();
			} else {
				Spaces.showApiError(res);
			}
		}, {
			onError: function (err) {
				Spaces.showError(err);
			}
		});
	}).action('remarks_load', function (e) {
		e.preventDefault();
		var el = $(this),
			parent = el.parents('.js-violators_item'),
			user_id = parent.data('user_id'),
			list = $('#remarks_' + user_id),
			list_data = list.data(),
			total = list.children().length;
		
		if (!list_data.limit)
			list_data.limit = total;
		
		if (el.data('busy'))
			return;
		
		var toggle_spinner = function (f) {
			el.find('.js-ico').toggleClass('ico_spinner', f);
			el.data('busy', f);
		};
		
		toggle_spinner(true);
		Spaces.api("remarks.getList", {User: user_id, O: total, L: list_data.limit, Link_id: Spaces.params.link_id}, function (res) {
			toggle_spinner(false);
			if (res.code != 0) {
				Spaces.showApiError(res);
			} else {
				list.append(res.remarks.join(''));
				
				if (res.remarks.length < list_data.limit)
					el.remove();
			}
		}, {
			onError: function (err) {
				toggle_spinner(false);
				Spaces.showError(err);
			}
		});
	});
});

