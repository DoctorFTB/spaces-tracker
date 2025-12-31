import module from 'module';
import $ from './jquery';
import Spaces from './spacesLib';
import './form_controls';
import {L, numeral} from './utils';

module.on("componentpage", function () {
	var form = $('#blog_quest')
		.on('change', '.js-checkbox', function (e) {
			var el = $(this),
				checked = el.hasClass('form-checkbox_checked'),
				limit = form.data('maxSelected');
			
			var selected = form.find('.js-checkbox.form-checkbox_checked').length + (checked ? 0 : 1);
			if (selected > limit) {
				Spaces.view.setInputError(el, L('Нельзя выбрать более {0}',
					numeral(limit, [L('$n категории'), L('$n категорий'), L('$n категорий')])));
				if (!checked)
					e.preventDefault();
			} else {
				form.find('.js-checkbox').each(function () {
					Spaces.view.setInputError($(this), false);
				});
			}
		});
	
	form.find('.js-checkbox.form-checkbox_checked').each(function () {
		var c = $(this);
		if (Spaces.view.hasInputError(c))
			c.click();
	});
});
