import module from 'module';
import $ from '../jquery';
import { throttle } from '../utils';

module.on('componentpage', () => {
	const handleInput = throttle((seoTag, input) => {
		const value = input.value.trim();
		seoTag.find('.js-seo_tag_toggle_int_query').prop("checked", value.length > 0);
	});

	$('#main').on('click', '.js-seo_tag_add_int_query', function (e) {
		const seoTag = $(this).parents('.js-seo_tag');
		toggleIntQuery(seoTag, true);
	}).on('click', '.js-seo_tag_remove_int_query', function (e) {
		const seoTag = $(this).parents('.js-seo_tag');
		toggleIntQuery(seoTag, false);
	}).on('change input', '.js-seo_tag_int_query', function (e) {
		const seoTag = $(this).parents('.js-seo_tag');
		handleInput(seoTag, this);
	}).on('mousedown', '.js-seo_tag_alias_for', function () {
		const select = $(this);
		const seoTag = select.parents('.js-seo_tag');
		if (select.data('inited'))
			return;

		console.time("init seo tags");
		const selectTemplate = document.getElementById("tmpl_seo_tag_alias_for");
		const currentValue = select.val();
		const currentSeoTagId = seoTag.data('id');
		for (const option of [...selectTemplate.content.children]) {
			if (option.value == currentValue || option.value == currentSeoTagId)
				continue;
			select.append(option.cloneNode(true));
		}
		console.timeEnd("init seo tags");

		select.data('inited', true);
	});
});

function toggleIntQuery(seoTag, state) {
	seoTag.find('.js-seo_tag_add_int_query').toggleClass('hide', state);
	seoTag.find('.js-seo_tag_remove_int_query').toggleClass('hide', !state);
	seoTag.find('.js-seo_tag_int_query_title').toggleClass('hide', !state);

	if (!state)
		seoTag.find('.js-seo_tag_int_query_title').val("");
}
