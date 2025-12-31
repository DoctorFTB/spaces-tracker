import SMILES_JSON from '../data/smiles.json';
import {L, ge, ce, hasClass, removeClass, addClass, tick, extend} from './utils';
import {Events} from "./events";
import {Spaces} from "./core";

import "SmilesMenu.css";

const db = decodeSmiles();

let menu;
let insertTagCallback;
let onCloseCallback;
let menuLocation;

const tpl = {
	menuHeader() {
		const tabs = [
			{
				title: L("Смайлы"),
				type: "smiles",
				page: "categories"
			},
			...(Object.keys(db.stickers).length > 0 ? [{
				title: L("Стикеры"),
				type: "stickers",
				page: "categories"
			}] : []),
			{
				title: `<img src="${ICONS_BASEURL}ico/remove.png" alt="" width="16" height="16" class="m" />`,
				type: "close"
			}
		];
		return `
			<div class="smiles-menu__header">
				${tabs.map((tab) => {
					return `
						<div
							class="
								js-smile_menu_nav smiles-menu__tab
								${menuLocation.type == tab.type ? ' smiles-menu__tab--is-active' : ''}
							"
							data-type="${tab.type}"
							data-page="${tab.page}"
						>
							${tab.title}
						</div>
					`;
				}).join("")}
			</div>
		`;
	},

	menu(body) {
		return `
			${tpl.menuHeader()}
			<div class="smiles-menu__body">
				${body}
			</div>
		`;
	},

	smilesCategories() {
		const categories = Object.values(db.smiles).sort((a, b) => a.order - b.order);
		return `
			<div class="smiles-menu__categories">
				${categories.map((cat) => {
					return `
						<a href="#" class="smiles-menu__category js-smile_menu_nav" data-type="smiles" data-page="list" data-id="${cat.id}">
							<div class="smiles-menu__category-title">
								${cat.name}
							</div>
							<img
								class="smiles-menu__category-icon middle"
								src="${cat.icon.src}"
								srcset="${cat.icon.srcset}"
								width="${cat.icon.width}"
								height="${cat.icon.height}"
								alt=""
							/>
						</a>
					`;
				}).join("")}
			</div>
		`;
	},

	smilesList(id) {
		let maxWidth = 0;
		let maxHeight = 0;
		for (const smile of db.smiles[id].list) {
			maxWidth = Math.max(maxWidth, smile.width);
			maxHeight = Math.max(maxHeight, smile.height);
		}
		maxHeight = Math.min(55, maxHeight);
		maxWidth = Math.min(55, maxWidth);

		const styles = `width:${maxWidth}px; height:${maxHeight}px; line-height:${maxHeight}px`;
		return `
			<div class="oh">
				<div class="s-property__wrap">
					<span class="s-property break-word">
						${db.smiles[id].name}
						<a href="#" class="js-smile_menu_nav" data-type="smiles" data-page="categories" data-id="0">
							<span class="ico delete-btn"></span>
						</a>
					</span>
				</div>
			</div>

			<div class="smiles-menu__list">
				${db.smiles[id].list.map((smile) => {
					return `
						<a href="#" class="js-smile_menu_select smiles-menu__list-item" data-value="${smile.name}" style="${styles}">
							<img
								src="${smile.src}"
								srcset="${smile.srcset}"
								width="${smile.width}"
								height="${smile.height}"
								class="middle"
								alt=""
							/>
						</a>
					`;
				}).join("")}
			</div>
		`;
	},

	stickersCategories() {
		const categories = Object.values(db.stickers).sort((a, b) => a.order - b.order);
		return `
			<div class="smiles-menu__categories">
				${categories.map((cat) => {
					return `
						<a href="#" class="smiles-menu__category js-smile_menu_nav" data-type="stickers" data-page="list" data-id="${cat.id}">
							<img
								class="smiles-menu__category-icon middle"
								src="${cat.icon.src}"
								srcset="${cat.icon.srcset}"
								width="${cat.icon.width}"
								height="${cat.icon.height}"
								alt=""
							/>
							<div class="smiles-menu__category-title">
								${cat.name}
							</div>
						</a>
					`;
				}).join("")}
			</div>

			${db.createStickerLink ? `
				<div class="smiles-menu__back">
					${db.createStickerLink ?? ""}
				</div>` : ``
			}
		`;
	},

	stickersList(id) {
		const cat = db.stickers[id];

		return `
			<div class="oh">
				<div class="s-property__wrap">
					<span class="s-property break-word">
						${cat.name}
						<a href="#" class="js-smile_menu_nav" data-type="stickers" data-page="categories" data-id="0">
							<span class="ico delete-btn"></span>
						</a>
					</span>
				</div>
			</div>

			${cat.buyLink ? (`
				<div class="t_center pad_t_a pad_b_a">
					${L('Этот набор стикеров пока недоступен.')}<br />
					<a class="inl_bl" style="padding: 5px" href="${cat.buyLink}">
						${L('Купить за {0} монет', cat.buyPrice)}
					</a>
				</div>
			`) : ''}

			<div class="smiles-menu__list">
				${cat.list.map((smile) => {
					return `
						<a href="#" class="js-smile_menu_select smiles-menu__list-item" data-value="${smile.name}">
							<img
								src="${smile.src}"
								srcset="${smile.srcset}"
								width="${smile.width}"
								height="${smile.height}"
								class="middle"
								alt=""
							/>
						</a>
					`;
				}).join("")}
			</div>
		`;
	},
};

export const SmilesMenu = {
	toggle(id, toolbar, insert_tag, onopen, onclose, opts) {
		opts = extend({
			stickers: true
		}, opts || {});

		if (!menu) {
			initMenu(id, toolbar);
			insertTagCallback = insert_tag;
			onCloseCallback = onclose;
			removeClass(menu, 'hide');
			onopen && onopen();
			render();
			updateDynamicInfo();
		} else {
			closeMenu();
			insertTagCallback = menu = null;
		}
	}
};

function initMenu(id, toolbar) {
	menu = document.createElement("div");
	menu.className = "smiles-menu defer";
	menu.id = "sm_" + id;
	toolbar.appendChild(menu);

	menuLocation = {
		type: "smiles",
		page: "categories",
		id: 0,
	};

	Events.delegate(menu, '.js-smile_menu_nav', 'click', (e) => {
		const link = e.delegateTarget;

		if (link.getAttribute('data-type') == "close") {
			closeMenu();
			return;
		}

		menuLocation = {
			type: link.getAttribute('data-type'),
			page: link.getAttribute('data-page'),
			id: +link.getAttribute('data-id'),
		};
		render();
		return false;
	});

	Events.delegate(menu, '.js-smile_menu_select', 'click', (e) => {
		const link = e.delegateTarget;
		const callback = insertTagCallback;
		closeMenu();
		callback(link.getAttribute('data-value'));
		closeMenu();
	});

	Events.delegate(menu, '.js-smile_menu_close', 'click', (e) => {
		closeMenu();
		return false;
	});
}

function render() {
	if (menuLocation.type == "stickers") {
		if (menuLocation.page == "categories") {
			menu.innerHTML = tpl.menu(tpl.stickersCategories());
		} else if (menuLocation.page == "list") {
			menu.innerHTML = tpl.menu(tpl.stickersList(menuLocation.id));
		}
	} else if (menuLocation.type == "smiles") {
		if (menuLocation.page == "categories") {
			menu.innerHTML = tpl.menu(tpl.smilesCategories());
		} else if (menuLocation.page == "list") {
			menu.innerHTML = tpl.menu(tpl.smilesList(menuLocation.id));
		}
	}
	menu?.scrollIntoView({
		behavior: "smooth",
		block: "nearest",
		inline: "nearest"
	});
}

function updateDynamicInfo() {
	Spaces.api("common.getStickers", { OnlyPrivate: true }, (res) => {
		if (res.code != 0)
			return;

		db.createStickerLink = res.createStickerLink;

		for (const cat of res.categories) {
			if (!db.stickers[cat.id]) {
				db.stickers[cat.id] = {
					id: cat.id,
					name: cat.name,
					infoLink: cat.info_link,
					buyLink: undefined,
					buyPrice: 0,
					order: Object.values(db.stickers).length,
					isSystem: cat.is_system != 0,
					icon: {
						src: cat.icon ? cat.icon.src : `${ICONS_BASEURL}magic_2x.png`,
						srcset: cat.icon?.src_2x ? `${cat.icon.src}, ${cat.icon.src_2x} 1.5x` : ``,
						width: 20,
						height: 20,
					},
					list: []
				};
			}

			db.stickers[cat.id].name = cat.name;
			db.stickers[cat.id].infoLink = cat.info_link;
			db.stickers[cat.id].buyPrice = 12;
			db.stickers[cat.id].buyLink = cat.bought ? undefined : cat.info_link;

			if (cat.stickers.length > 0) {
				db.stickers[cat.id].list = [];
				for (const sticker of cat.stickers) {
					db.stickers[cat.id].list.push({
						name: `:${sticker.name}`,
						src: sticker.src,
						srcset: sticker.src_2x ? `${sticker.src}, ${sticker.src_2x} 1.5x` : ``,
						width: 50,
						height: 50,
					});
				}
			}
		}

		if (menuLocation.type == "stickers")
			render();
	});
}

function closeMenu() {
	menu.parentNode.removeChild(menu);
	onCloseCallback && onCloseCallback();
	onCloseCallback = insertTagCallback = menu = undefined;
	menuLocation = undefined;
}

function decodeSmiles() {
	const stickers = {};
	let stickerCategoryIndex = 0;
	for (const cat of SMILES_JSON.st_categories) {
		const category = {
			id: cat[4],
			name: cat[0],
			infoLink: undefined,
			buyLink: undefined,
			buyPrice: 0,
			isSystem: true,
			order: stickerCategoryIndex,
			icon: {
				src: `${ICONS_BASEURL}${cat[1]}`,
				srcset: "",
				width: cat[2],
				height: cat[3],
			},
			list: []
		};
		stickers[category.id] = category;

		const rev = SMILES_JSON.stickers_revision;
		for (const sticker of SMILES_JSON.list[1][stickerCategoryIndex]) {
			const sm = unpackSmile(sticker.split('|'));
			const src = `${ICONS_BASEURL}st/50/${-cat[4]}/${sm.src}.png?${rev}`;
			const src_2x = `${ICONS_BASEURL}st/50/${-cat[4]}/${sm.src}_2x.png?${rev}`;
			category.list.push({
				name: sm.name,
				src: src,
				srcset: src_2x ? `${src}, ${src_2x} 1.5x` : ``,
				width: 50,
				height: 50,
			});
		}
		stickerCategoryIndex++;
	}

	const smiles = [];
	let smilesCategoryIndex = 0;

	const smileImg = (name, width, height) => {
		let src;
		let src_2x;
		const rev = SMILES_JSON.smiles_revision;
		if (Device.features.webpAnimation) {
			src = `${ICONS_BASEURL}sm/webp/${name}.webp?${rev}`;
			src_2x = `${ICONS_BASEURL}sm/webp/${name}_2x.webp?${rev}`;
		} else {
			src = `${ICONS_BASEURL}sm/gif/${name}.gif?${rev}`;
		}
		return {
			src,
			srcset: src_2x ? `${src}, ${src_2x} 1.5x` : ``,
			width,
			height
		};
	};

	for (const cat of SMILES_JSON.categories) {
		const category = {
			id: cat[4],
			name: cat[0],
			order: smilesCategoryIndex,
			icon: smileImg(cat[1], cat[2], cat[3]),
			list: []
		};
		smiles[category.id] = category;

		let smileIndex = 0;
		for (const smile of SMILES_JSON.list[0][smilesCategoryIndex]) {
			const sm = unpackSmile(smile.split('|'));
			const size = SMILES_JSON.sizes[0][smilesCategoryIndex][smileIndex];
			const width = (size >> 8) & 0xFF;
			const height = size & 0xFF;
			category.list.push({
				name: sm.name,
				...smileImg(sm.src, width, height)
			});
			smileIndex++;
		}
		smilesCategoryIndex++;
	}

	return { smiles, stickers };
}

function unpackSmile(a) {
	let n = a[0], s;
	n = n.indexOf('@') >= 0 ? n.substring(1) : ":" + n;
	if (a.length == 1) {
		s = n.charAt(0) == ':' ? n.substring(1) : n;
	} else {
		s = a[1];
	}
	return {
		name: n,
		src: s,
	};
}
