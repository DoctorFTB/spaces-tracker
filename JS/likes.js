import $ from './jquery';
import {Spaces, Codes} from './spacesLib';
import {ge, L, html_wrap} from './utils';

const MORE_LINK_WIDTH = 150;
const MAX_LIKE_USERS = 5;
const ONE_LIKE_PREVIEW_WIDTH = 25;

let classes = {
	ico: {
		up: 'ico_abar_vote_up',
		upActive: 'ico_abar_vote_up_on',
		down: 'ico_abar_vote_down',
		downActive: 'ico_abar_vote_down_on'
	}
};
let tpl = {
	error: function (msg) {
		return '<div class="red">' + msg + '</div>'
	},
	loadingLikes() {
		return `
			<div style="height: 20px" class="inl_bl m"></div>
			<span class="ico ico_spinner m"></span>
			<span class="m">&nbsp;</span>
		`;
	},
	noLikes(text, error) {
		return `
			<div style="height: 20px" class="inl_bl m"></div>
			<span class="m ${error ? 'red' : 'grey'}">${text}</span>
		`;
	},
	fullLink(url) {
		return `
			<a href="${html_wrap(url)}" class="full_link"></a>
		`;
	},
	moreLink(available, url) {
		return `
			<a href="${url}" class="padd_left m link-grey">
				${L('и ещё {0}', available)}
			</a>
		`;
	},
	arrow() {
		return `<span class="ico ico_arr_right ico_centered"></span>`;
	}
};

let hide_err_timeout;

$('#main_wrap').on('click', '.js-vote_btn', function (e, extra) {
	e.stopImmediatePropagation(); e.preventDefault();
	e.stopPropagation();
	
	let current_btn = $(this),
		current_data = current_btn.data(),
		
		type = current_data.type,
		vid = current_data.vote_id,
		type_id = type + "_" + vid,
		
		like_up_btn = $('#' + vid + '_voteUp'),
		like_down_btn = $('#' + vid + '_voteDown'),
		like_up_data = like_up_btn.data(),
		like_down_data = like_down_btn.data(),
		
		opposite_btn = type < 0 ? like_up_btn : like_down_btn,
		opposite_data = type < 0 ? like_up_data : like_down_data,
		
		subscr_offer = $('#subscribe_offer_' + current_data.ot + '_' + current_data.oid),
		share_offer = $('#share_offer_' + current_data.ot + '_' + current_data.oid);
	
	let clearError = function () {
		$('#vote_err_' + vid).addClass('hide');
		clearTimeout(hide_err_timeout);
	};
	
	let showError = function (text) {
		let err = $('#vote_err_' + vid);
		
		if (!err.length) {
			err = current_btn.parents('.js-action_bar')
				.find('.js-vote_error');
		}
		
		if (err.length && !ge('#Gallery')) {
			err.removeClass('hide').html(text);
			hide_err_timeout = setTimeout(clearError, 4000);
		} else {
			Spaces.showMsg(text, {
				gallery: true,
				type: 'alert'
			});
		}
	};
	
	if (!extra || !extra.ignore)
		clearError();
	
	current_data.mode = current_data.mode || 'default';
	
	let binded = current_btn.data('binded');
	if (binded) {
		$('#' + binded + (type < 0 ? '_voteDown' : '_voteUp')).click();
		return;
	}
	
	if (current_data.notAuth) {
		showError(Spaces.view.onlyAuthMotivator());
		return;
	}
	
	if (current_data.ot == Spaces.TYPES.EXTERNAL_VIDEO) {
		let action = type < 0 ? L("дислайкать") : L("лайкать");
		showError(L("Это видео нельзя {0}.", action));
		return;
	}
	
	if (current_data.privatePhoto && type < 0) {
		showError(L("Это фото нельзя дислайкать."));
		return;
	}
	
	if (current_data.disabled) {
		showError(L("Вы не можете голосовать за себя."));
		return;
	}
	
	let api_method, api_data = {
		CK: null,
		Oid: current_data.oid,
		Ot: current_data.ot,
		from: current_data.from,
		Visit: current_data.visit,
		Widgets: subscr_offer.length > 0 && current_data.subscr,
		Link_id: Spaces.params.link_id
	};
	
	let polarity_change = false;
	
	// Удаляем голос
	if (current_data.clicked) {
		--current_data.cnt;
		api_method = "voting.delete";
		current_data.clicked = false;
	} else if (opposite_btn.data('clicked')) { // Смена полярности
		++current_data.cnt; --opposite_data.cnt;
		
		api_method = "voting.like";
		api_data.Down = type < 0 ? 1 : 0;
		
		current_data.clicked = true;
		opposite_data.clicked = false;
		polarity_change = true;
	} else { // Ставим первый голос
		++current_data.cnt;
		
		api_method = "voting.like";
		api_data.Down = type < 0 ? 1 : 0;
		
		current_data.clicked = true;
	}
	
	like_up_data = like_up_data || {cnt: 0};
	like_down_data = like_down_data || {cnt: 0};
	
	// Счётчики
	let up_cnt = $('#vote_up_cnt_' + vid)
		.text(like_up_data.cnt);
	let down_cnt = $('#vote_down_cnt_' + vid)
		.text(like_down_data.cnt);
	
	if (up_cnt.data('hideable'))
		up_cnt.toggle(like_up_data.cnt > 0);
	if (down_cnt.data('hideable'))
		down_cnt.toggle(like_down_data.cnt > 0);
	
	// Общий счётчик
	let full_cnt = -like_down_data.cnt + like_up_data.cnt;
	$('#' + vid + '_voteFullCnt')
		.text(full_cnt)
		.toggleClass("red", full_cnt < 0)
		.toggleClass("green", full_cnt > 0);
	
	like_up_btn.attr("title", "За " + like_up_data.cnt);
	like_down_btn.attr("title", "Против " + like_down_data.cnt);
	
	if (subscr_offer.length)
		subscr_offer.addClass('hide');
	
	if (share_offer.length)
		share_offer.toggleClass('hide', !like_up_data.clicked);
	
	if (current_data.mode == 'old_button') {
		like_up_btn.children().toggleClass('on', !!like_up_data.clicked);
		like_down_btn.children().toggleClass('on', !!like_down_data.clicked);
	} else if (current_data.mode == 'default') {
		like_up_btn.find('.ico_abar')
			.toggleClass(classes.ico.up, !like_up_data.clicked)
			.toggleClass(classes.ico.upActive, !!like_up_data.clicked);
		like_up_btn.find('.action-bar_cnt').toggleClass('action-bar_cnt_on', !!like_up_data.clicked);
		like_down_btn.find('.ico_abar')
			.toggleClass(classes.ico.down, !like_down_data.clicked)
			.toggleClass(classes.ico.downActive, !!like_down_data.clicked);
		like_down_btn.find('.action-bar_cnt').toggleClass('action-bar_cnt_on action-bar_cnt_on_red', !!like_down_data.clicked);
	}
	
	let voted = $('#voted_' + current_data.ot + '_' + current_data.oid);
	if (!like_down_data.clicked)
		voted.addClass('hide');
	
	like_up_btn.trigger('like', {
		polarity: like_down_data.clicked ? -1 : (like_up_data.clicked ? 1 : 0),
		plus: like_up_data.cnt,
		minus: like_down_data.cnt
	});
	
	if (like_up_data.clicked) {
		let wrap = share_offer.parents('.widgets-group');
		if (wrap.length)
			share_offer.insertAfter(wrap);
	}
	
	if (extra && extra.ignore)
		return;
	
	Spaces.api(api_method, api_data, function (res) {
		if (res.code == 0 && res.warn)
			showError(res.warn);
		
		if (res.code == 0 && like_down_data.clicked)
			voted.removeClass('hide');
		
		if (res.code != 0 && res.code != Codes.VOTING.ERR_VOTE_NOT_FOUND) {
			showError(Spaces.apiError(res));
			
			if (like_up_data.clicked) {
				if (polarity_change) {
					like_down_btn.trigger("click", [{ignore: true}]);
				} else {
					like_up_btn.trigger("click", [{ignore: true}]);
				}
			} else if (like_down_data.clicked) {
				if (polarity_change) {
					like_up_btn.trigger("click", [{ignore: true}]);
				} else {
					like_down_btn.trigger("click", [{ignore: true}]);
				}
			}
		}
		
		if (subscr_offer.length) {
			if (res.widgets && res.widgets.author) {
				let wrap = subscr_offer.parents('.widgets-group');
				if (wrap.length)
					subscr_offer.insertAfter(wrap);
				subscr_offer.find('.js-subscribe_offer_object').html(res.widgets.author);
				subscr_offer.find('.js-subscribe_offer_button').html(res.widgets.subscr_link);
				subscr_offer.removeClass('hide');
			}
		}
	});
	
}).on('click', '.js-show_likes', function (e) {
	e.preventDefault();
	
	let el = $(this);
	let element_id = el.data('id');
	let [ot, oid] = element_id.split('_');
	let list = $(`#vote_up_list_${element_id}`)
	
	el.toggleClass('js-clicked');
	list.toggleClass('hide');
	
	if (list.hasClass('hide'))
		return;
	
	list.html(tpl.loadingLikes());
	list.append(tpl.fullLink(el.prop("href")));
	
	Spaces.api("voting.users", {Oid: oid, Ot: ot, O: 0, L: 30}, (res) => {
		if (res.code != 0) {
			list.html(tpl.noLikes(Spaces.apiError(res), true));
			list.append(tpl.fullLink(el.prop("href")));
			return;
		}
		
		let max_items = Math.min(MAX_LIKE_USERS, Math.floor((list.width() - MORE_LINK_WIDTH) / ONE_LIKE_PREVIEW_WIDTH));
		
		if (res.users.length > 0) {
			list.html(res.users.slice(0, max_items).join(''));
		} else {
			list.html(tpl.noLikes(L('Ещё никто не лайкал.')));
		}
		
		let available = res.count - max_items;
		if (available > 0)
			list.append(tpl.moreLink(available, el.prop("href")));
		
		list.append(tpl.arrow());
		list.append(tpl.fullLink(el.prop("href")));
	}, {
		onError(err) {
			list.html(tpl.noLikes(err, true));
			list.append(tpl.fullLink(el.prop("href")));
		}
	});
});

