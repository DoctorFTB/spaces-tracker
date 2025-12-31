import module from 'module';
import $ from './jquery';
import Spaces from './spacesLib';
import page_loader from './ajaxify';
import AttachSelector from './widgets/attach_selector';
import {tick} from './utils';

var busy, input, microblog;

module.on("componentpage", function () {
	busy = false;
	input = $('#microblog_ta textarea');
	microblog = $('.microblog');
	
	input.on('focus', function () {
		expand_microblog(true, true);
	});
	
	$('body').on('click.oneRequest', function (e) {
		if (!$.contains(microblog[0], e.target))
			check_microblog(true);
	});
	
	$(window).on('text_restore.oneRequest', function (e) {
		check_microblog(false);
	});
	
	check_microblog(false);
});

module.on("componentpagedone", function () {
	input = microblog = null;
});

function check_microblog(user_event) {
	expand_microblog(!!(input.val().length || AttachSelector.isBusy() || AttachSelector.isOpened() || AttachSelector.getAttaches(microblog.find('form')).length), false, user_event);
}

function expand_microblog(flag, focus, user_event) {
	if (busy)
		return;
	
	if (microblog.data('expanded') == flag)
		return;
	
	busy = true;
	
	var ta = $('#microblog_ta'),
		btn = $('#mainSubmitForm');
	
	ta.find('.cntBl').toggleClass('hide', !flag);
	$('#microblog_minimized').toggleClass('hide', !flag);
	$(flag ? '#microblog_minimized_ta' : '#microblog_expanded_ta').append(ta);
	$('#microblog_expanded').toggleClass('hide', flag);
	
	var input = ta.find('textarea');
	if (flag) {
		input.attr("rows", input.data('minRows'));
		if (focus) {
			tick(function () {
				input.focus();
				busy = false;
			});
		} else {
			busy = false;
		}
	} else {
		input.attr("rows", 1);
		busy = false;
	}
	
	if (user_event)
		Spaces.view.setInputError(input, false);
	
	microblog.data('expanded', flag);
}


