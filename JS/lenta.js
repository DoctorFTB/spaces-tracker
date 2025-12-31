import module from 'module';
import $ from './jquery';
import {Spaces, Url, Codes} from './spacesLib';
import {L} from './utils';

var classes = {
	linkClicked: 'js-link_clicked',
	linkActive: 'link_active',
	moreClicked: 'item_clicked',
	hide: 'hide',
	ico: {
		loading: 'ico ico_spinner'
	}
},
itemsOnPage = 0;

var tpl = {
	new_item: function (objects) {
		var html = '';
		for (var i = 0, l = objects.length; i < l; i++)
			html += '<div class="widgets-group widgets-group_top wbg cf">' + objects[i] + '</div>';
		return html;
	}
};

module.on("componentpage", function () {
	$('#main').on('click', '.js-more_items_link_wrapper', function (e) {
		e.preventDefault();
		
		var el = $(this),
			link = el.find('a'),
			id = el.data('id'),
			offset = el.data('offset'),
			item = $('#l_' + id);
		
		if (!link.hasClass(classes.moreClicked)) {
			link.addClass(classes.moreClicked)
				.find('.ico').prop("className", classes.ico.loading);
			
			Spaces.api("lenta.getItems", {
				Oid: id,
				O: offset,
				Short: item.data('short')
			}, function (res) {
				el.hide();
				if (res.code != 0) {
					Spaces.showApiError(res);
				} else {
					if (res.items.list.length > 0) {
						var items = res.items.list,
							itemsLength = items.length,
							html = '';
							
						for (var i = 0; i < itemsLength; i++)
							html += '<div class="lenta-block__item">' + items[i] + '</div>';
						$('#l_' + id + '-items').append(html);
					}
					if (res.items.tile.length > 0) {
						var tiles = $('#l_' + id + '-tile_items');
						tiles.append(res.items.tile.join(''));
						tiles.append(tiles.find('.tiled_cap').detach());
					}
				}
			});
		}
	}).on('click', '.js-delete_lenta_item a', function (e) {
		// удаление объекта из ленты и восстановление его
		e.preventDefault();
		
		var link_close = $(this),
			el = link_close.parent(),
			id = el.data('id'),
			query = (new Url(location.href)).query,
			p = query.P || 1,
			cancel = +el.data('cancel'),
			new_events_wrap = $('#js-lenta_events_wrapper'),
			items_on_page = new_events_wrap.data('items_on_page'),
			item = $('#l_' + id);
		
		if (link_close.data('busy'))
			return;
		
		// Спиннеры
		var show_spinner = function (flag) {
			if (cancel) {
				link_close.find('.ico').toggleClass('ico_spinner', flag);
			} else {
				link_close.toggleClass('ico_spinner', flag);
			}
			link_close.data('busy', flag);
		};
		show_spinner(true);
		
		Spaces.api("lenta.objectDelete", {
			Oid: id,
			CK: null,
			Pag: 1,
			Ol: !cancel,
			L: 1,
			O: (p * items_on_page) - 1,
			At: query.At || 0,
			Aid: query.Aid || 0,
			P: p,
			Sort: el.data('sort') || query.Sort || 0,
			Cancel: cancel,
			Rli: el.data('rli'),
			Short: item.data('short')
		}, function (res) {
			show_spinner(false);
			
			if (res.code != 0) {
				Spaces.showApiError(res);
			} else {
				if (!cancel) {
					// Удаляем последний блок для восстановления записи
					$('.js-restore_lenta_item_menu').parent().remove();
				}
				
				// Удаляем комментарии
				item.parent().next('[id^="last_comments_"]').remove();
				
				// Заменяем виджет записи
				item.replaceWith(res.widget);
				
				// Удаляем лишние записи при восстановлении
				if (cancel) {
					let items = $('#js-lenta_events_wrapper .js-lenta_row');
					for (let i = items_on_page; i < items.length; i++)
						$(items[i]).parent().remove();
				}
				
				if (res.objects)
					new_events_wrap.append(tpl.new_item(res.objects));
				
				var pagination = (res.pagination && res.pagination != 'undef' ? res.pagination : '');
				$('#js-lenta_pagination_wrapper .js-pag_item').each(function () {
					var self = $(this);
					if (self.hasClass('hide')) {
						self.removeClass('hide');
						if (!cancel)
							self.html(pagination);
					} else {
						self.addClass('hide');
					}
				});
			}

			el.removeClass(classes.linkClicked);
		}, {
			onError: function (err) {
				show_spinner(false);
				Spaces.showError(err);
			}
		});
	}).on('click', '.js-get_settings_form a', function (e) {
		// получение формы настроек автора
		e.preventDefault();
		
		var	link = $(this),
			el = link.parent(),
			objId = el.data('id'),
			user_settings = $('#l_' + objId + '-user_settings'),
			linkClicked = link.hasClass(classes.linkClicked);
			
		if (!linkClicked) {
			link.addClass(classes.linkClicked + ' ' + classes.linkActive);
			
			if (el.data('form_loaded') != '1'){
				var link_id = link.parents('.js-link_id').data('link_id'),
					id = el.data('author_id'),
					type = el.data('author_type');
					
				Spaces.api("lenta.getSettingsForm", {
					Aid: id,
					At: type,
					Link_id: link_id,
					CK: null
				}, function (res) {
					if (res.code != 0) {
						Spaces.showApiError(res);
					} else{
						user_settings.html(res.form);
						
						el.data('form_loaded','1');
					}
				});
			}
			
			user_settings.show();
		} else {
			link.removeClass(classes.linkClicked + ' ' + classes.linkActive);
			user_settings.hide();
		}
	}).on('click', '.js-close_settings_form a', function (e) {
		// скрытие формы настроек (нажатие на отмену)
		e.preventDefault();
		
		$(this).parents('.widgets-group').find('.js-get_settings_form a').click();
	}).on('click', '.js-show_last_comments', function (e) {
		// выводим последние комментарии к записи и форму оставления комментария
		e.preventDefault();
		
		var	el = $(this),
			ico = el.find('.ico_abar'),
			ot = el.data('ot'),
			id = el.data('id');
		
		ico.attr("class", 'ico ico_spinner');
		
		if (!el.data('clicked')) {
			el.addClass('item_clicked').data('clicked', 1);
	
			Spaces.api("comments.readLast", {
				Ot: ot,
				Oid: id,
				from: 'mylenta',
				Link_id: $('#js-lenta_events_wrapper').data('link_id')
			}, function (res) {
				el.hide();
				
				var commentsBlock = $('#last_comments_' + id);
				if (res.code != 0) {
					var error = Spaces.apiError(res);
					if (res.code == Codes.COMMON.ERR_FORBIDDEN)
						error = L('Доступ к записи закрыт.');
					
					var error = '<div class="system-message system-message_alert">' + error + '</div>';
					commentsBlock.html(error).removeClass('hide');
				} else {
					commentsBlock.fastHtml(res.comments).removeClass('hide');
					el.parents('#js-lenta_events_wrapper > div').after(commentsBlock);
				}
			});
		}
	}).action('author_block', function (e) {
		e.preventDefault();
		var link = $(this),
			parent = link.parents('.js-replace_widget');
		parent.parent().find('.js-replace_link').remove();
		parent.remove();
		
		Spaces.api("lenta.authorBlock", {Aid: link.data('aid'), At: link.data('at'), CK: null}, function (res) {
			if (res.code != 0)
				Spaces.showApiError(res);
		})
	});
});
