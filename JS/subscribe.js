import $ from './jquery';
import {Spaces, Codes} from './spacesLib';
import notifications from './notifications';
import {L} from './utils';

var $body = $('body'),
	modes = {
		APART: 1,
		ALONG: 2,
		MINIMIZED: 3,
		INLINE: 4,
		SINGLE: 5,
		TILED: 6
	};
	
//добавление в друзья
$body.on('click', '.js-friend_request', function (e) {
	e.preventDefault();
	e.stopPropagation();
			
	var el = $(this),
		user = el.data('user'),
		contact = el.data('contact'),
		mode = el.data('mode'),
		message_textarea = $('#js-request_message_'+mode),
		message_error = $('#js-request_message_error_'+mode),
		message = $.trim(message_textarea.val()),
		in_pendings = el.data('in_pendings'),
		rec_tile = el.data('rec_tile'),
		noclick = el.data('noclick'),
		list_item =  el.data('list_item');
	
	if (el.data('error'))
		return;
	
	if (message.length > 100){
		message_textarea.addClass('text-input_error');
		message_error.addClass(L('pad_t_a')).text(L('Длина сообщения не должна превышать 100 символов.'));
	} else {
		Spaces.api("friends.offer", {user: user, Contact: contact, message: message, CK: null}, function (res) {
		if (res.code == Codes.COMMON.SUCCESS){
			if (rec_tile == 1 || list_item == 2){
				var parentBlock = el.parents('.js-pending-item');
				
				parentBlock.find('.js-add-friend, .js-remove-pending').hide();
				
				if (res.offer_accepted){
					parentBlock.find('.not_friends_link').show();
				}else{
					parentBlock.find('.friends_link_requested').show();
				}
			
			/*
			} else if (in_pendings == 1){
				var parentBlock = el.parents('.js-pending-item');
				
				if (res.offer_accepted){
					parentBlock.find('.not_friends_link').show();
					parentBlock.find('.js-add-friend, .js-remove-pending').hide();
				}else{
					parentBlock.find('.friends_link_requested').show();
					parentBlock.find('.js-add-friend').hide();
				}
				
				notifications.showNotification(L('Предложение дружбы принято.'), 'info');
				
				var pendings_cnt = $('#pendings_cnt');
				
				if (res.pendings_cnt == 0){
					pendings_cnt.hide();
				} else {
					pendings_cnt.html(res.pendings_cnt);
				}
			*/
			} else {
				/*
					if (list_item == 1){
						el.hide();
						el.parent().find('.js-cancel-friend-request').show();
					} else 
				*/
				var notif_sended = false;

				$('div[data-cuser='+ user +'], div[data-ccontact='+ contact +']' ).each(function(){
					var $this = $(this);
					
					if ($this.prop("className").indexOf('js-friends_') < 0 && $this.prop("className").indexOf('js-lenta_subscr_') < 0)
						return;
					
					if (res.offer_accepted){
						if ($this.hasClass('js-friends_delete') || $this.hasClass('js-lenta_subscr_delete')){
							$this.show();
						} else {
							$this.hide();
						}
						
						if (in_pendings == 1) {
							if (!notif_sended) {
								notif_sended = true;
								notifications.showNotification(L('Предложение дружбы принято.'), 'info');
							}
							var pendings_cnt = $('#pendings_cnt');
							
							if (res.pendings_cnt == 0){
								pendings_cnt.hide();
							} else {
								pendings_cnt.html(res.pendings_cnt);
							}
							
							$this.parent().addClass('table__cell_last').attr('width', '100%').next('.table__cell').remove();
						}
					} else if ($this.prop("className").indexOf('js-friends_') >= 0) {
						if ($this.hasClass('js-friends_revoke')){
							$this.show();
						} else {
							$this.hide();
						}
					}
				});
				
				/*
				$('.js-add-friend').hide();
				if (res.offer_accepted){
					$('.not_friends_link, .delete_from_lenta_link').show();
					$('.add_to_lenta_link').hide();
				}else{
					$('.friends_link_requested').show();
				}
				*/
			}
			
			if ((noclick != 1) || ((in_pendings != 1)&&(list_item != 1))){
				$body.trigger('click');
			}
			
			if ((in_pendings != 1)&&(list_item != 1)){
				message_textarea.val('').removeClass('text-input_error');
				message_error.removeClass('pad_t_a').text('');
			}
			
		} else {
			Spaces.showApiError(res);
		}
		});
	}
});




//добавление в ленту
$body.on('click', '.js-lenta_subscr_add a[data-action=lenta_subscr_add]', function (e) {
	if (!Spaces.params.nid)
		return;
	
	e.preventDefault();
	e.stopPropagation();
	
	var el = $(this),
		parent = el.parent(),
		id = parent.data('author_id'),
		rand = parent.data('rand'),
		type = parent.data('author_type');
	
	if (el.data('error'))
		return;
	
	if (!el.hasClass('js-dd_menu_link')) {
		Spaces.api("lenta.authorAdd", {Aid: id, At: type, CK: null}, function (res) {
			if (res.code == Codes.COMMON.SUCCESS){
				$('div[data-author_type="' + type + '"][data-author_id="' + id + '"]').each(function(){
					var $this = $(this);
					
					if ($this.hasClass('js-lenta_subscr_as')){
						$this.hide();
					} else {
						$this.show();
					}
				});
			} else {
				Spaces.showApiError(res);
			}
		});
	}
});

//удаление из ленты
$body.on('click', 'a[data-action=lenta_subscr_remove]', function (e) {
	e.preventDefault();
	e.stopPropagation();
	
	var el = $(this),
		parent = el.parent(),
		id = parent.data('author_id'),
		rand = parent.data('rand'),
		type = parent.data('author_type');
	
	if (el.data('error'))
		return;
	
	if (!el.hasClass('js-dd_menu_link')) {
		Spaces.api("lenta.authorDelete", {Aid: id, At: type, CK: null}, function (res) {
			if (res.code == Codes.COMMON.SUCCESS){
				$('div[data-author_type="' + type + '"][data-author_id="' + id +'"]').each(function(){
					var $this = $(this);
					
					if ($this.hasClass('js-lenta_subscr_as')){
						$this.show();
					} else {
						$this.hide();
					}
				});
				$body.trigger('click');
			} else {
				Spaces.showApiError(res);
			}
		});
	}
});	

//удаление из друзей
$body.on('click', '.js-remove-friend', function (e) {
	e.preventDefault();
	e.stopPropagation();
			
	var el = $(this),
		user = el.data('user'),
		contact = el.data('contact'),
		noclick = el.data('noclick'),
		in_pendings = el.data('in_pendings'),
		list_item =  el.data('list_item');
	
	if (el.data('error'))
		return;
	
	Spaces.api("friends.delete", {user: user, Contact: contact, CK: null}, function (res) {
		if (res.code == 0) {
			$('div[data-cuser='+ user +'], div[data-ccontact='+ contact +']').each(function(){
				var $this = $(this),
					toggle = this.className.match(/js-(lenta|friends).*?(add|delete|revoke)/i);
				$this.toggle(toggle[2] == 'add');
			});
			
			/*
				if (list_item == 1){
					el.hide();
					el.parent().find('.js-friend_request').show();
				} else if (in_pendings == 1 || list_item == 2){
					var parentBlock = el.parents('.js-pending-item');
					
					parentBlock.find('.not_friends_link').hide();
					parentBlock.find('.js-add-friend, .js-remove-pending').show();
				} else {
					$('.not_friends_link, .delete_from_lenta_link').hide();
					$('.friends_link_item, .add_to_lenta_link').show();
				}
			*/
			
			if ((noclick != 1)&& (list_item != 1)){
				$body.trigger('click');
			}
		} else {
		Spaces.showApiError(res);
		}
	});
});


//отмена заявки в друзья
$body.on('click', '.js-cancel-friend-request', function (e) {
	e.preventDefault();
	e.stopPropagation();
			
	var el = $(this),
		user = el.data('user'),
		noclick = el.data('noclick'),
		in_pendings = el.data('in_pendings'),
		rec_tile = el.data('rec_tile'),
		list_item =  el.data('list_item');
	
	if (el.data('error'))
		return;
	
	Spaces.api("friends.revokeOffer", {user: user, CK: null}, function (res) {
		if (res.code == Codes.COMMON.SUCCESS){
			
			$('div[data-cuser='+ user +']').each(function(){
				var $this = $(this),
					toggle = this.className.match(/js-friends.*?(add|delete|revoke)/i);
				if (toggle)
					$this.toggle(toggle[1] == 'add');
			});
			
			/*
			if (list_item == 1){
				el.hide();
				el.parent().find('.js-friend_request').show();
			} else if (in_pendings == 1 || rec_tile == 1 || list_item == 2){
				var parentBlock = el.parents('.js-pending-item');
				
				parentBlock.find('.friends_link_requested').hide();
				parentBlock.find('.friends_link_item').show();
			} else {
				$('.friends_link_requested').hide();
				$('.friends_link_item').show();
			}
			*/
			
			if (noclick != 1){
				$body.trigger('click');
			}
		} else {
			Spaces.showApiError(res);
		}
	});
});

// отправка жалобы на юзера
$body.on('click', '.js-complaint_link', function (e) {
	e.preventDefault();
	e.stopPropagation();
	
	var el = $(this),
		Oid = el.data('object_id'),
		type = el.data('type'),
		mode = el.data('mode'),
		message_textarea = $('#js-complaint_message_'+mode),
		message_error    = $('#js-complaint_message_error_'+mode),
		message = $.trim(message_textarea.val()),
		radio = $('.js-radio-complaint_reason input[type=radio]:checked').val() || '',
		disabled = el.data('disabled');
	
	if (el.data('error'))
		return;
	
	if (disabled == '1'){
		
	} else if (message.length > 1000){
		message_textarea.addClass('text-input_error');
		message_error.addClass('pad_t_a').text(L('Длина сообщения не должна превышать 1000 символов.'));
	} else {
		Spaces.api("complaints.complain", {Oid: Oid, c: message, T: type,  R: radio, CK: null}, function (res) {
		if (res.code == Codes.COMMON.SUCCESS){
			$body.trigger('click');
			message_textarea.val('').removeClass('text-input_error');
			message_error.removeClass('pad_t_a').text('');
			
			var dd_menu_id = el.parents('.js-dd_menu_item').attr('id');
			$('a[data-menu_id='+dd_menu_id+'] .ico').get(0).className = 'ico ico_ok_green';
			
			notifications.showNotification(L('Спасибо! Ваша жалоба будет рассмотрена в ближайшее время.'), 'info');
		} else{
			Spaces.showApiError(res);
		}
		});
	}
});

$body.on('click', '.js-radio-complaint_reason', function (e) {
	$('.js-complaint_link').removeClass('user__tools-link_disabled').data({'disabled': 0}).find('.ico_ok').removeClass('ico_ok').addClass('ico_ok_blue');
});
