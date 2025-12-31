import $ from './jquery';

$('body').on('click', '.js-toggle_title', function (e) {
	e.preventDefault(); e.stopPropagation();
	var content = $(this).parent().parent().toggleClass('js-toggle_content_hide');
	content.find('.js-is_hidden').val(content.hasClass('js-toggle_content_hide') ? 1 : 0);
}).on('click', '.toggle-list__btn', function (e) {
	$(this).parents('.toggle-list__wrap').toggleClass('toggle-list__wrap_show');
});
