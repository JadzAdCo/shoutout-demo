/* phone-country-codes.js — ITU/E.164 country calling codes for FLOQR SMS auth */
(function (root) {
  "use strict";

  var CODES = [
    { dial: "+93", name: "Afghanistan" },
    { dial: "+355", name: "Albania" },
    { dial: "+213", name: "Algeria" },
    { dial: "+1-684", name: "American Samoa" },
    { dial: "+376", name: "Andorra" },
    { dial: "+244", name: "Angola" },
    { dial: "+1-264", name: "Anguilla" },
    { dial: "+1-268", name: "Antigua and Barbuda" },
    { dial: "+54", name: "Argentina" },
    { dial: "+374", name: "Armenia" },
    { dial: "+297", name: "Aruba" },
    { dial: "+61", name: "Australia" },
    { dial: "+43", name: "Austria" },
    { dial: "+994", name: "Azerbaijan" },
    { dial: "+1-242", name: "Bahamas" },
    { dial: "+973", name: "Bahrain" },
    { dial: "+880", name: "Bangladesh" },
    { dial: "+1-246", name: "Barbados" },
    { dial: "+375", name: "Belarus" },
    { dial: "+32", name: "Belgium" },
    { dial: "+501", name: "Belize" },
    { dial: "+229", name: "Benin" },
    { dial: "+1-441", name: "Bermuda" },
    { dial: "+975", name: "Bhutan" },
    { dial: "+591", name: "Bolivia" },
    { dial: "+387", name: "Bosnia and Herzegovina" },
    { dial: "+267", name: "Botswana" },
    { dial: "+55", name: "Brazil" },
    { dial: "+246", name: "British Indian Ocean Territory" },
    { dial: "+1-284", name: "British Virgin Islands" },
    { dial: "+673", name: "Brunei" },
    { dial: "+359", name: "Bulgaria" },
    { dial: "+226", name: "Burkina Faso" },
    { dial: "+257", name: "Burundi" },
    { dial: "+855", name: "Cambodia" },
    { dial: "+237", name: "Cameroon" },
    { dial: "+238", name: "Cape Verde" },
    { dial: "+1-345", name: "Cayman Islands" },
    { dial: "+236", name: "Central African Republic" },
    { dial: "+235", name: "Chad" },
    { dial: "+56", name: "Chile" },
    { dial: "+86", name: "China" },
    { dial: "+61", name: "Christmas Island" },
    { dial: "+61", name: "Cocos (Keeling) Islands" },
    { dial: "+57", name: "Colombia" },
    { dial: "+269", name: "Comoros" },
    { dial: "+242", name: "Congo" },
    { dial: "+243", name: "Congo (DRC)" },
    { dial: "+682", name: "Cook Islands" },
    { dial: "+506", name: "Costa Rica" },
    { dial: "+225", name: "Cote d'Ivoire" },
    { dial: "+385", name: "Croatia" },
    { dial: "+53", name: "Cuba" },
    { dial: "+599", name: "Curacao" },
    { dial: "+357", name: "Cyprus" },
    { dial: "+420", name: "Czech Republic" },
    { dial: "+45", name: "Denmark" },
    { dial: "+253", name: "Djibouti" },
    { dial: "+1-767", name: "Dominica" },
    { dial: "+1-809", name: "Dominican Republic" },
    { dial: "+593", name: "Ecuador" },
    { dial: "+20", name: "Egypt" },
    { dial: "+503", name: "El Salvador" },
    { dial: "+240", name: "Equatorial Guinea" },
    { dial: "+291", name: "Eritrea" },
    { dial: "+372", name: "Estonia" },
    { dial: "+268", name: "Eswatini" },
    { dial: "+251", name: "Ethiopia" },
    { dial: "+500", name: "Falkland Islands" },
    { dial: "+298", name: "Faroe Islands" },
    { dial: "+679", name: "Fiji" },
    { dial: "+358", name: "Finland" },
    { dial: "+33", name: "France" },
    { dial: "+594", name: "French Guiana" },
    { dial: "+689", name: "French Polynesia" },
    { dial: "+241", name: "Gabon" },
    { dial: "+220", name: "Gambia" },
    { dial: "+995", name: "Georgia" },
    { dial: "+49", name: "Germany" },
    { dial: "+233", name: "Ghana" },
    { dial: "+350", name: "Gibraltar" },
    { dial: "+30", name: "Greece" },
    { dial: "+299", name: "Greenland" },
    { dial: "+1-473", name: "Grenada" },
    { dial: "+590", name: "Guadeloupe" },
    { dial: "+1-671", name: "Guam" },
    { dial: "+502", name: "Guatemala" },
    { dial: "+44", name: "Guernsey" },
    { dial: "+224", name: "Guinea" },
    { dial: "+245", name: "Guinea-Bissau" },
    { dial: "+592", name: "Guyana" },
    { dial: "+509", name: "Haiti" },
    { dial: "+504", name: "Honduras" },
    { dial: "+852", name: "Hong Kong" },
    { dial: "+36", name: "Hungary" },
    { dial: "+354", name: "Iceland" },
    { dial: "+91", name: "India" },
    { dial: "+62", name: "Indonesia" },
    { dial: "+98", name: "Iran" },
    { dial: "+964", name: "Iraq" },
    { dial: "+353", name: "Ireland" },
    { dial: "+44", name: "Isle of Man" },
    { dial: "+972", name: "Israel" },
    { dial: "+39", name: "Italy" },
    { dial: "+1-876", name: "Jamaica" },
    { dial: "+81", name: "Japan" },
    { dial: "+44", name: "Jersey" },
    { dial: "+962", name: "Jordan" },
    { dial: "+7", name: "Kazakhstan" },
    { dial: "+254", name: "Kenya" },
    { dial: "+686", name: "Kiribati" },
    { dial: "+383", name: "Kosovo" },
    { dial: "+965", name: "Kuwait" },
    { dial: "+996", name: "Kyrgyzstan" },
    { dial: "+856", name: "Laos" },
    { dial: "+371", name: "Latvia" },
    { dial: "+961", name: "Lebanon" },
    { dial: "+266", name: "Lesotho" },
    { dial: "+231", name: "Liberia" },
    { dial: "+218", name: "Libya" },
    { dial: "+423", name: "Liechtenstein" },
    { dial: "+370", name: "Lithuania" },
    { dial: "+352", name: "Luxembourg" },
    { dial: "+853", name: "Macau" },
    { dial: "+261", name: "Madagascar" },
    { dial: "+265", name: "Malawi" },
    { dial: "+60", name: "Malaysia" },
    { dial: "+960", name: "Maldives" },
    { dial: "+223", name: "Mali" },
    { dial: "+356", name: "Malta" },
    { dial: "+692", name: "Marshall Islands" },
    { dial: "+596", name: "Martinique" },
    { dial: "+222", name: "Mauritania" },
    { dial: "+230", name: "Mauritius" },
    { dial: "+262", name: "Mayotte" },
    { dial: "+52", name: "Mexico" },
    { dial: "+691", name: "Micronesia" },
    { dial: "+373", name: "Moldova" },
    { dial: "+377", name: "Monaco" },
    { dial: "+976", name: "Mongolia" },
    { dial: "+382", name: "Montenegro" },
    { dial: "+1-664", name: "Montserrat" },
    { dial: "+212", name: "Morocco" },
    { dial: "+258", name: "Mozambique" },
    { dial: "+95", name: "Myanmar" },
    { dial: "+264", name: "Namibia" },
    { dial: "+674", name: "Nauru" },
    { dial: "+977", name: "Nepal" },
    { dial: "+31", name: "Netherlands" },
    { dial: "+687", name: "New Caledonia" },
    { dial: "+64", name: "New Zealand" },
    { dial: "+505", name: "Nicaragua" },
    { dial: "+227", name: "Niger" },
    { dial: "+234", name: "Nigeria" },
    { dial: "+683", name: "Niue" },
    { dial: "+672", name: "Norfolk Island" },
    { dial: "+850", name: "North Korea" },
    { dial: "+389", name: "North Macedonia" },
    { dial: "+1-670", name: "Northern Mariana Islands" },
    { dial: "+47", name: "Norway" },
    { dial: "+968", name: "Oman" },
    { dial: "+92", name: "Pakistan" },
    { dial: "+680", name: "Palau" },
    { dial: "+970", name: "Palestine" },
    { dial: "+507", name: "Panama" },
    { dial: "+675", name: "Papua New Guinea" },
    { dial: "+595", name: "Paraguay" },
    { dial: "+51", name: "Peru" },
    { dial: "+63", name: "Philippines" },
    { dial: "+48", name: "Poland" },
    { dial: "+351", name: "Portugal" },
    { dial: "+1-787", name: "Puerto Rico" },
    { dial: "+974", name: "Qatar" },
    { dial: "+262", name: "Reunion" },
    { dial: "+40", name: "Romania" },
    { dial: "+7", name: "Russia" },
    { dial: "+250", name: "Rwanda" },
    { dial: "+590", name: "Saint Barthelemy" },
    { dial: "+290", name: "Saint Helena" },
    { dial: "+1-869", name: "Saint Kitts and Nevis" },
    { dial: "+1-758", name: "Saint Lucia" },
    { dial: "+590", name: "Saint Martin" },
    { dial: "+508", name: "Saint Pierre and Miquelon" },
    { dial: "+1-784", name: "Saint Vincent and the Grenadines" },
    { dial: "+685", name: "Samoa" },
    { dial: "+378", name: "San Marino" },
    { dial: "+239", name: "Sao Tome and Principe" },
    { dial: "+966", name: "Saudi Arabia" },
    { dial: "+221", name: "Senegal" },
    { dial: "+381", name: "Serbia" },
    { dial: "+248", name: "Seychelles" },
    { dial: "+232", name: "Sierra Leone" },
    { dial: "+65", name: "Singapore" },
    { dial: "+1-721", name: "Sint Maarten" },
    { dial: "+421", name: "Slovakia" },
    { dial: "+386", name: "Slovenia" },
    { dial: "+677", name: "Solomon Islands" },
    { dial: "+252", name: "Somalia" },
    { dial: "+27", name: "South Africa" },
    { dial: "+82", name: "South Korea" },
    { dial: "+211", name: "South Sudan" },
    { dial: "+34", name: "Spain" },
    { dial: "+94", name: "Sri Lanka" },
    { dial: "+249", name: "Sudan" },
    { dial: "+597", name: "Suriname" },
    { dial: "+47", name: "Svalbard and Jan Mayen" },
    { dial: "+46", name: "Sweden" },
    { dial: "+41", name: "Switzerland" },
    { dial: "+963", name: "Syria" },
    { dial: "+886", name: "Taiwan" },
    { dial: "+992", name: "Tajikistan" },
    { dial: "+255", name: "Tanzania" },
    { dial: "+66", name: "Thailand" },
    { dial: "+670", name: "Timor-Leste" },
    { dial: "+228", name: "Togo" },
    { dial: "+690", name: "Tokelau" },
    { dial: "+676", name: "Tonga" },
    { dial: "+1-868", name: "Trinidad and Tobago" },
    { dial: "+216", name: "Tunisia" },
    { dial: "+90", name: "Turkey" },
    { dial: "+993", name: "Turkmenistan" },
    { dial: "+1-649", name: "Turks and Caicos Islands" },
    { dial: "+688", name: "Tuvalu" },
    { dial: "+1-340", name: "U.S. Virgin Islands" },
    { dial: "+256", name: "Uganda" },
    { dial: "+380", name: "Ukraine" },
    { dial: "+971", name: "United Arab Emirates" },
    { dial: "+44", name: "United Kingdom" },
    { dial: "+1", name: "United States / Canada" },
    { dial: "+598", name: "Uruguay" },
    { dial: "+998", name: "Uzbekistan" },
    { dial: "+678", name: "Vanuatu" },
    { dial: "+39", name: "Vatican City" },
    { dial: "+58", name: "Venezuela" },
    { dial: "+84", name: "Vietnam" },
    { dial: "+681", name: "Wallis and Futuna" },
    { dial: "+212", name: "Western Sahara" },
    { dial: "+967", name: "Yemen" },
    { dial: "+260", name: "Zambia" },
    { dial: "+263", name: "Zimbabwe" }
  ];

  /* Normalize NANP territory dials to +1 for select values used in E.164 join. */
  function normalizeDial(dial) {
    var d = String(dial || "").trim();
    if (!d) return "+1";
    if (d.charAt(0) !== "+") d = "+" + d.replace(/[^\d]/g, "");
    /* Keep primary country codes; strip NANP NPA suffix for join (value stays as listed for display entries that use +1-XXX). */
    return d;
  }

  /** Dial used as option value / join prefix (NANP territories → +1). */
  function dialValue(entry) {
    var d = normalizeDial(entry && entry.dial);
    if (/^\+1-\d+$/.test(d)) return "+1";
    return d;
  }

  function compareNames(a, b) {
    var an = (a && a.name) || "";
    var bn = (b && b.name) || "";
    if (an < bn) return -1;
    if (an > bn) return 1;
    return 0;
  }

  function pinRank(entry) {
    var name = (entry && entry.name) || "";
    var dial = dialValue(entry);
    if (dial === "+1" && name.indexOf("United States") === 0) return 0;
    if (dial === "+44" && name === "United Kingdom") return 1;
    return 100;
  }

  function sortedCodes() {
    var copy = CODES.slice();
    copy.sort(function (a, b) {
      var pa = pinRank(a);
      var pb = pinRank(b);
      if (pa !== pb) return pa - pb;
      return compareNames(a, b);
    });
    return copy;
  }

  /**
   * Fill a <select> with "Country Name (+NN)" options.
   * @param {HTMLSelectElement} selectEl
   * @param {string} [selectedDial] preferred dial, default +1
   */
  function populateSelect(selectEl, selectedDial) {
    if (!selectEl) return;
    var prefer = normalizeDial(selectedDial || "+1");
    if (/^\+1-\d+$/.test(prefer)) prefer = "+1";
    selectEl.innerHTML = "";
    var list = sortedCodes();
    var i;
    var matched = false;
    for (i = 0; i < list.length; i++) {
      var entry = list[i];
      var opt = document.createElement("option");
      var value = dialValue(entry);
      opt.value = value;
      opt.textContent = entry.name + " (" + entry.dial + ")";
      opt.setAttribute("data-name", entry.name);
      if (!matched && value === prefer) {
        opt.selected = true;
        matched = true;
      }
      selectEl.appendChild(opt);
    }
    if (!matched && selectEl.options.length) {
      selectEl.selectedIndex = 0;
    }
  }

  /**
   * Parse raw phone into dial + national digits.
   * @param {string} raw
   * @returns {{ dial: string, national: string }}
   */
  function splitPhone(raw) {
    var s = String(raw || "").trim();
    var digitsOnly = s.replace(/[^\d]/g, "");
    var dial = "+1";
    var national = digitsOnly;

    if (s.charAt(0) === "+" || s.indexOf("00") === 0) {
      var rest = s.charAt(0) === "+" ? s.slice(1) : s.slice(2);
      rest = rest.replace(/[^\d]/g, "");
      var best = null;
      var codes = sortedCodes();
      var i;
      for (i = 0; i < codes.length; i++) {
        var dv = dialValue(codes[i]).replace(/^\+/, "");
        if (rest.indexOf(dv) === 0) {
          if (!best || dv.length > best.length) best = dv;
        }
      }
      if (best) {
        dial = "+" + best;
        national = rest.slice(best.length);
      } else if (rest.length) {
        dial = "+" + rest.slice(0, 1);
        national = rest.slice(1);
      }
    } else if (digitsOnly.length === 10) {
      dial = "+1";
      national = digitsOnly;
    } else if (digitsOnly.length === 11 && digitsOnly.charAt(0) === "1") {
      dial = "+1";
      national = digitsOnly.slice(1);
    }

    return { dial: dial, national: national };
  }

  /**
   * Join dial + national into E.164 string.
   * @param {string} dial
   * @param {string} national
   * @returns {string}
   */
  function joinPhone(dial, national) {
    var d = normalizeDial(dial);
    if (/^\+1-\d+$/.test(d)) d = "+1";
    var n = String(national || "").replace(/[^\d]/g, "");
    if (!n) return d;
    return d + n;
  }

  root.FLOQRPhoneCountries = {
    codes: CODES,
    populateSelect: populateSelect,
    splitPhone: splitPhone,
    joinPhone: joinPhone
  };
})(typeof window !== "undefined" ? window : this);
