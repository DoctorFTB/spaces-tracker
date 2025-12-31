import module from 'module';
import $ from '../jquery';
import Spaces from '../spacesLib';
import {L} from '../utils';
import {copyToClipboard} from '../core/clipboard';
import DdMenu from '../dd_menu';

function init(container) {
	// Скрываем "Поделиться с помощью..", если браузер не поддерживает
	container.on('dd_menu_open', '.js-share_menu', function (e) {
		let menu = $(this);
		menu.find('[data-action="share_external"]').toggleClass('hide', typeof navigator.share !== 'function');
		menu.find('[data-action="save_to_collections"]').addClass('hide');
	});
	
	container.action('share_external', function (e) {
		e.preventDefault();
		navigator.share({url: getObjectUrl($(this))});
	}).action('copy_link', function (e) {
		e.preventDefault();
		e.stopPropagation();
		
		let el = $(this);
		let url = getObjectUrl(el);
		
		let set_status = (flag) => {
			el.find('.js-text').text(flag ? L('Скопировать ссылку (скопировано)') : L('Скопировать ссылку'));
			el.find('.js-ico').toggleClass("ico_mail ico_mail_link", !flag).toggleClass("ico ico_ok_green", flag);
		};
		
		// Копируем в буфер браузера
		copyToClipboard(url);
		
		// Копируем в буфер сайта
		if (Spaces.params.nid) {
			Spaces.api("common.copyURL", {
				url:	url,
				CK:		null
			});
		}
		
		set_status(true);
		
		setTimeout(() => {
			set_status(false);
			DdMenu.close();
		}, 1500);
	}).action('cancel', function (e) {
		DdMenu.close();
	});
}

module.on('componentpage', () => {
	init($('#main'));
});

function getObjectUrl(link) {
	return $('#Gallery').data('objectUrl') || link.parents('.js-action_bar').data('objectUrl');
}

export { init };
