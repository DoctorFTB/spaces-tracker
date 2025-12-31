import module from 'module';
import $ from './jquery';
import Spaces from './spacesLib';

module.on("componentpage", function () {
	var classes = {
		moreClicked: 'item_clicked',
		ico: {
			loading: 'ico ico_spinner'
		}
	};
	
	$('#main').on('click', '.js-more_items_link_wrapper', function (e) {
		e.preventDefault();
		
		var el = $(this),
			link = el.find('a'),
			id = el.data('id'),
			user = el.data('user'),
			offset = el.data('offset');
		
		if (!link.hasClass(classes.moreClicked)) {
			link.addClass(classes.moreClicked)
				.find('.ico').prop("className", classes.ico.loading);
			
			Spaces.api("user_activity.getItems", {
				Oid: id,
				user: user,
				O: offset
			}, function (res) {
				el.hide();
				if (res.code != 0) {
					Spaces.showApiError(res);
				} else {
					if (res.items.list.length > 0){
						var items = res.items.list,
							itemsLength = items.length,
							html = '';
							
						for (var i = 0; i < itemsLength; i++) {
							html += '<div class="lenta-block__item">' + items[i] + '</div>';
						}
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
	});
});
