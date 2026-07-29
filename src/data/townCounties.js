// Town → county lookup for the /locations hub grouping and county pages.
// England: ceremonial counties. Scotland: council areas. Wales: principal
// areas/preserved counties. Northern Ireland: not subdivided (only Belfast
// currently exists as a location page).
//
// Hand-built against the 210 bridging-loans town list in locationPages.json
// (2026-07-29). If new towns are added by the content pipeline and aren't in
// this map, they fall back to being ungrouped on the hub (see Locations.jsx)
// rather than guessed at — a wrong county is worse than an unsorted entry.
const TOWN_COUNTY = {
    // Bedfordshire
    'Bedford': 'Bedfordshire', 'Luton': 'Bedfordshire',
    // Berkshire
    'Maidenhead': 'Berkshire', 'Reading': 'Berkshire', 'Slough': 'Berkshire', 'Windsor': 'Berkshire',
    // Buckinghamshire
    'Aylesbury': 'Buckinghamshire', 'High Wycombe': 'Buckinghamshire', 'Milton Keynes': 'Buckinghamshire',
    // Cambridgeshire
    'Cambridge': 'Cambridgeshire', 'Ely': 'Cambridgeshire', 'Huntingdon': 'Cambridgeshire', 'Peterborough': 'Cambridgeshire',
    // Cheshire
    'Chester': 'Cheshire', 'Crewe': 'Cheshire', 'Macclesfield': 'Cheshire', 'Warrington': 'Cheshire',
    // Cornwall
    'Falmouth': 'Cornwall', 'Newquay': 'Cornwall', 'Penzance': 'Cornwall', 'Truro': 'Cornwall',
    // Cumbria
    'Barrow-in-Furness': 'Cumbria', 'Carlisle': 'Cumbria', 'Kendal': 'Cumbria',
    // Derbyshire
    'Chesterfield': 'Derbyshire', 'Derby': 'Derbyshire',
    // Devon
    'Barnstaple': 'Devon', 'Exeter': 'Devon', 'Plymouth': 'Devon', 'Torquay': 'Devon',
    // Dorset
    'Bournemouth': 'Dorset', 'Dorchester': 'Dorset', 'Poole': 'Dorset', 'Weymouth': 'Dorset',
    // County Durham
    'Darlington': 'County Durham', 'Durham': 'County Durham', 'Hartlepool': 'County Durham',
    // East Sussex
    'Brighton': 'East Sussex', 'Eastbourne': 'East Sussex', 'Hastings': 'East Sussex', 'Hove': 'East Sussex',
    // Essex
    'Chelmsford': 'Essex', 'Colchester': 'Essex', 'Harlow': 'Essex',
    // Gloucestershire
    'Cheltenham': 'Gloucestershire', 'Gloucester': 'Gloucestershire',
    // Greater London
    'Barking': 'Greater London', 'Bethnal Green': 'Greater London', 'Bromley': 'Greater London',
    'Canary Wharf': 'Greater London', 'Chelsea': 'Greater London', 'City of London': 'Greater London',
    'Croydon': 'Greater London', 'Fulham': 'Greater London', 'Greenwich': 'Greater London',
    'Hackney': 'Greater London', 'Hammersmith': 'Greater London', 'Ilford': 'Greater London',
    'Islington': 'Greater London', 'Kensington': 'Greater London', 'Lewisham': 'Greater London',
    'London': 'Greater London', 'Mayfair': 'Greater London', 'Romford': 'Greater London',
    'Stratford': 'Greater London', 'Tottenham': 'Greater London', 'Walthamstow': 'Greater London',
    'Wimbledon': 'Greater London', 'Woolwich': 'Greater London',
    // Greater Manchester
    'Bolton': 'Greater Manchester', 'Bury': 'Greater Manchester', 'Manchester': 'Greater Manchester',
    'Oldham': 'Greater Manchester', 'Rochdale': 'Greater Manchester', 'Salford': 'Greater Manchester',
    'Stockport': 'Greater Manchester', 'Wigan': 'Greater Manchester',
    // Hampshire
    'Aldershot': 'Hampshire', 'Basingstoke': 'Hampshire', 'Eastleigh': 'Hampshire', 'Fareham': 'Hampshire',
    'Gosport': 'Hampshire', 'Portsmouth': 'Hampshire', 'Southampton': 'Hampshire', 'Winchester': 'Hampshire',
    // Herefordshire
    'Hereford': 'Herefordshire',
    // Hertfordshire
    'Hemel Hempstead': 'Hertfordshire', 'Letchworth': 'Hertfordshire', 'St Albans': 'Hertfordshire',
    'Stevenage': 'Hertfordshire', 'Watford': 'Hertfordshire', 'Welwyn Garden City': 'Hertfordshire',
    // Kent
    'Canterbury': 'Kent', 'Dover': 'Kent', 'Folkestone': 'Kent', 'Maidstone': 'Kent',
    'Margate': 'Kent', 'Ramsgate': 'Kent', 'Tunbridge Wells': 'Kent',
    // Lancashire
    'Blackburn': 'Lancashire', 'Blackpool': 'Lancashire', 'Burnley': 'Lancashire',
    'Lancaster': 'Lancashire', 'Morecambe': 'Lancashire', 'Preston': 'Lancashire',
    // Leicestershire
    'Hinckley': 'Leicestershire', 'Leicester': 'Leicestershire', 'Loughborough': 'Leicestershire',
    // Lincolnshire
    'Grantham': 'Lincolnshire', 'Grimsby': 'Lincolnshire', 'Lincoln': 'Lincolnshire', 'Scunthorpe': 'Lincolnshire',
    // Merseyside
    'Liverpool': 'Merseyside',
    // Norfolk
    'Norwich': 'Norfolk',
    // North Yorkshire
    'Harrogate': 'North Yorkshire', 'Middlesbrough': 'North Yorkshire', 'Scarborough': 'North Yorkshire',
    'Whitby': 'North Yorkshire', 'York': 'North Yorkshire',
    // East Riding of Yorkshire
    'Hull': 'East Riding of Yorkshire',
    // Northamptonshire
    'Corby': 'Northamptonshire', 'Kettering': 'Northamptonshire', 'Northampton': 'Northamptonshire', 'Wellingborough': 'Northamptonshire',
    // Nottinghamshire
    'Mansfield': 'Nottinghamshire', 'Newark': 'Nottinghamshire', 'Nottingham': 'Nottinghamshire',
    // Oxfordshire
    'Oxford': 'Oxfordshire',
    // Shropshire
    'Shrewsbury': 'Shropshire', 'Telford': 'Shropshire',
    // Somerset
    'Bath': 'Somerset', 'Taunton': 'Somerset', 'Weston-super-Mare': 'Somerset', 'Yeovil': 'Somerset',
    // South Yorkshire
    'Barnsley': 'South Yorkshire', 'Doncaster': 'South Yorkshire', 'Rotherham': 'South Yorkshire', 'Sheffield': 'South Yorkshire',
    // Staffordshire
    'Stoke-on-Trent': 'Staffordshire',
    // Suffolk
    'Ipswich': 'Suffolk',
    // Surrey
    'Farnham': 'Surrey', 'Guildford': 'Surrey', 'Woking': 'Surrey',
    // Tyne and Wear
    'Gateshead': 'Tyne and Wear', 'Newcastle': 'Tyne and Wear', 'Newcastle upon Tyne': 'Tyne and Wear',
    'South Shields': 'Tyne and Wear', 'Sunderland': 'Tyne and Wear',
    // West Midlands
    'Birmingham': 'West Midlands', 'Coventry': 'West Midlands', 'Dudley': 'West Midlands',
    'Solihull': 'West Midlands', 'Walsall': 'West Midlands', 'West Bromwich': 'West Midlands', 'Wolverhampton': 'West Midlands',
    // West Sussex
    'Chichester': 'West Sussex', 'Crawley': 'West Sussex', 'Horsham': 'West Sussex', 'Worthing': 'West Sussex',
    // West Yorkshire
    'Bradford': 'West Yorkshire', 'Halifax': 'West Yorkshire', 'Huddersfield': 'West Yorkshire',
    'Leeds': 'West Yorkshire', 'Wakefield': 'West Yorkshire',
    // Wiltshire
    'Salisbury': 'Wiltshire', 'Swindon': 'Wiltshire',
    // Worcestershire
    'Redditch': 'Worcestershire', 'Worcester': 'Worcestershire',
    // Bristol
    'Bristol': 'Bristol',

    // ── Wales ──
    'Aberystwyth': 'Ceredigion', 'Bangor': 'Gwynedd', 'Barry': 'Vale of Glamorgan',
    'Bridgend': 'Bridgend', 'Caerphilly': 'Caerphilly', 'Cardiff': 'Cardiff',
    'Carmarthen': 'Carmarthenshire', 'Cwmbran': 'Torfaen', 'Llandudno': 'Conwy',
    'Merthyr Tydfil': 'Merthyr Tydfil', 'Neath': 'Neath Port Talbot', 'Newport': 'Newport',
    'Port Talbot': 'Neath Port Talbot', 'Swansea': 'Swansea', 'Wrexham': 'Wrexham',

    // ── Scotland ──
    'Aberdeen': 'Aberdeen City', 'Ayr': 'South Ayrshire', 'Coatbridge': 'North Lanarkshire',
    'Cumbernauld': 'North Lanarkshire', 'Dumfries': 'Dumfries and Galloway', 'Dundee': 'Dundee City',
    'Dunfermline': 'Fife', 'East Kilbride': 'South Lanarkshire', 'Edinburgh': 'City of Edinburgh',
    'Elgin': 'Moray', 'Falkirk': 'Falkirk', 'Fort William': 'Highland', 'Glasgow': 'Glasgow City',
    'Greenock': 'Inverclyde', 'Hamilton': 'South Lanarkshire', 'Inverness': 'Highland',
    'Kilmarnock': 'East Ayrshire', 'Kirkcaldy': 'Fife', 'Livingston': 'West Lothian',
    'Motherwell': 'North Lanarkshire', 'Oban': 'Argyll and Bute', 'Paisley': 'Renfrewshire',
    'Perth': 'Perth and Kinross', 'St Andrews': 'Fife', 'Stirling': 'Stirling',

    // ── Northern Ireland ──
    'Belfast': 'Northern Ireland',
};

const NATION = {
    'Aberdeen City': 'Scotland', 'South Ayrshire': 'Scotland', 'North Lanarkshire': 'Scotland',
    'Dumfries and Galloway': 'Scotland', 'Dundee City': 'Scotland', 'Fife': 'Scotland',
    'South Lanarkshire': 'Scotland', 'City of Edinburgh': 'Scotland', 'Moray': 'Scotland',
    'Falkirk': 'Scotland', 'Highland': 'Scotland', 'Glasgow City': 'Scotland', 'Inverclyde': 'Scotland',
    'East Ayrshire': 'Scotland', 'West Lothian': 'Scotland', 'Argyll and Bute': 'Scotland',
    'Renfrewshire': 'Scotland', 'Perth and Kinross': 'Scotland', 'Stirling': 'Scotland',
    'Ceredigion': 'Wales', 'Gwynedd': 'Wales', 'Vale of Glamorgan': 'Wales', 'Bridgend': 'Wales',
    'Caerphilly': 'Wales', 'Cardiff': 'Wales', 'Carmarthenshire': 'Wales', 'Torfaen': 'Wales',
    'Conwy': 'Wales', 'Merthyr Tydfil': 'Wales', 'Neath Port Talbot': 'Wales', 'Newport': 'Wales',
    'Swansea': 'Wales', 'Wrexham': 'Wales',
    'Northern Ireland': 'Northern Ireland',
};

export const countyForTown = (town) => TOWN_COUNTY[town] || null;
export const nationForCounty = (county) => NATION[county] || 'England';

export default TOWN_COUNTY;
