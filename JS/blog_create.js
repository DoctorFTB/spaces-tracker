import module from 'module';
import $ from './jquery';
import UniversalSearch from './search';
import {L} from './utils';

var tpl = {
	suggestItem: function (data) {
		return '<a href="#ch" class="js-usearch_result_val list-link-darkblue list-link" ' + 
			'data-hide="1" data-value="' + data.name + '" data-karma_cost="' + data.karma_cost + '" data-adult="' + data.adult + '">' + data.name + '</a>';
	}
};

var has_adult_files, has_adult_channel;

UniversalSearch.register("blog_channels", {
	apiMethod: 'blogs.findChannel',
	apiData: {CK: null},
	param: "q",
	results: "channels",
	length: 2,
	hideEmpty: true,
	
	onRender: function (list, data, sq) {
		var result = [];
		for (var i = 0; i < data.channels.length; ++i)
			result.push(tpl.suggestItem(data.channels[i]));
		list.html(result.join(''));
	}
});

function showKarmaCost(cost) {
	$('#karma_cost').toggleClass('hide', !cost);
	$('#karma_cost_cnt').text(-cost);
	
	// Сбрасываем ошибку
	var wrap = $('#blogs_channel').parents('.js-channel_error_wrap');
	wrap.removeClass('error').find('.js-channel_error').remove();
}

function toggleAdult() {
	var adult_el = $('input[name="Adult"]'),
		adult_el_wrap = adult_el.parents('.js-checkbox_wrap'),
		old_checked = adult_el.data("old_checked");
	
	if (has_adult_files || has_adult_channel) {
		// Сохраняем значение, которое установил юзер
		if (old_checked === undefined)
			adult_el.data('old_checked', adult_el.prop("checked"));
		
		// Устанавливаем галочку 18+ и блокируем это поле
		if (!adult_el.prop("checked"))
			adult_el.parents('.js-checkbox').click();
		adult_el.attr("disabled", "disabled");
		
		// Добавляем hidden с Adult=1, т.е. checkbox с disabled не передаёт своё значение
		var hidden = $('<input type="hidden" class="js-checkbox_disabled" />');
		hidden.prop("name", adult_el.prop("name")).val(adult_el.val());
		adult_el.parents('.js-checkbox_wrap').append(hidden);
		
		var adult_cause = L('Ваша запись в блоге автоматически помечена, как запись для взрослых, потому что к ней приложен контент 18+.');
		if (has_adult_channel)
			adult_cause = L('Ваша запись в блоге автоматически помечена, как запись для взрослых, потому что добавлена в канал 18+.');
		
		adult_el_wrap.find('.form-checkbox__descr')
			.removeClass('hide').html(adult_cause);

		adult_el_wrap.removeClass('form-checkbox_w_descr');
	} else {
		// Разблокируем чекбокс 18+, если канал не 18+
		adult_el.removeAttr("disabled");
		adult_el.removeData("old_checked");
		
		// Возвращаем старое значение, которое установио юзер
		if (old_checked !== undefined) {
			if (adult_el.prop("checked") != old_checked)
				adult_el.parents('.js-checkbox').click();
		}
		
		adult_el_wrap.find('.form-checkbox__descr').addClass('hide');
		adult_el_wrap.find('.js-checkbox_disabled').remove();
	}
}

module.on("componentpage", function () {
	has_adult_files = $('.attaches_block [itemprop="requiredMinAge"]').length;
	has_adult_channel = $('.js-blog_channels').data('adult');
	
	UniversalSearch.recheck();
	
	$('#main').on('click', '.js-blogs_my_channels button', function (e) {
		e.preventDefault();
		var el = $(this);
		has_adult_channel = !!el.data("adult");
		toggleAdult();
		$('#blogs_channel input').val(el.val()).trigger('change').trigger('closeSearch');
		showKarmaCost(el.data('karma_cost'));
	}).on('usearch:change', '#blogs_channel', function (e, data) {
		has_adult_channel = data.item && data.item.data("adult");
		toggleAdult();
		showKarmaCost(data.item ? data.item.data('karma_cost') : 0);
	}).on('onAdultAttach', function (e, data) {
		has_adult_files = data.hasAdult;
		toggleAdult();
	});
});


