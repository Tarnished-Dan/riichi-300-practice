(() => {
  "use strict";
  const numbers = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const suits = [["m", "万"], ["p", "筒"], ["s", "索"]];
  const groups = suits.map(([suit, name]) => ({
    name: `${name}子`,
    tiles: [...Array.from({ length: 9 }, (_, i) => [`${i + 1}${suit}`, `${numbers[i + 1]}${name}`]), [`0${suit}`, `赤五${name}`]]
  }));
  groups.push({
    name: "字牌",
    tiles: ["东", "南", "西", "北", "白", "发", "中"].map((name, i) => [`${i + 1}z`, name])
  });
  document.querySelector("#tile-gallery").innerHTML = groups.map(group =>
    `<section class="gallery-row"><h2>${group.name}</h2>${group.tiles.map(([code, name]) =>
      `<div class="gallery-tile" data-tile="${code}" aria-label="${name}">${window.MahjongTileArt.face(code)}<span>${name}</span></div>`
    ).join("")}</section>`
  ).join("");
})();
