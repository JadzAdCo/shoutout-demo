/**
 * FIFA-style national home kits for photo jersey generation.
 * Colors = typical home primary / secondary / optional collar accents.
 * Named LED files: images/soccer/soccer-{slug}-back-with-country.png (nations)
 * and soccer-{slug}-back-with-club.png (clubs).
 */
(function (global) {
  "use strict";

  /** @type {Array<{name:string,region:string,primary:string,secondary:string,accent?:string,collar:string}>} */
  const NATIONAL_TEAMS = [
    // —— Africa (CAF) ——
    {name: "Algeria", region: "Africa", primary: "#007A3D", secondary: "#FFFFFF", accent: "#D21034", collar: "green white red"},
    {name: "Angola", region: "Africa", primary: "#C8102E", secondary: "#000000", accent: "#FFCD00", collar: "red black yellow"},
    {name: "Benin", region: "Africa", primary: "#008751", secondary: "#FCD116", accent: "#E8112D", collar: "green yellow red"},
    {name: "Botswana", region: "Africa", primary: "#75AADB", secondary: "#000000", accent: "#FFFFFF", collar: "light blue black white"},
    {name: "Burkina Faso", region: "Africa", primary: "#EF2B2D", secondary: "#009E49", accent: "#FCD116", collar: "red green yellow"},
    {name: "Burundi", region: "Africa", primary: "#CE1126", secondary: "#1EB53A", accent: "#FFFFFF", collar: "red green white"},
    {name: "Cameroon", region: "Africa", primary: "#007A33", secondary: "#FCD116", accent: "#CE1126", collar: "green then RED then yellow"},
    {name: "Cape Verde", region: "Africa", primary: "#003893", secondary: "#FFFFFF", accent: "#CF2027", collar: "blue white red"},
    {name: "Central African Republic", region: "Africa", primary: "#003082", secondary: "#289728", accent: "#FFCE00", collar: "blue green yellow"},
    {name: "Chad", region: "Africa", primary: "#002664", secondary: "#FECB00", accent: "#C60C30", collar: "blue yellow red"},
    {name: "Comoros", region: "Africa", primary: "#3A75C4", secondary: "#FFFFFF", accent: "#CE1126", collar: "blue white red"},
    {name: "Congo", region: "Africa", primary: "#009543", secondary: "#FBDE4A", accent: "#DC241F", collar: "green yellow red"},
    {name: "DR Congo", region: "Africa", primary: "#007FFF", secondary: "#F7D618", accent: "#CE1021", collar: "blue yellow red"},
    {name: "Djibouti", region: "Africa", primary: "#6AB2E7", secondary: "#12AD2B", accent: "#D7141A", collar: "light blue green red"},
    {name: "Egypt", region: "Africa", primary: "#CE1126", secondary: "#FFFFFF", accent: "#000000", collar: "red white black"},
    {name: "Equatorial Guinea", region: "Africa", primary: "#3E9A00", secondary: "#FFFFFF", accent: "#E32118", collar: "green white red"},
    {name: "Eritrea", region: "Africa", primary: "#EA0437", secondary: "#12AD2B", accent: "#4189DD", collar: "red green blue"},
    {name: "Eswatini", region: "Africa", primary: "#3E5EB9", secondary: "#FFD100", accent: "#FF4E00", collar: "blue yellow orange"},
    {name: "Ethiopia", region: "Africa", primary: "#078930", secondary: "#FCDD09", accent: "#DA121A", collar: "green yellow red"},
    {name: "Gabon", region: "Africa", primary: "#009E60", secondary: "#FCD116", accent: "#3A75C4", collar: "green yellow blue"},
    {name: "Gambia", region: "Africa", primary: "#CE1126", secondary: "#0C1C8C", accent: "#3A7728", collar: "red blue green"},
    {name: "Ghana", region: "Africa", primary: "#006B3F", secondary: "#FCD116", accent: "#CE1126", collar: "green yellow red"},
    {name: "Guinea", region: "Africa", primary: "#CE1126", secondary: "#FCD116", accent: "#009460", collar: "red yellow green"},
    {name: "Guinea-Bissau", region: "Africa", primary: "#CE1126", secondary: "#FCD116", accent: "#009E49", collar: "red yellow green"},
    {name: "Ivory Coast", region: "Africa", primary: "#F77F00", secondary: "#FFFFFF", accent: "#009E60", collar: "orange white green"},
    {name: "Kenya", region: "Africa", primary: "#000000", secondary: "#BB0000", accent: "#006600", collar: "black red green"},
    {name: "Lesotho", region: "Africa", primary: "#009543", secondary: "#00209F", accent: "#FFFFFF", collar: "green blue white"},
    {name: "Liberia", region: "Africa", primary: "#BF0A30", secondary: "#002868", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Libya", region: "Africa", primary: "#239E46", secondary: "#000000", accent: "#E70013", collar: "green black red"},
    {name: "Madagascar", region: "Africa", primary: "#FC3D32", secondary: "#007E3A", accent: "#FFFFFF", collar: "red green white"},
    {name: "Malawi", region: "Africa", primary: "#CE1126", secondary: "#339E35", accent: "#000000", collar: "red green black"},
    {name: "Mali", region: "Africa", primary: "#14B53A", secondary: "#FCD116", accent: "#CE1126", collar: "green yellow red"},
    {name: "Mauritania", region: "Africa", primary: "#006233", secondary: "#FFC400", collar: "green gold"},
    {name: "Mauritius", region: "Africa", primary: "#00A551", secondary: "#EA2839", accent: "#1A206D", collar: "green red blue"},
    {name: "Morocco", region: "Africa", primary: "#C1272D", secondary: "#006233", collar: "red green"},
    {name: "Mozambique", region: "Africa", primary: "#007168", secondary: "#FCE100", accent: "#D21034", collar: "teal yellow red"},
    {name: "Namibia", region: "Africa", primary: "#003580", secondary: "#009543", accent: "#C8102E", collar: "blue green red"},
    {name: "Niger", region: "Africa", primary: "#E05206", secondary: "#0DB02B", accent: "#FFFFFF", collar: "orange green white"},
    {name: "Nigeria", region: "Africa", primary: "#008751", secondary: "#FFFFFF", collar: "green white"},
    {name: "Rwanda", region: "Africa", primary: "#00A1DE", secondary: "#FAD201", accent: "#20603D", collar: "sky blue yellow green"},
    {name: "Sao Tome and Principe", region: "Africa", primary: "#12AD2B", secondary: "#FFD924", accent: "#D21034", collar: "green yellow red"},
    {name: "Senegal", region: "Africa", primary: "#00853F", secondary: "#FDEF42", accent: "#E31B23", collar: "green yellow red"},
    {name: "Seychelles", region: "Africa", primary: "#003F87", secondary: "#FCD856", accent: "#D62828", collar: "blue yellow red"},
    {name: "Sierra Leone", region: "Africa", primary: "#1EB53A", secondary: "#FFFFFF", accent: "#0072C6", collar: "green white blue"},
    {name: "Somalia", region: "Africa", primary: "#4189DD", secondary: "#FFFFFF", collar: "blue white"},
    {name: "South Africa", region: "Africa", primary: "#007A4D", secondary: "#FFB81C", accent: "#000000", collar: "green gold black"},
    {name: "South Sudan", region: "Africa", primary: "#0F47AF", secondary: "#078930", accent: "#DA121A", collar: "blue green red"},
    {name: "Sudan", region: "Africa", primary: "#D21034", secondary: "#007229", accent: "#000000", collar: "red green black"},
    {name: "Tanzania", region: "Africa", primary: "#1EB53A", secondary: "#00A3DD", accent: "#FCD116", collar: "green blue yellow"},
    {name: "Togo", region: "Africa", primary: "#006A4E", secondary: "#FFCE00", accent: "#D21034", collar: "green yellow red"},
    {name: "Tunisia", region: "Africa", primary: "#E70013", secondary: "#FFFFFF", collar: "red white"},
    {name: "Uganda", region: "Africa", primary: "#FCDC04", secondary: "#D90000", accent: "#000000", collar: "yellow red black"},
    {name: "Zambia", region: "Africa", primary: "#198A00", secondary: "#EF7D00", accent: "#DE2010", collar: "green orange red"},
    {name: "Zimbabwe", region: "Africa", primary: "#006400", secondary: "#D40000", accent: "#FFD200", collar: "green red yellow"},

    // —— Europe (UEFA) ——
    {name: "Albania", region: "Europe", primary: "#E41E20", secondary: "#000000", collar: "red black"},
    {name: "Andorra", region: "Europe", primary: "#0018A8", secondary: "#FEDD00", accent: "#D0103A", collar: "blue yellow red"},
    {name: "Armenia", region: "Europe", primary: "#D90012", secondary: "#0033A0", accent: "#F2A800", collar: "red blue orange"},
    {name: "Austria", region: "Europe", primary: "#ED2939", secondary: "#FFFFFF", collar: "red white"},
    {name: "Azerbaijan", region: "Europe", primary: "#00B5E2", secondary: "#EF3340", accent: "#509E2F", collar: "blue red green"},
    {name: "Belarus", region: "Europe", primary: "#CE1720", secondary: "#4AA657", accent: "#FFFFFF", collar: "red green white"},
    {name: "Belgium", region: "Europe", primary: "#FDDA24", secondary: "#000000", accent: "#EF3340", collar: "yellow black red"},
    {name: "Bosnia and Herzegovina", region: "Europe", primary: "#002395", secondary: "#FECB00", collar: "blue yellow"},
    {name: "Bulgaria", region: "Europe", primary: "#FFFFFF", secondary: "#00966E", accent: "#D62612", collar: "white green red"},
    {name: "Croatia", region: "Europe", primary: "#FF0000", secondary: "#FFFFFF", accent: "#171796", collar: "red white blue checker accents"},
    {name: "Cyprus", region: "Europe", primary: "#FFFFFF", secondary: "#D47600", accent: "#0A5C2E", collar: "white orange green"},
    {name: "Czechia", region: "Europe", primary: "#D7141A", secondary: "#11457E", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Denmark", region: "Europe", primary: "#C60C30", secondary: "#FFFFFF", collar: "red white"},
    {name: "England", region: "Europe", primary: "#FFFFFF", secondary: "#CF081F", accent: "#00247D", collar: "white red navy"},
    {name: "Estonia", region: "Europe", primary: "#0072CE", secondary: "#000000", accent: "#FFFFFF", collar: "blue black white"},
    {name: "Faroe Islands", region: "Europe", primary: "#FFFFFF", secondary: "#0065A4", accent: "#ED2939", collar: "white blue red"},
    {name: "Finland", region: "Europe", primary: "#FFFFFF", secondary: "#003580", collar: "white blue"},
    {name: "France", region: "Europe", primary: "#002395", secondary: "#FFFFFF", accent: "#ED2939", collar: "blue white red"},
    {name: "Georgia", region: "Europe", primary: "#FFFFFF", secondary: "#FF0000", collar: "white red"},
    {name: "Germany", region: "Europe", primary: "#FFFFFF", secondary: "#000000", accent: "#DD0000", collar: "white black red"},
    {name: "Gibraltar", region: "Europe", primary: "#FFFFFF", secondary: "#C8102E", collar: "white red"},
    {name: "Greece", region: "Europe", primary: "#0D5EAF", secondary: "#FFFFFF", collar: "blue white"},
    {name: "Hungary", region: "Europe", primary: "#CE2939", secondary: "#FFFFFF", accent: "#477050", collar: "red white green"},
    {name: "Iceland", region: "Europe", primary: "#02529C", secondary: "#DC1E35", accent: "#FFFFFF", collar: "blue red white"},
    {name: "Ireland", region: "Europe", primary: "#169B62", secondary: "#FF883E", accent: "#FFFFFF", collar: "green orange white"},
    {name: "Israel", region: "Europe", primary: "#FFFFFF", secondary: "#0038B8", collar: "white blue"},
    {name: "Italy", region: "Europe", primary: "#0066B3", secondary: "#FFFFFF", accent: "#C8102E", collar: "azzurro blue white red"},
    {name: "Kazakhstan", region: "Europe", primary: "#00AFCA", secondary: "#FEC50C", collar: "sky blue gold"},
    {name: "Kosovo", region: "Europe", primary: "#244AA5", secondary: "#D0A650", accent: "#FFFFFF", collar: "blue gold white"},
    {name: "Latvia", region: "Europe", primary: "#9E3039", secondary: "#FFFFFF", collar: "maroon white"},
    {name: "Liechtenstein", region: "Europe", primary: "#002B7F", secondary: "#CE1126", accent: "#FFD700", collar: "blue red gold"},
    {name: "Lithuania", region: "Europe", primary: "#FDB913", secondary: "#006A44", accent: "#C1272D", collar: "yellow green red"},
    {name: "Luxembourg", region: "Europe", primary: "#00A1DE", secondary: "#EF3340", accent: "#FFFFFF", collar: "light blue red white"},
    {name: "Malta", region: "Europe", primary: "#FFFFFF", secondary: "#CF142B", collar: "white red"},
    {name: "Moldova", region: "Europe", primary: "#003DA5", secondary: "#FFD200", accent: "#C8102E", collar: "blue yellow red"},
    {name: "Montenegro", region: "Europe", primary: "#C40308", secondary: "#D4AF37", collar: "red gold"},
    {name: "Netherlands", region: "Europe", primary: "#FF6600", secondary: "#FFFFFF", accent: "#21468B", collar: "orange white blue"},
    {name: "North Macedonia", region: "Europe", primary: "#D20000", secondary: "#FFE600", collar: "red yellow"},
    {name: "Northern Ireland", region: "Europe", primary: "#006633", secondary: "#FFFFFF", accent: "#C8102E", collar: "green white red"},
    {name: "Norway", region: "Europe", primary: "#BA0C2F", secondary: "#00205B", accent: "#FFFFFF", collar: "red navy white"},
    {name: "Poland", region: "Europe", primary: "#FFFFFF", secondary: "#DC143C", collar: "white red"},
    {name: "Portugal", region: "Europe", primary: "#FF0000", secondary: "#006600", accent: "#FFD700", collar: "red green gold"},
    {name: "Romania", region: "Europe", primary: "#002B7F", secondary: "#FCD116", accent: "#CE1126", collar: "blue yellow red"},
    {name: "Russia", region: "Europe", primary: "#FFFFFF", secondary: "#0039A6", accent: "#D52B1E", collar: "white blue red"},
    {name: "San Marino", region: "Europe", primary: "#5EB6E4", secondary: "#FFFFFF", collar: "light blue white"},
    {name: "Scotland", region: "Europe", primary: "#0065BD", secondary: "#FFFFFF", collar: "navy blue white"},
    {name: "Serbia", region: "Europe", primary: "#C6363C", secondary: "#0C4076", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Slovakia", region: "Europe", primary: "#0B4EA2", secondary: "#EE1C25", accent: "#FFFFFF", collar: "blue red white"},
    {name: "Slovenia", region: "Europe", primary: "#0055A4", secondary: "#FFFFFF", accent: "#ED1C24", collar: "blue white red"},
    {name: "Spain", region: "Europe", primary: "#AA151B", secondary: "#F1BF00", collar: "red gold"},
    {name: "Sweden", region: "Europe", primary: "#FECC02", secondary: "#0058A7", collar: "yellow blue"},
    {name: "Switzerland", region: "Europe", primary: "#FF0000", secondary: "#FFFFFF", collar: "red white"},
    {name: "Turkey", region: "Europe", primary: "#E30A17", secondary: "#FFFFFF", collar: "red white"},
    {name: "Ukraine", region: "Europe", primary: "#0057B8", secondary: "#FFD700", collar: "blue yellow"},
    {name: "Wales", region: "Europe", primary: "#C8102E", secondary: "#FFFFFF", accent: "#00B140", collar: "red white green"},

    // —— Asia (AFC) ——
    {name: "Afghanistan", region: "Asia", primary: "#000000", secondary: "#D32011", accent: "#007A36", collar: "black red green"},
    {name: "Australia", region: "Asia", primary: "#FFCD00", secondary: "#00843D", collar: "gold green"},
    {name: "Bahrain", region: "Asia", primary: "#CE1126", secondary: "#FFFFFF", collar: "red white"},
    {name: "Bangladesh", region: "Asia", primary: "#006A4E", secondary: "#F42A41", collar: "green red"},
    {name: "Bhutan", region: "Asia", primary: "#FF4E00", secondary: "#FFD520", accent: "#FFFFFF", collar: "orange yellow"},
    {name: "Brunei", region: "Asia", primary: "#F7E017", secondary: "#FFFFFF", accent: "#000000", collar: "yellow white black"},
    {name: "Cambodia", region: "Asia", primary: "#032EA1", secondary: "#E00025", accent: "#FFFFFF", collar: "blue red white"},
    {name: "China", region: "Asia", primary: "#DE2910", secondary: "#FFDE00", collar: "red gold"},
    {name: "Hong Kong", region: "Asia", primary: "#DE2910", secondary: "#FFFFFF", collar: "red white"},
    {name: "India", region: "Asia", primary: "#FF9933", secondary: "#138808", accent: "#FFFFFF", collar: "saffron green white"},
    {name: "Indonesia", region: "Asia", primary: "#CE1126", secondary: "#FFFFFF", collar: "red white"},
    {name: "Iran", region: "Asia", primary: "#FFFFFF", secondary: "#239F40", accent: "#DA0000", collar: "white green red"},
    {name: "Iraq", region: "Asia", primary: "#FFFFFF", secondary: "#CE1126", accent: "#000000", collar: "white red black"},
    {name: "Japan", region: "Asia", primary: "#0000A0", secondary: "#FFFFFF", accent: "#BC002D", collar: "navy white red"},
    {name: "Jordan", region: "Asia", primary: "#CE1126", secondary: "#000000", accent: "#007A3D", collar: "red black green"},
    {name: "Kuwait", region: "Asia", primary: "#007A3D", secondary: "#FFFFFF", accent: "#CE1126", collar: "green white red"},
    {name: "Kyrgyzstan", region: "Asia", primary: "#E8112D", secondary: "#FFEF00", collar: "red yellow"},
    {name: "Laos", region: "Asia", primary: "#CE1126", secondary: "#002868", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Lebanon", region: "Asia", primary: "#EE161F", secondary: "#FFFFFF", accent: "#00A651", collar: "red white green"},
    {name: "Macau", region: "Asia", primary: "#00785E", secondary: "#FFFFFF", accent: "#F7C109", collar: "green white gold"},
    {name: "Malaysia", region: "Asia", primary: "#CC0001", secondary: "#010066", accent: "#FFCC00", collar: "red blue yellow"},
    {name: "Maldives", region: "Asia", primary: "#D21034", secondary: "#007E3A", accent: "#FFFFFF", collar: "red green white"},
    {name: "Mongolia", region: "Asia", primary: "#C4272F", secondary: "#015197", accent: "#F9DD16", collar: "red blue yellow"},
    {name: "Myanmar", region: "Asia", primary: "#FECB00", secondary: "#EA2839", accent: "#34B233", collar: "yellow red green"},
    {name: "Nepal", region: "Asia", primary: "#DC143C", secondary: "#003893", accent: "#FFFFFF", collar: "crimson blue white"},
    {name: "North Korea", region: "Asia", primary: "#024FA2", secondary: "#FFFFFF", accent: "#ED1C27", collar: "blue white red"},
    {name: "Oman", region: "Asia", primary: "#DB161B", secondary: "#FFFFFF", accent: "#008000", collar: "red white green"},
    {name: "Pakistan", region: "Asia", primary: "#01411C", secondary: "#FFFFFF", collar: "green white"},
    {name: "Palestine", region: "Asia", primary: "#CE1126", secondary: "#000000", accent: "#007A3D", collar: "red black green"},
    {name: "Philippines", region: "Asia", primary: "#0038A8", secondary: "#CE1126", accent: "#FFFFFF", collar: "blue red white"},
    {name: "Qatar", region: "Asia", primary: "#8A1538", secondary: "#FFFFFF", collar: "maroon white"},
    {name: "Saudi Arabia", region: "Asia", primary: "#006C35", secondary: "#FFFFFF", collar: "green white"},
    {name: "Singapore", region: "Asia", primary: "#EF3340", secondary: "#FFFFFF", collar: "red white"},
    {name: "South Korea", region: "Asia", primary: "#CD2E3A", secondary: "#0047A0", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Sri Lanka", region: "Asia", primary: "#8D153A", secondary: "#FFBE29", accent: "#00534E", collar: "maroon gold green"},
    {name: "Syria", region: "Asia", primary: "#CE1126", secondary: "#000000", accent: "#007A3D", collar: "red black green"},
    {name: "Taiwan", region: "Asia", primary: "#FE0000", secondary: "#000095", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Tajikistan", region: "Asia", primary: "#CC0000", secondary: "#006600", accent: "#FFFFFF", collar: "red green white"},
    {name: "Thailand", region: "Asia", primary: "#A51931", secondary: "#2D2A4A", accent: "#FFFFFF", collar: "red navy white"},
    {name: "Timor-Leste", region: "Asia", primary: "#DA121A", secondary: "#FFC726", accent: "#000000", collar: "red yellow black"},
    {name: "Turkmenistan", region: "Asia", primary: "#28AE66", secondary: "#FFFFFF", accent: "#D22630", collar: "green white red"},
    {name: "United Arab Emirates", region: "Asia", primary: "#FFFFFF", secondary: "#00732F", accent: "#FF0000", collar: "white green red"},
    {name: "Uzbekistan", region: "Asia", primary: "#0099B5", secondary: "#FFFFFF", accent: "#1EB53A", collar: "sky blue white green"},
    {name: "Vietnam", region: "Asia", primary: "#DA251D", secondary: "#FFFF00", collar: "red yellow"},
    {name: "Yemen", region: "Asia", primary: "#CE1126", secondary: "#FFFFFF", accent: "#000000", collar: "red white black"},

    // —— North / Central America & Caribbean (CONCACAF) ——
    {name: "Antigua and Barbuda", region: "North America", primary: "#CE1126", secondary: "#0072C6", accent: "#FCD116", collar: "red blue yellow"},
    {name: "Bahamas", region: "North America", primary: "#00ABC9", secondary: "#FAE042", accent: "#000000", collar: "aqua gold black"},
    {name: "Barbados", region: "North America", primary: "#00267F", secondary: "#FFC726", accent: "#000000", collar: "blue gold black"},
    {name: "Belize", region: "North America", primary: "#171696", secondary: "#D90F19", accent: "#FFFFFF", collar: "blue red white"},
    {name: "Canada", region: "North America", primary: "#FF0000", secondary: "#FFFFFF", collar: "red white"},
    {name: "Costa Rica", region: "North America", primary: "#CE1126", secondary: "#00247D", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Cuba", region: "North America", primary: "#002A8F", secondary: "#CF142B", accent: "#FFFFFF", collar: "blue red white"},
    {name: "Curacao", region: "North America", primary: "#002B7F", secondary: "#F9E814", accent: "#FFFFFF", collar: "blue yellow white"},
    {name: "Dominica", region: "North America", primary: "#006600", secondary: "#FCD116", accent: "#000000", collar: "green yellow black"},
    {name: "Dominican Republic", region: "North America", primary: "#002D62", secondary: "#CE1126", accent: "#FFFFFF", collar: "blue red white"},
    {name: "El Salvador", region: "North America", primary: "#0F47AF", secondary: "#FFFFFF", collar: "blue white"},
    {name: "Grenada", region: "North America", primary: "#CE1126", secondary: "#007A5E", accent: "#FCD116", collar: "red green yellow"},
    {name: "Guatemala", region: "North America", primary: "#4997D0", secondary: "#FFFFFF", accent: "#4997D0", collar: "sky blue white"},
    {name: "Haiti", region: "North America", primary: "#00209F", secondary: "#D21034", accent: "#FFFFFF", collar: "blue red white"},
    {name: "Honduras", region: "North America", primary: "#00A3E0", secondary: "#FFFFFF", collar: "sky blue white"},
    {name: "Jamaica", region: "North America", primary: "#007847", secondary: "#FFB81C", accent: "#000000", collar: "green gold black"},
    {name: "Mexico", region: "North America", primary: "#006847", secondary: "#FFFFFF", accent: "#CE1126", collar: "green white red"},
    {name: "Nicaragua", region: "North America", primary: "#0067C6", secondary: "#FFFFFF", collar: "blue white"},
    {name: "Panama", region: "North America", primary: "#FFFFFF", secondary: "#D21034", accent: "#005293", collar: "white red blue"},
    {name: "Saint Kitts and Nevis", region: "North America", primary: "#009739", secondary: "#C8102E", accent: "#000000", collar: "green red black"},
    {name: "Saint Lucia", region: "North America", primary: "#66CCFF", secondary: "#FCD116", accent: "#000000", collar: "sky blue yellow black"},
    {name: "Saint Vincent and the Grenadines", region: "North America", primary: "#0072C6", secondary: "#FCD116", accent: "#009E49", collar: "blue yellow green"},
    {name: "Suriname", region: "North America", primary: "#377E3F", secondary: "#FFFFFF", accent: "#B40A2D", collar: "green white red"},
    {name: "Trinidad and Tobago", region: "North America", primary: "#CE1126", secondary: "#000000", accent: "#FFFFFF", collar: "red black white"},
    {name: "United States", region: "North America", primary: "#002868", secondary: "#FFFFFF", accent: "#BF0A30", collar: "navy white red"},
    {name: "Greenland", region: "North America", primary: "#C8102E", secondary: "#FFFFFF", collar: "red white Nordic cross accents"},

    // —— South America (CONMEBOL) ——
    {name: "Argentina", region: "South America", primary: "#75AADB", secondary: "#FFFFFF", accent: "#000000", collar: "sky blue white"},
    {name: "Bolivia", region: "South America", primary: "#007A33", secondary: "#D52B1E", accent: "#F9E300", collar: "green red yellow"},
    {name: "Brazil", region: "South America", primary: "#FFDF00", secondary: "#009C3B", accent: "#002776", collar: "gold green blue"},
    {name: "Chile", region: "South America", primary: "#D52B1E", secondary: "#0039A6", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Colombia", region: "South America", primary: "#FCD116", secondary: "#003893", accent: "#CE1126", collar: "yellow blue red"},
    {name: "Ecuador", region: "South America", primary: "#FFD100", secondary: "#0033A0", accent: "#EF3340", collar: "yellow blue red"},
    {name: "Paraguay", region: "South America", primary: "#D52B1E", secondary: "#0038A8", accent: "#FFFFFF", collar: "red blue white"},
    {name: "Peru", region: "South America", primary: "#D91023", secondary: "#FFFFFF", collar: "red white"},
    {name: "Uruguay", region: "South America", primary: "#0038A8", secondary: "#FFFFFF", accent: "#000000", collar: "sky blue white"},
    {name: "Venezuela", region: "South America", primary: "#FFCC00", secondary: "#00247D", accent: "#CF142B", collar: "yellow blue red"},

    // —— Oceania (OFC) + Australia already in Asia/AFC ——
    {name: "Fiji", region: "Oceania", primary: "#FFFFFF", secondary: "#68B2E3", accent: "#C8102E", collar: "white light blue red"},
    {name: "New Caledonia", region: "Oceania", primary: "#002395", secondary: "#E30613", accent: "#009543", collar: "blue red green"},
    {name: "New Zealand", region: "Oceania", primary: "#000000", secondary: "#FFFFFF", accent: "#C8102E", collar: "black white red"},
    {name: "Papua New Guinea", region: "Oceania", primary: "#000000", secondary: "#CE1126", accent: "#FCD116", collar: "black red yellow"},
    {name: "Samoa", region: "Oceania", primary: "#002B7F", secondary: "#CE1126", accent: "#FFFFFF", collar: "blue red white"},
    {name: "Solomon Islands", region: "Oceania", primary: "#0051BA", secondary: "#215B33", accent: "#FCD116", collar: "blue green yellow"},
    {name: "Tahiti", region: "Oceania", primary: "#CE1126", secondary: "#FFFFFF", accent: "#002395", collar: "red white blue"},
    {name: "Tonga", region: "Oceania", primary: "#C8102E", secondary: "#FFFFFF", collar: "red white"},
    {name: "Vanuatu", region: "Oceania", primary: "#009543", secondary: "#D21034", accent: "#000000", collar: "green red black"}
  ];

  function slug(name) {
    return String(name || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .replace(/^[0-9]+/, "");
  }

  function promptFor(team) {
    const accentBit = team.accent
      ? ` Collar and trim use ${team.collar} (accent ${team.accent}).`
      : ` Collar and trim use ${team.collar}.`;
    return [
      `Photorealistic BACK of a ${team.name} national football / soccer jersey. Solid #000000 black backdrop (LED energy). Vertical 3:4 portrait product photo.`,
      `NO HANGER: no wooden hanger, no black plastic hanger, no wire hanger, no hook. Jersey fabric only.`,
      `Body fabric color ${team.primary} with secondary ${team.secondary}.${accentBit}`,
      `Slim short-sleeve kit. Soft even lighting, subtle athletic mesh texture.`,
      `Completely blank back for name/number overlays: ZERO letters, ZERO numbers, no country wordmark, no crest, no FIFA marks.`,
      `Do not print ${team.name} or any translation of the country name on the shirt.`
    ].join(" ");
  }

  /**
   * Country/club wordmark on the jersey BACK. LED uses these files (not the blank).
   * Locked to Lille LED markup: wordmark at the collar (green neckline), slight shoulder curve, 7% smaller than the old 43% mark.
   * Output: soccer-{slug}-back-with-country.png or soccer-{slug}-back-with-club.png
   */
  function promptForCountryName(team) {
    const wordmark = String(team.name || "").toUpperCase();
    const letterColor = team.secondary || "#FFFFFF";
    const fallback = team.accent || "#FFFFFF";
    const twoWord = wordmark.includes(" ");
    const sizeBit = twoWord
      ? `TWO-WORD name ${wordmark}: one arched line. Same letter height as CAMEROON until the SECOND word would leave the fabric, then stop. Never drop, crop, or omit the second word. Never wrap to two lines.`
      : `Same letter height and arch as CAMEROON on the plate. Wordmark fills about 65% of jersey width.`;
    return [
      `Keep the EXACT Cameroon/Morocco jersey SILHOUETTE: same camera, crop, slim short-sleeve cut, crew collar shape, sleeve length, and fabric drape. Do not design a new shirt.`,
      `ONLY recolor this same garment for ${team.name}: body ${team.primary}, letter/trim ${letterColor}, collar ${team.collar}. No V-neck, no new sleeve cut, no zoom.`,
      `NO HANGER: remove any wooden, black plastic, or wire hanger and hook. Solid #000000 black backdrop (LED energy). Jersey fabric only.`,
      `Add ONLY one line of text: ${wordmark}`,
      `Heat-transfer athletic block capitals, letter color ${letterColor} (use ${fallback} only if too close to body ${team.primary}).`,
      sizeBit,
      `Position: TOP of the letters at the inner collar / green neckline. Almost no gap under the collar. High on the shoulders.`,
      `Gentle arch following the shoulder curve: center of the word sits highest under the collar; first and last letters sit slightly lower toward the sleeves. Not a deep U, not a flat nameplate, not printed on the collar.`,
      `ABSOLUTELY NO NUMBERS. No player name, crest, FIFA, or extra text.`,
      `Empty middle and lower back for patron name/number overlay. No person.`
    ].join(" ");
  }

  function promptForClubName(club) {
    const wordmark = String(club.wordmark || club.name || "").toUpperCase();
    const letterColor = club.secondary || "#FFFFFF";
    const fallback = club.accent || "#FFFFFF";
    return [
      `Keep the EXACT Cameroon/Morocco/PSG jersey SILHOUETTE: same camera, crop, slim short-sleeve cut, crew collar shape. Do not design a new shirt.`,
      `ONLY recolor this same garment for ${club.name}. No V-neck, no new sleeve cut, no zoom.`,
      `NO HANGER: remove any wooden, black plastic, or wire hanger and hook. Solid #000000 black backdrop (LED energy). Jersey fabric only.`,
      `Add ONLY one line of text: ${wordmark}`,
      `Heat-transfer athletic block capitals, letter color ${letterColor} (use ${fallback} only if too close to body ${club.primary}).`,
      `Letter size: about 40% of jersey width (7% smaller than the prior mark).`,
      `Position: TOP of the letters at the inner collar / green neckline. Almost no gap under the collar.`,
      `Gentle arch following the shoulder curve: center highest under the collar; ends slightly lower toward the sleeves.`,
      `NO NUMBERS, no player name, no crest. Empty mid/lower back. No person.`
    ].join(" ");
  }

  global.FLOQR_NATIONAL_TEAMS = NATIONAL_TEAMS;
  global.FLOQR_NATIONAL_TEAM_SLUG = slug;
  global.FLOQR_NATIONAL_TEAM_PROMPT = promptFor;
  global.FLOQR_NATIONAL_TEAM_COUNTRY_NAME_PROMPT = promptForCountryName;
  global.FLOQR_CLUB_NAME_PROMPT = promptForClubName;
})(typeof window !== "undefined" ? window : globalThis);
