/**
 * The story's people get first names of the part of the world their town is in (the owner, 26 November
 * 2026: "if easy that's the way to do it"). The names are drawn once, from the first home's place, and
 * kept: Mira stays Mira when you play in Tokyo.
 *
 * The regions are rough boxes, as for the windows (`windows.ts`) and left-hand traffic (`world.ts`). Where
 * boxes overlap, the smallest wins (Austria inside central Europe, Quebec inside North America). Where no
 * box fits, a shared list of names that read in most languages.
 *
 * Each list is ten common women's and ten common men's first names of adults today (born about 1975 to
 * 2000), from general knowledge of each country's most given names: first names only, never a surname.
 * To be checked against each country's own name statistics before the lists grow.
 */

interface Region {
  key: string;
  /** south, west, north, east (degrees); a region may have several */
  boxes: Array<[number, number, number, number]>;
  women: string[];
  men: string[];
}

const SHARED_WOMEN = ['Mira', 'Ana', 'Nina', 'Lena', 'Sara', 'Maya', 'Lina', 'Eva', 'Zoe', 'Ella'];
const SHARED_MEN = ['Theo', 'Leo', 'Sam', 'Max', 'Noah', 'Adam', 'Ben', 'Luca', 'Omar', 'Kai'];

const REGIONS: Region[] = [
  {
    key: 'german',
    // Germany: the north, west of Szczecin; the middle, to the Oder; Görlitz and Zittau; the south, east of
    // the French border. Austria, without Slovenia. German-speaking Switzerland; Upper Valais
    boxes: [[52.9, 5.8, 55.1, 14.2], [49.0, 5.8, 52.9, 14.7], [50.8, 14.7, 51.3, 15.05], [47.2, 7.5, 49.0, 15.1], [46.8, 9.5, 49.1, 17.2], [46.4, 9.5, 46.8, 15.6], [46.6, 7.1, 47.81, 10.5], [46.0, 7.6, 46.6, 8.2]],
    women: ['Anna', 'Julia', 'Sarah', 'Lisa', 'Katharina', 'Laura', 'Sandra', 'Nicole', 'Stefanie', 'Christina'],
    men: ['Michael', 'Daniel', 'Thomas', 'Andreas', 'Tobias', 'Stefan', 'Christian', 'Jan', 'Florian', 'Markus'],
  },
  {
    key: 'french',
    // France; Lille; Alsace and Lorraine; the Riviera; Corsica; Romandy and Lower Valais; Quebec
    boxes: [[41.3, -5.2, 51.1, 8.3], [50.0, 2.5, 50.72, 3.2], [47.6, 5.8, 49.2, 7.8], [43.0, 5.8, 44.4, 7.53], [41.3, 8.5, 43.1, 9.6], [45.8, 5.9, 46.6, 7.6], [45, -75.5, 52, -57]],
    women: ['Julie', 'Camille', 'Marie', 'Laura', 'Sarah', 'Pauline', 'Émilie', 'Céline', 'Manon', 'Aurélie'],
    men: ['Nicolas', 'Julien', 'Thomas', 'Maxime', 'Alexandre', 'Antoine', 'Kevin', 'Romain', 'Sébastien', 'Guillaume'],
  },
  {
    key: 'belgian',
    boxes: [[49.5, 2.5, 51.5, 6.0]],
    women: ['Laura', 'Sarah', 'Julie', 'Marie', 'Elke', 'Lotte', 'Charlotte', 'Sofie', 'Céline', 'Ann'],
    men: ['Thomas', 'Kevin', 'Nicolas', 'Pieter', 'Jonas', 'Maxime', 'Wouter', 'Simon', 'Tom', 'Julien'],
  },
  {
    key: 'dutch',
    // the west and north; Groningen and Twente; Brabant and Limburg
    boxes: [[51.45, 3.3, 53.6, 6.2], [52.0, 6.2, 53.6, 7.1], [50.75, 4.75, 51.45, 6.0]],
    women: ['Anne', 'Lisa', 'Laura', 'Sanne', 'Femke', 'Linda', 'Kim', 'Iris', 'Eva', 'Marieke'],
    men: ['Thomas', 'Daan', 'Jeroen', 'Bas', 'Niels', 'Tim', 'Sander', 'Ruben', 'Mark', 'Joost'],
  },
  {
    key: 'british',
    // Britain and Ireland
    boxes: [[49.9, -10.7, 60.9, 1.8]],
    women: ['Sarah', 'Emma', 'Laura', 'Rebecca', 'Hannah', 'Charlotte', 'Amy', 'Sophie', 'Gemma', 'Katie'],
    men: ['James', 'Daniel', 'Thomas', 'Matthew', 'Christopher', 'David', 'Michael', 'Adam', 'Luke', 'Andrew'],
  },
  {
    key: 'spanish',
    // the north-west and the Basque coast; the south and east below the Pyrenees; Catalonia and the Balearics; the Canaries
    boxes: [[36, -9.5, 43.8, -1.75], [36.0, -1.75, 42.5, 0.4], [38.6, 0.4, 42.5, 3.4], [27.6, -18.2, 29.5, -13.3]],
    women: ['María', 'Laura', 'Lucía', 'Marta', 'Cristina', 'Ana', 'Elena', 'Sara', 'Paula', 'Raquel'],
    men: ['David', 'Javier', 'Daniel', 'Carlos', 'Sergio', 'Alejandro', 'Pablo', 'Jorge', 'Álvaro', 'Adrián'],
  },
  {
    key: 'portuguese',
    boxes: [[36.9, -9.6, 42.2, -7.0]],
    women: ['Ana', 'Inês', 'Joana', 'Mariana', 'Catarina', 'Sofia', 'Rita', 'Sara', 'Beatriz', 'Marta'],
    men: ['João', 'Pedro', 'Tiago', 'Miguel', 'Rui', 'Bruno', 'Diogo', 'Ricardo', 'André', 'Nuno'],
  },
  {
    key: 'italian',
    // the north; the centre; Apulia; the south and Sicily; southern Sardinia; Ticino and Valtellina
    boxes: [[43.7, 6.6, 47.1, 13.9], [40.0, 8.1, 43.7, 15.7], [39.8, 15.7, 41.95, 18.6], [36.6, 12.0, 40.0, 16.7], [38.8, 8.1, 40.0, 9.9], [45.8, 8.4, 46.4, 10.5]],
    women: ['Giulia', 'Francesca', 'Chiara', 'Sara', 'Valentina', 'Martina', 'Federica', 'Elisa', 'Silvia', 'Alessia'],
    men: ['Marco', 'Andrea', 'Luca', 'Alessandro', 'Matteo', 'Francesco', 'Davide', 'Simone', 'Stefano', 'Lorenzo'],
  },
  {
    key: 'scandinavian',
    // Denmark; Sweden; southern Norway; northern Norway
    boxes: [[54.8, 8, 57.8, 15.2], [55.3, 11, 69.1, 24.2], [57.9, 4.5, 65.0, 13.0], [65.0, 11.0, 71.2, 31.1]],
    women: ['Anna', 'Emma', 'Sara', 'Maria', 'Ida', 'Julia', 'Karin', 'Linnea', 'Camilla', 'Mette'],
    men: ['Erik', 'Lars', 'Anders', 'Johan', 'Magnus', 'Mikkel', 'Jonas', 'Henrik', 'Oskar', 'Martin'],
  },
  {
    key: 'finnish',
    // the south, west of the Russian border; the rest
    boxes: [[59.7, 20.5, 62.0, 28.5], [62.0, 21.0, 70.1, 31.6]],
    women: ['Anna', 'Laura', 'Johanna', 'Sanna', 'Emilia', 'Katja', 'Hanna', 'Elina', 'Riikka', 'Tiina'],
    men: ['Mikko', 'Juha', 'Antti', 'Ville', 'Jussi', 'Teemu', 'Janne', 'Matti', 'Lauri', 'Jani'],
  },
  {
    key: 'polish',
    boxes: [[49, 14.1, 54.9, 23.95]],
    women: ['Anna', 'Katarzyna', 'Magdalena', 'Agnieszka', 'Joanna', 'Monika', 'Aleksandra', 'Natalia', 'Karolina', 'Marta'],
    men: ['Piotr', 'Tomasz', 'Paweł', 'Michał', 'Krzysztof', 'Marcin', 'Jakub', 'Łukasz', 'Kamil', 'Adam'],
  },
  {
    key: 'czech-slovak',
    // Bohemia; southern Bohemia; Moravia; Slovakia
    boxes: [[49.5, 12.4, 50.9, 16.8], [48.55, 13.6, 49.5, 16.8], [48.6, 16.8, 50.0, 18.9], [47.7, 16.9, 49.6, 22.2]],
    women: ['Jana', 'Petra', 'Lucie', 'Kateřina', 'Tereza', 'Veronika', 'Martina', 'Eva', 'Lenka', 'Barbora'],
    men: ['Jan', 'Petr', 'Tomáš', 'Martin', 'Jakub', 'Lukáš', 'Ondřej', 'Pavel', 'David', 'Michal'],
  },
  {
    key: 'greek',
    // the south and the islands; the north; Thrace; Rhodes
    boxes: [[34.8, 19.3, 40.0, 26.7], [40.0, 20.0, 40.9, 26.3], [40.9, 23.4, 41.25, 26.3], [35.85, 27.0, 36.5, 28.3]],
    women: ['Maria', 'Eleni', 'Katerina', 'Sofia', 'Georgia', 'Christina', 'Anna', 'Dimitra', 'Ioanna', 'Vasiliki'],
    men: ['Giorgos', 'Dimitris', 'Nikos', 'Kostas', 'Giannis', 'Christos', 'Panagiotis', 'Vasilis', 'Thanasis', 'Alexandros'],
  },
  {
    key: 'turkish',
    // Anatolia; the east to the Iranian border; Istanbul, Thrace and the Black Sea coast; Hatay; the Lycian coast
    boxes: [[36.6, 25.6, 41.0, 43.5], [36.6, 43.5, 39.8, 44.8], [41.0, 26.0, 42.2, 41.5], [35.8, 35.7, 36.6, 36.6], [36.1, 29.2, 36.6, 32.6]],
    women: ['Elif', 'Zeynep', 'Merve', 'Esra', 'Büşra', 'Ayşe', 'Fatma', 'Emine', 'Özge', 'Seda'],
    men: ['Mehmet', 'Mustafa', 'Ahmet', 'Emre', 'Murat', 'Burak', 'Can', 'Serkan', 'Oğuz', 'Hakan'],
  },
  {
    key: 'east-slavic',
    // Russia, Ukraine and Belarus; the Russian Far East by the sea; Kaliningrad
    boxes: [[41, 22.1, 70, 180], [42.3, 130.7, 53.6, 135], [54.3, 19.6, 55.3, 22.9]],
    women: ['Anna', 'Maria', 'Elena', 'Olga', 'Natalia', 'Irina', 'Ekaterina', 'Tatiana', 'Svetlana', 'Yulia'],
    men: ['Alexander', 'Dmitry', 'Sergey', 'Andrey', 'Alexey', 'Ivan', 'Mikhail', 'Nikolai', 'Pavel', 'Maxim'],
  },
  {
    key: 'arabic',
    // North Africa and the Middle East
    boxes: [[12, -17, 37.5, 60]],
    women: ['Fatima', 'Mariam', 'Nour', 'Sara', 'Aisha', 'Layla', 'Huda', 'Rania', 'Salma', 'Yasmin'],
    men: ['Mohamed', 'Ahmed', 'Omar', 'Youssef', 'Ali', 'Khaled', 'Hassan', 'Karim', 'Tarek', 'Mahmoud'],
  },
  {
    key: 'persian',
    // Iran; its west; its south-east coast
    boxes: [[27.0, 48.0, 39.8, 63.3], [33.5, 44.0, 39.8, 48.0], [25.2, 56.7, 27.0, 63.3]],
    women: ['Zahra', 'Fatemeh', 'Maryam', 'Sara', 'Narges', 'Mahsa', 'Leila', 'Neda', 'Shirin', 'Parisa'],
    men: ['Mohammad', 'Ali', 'Reza', 'Hossein', 'Mehdi', 'Amir', 'Hamed', 'Saeed', 'Majid', 'Behnam'],
  },
  {
    key: 'pakistani',
    boxes: [[23.6, 61.6, 37.1, 74.6]],
    women: ['Ayesha', 'Fatima', 'Sana', 'Hira', 'Maryam', 'Zainab', 'Amna', 'Sadia', 'Mehwish', 'Rabia'],
    men: ['Muhammad', 'Ali', 'Ahmed', 'Usman', 'Hamza', 'Bilal', 'Imran', 'Fahad', 'Zeeshan', 'Asad'],
  },
  {
    key: 'indian',
    boxes: [[6, 68, 35.5, 93]],
    women: ['Priya', 'Anjali', 'Pooja', 'Neha', 'Sneha', 'Divya', 'Kavya', 'Shreya', 'Ananya', 'Riya'],
    men: ['Rahul', 'Amit', 'Rohit', 'Arjun', 'Vikram', 'Suresh', 'Aditya', 'Karan', 'Rajesh', 'Sanjay'],
  },
  {
    key: 'bangladeshi',
    boxes: [[20.6, 88.5, 26.7, 92.7]],
    women: ['Fatema', 'Nusrat', 'Sumaiya', 'Tahmina', 'Farzana', 'Ayesha', 'Nasrin', 'Sadia', 'Taslima', 'Shirin'],
    men: ['Mohammad', 'Rahim', 'Karim', 'Hasan', 'Rakib', 'Sakib', 'Tanvir', 'Arif', 'Imran', 'Fahim'],
  },
  {
    key: 'north-american',
    // the United States and English-speaking Canada
    boxes: [[24, -170, 72, -52]],
    women: ['Jessica', 'Ashley', 'Sarah', 'Emily', 'Megan', 'Amanda', 'Lauren', 'Rachel', 'Nicole', 'Jennifer'],
    men: ['Michael', 'Christopher', 'Matthew', 'Joshua', 'David', 'Daniel', 'James', 'Andrew', 'Ryan', 'Tyler'],
  },
  {
    key: 'latin-american',
    // South and Central America; the Caribbean; Mexico, along its northern border
    boxes: [[-56, -118, 14.5, -34], [14.5, -86.7, 24, -59], [14.5, -118, 28.0, -86.7], [28.0, -117.2, 32.55, -114.7], [28.0, -114.7, 31.3, -104.5], [28.0, -104.5, 29.5, -100.2]],
    women: ['María', 'Fernanda', 'Daniela', 'Gabriela', 'Valeria', 'Andrea', 'Alejandra', 'Paola', 'Carolina', 'Lucía'],
    men: ['José', 'Luis', 'Carlos', 'Juan', 'Diego', 'Miguel', 'Jorge', 'Alejandro', 'Javier', 'Andrés'],
  },
  {
    key: 'brazilian',
    // the north; the south-east; Mato Grosso do Sul
    boxes: [[-16, -74, 5.3, -34.8], [-34, -55.0, -16, -34.8], [-22.2, -58.2, -16, -55.0]],
    women: ['Ana', 'Juliana', 'Fernanda', 'Camila', 'Amanda', 'Bruna', 'Larissa', 'Patrícia', 'Aline', 'Mariana'],
    men: ['Lucas', 'Gabriel', 'Rafael', 'Felipe', 'Bruno', 'Rodrigo', 'Thiago', 'Diego', 'Leonardo', 'Marcelo'],
  },
  {
    key: 'japanese',
    // Honshu, Kyushu and Shikoku; Hokkaido; Okinawa
    boxes: [[31, 129.5, 41.6, 142.2], [41.3, 139.3, 45.6, 146], [24, 122.9, 31, 132]],
    women: ['Ai', 'Yuki', 'Mai', 'Misaki', 'Haruka', 'Ayaka', 'Megumi', 'Yui', 'Kana', 'Nanami'],
    men: ['Takuya', 'Daisuke', 'Kenta', 'Shota', 'Yuta', 'Takumi', 'Kazuki', 'Ryota', 'Tsubasa', 'Hiroshi'],
  },
  {
    key: 'korean',
    boxes: [[33.1, 124.5, 43.0, 129.6]],
    women: ['Ji-yeon', 'Min-ji', 'Seo-yeon', 'Ji-hye', 'Eun-ji', 'Hye-jin', 'Soo-jin', 'Yu-na', 'Da-eun', 'Su-bin'],
    men: ['Min-jun', 'Ji-hoon', 'Hyun-woo', 'Sung-min', 'Dong-hyun', 'Jun-ho', 'Young-ho', 'Jae-won', 'Seung-hyun', 'Tae-yang'],
  },
  {
    key: 'chinese',
    boxes: [[18, 73, 53.6, 135]],
    women: ['Jing', 'Min', 'Yan', 'Li', 'Hui', 'Xin', 'Fang', 'Ting', 'Yu', 'Lin'],
    men: ['Wei', 'Lei', 'Jun', 'Tao', 'Hao', 'Peng', 'Bo', 'Jie', 'Yang', 'Qiang'],
  },
  {
    key: 'vietnamese',
    boxes: [[8.4, 104.0, 23.4, 109.5]],
    women: ['Linh', 'Trang', 'Huong', 'Thao', 'Ngoc', 'Lan', 'Mai', 'Hoa', 'Phuong', 'Anh'],
    men: ['Minh', 'Hung', 'Tuan', 'Duc', 'Nam', 'Long', 'Hoang', 'Quang', 'Dung', 'Huy'],
  },
  {
    key: 'thai',
    // the nicknames people go by
    boxes: [[5.6, 97.3, 20.5, 105.7]],
    women: ['Ploy', 'Nok', 'Fon', 'Mint', 'Noon', 'Pim', 'Fah', 'Jan', 'Bee', 'Kwan'],
    men: ['Ton', 'Bank', 'Golf', 'Boss', 'Arm', 'Beam', 'Top', 'Nat', 'Pond', 'Big'],
  },
  {
    key: 'filipino',
    boxes: [[4.5, 116.8, 21.2, 126.7]],
    women: ['Maria', 'Angelica', 'Kimberly', 'Princess', 'Mary Joy', 'Kristine', 'Jennifer', 'Joanna', 'Michelle', 'Camille'],
    men: ['John Paul', 'Mark', 'Christian', 'Jerome', 'Kevin', 'Michael', 'Jayson', 'Ryan', 'Joshua', 'Carlo'],
  },
  {
    key: 'malay',
    // Malaysia and Indonesia
    boxes: [[-11, 95, 7.5, 141]],
    women: ['Siti', 'Nur', 'Putri', 'Dewi', 'Ayu', 'Sri', 'Rina', 'Wulan', 'Intan', 'Aisyah'],
    men: ['Muhammad', 'Ahmad', 'Agus', 'Budi', 'Rizky', 'Andi', 'Fajar', 'Hendra', 'Arif', 'Hafiz'],
  },
  {
    key: 'singapore',
    boxes: [[1.15, 103.6, 1.48, 104.1]],
    women: ['Wei Ling', 'Hui Min', 'Siti', 'Priya', 'Mei Ling', 'Nur', 'Rachel', 'Jasmine', 'Grace', 'Shu Fen'],
    men: ['Wei Jie', 'Jun Hao', 'Muhammad', 'Ravi', 'Daniel', 'Ryan', 'Zhi Hao', 'Kumar', 'Marcus', 'Hafiz'],
  },
  {
    key: 'kenyan',
    boxes: [[-4.7, 33.9, 5.5, 41.9]],
    women: ['Wanjiru', 'Akinyi', 'Achieng', 'Njeri', 'Wambui', 'Faith', 'Mercy', 'Grace', 'Joy', 'Esther'],
    men: ['Kamau', 'Otieno', 'Mwangi', 'Brian', 'Kevin', 'Dennis', 'Collins', 'Ochieng', 'Kiprono', 'Njoroge'],
  },
  {
    key: 'south-african',
    boxes: [[-35, 16.4, -22.1, 33]],
    women: ['Thandi', 'Nomsa', 'Lerato', 'Palesa', 'Zanele', 'Sarah', 'Michelle', 'Nadia', 'Ayanda', 'Lindiwe'],
    men: ['Sipho', 'Thabo', 'Lwazi', 'Johan', 'Pieter', 'Kagiso', 'Mandla', 'Ryan', 'Bongani', 'Tshepo'],
  },
  {
    key: 'australian',
    // Australia and New Zealand
    boxes: [[-47.5, 112, -10, 179]],
    women: ['Jessica', 'Sarah', 'Emma', 'Chloe', 'Emily', 'Lauren', 'Hannah', 'Kate', 'Laura', 'Megan'],
    men: ['Jack', 'James', 'Josh', 'Matthew', 'Daniel', 'Ryan', 'Liam', 'Thomas', 'Nathan', 'Ben'],
  },
  {
    key: 'shared',
    // places a bigger box would name wrongly, and no list of their own yet: the Levant, Cyprus, the Baltic
    // states, Romania, Bulgaria and Moldova, Mongolia, Central Asia, Myanmar, Cambodia, the South Caucasus,
    // the Sahel
    boxes: [[41.0, 41.5, 42.6, 50.0], [38.8, 43.5, 41.0, 50.0], [10, -17.6, 18.0, 16.0], [29.4, 34.2, 33.4, 35.9], [34.5, 32.2, 35.75, 34.65], [54.0, 20.9, 59.7, 28.2], [41.2, 20.2, 48.3, 29.8], [41.5, 87.7, 52.2, 120.0], [35.0, 46.5, 50.5, 87.4], [9.6, 92.2, 28.6, 101.2], [10.4, 102.3, 14.7, 106.2]],
    women: SHARED_WOMEN,
    men: SHARED_MEN,
  },
];

/** Names that read in most languages, where no region fits. */
const SHARED: Region = { key: 'shared', boxes: [], women: SHARED_WOMEN, men: SHARED_MEN };

/** The story's people by name. */
export interface Names {
  /** the region the names were drawn from */
  region: string;
  /** at the fuel station */
  pump: string;
  /** at the fire station */
  flame: string;
  /** at the police station */
  shield: string;
  /** in the first home's building */
  neighbour: string;
  friends: [string, string, string];
}

/** The region a place lies in: of the boxes that hold it, the smallest. */
export function regionAt(lat: number, lon: number): Region {
  let best: Region = SHARED;
  let area = Infinity;
  for (const r of REGIONS) {
    for (const [s, w, n, e] of r.boxes) {
      if (lat < s || lat > n || lon < w || lon > e) continue;
      const a = (n - s) * (e - w);
      if (a < area) {
        area = a;
        best = r;
      }
    }
  }
  return best;
}

/** A number from a place, the same on every visit: the names stay put for a player. */
function seedOf(lat: number, lon: number): number {
  let h = 2166136261;
  for (const c of `${lat.toFixed(4)},${lon.toFixed(4)}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small, steady stream of numbers from a seed. */
function stream(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** The story's people for a home at this place: different names for each, from the place's region. */
export function namesFor(lat: number, lon: number): Names {
  const r = regionAt(lat, lon);
  const next = stream(seedOf(lat, lon));
  const used = new Set<string>();
  const pick = (from: string[]): string => {
    const left = from.filter((n) => !used.has(n));
    const name = left[Math.floor(next() * left.length)] ?? from[0];
    used.add(name);
    return name;
  };
  const either = (): string => (next() < 0.5 ? pick(r.women) : pick(r.men));
  return { region: r.key, pump: pick(r.women), flame: pick(r.men), shield: pick(r.women), neighbour: either(), friends: [pick(r.women), pick(r.men), either()] };
}

/** For tests: every region's key and its lists. */
export const REGION_LISTS: ReadonlyArray<Pick<Region, 'key' | 'women' | 'men'>> = REGIONS;
