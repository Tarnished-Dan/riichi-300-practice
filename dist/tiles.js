/* Original vector tile artwork; patterns checked against JPML's tile chart.
 * https://www.ma-jan.or.jp/about/haiga.html
 * Non-red pinzu pips use a consistent dark ink instead of blue/green variants.
 * All graphics are local; no game assets are used.
 */
(() => {
  "use strict";

  const INK = "#253449";
  const RED = "#b4272e";
  const GREEN = "#167046";
  const DARK_GREEN = "#105638";
  const IVORY = "#fffdf1";
  const NUMERALS = ["", "一", "二", "三", "四", "伍", "六", "七", "八", "九"];
  const HONORS = ["", "東", "南", "西", "北", "", "發", "中"];
  const ALIASES = { 東: "1z", 东: "1z", 南: "2z", 西: "3z", 北: "4z", 白: "5z", 發: "6z", 发: "6z", 中: "7z" };
  const cache = new Map();

  const escape = value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));

  function glyph(character, x, y, size, color, width) {
    return `<text class="mahjong-glyph" x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="600" fill="${color}"${width ? ` textLength="${width}" lengthAdjust="spacingAndGlyphs"` : ""}>${character}</text>`;
  }

  function characters(number, red) {
    return glyph(NUMERALS[number], 26, 32, 32, red ? RED : INK, number === 1 ? 27 : 31)
      + glyph("萬", 26, 67, 36, RED, 36);
  }

  /* The negative space and eight small petals remain legible on narrow tiles. */
  function circleFlower(x, y, radius, color) {
    const petalRadius = radius * .14;
    let petals = "";
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI / 4;
      petals += `<circle cx="${(x + Math.sin(angle) * radius * .57).toFixed(2)}" cy="${(y + Math.cos(angle) * radius * .57).toFixed(2)}" r="${petalRadius.toFixed(2)}" fill="${IVORY}"/>`;
    }
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}"/>`
      + `<circle cx="${x}" cy="${y}" r="${(radius * .84).toFixed(2)}" fill="none" stroke="${IVORY}" stroke-width="${(radius * .085).toFixed(2)}"/>`
      + petals
      + `<circle cx="${x}" cy="${y}" r="${(radius * .21).toFixed(2)}" fill="${IVORY}"/>`;
  }

  function circles(number, red) {
    if (number === 1) {
      return circleFlower(26, 38, 19, INK)
        + `<circle cx="26" cy="38" r="8.6" fill="${IVORY}"/>`
        + circleFlower(26, 38, 7.5, RED);
    }
    const positions = {
      2: [[26, 20], [26, 56]],
      3: [[13, 17], [26, 38], [39, 59]],
      4: [[14, 18], [38, 18], [14, 58], [38, 58]],
      5: [[14, 16], [38, 16], [26, 38], [14, 60], [38, 60]],
      6: [[14, 15], [38, 15], [14, 38], [38, 38], [14, 61], [38, 61]],
      7: [[12, 11], [26, 20], [40, 29], [14, 44], [38, 44], [14, 62], [38, 62]],
      8: [[14, 11], [38, 11], [14, 29], [38, 29], [14, 47], [38, 47], [14, 65], [38, 65]],
      9: [[12, 15], [26, 15], [40, 15], [12, 38], [26, 38], [40, 38], [12, 61], [26, 61], [40, 61]]
    };
    const radius = number === 2 ? 8.7 : number === 9 ? 5.9 : number >= 7 ? 6.6 : 7.7;
    // Ordinary pinzu combine ink and red; only the red five colors every pip red.
    const redPips = {
      3: [1],
      5: [2],
      6: [2, 3, 4, 5],
      7: [3, 4, 5, 6],
      9: [3, 4, 5]
    };
    return positions[number].map(([x, y], index) => {
      const isRedPip = red || (redPips[number] || []).includes(index);
      return circleFlower(x, y, radius, isRedPip ? RED : INK);
    }).join("");
  }

  /* Each bamboo stalk has a rounded core and three visibly engraved nodes. */
  function bamboo(x, y, height, color = GREEN, rotation = 0, width = 5.4) {
    const half = height / 2;
    const edge = color === RED ? "#8f2029" : DARK_GREEN;
    const middleNode = height > 15 ? `<path d="M${-width * .57} 0H${width * .57}" stroke="${IVORY}" stroke-width="1.05"/>` : "";
    return `<g transform="translate(${x} ${y}) rotate(${rotation})">`
      + `<path d="M0 ${-half}V${half}" fill="none" stroke="${edge}" stroke-width="${width}" stroke-linecap="round"/>`
      + `<path d="M-.65 ${-half + 1.4}V${half - 1.4}" fill="none" stroke="${color}" stroke-width="${width * .55}" stroke-linecap="round"/>`
      + `<path d="M${-width * .61} ${-half + 2.4}H${width * .61}M${-width * .61} ${half - 2.4}H${width * .61}" fill="none" stroke="${edge}" stroke-width="1.8" stroke-linecap="round"/>`
      + middleNode
      + `<path d="M${-width * .4} ${-half + 4}H${width * .4}M${-width * .4} ${half - 4}H${width * .4}" fill="none" stroke="${IVORY}" stroke-opacity=".7" stroke-width=".8"/>`
      + "</g>";
  }

  function peacock() {
    return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`
      /* A spread fan, eyespots, curved neck, beak and feet make the bird distinct. */
      + `<path d="M25 55C12 50 5 38 7 23C7 15 11 9 16 11C17 4 25 5 28 12C34 6 42 12 38 21C46 19 50 28 43 35C45 44 35 52 25 55Z" fill="${DARK_GREEN}"/>`
      + `<path d="M25 52C13 43 10 29 13 16M25 52C19 38 18 24 22 12M25 52C25 37 29 25 33 17M25 52C32 40 36 34 41 28" stroke="#56a474" stroke-width="3.1"/>`
      + `<ellipse cx="13.2" cy="20.5" rx="3.1" ry="5" transform="rotate(-13 13.2 20.5)" fill="#c1d393"/>`
      + `<ellipse cx="22.1" cy="16.5" rx="3.2" ry="5" fill="#c1d393"/>`
      + `<ellipse cx="32.1" cy="21" rx="3.2" ry="4.7" transform="rotate(23 32.1 21)" fill="#c1d393"/>`
      + `<ellipse cx="40" cy="30.7" rx="3" ry="4.5" transform="rotate(43 40 30.7)" fill="#c1d393"/>`
      + `<path d="M13 18.1V22.7M22 14.1V18.8M31.1 19L33.1 23M38.5 29.1L41.4 32.2" stroke="${GREEN}" stroke-width="2.5"/>`
      + `<path d="M23 55L21.3 65M29 54L31.2 64M21.3 65L16 66M21.3 65L25 66M31.2 64L36 65" stroke="${INK}" stroke-width="1.6"/>`
      + `<path d="M19 48C19 39 29 39 30 32C29 28 29 24 32 21C35 18 40 20 41 24C43 29 38 32 35 32C34 37 36 42 34 47C32 53 25 58 20 54Z" fill="${GREEN}" stroke="${DARK_GREEN}" stroke-width="1"/>`
      + `<path d="M20 48C23 42 29 43 31 39C33 45 29 50 22 53" fill="#e1e5b5"/>`
      + `<path d="M22 47C25 44 28 44 30 42M23 50C26 47 28 47 30 45" stroke="${DARK_GREEN}" stroke-width="1.5"/>`
      + `<path d="M40 24L47 26L40.5 28" fill="${RED}"/>`
      + `<path d="M32.5 20L30.5 15M35 19L35.5 13M37.5 20L40 16" stroke="${GREEN}" stroke-width="1.5"/>`
      + `<circle cx="30" cy="14" r="1.6" fill="${GREEN}"/><circle cx="35.5" cy="12" r="1.6" fill="${GREEN}"/><circle cx="40.5" cy="15" r="1.6" fill="${GREEN}"/>`
      + `<circle cx="37" cy="24" r="2.25" fill="${IVORY}"/><circle cx="37.4" cy="24" r="1.2" fill="${INK}"/>`
      + "</g>";
  }

  function bamboos(number, red) {
    if (number === 1) return peacock();
    if (number === 8) {
      /* Traditional 8-sou: an M above a W, each made of four green stalks. */
      const diagonal = Math.hypot(16, 16);
      return [
        bamboo(10, 22, 22, GREEN, 0, 4.7),
        bamboo(18, 19, diagonal, GREEN, -45, 4.7),
        bamboo(34, 19, diagonal, GREEN, 45, 4.7),
        bamboo(42, 22, 22, GREEN, 0, 4.7),
        bamboo(10, 54, 22, GREEN, 0, 4.7),
        bamboo(18, 57, diagonal, GREEN, 45, 4.7),
        bamboo(34, 57, diagonal, GREEN, -45, 4.7),
        bamboo(42, 54, 22, GREEN, 0, 4.7)
      ].join("");
    }
    const positions = {
      2: [[26, 19], [26, 57]],
      3: [[26, 17], [14, 55], [38, 55]],
      4: [[14, 18], [38, 18], [14, 58], [38, 58]],
      5: [[13, 16], [39, 16], [26, 38], [13, 60], [39, 60]],
      6: [[12, 19], [26, 19], [40, 19], [12, 57], [26, 57], [40, 57]],
      7: [[26, 12], [12, 35], [26, 35], [40, 35], [12, 60], [26, 60], [40, 60]],
      9: [[12, 13], [26, 13], [40, 13], [12, 38], [26, 38], [40, 38], [12, 63], [26, 63], [40, 63]]
    };
    const height = number <= 4 ? 23 : number === 6 ? 24 : number === 5 ? 19 : 17;
    return positions[number].map(([x, y], index) => bamboo(
      x, y, height,
      red || number === 5 && index === 2 || number === 7 && index === 0
        || number === 9 && index % 3 === 1 ? RED : GREEN,
      0, number === 6 || number === 9 ? 5.2 : 5.8
    )).join("");
  }

  function face(rawCode) {
    const input = String(rawCode ?? "").trim().toLowerCase();
    const code = ALIASES[input] || input;
    if (cache.has(code)) return cache.get(code);
    const match = /^([0-9])([mps])$|^([1-7])(z)$/.exec(code);
    if (!match) {
      return `<span class="tile tile-crafted"><span class="tile-fallback">${escape(rawCode ?? "")}</span></span>`;
    }
    const rawNumber = Number(match[1] ?? match[3]);
    const suit = match[2] || match[4];
    const red = rawNumber === 0;
    const number = red ? 5 : rawNumber;
    let drawing = "";
    if (suit === "m") drawing = characters(number, red);
    if (suit === "p") drawing = circles(number, red);
    if (suit === "s") drawing = bamboos(number, red);
    if (suit === "z" && number !== 5) {
      drawing = glyph(HONORS[number], 26, 55, 49, number === 6 ? GREEN : number === 7 ? RED : INK, 43);
    }
    const result = `<span class="tile tile-crafted tile-${suit}${red ? " is-red" : ""}${suit === "z" && number === 5 ? " tile-blank" : ""}" aria-hidden="true">`
      + `<svg class="tile-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 76" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${drawing}</svg></span>`;
    cache.set(code, result);
    return result;
  }

  window.MahjongTileArt = Object.freeze({ face });
})();
