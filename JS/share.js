import module from 'module';
import $ from './jquery';
import Device from './device';
import {L, html_wrap} from './utils';

var SOCIAL_LINKS = {
	tg: {
		title:	"Telegram",
		url:	"https://t.me/share/url?url={link}&text={title}",
		icon:	'ico_soc ico_soc_tg',
		blank:	true
	},
	twitter: {
		title:	"X",
		url:	"https://twitter.com/share?url={link}&text={title}",
		icon:	'ico_soc ico_soc_twitter',
		w:		626,
		h:		436
	},
	vk: {
		title:	"VK",
		url:	"https://vk.com/share.php?url={link}&title={title}",
		icon:	'ico_soc ico_soc_vk',
		w:		626,
		h:		278
	},
	odnk: {
		title:	L("Одноклассники"),
		url:	"https://connect.ok.ru/offer?url={link}&title={title}&imageUrl={logo}",
		icon:	'ico_soc ico_soc_odnk',
		w:		830,
		h:		650
	},
	fb: {
		title:	"Facebook",
		url:	"https://www.facebook.com/sharer.php?u={link}&t={title}&src=sp",
		icon:	'ico_soc ico_soc_fb',
		w:		609,
		h:		436
	},
	mymir: {
		title:	L("Мой Мир@Mail.Ru"),
		url:	"https://connect.mail.ru/share?url={link}&title={title}&imageurl={logo}",
		icon:	'ico_soc ico_soc_mymir',
		w:		626,
		h:		436
	},
	email: {
		title:	L("Отправить на email"),
		url:	"mailto:?Subject={title}&body={link}%0A",
		icon:	'ico_soc ico_soc_email',
		direct:	true
	}
};

var tpl = {
	wrap: function (data) {
		var html =
			'<div class="soc-link__wrapper pad_b_a">' + 
				'<div class="pad_t_a t_center">' + 
					'<label class="grey">Поделиться:</label>' + 
				'</div>' + 
				data + 
			'</div>';
		return html;
	},
	link: function (data) {
		var html =
			'<div class="inl_bl pad_t_a">' + 
				'<a href="' + data.url + '"' + (data.blank ? ' target="_blank" rel="noopener"' : '') + ' class="js-sps soc-link soc-link_' + data.id + '" data-id="' + data.id + '" title="' + data.title + '">' + 
					'<span class="' + data.icon + '"></span>' + 
				'</a>' + 
			'</div>';
		return html;
	}
};

module.on("componentpage", function () {
	var share_link = $.trim(($('#share_link').text() || location.href).replace(/([&?;])sid=[^#;&]+/g, '$1sid=')),
		share_title = $.trim($('#share_title').text() || document.title),
		page_logo = $.trim($('#site_logo').prop("src") || "");
	
	$('.js-share_buttons').each(function () {
		var el = $(this),
			html = "";
		
		$.each(SOCIAL_LINKS, function (id, link) {
			var url = link.url
				.replace(/\{link\}/g, encodeURIComponent(el.data('url') || share_link))
				.replace(/\{title\}/g, encodeURIComponent(el.data('title') || share_title))
				.replace(/\{logo\}/g, encodeURIComponent(el.data('logo') || page_logo));
			html += tpl.link({
				id:		id,
				title:	link.title,
				icon:	link.icon,
				url:	html_wrap(url),
				blank:	!link.direct
			});
		});
		
		el.html(tpl.wrap(html));
	})
	.on('click', '.js-sps', function (e) {
		var el = $(this),
			link = SOCIAL_LINKS[el.data('id')];
		
		if (!link.direct && Device.type == 'desktop' && !link.blank) {
			e.preventDefault();
			var top = ($(window).innerHeight() - link.h) / 2,
				left = ($(window).innerWidth() - link.w) / 2;
			window.open(el.prop("href"), "_blank", 'toolbar=0, status=0, width=' + link.w + ', height=' + link.h + ', top=' + top + ', left=' + left);
		}
	});
});


