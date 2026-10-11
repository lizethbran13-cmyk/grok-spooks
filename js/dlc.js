/* Grok Spooks - Ratita Industries Super Pack (DLC). Unlocked in the Grok Arcade DLC Shop, which sets
   localStorage['grokDLC.spooks.ratita_industries_super_pack_e'] on the shared lizethbran13-cmyk.github.io origin.
   Online: a host who owns the pack shares it with everyone in the room for that session. */
(function () {
'use strict';
const SP = window.SP = window.SP || {};
const D = SP.DLC = { KEY: 'grokDLC.spooks.ratita_industries_super_pack_e', NAME: 'Ratita Industries Super Pack', PRICE: 25,
  SHOP: 'https://lizethbran13-cmyk.github.io/grok-arcade/', hostShare: false };
D.mine = function () { try { return !!localStorage.getItem(D.KEY); } catch (e) { return false; } };
// usable now: you own it, or you are a guest in a room whose host owns it
D.on = function () { return D.mine() || D.hostShare; };
D.FIRST_AREA = 6; // areas 6 + 7 are the Ratita Industries labs
D.isDlcArea = (a) => a >= D.FIRST_AREA;
})();
