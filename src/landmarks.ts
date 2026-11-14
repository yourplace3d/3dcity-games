/**
 * Sights most people know by name, so that a player who comes to one can tell: the map draws the
 * Arc de Triomphe as a block like any other. A short list kept by hand for the cities the game
 * knows by heart; each place was checked against the named points in the map tiles.
 */

import type { Projector } from './geo/projection';

/** Name, latitude, longitude. */
const SIGHTS: Array<[string, number, number]> = [
  ['Brandenburg Gate', 52.5163, 13.3777],
  ['TV Tower', 52.5208, 13.4094],
  ['Reichstag', 52.5186, 13.3762],
  ['Victory Column', 52.5145, 13.3501],
  ['Elbphilharmonie', 53.5413, 9.9841],
  ["St. Michael's Church", 53.5484, 9.9788],
  ['Hamburg City Hall', 53.5503, 9.9920],
  ['Frauenkirche', 48.1386, 11.5736],
  ['New Town Hall', 48.1374, 11.5755],
  ['Cologne Cathedral', 50.9413, 6.9583],
  ['Römer', 50.1106, 8.6821],
  ['Main Tower', 50.1124, 8.6722],
  ['New Palace', 48.7785, 9.1800],
  ['Imperial Castle', 49.4579, 11.0758],
  ['Freiburg Minster', 47.9955, 7.8530],
  ["St. Stephen's Cathedral", 48.2085, 16.3731],
  ['Giant Ferris Wheel', 48.2166, 16.3959],
  ['Grossmünster', 47.3701, 8.5441],
  ['Arc de Triomphe', 48.8738, 2.2950],
  ['Eiffel Tower', 48.8584, 2.2945],
  ['Notre-Dame', 48.8530, 2.3499],
  ['Louvre', 48.8606, 2.3376],
  ['Sacré-Cœur', 48.8867, 2.3431],
  ['Big Ben', 51.5007, -0.1246],
  ['Tower Bridge', 51.5055, -0.0754],
  ['Buckingham Palace', 51.5014, -0.1419],
  ["St Paul's Cathedral", 51.5138, -0.0984],
  ['London Eye', 51.5033, -0.1196],
  ['Royal Palace', 52.3731, 4.8913],
  ['Rijksmuseum', 52.3600, 4.8852],
  ['Brussels Town Hall', 50.8465, 4.3524],
  ['Atomium', 50.8949, 4.3415],
  ['Royal Palace', 40.4180, -3.7143],
  ['Puerta de Alcalá', 40.4200, -3.6888],
  ['Sagrada Família', 41.4036, 2.1744],
  ['Belém Tower', 38.6916, -9.2160],
  ['Colosseum', 41.8902, 12.4922],
  ['Pantheon', 41.8986, 12.4769],
  ["St. Peter's Basilica", 41.9022, 12.4539],
  ['Trevi Fountain', 41.9009, 12.4833],
  ['Milan Cathedral', 45.4641, 9.1919],
  ['Charles Bridge', 50.0865, 14.4114],
  ['Prague Castle', 50.0909, 14.4005],
  ['Palace of Culture and Science', 52.2319, 21.0067],
  ['The Little Mermaid', 55.6929, 12.5993],
  ['Stockholm City Hall', 59.3275, 18.0546],
  ['Royal Palace', 59.3268, 18.0717],
  ['Opera House', 59.9075, 10.7531],
  ['Helsinki Cathedral', 60.1704, 24.9522],
  ['The Spire', 53.3498, -6.2603],
  ['Trinity College', 53.3438, -6.2546],
  ['Hagia Sophia', 41.0086, 28.9802],
  ['Blue Mosque', 41.0054, 28.9768],
  ['Galata Tower', 41.0256, 28.9741],
  ['Parthenon', 37.9715, 23.7267],
  ['Empire State Building', 40.7484, -73.9857],
  ['Times Square', 40.7580, -73.9855],
  ['Statue of Liberty', 40.6892, -74.0445],
  ['Brooklyn Bridge', 40.7061, -73.9969],
  ['Hollywood Sign', 34.1341, -118.3215],
  ['Los Angeles City Hall', 34.0537, -118.2427],
  ['Willis Tower', 41.8789, -87.6359],
  ['Cloud Gate', 41.8827, -87.6233],
  ['Golden Gate Bridge', 37.8199, -122.4783],
  ['Coit Tower', 37.8024, -122.4058],
  ['Transamerica Pyramid', 37.7952, -122.4028],
  ['Space Needle', 47.6205, -122.3493],
  ['Massachusetts State House', 42.3588, -71.0638],
  ['White House', 38.8977, -77.0365],
  ['United States Capitol', 38.8899, -77.0091],
  ['Washington Monument', 38.8895, -77.0353],
  ['Lincoln Memorial', 38.8893, -77.0502],
  ['Freedom Tower', 25.7801, -80.1897],
  ['CN Tower', 43.6426, -79.3871],
  ['Parliament Hill', 45.4236, -75.7009],
  ['Notre-Dame Basilica', 45.5045, -73.5561],
  ['Canada Place', 49.2888, -123.1111],
  ['Angel of Independence', 19.4270, -99.1677],
  ['Metropolitan Cathedral', 19.4345, -99.1332],
  ['Palacio de Bellas Artes', 19.4352, -99.1412],
  ['Christ the Redeemer', -22.9519, -43.2105],
  ['Maracanã', -22.9121, -43.2302],
  ['MASP', -23.5614, -46.6559],
  ['Sé Cathedral', -23.5513, -46.6344],
  ['Obelisk', -34.6037, -58.3816],
  ['Casa Rosada', -34.6081, -58.3703],
  ['Tokyo Tower', 35.6586, 139.7454],
  ['Shibuya Crossing', 35.6595, 139.7005],
  ['Tokyo Skytree', 35.7101, 139.8107],
  ['Sensō-ji', 35.7148, 139.7967],
  ['Osaka Castle', 34.6873, 135.5262],
  ['Gyeongbokgung Palace', 37.5796, 126.9770],
  ['N Seoul Tower', 37.5512, 126.9882],
  ['Tiananmen', 39.9087, 116.3975],
  ['Temple of Heaven', 39.8822, 116.4066],
  ['Oriental Pearl Tower', 31.2397, 121.4998],
  ['Clock Tower', 22.2936, 114.1695],
  ['Marina Bay Sands', 1.2834, 103.8607],
  ['Merlion', 1.2868, 103.8545],
  ['Grand Palace', 13.7500, 100.4913],
  ['Wat Arun', 13.7437, 100.4888],
  ['Gateway of India', 18.9220, 72.8347],
  ['India Gate', 28.6129, 77.2295],
  ['Red Fort', 28.6562, 77.2410],
  ['Burj Khalifa', 25.1972, 55.2744],
  ['Cairo Tower', 30.0459, 31.2243],
  ['Great Pyramid of Giza', 29.9792, 31.1342],
  ['Castle of Good Hope', -33.9259, 18.4279],
  ['KICC', -1.2889, 36.8231],
  ['Sydney Opera House', -33.8568, 151.2153],
  ['Sydney Harbour Bridge', -33.8523, 151.2108],
  ['Flinders Street Station', -37.8183, 144.9671],
];

export interface Sight {
  name: string;
  x: number;
  y: number;
}

/** The sights that lie in a square, in its own metres. */
export function sightsIn(proj: Projector, half: number): Sight[] {
  const out: Sight[] = [];
  for (const [name, lat, lon] of SIGHTS) {
    // a quick no for the other side of the world
    if (Math.abs(lat - proj.center.lat) > 0.05) continue;
    const [x, y] = proj.toLocal(lon, lat);
    if (Math.abs(x) < half && Math.abs(y) < half) out.push({ name, x, y });
  }
  return out;
}
