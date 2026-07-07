/* Thai Province → District (Amphoe) mapping — English names, all 77 provinces */
const THAI_PROV_DIST = {
  /* ── Central ── */
  'Bangkok': [
    'Phra Nakhon','Pom Prap Sattru Phai','Samphanthawong','Dusit','Phaya Thai','Ratchathewi',
    'Pathum Wan','Bang Rak','Sathon','Bang Kho Laem','Yan Nawa','Khlong San','Thon Buri',
    'Bangkok Yai','Bangkok Noi','Bang Phlat','Taling Chan','Thawi Watthana','Phasi Charoen',
    'Nong Khaem','Bang Khae','Bang Khun Thian','Chom Thong','Rat Burana','Thung Khru',
    'Bang Bon','Huai Khwang','Wang Thonglang','Khlong Toei','Suan Luang','Phra Khanong',
    'Bang Na','Lat Krabang','Min Buri','Khan Na Yao','Saphan Sung','Nong Chok','Prawet',
    'Bueng Kum','Lat Phrao','Chatuchak','Bang Sue','Bang Khen','Lak Si','Don Mueang'
  ],
  'Kanchanaburi': [
    'Mueang Kanchanaburi','Sai Yok','Bo Phloi','Si Sawat','Tha Maka','Tha Muang',
    'Thong Pha Phum','Sangkhla Buri','Phanom Thuan','Lao Khwan','Dan Makkham Tia',
    'Nong Prue','Huai Krachao'
  ],
  'Nakhon Pathom': ['Mueang Nakhon Pathom','Kamphaeng Saen','Nakhon Chai Si','Don Tum','Bang Len','Sam Phran','Phutthamonthon'],
  'Nakhon Nayok': ['Mueang Nakhon Nayok','Pak Phli','Ban Na','Ongkharak'],
  'Nonthaburi': ['Mueang Nonthaburi','Bang Kruai','Bang Yai','Bang Bua Thong','Sai Noi','Pak Kret'],
  'Pathum Thani': ['Mueang Pathum Thani','Khlong Luang','Thanyaburi','Nong Suea','Lat Lum Kaeo','Lam Luk Ka','Sam Khok'],
  'Prachuap Khiri Khan': ['Mueang Prachuap Khiri Khan','Kui Buri','Thap Sakae','Bang Saphan','Bang Saphan Noi','Pran Buri','Hua Hin','Sam Roi Yot'],
  'Prachin Buri': ['Mueang Prachin Buri','Kabin Buri','Na Di','Ban Sang','Prachantakham','Si Maha Phot','Si Mahosot'],
  'Phra Nakhon Si Ayutthaya': [
    'Phra Nakhon Si Ayutthaya','Tha Ruea','Nakhon Luang','Bang Sai','Bang Ban','Bang Pa-in',
    'Bang Pahan','Phak Hai','Phachi','Lat Bua Luang','Wang Noi','Sena','Bang Sai (Hua)','Uthai','Maha Rat','Ban Phraek'
  ],
  'Phetchaburi': ['Mueang Phetchaburi','Khao Yoi','Nong Ya Plong','Cha-am','Tha Yang','Ban Lat','Ban Laem','Kaeng Krachan'],
  'Ratchaburi': ['Mueang Ratchaburi','Chom Bueng','Suan Phueng','Damnoen Saduak','Ban Pong','Bang Phae','Photharam','Pak Tho','Wat Phleng','Ban Kha'],
  'Lop Buri': ['Mueang Lop Buri','Phatthana Nikhom','Khok Samrong','Chai Badan','Tha Wung','Ban Mi','Tha Luang','Sa Bot','Khok Charoen','Lam Sonthi','Nong Muang'],
  'Samut Prakan': ['Mueang Samut Prakan','Bang Bo','Bang Phli','Phra Pradaeng','Phra Samut Chedi','Bang Sao Thong'],
  'Samut Songkhram': ['Mueang Samut Songkhram','Bang Khonthi','Amphawa'],
  'Samut Sakhon': ['Mueang Samut Sakhon','Krathum Baen','Ban Phaeo'],
  'Saraburi': ['Mueang Saraburi','Kaeng Khoi','Nong Khae','Wiha Daeng','Nong Saeng','Ban Mo','Don Phut','Nong Don','Phra Phutthabat','Sa Bot','Wang Muang','Chaloem Phra Kiat','Muak Lek'],
  'Sa Kaeo': ['Mueang Sa Kaeo','Khlong Hat','Ta Phraya','Wang Nam Yen','Watthana Nakhon','Aranyaprathet','Khao Chakan','Khok Sung','Wang Sombun'],
  'Sing Buri': ['Mueang Sing Buri','Bang Rachan','Khai Bang Rachan','Phrom Buri','Tha Chang','In Buri'],
  'Suphan Buri': ['Mueang Suphan Buri','Doem Bang Nang Buat','Dan Chang','Bang Pla Ma','Si Prachan','Don Chedi','Song Phi Nong','Sam Chuk','U Thong','Nong Ya Sai'],
  'Ang Thong': ['Mueang Ang Thong','Chaiyo','Pa Mok','Pho Thong','Sawaeng Ha','Wiset Chai Chan','Sam Ko'],
  'Uthai Thani': ['Mueang Uthai Thani','Thap Than','Sawang Arom','Nong Chang','Nong Khayang','Ban Rai','Lan Sak','Huai Khot'],
  'Chai Nat': ['Mueang Chai Nat','Manorom','Wat Sing','Sapphaya','Sankhaburi','Hankha','Nong Mamong','Noen Kham'],

  /* ── Eastern ── */
  'Chachoengsao': ['Mueang Chachoengsao','Bang Khla','Bang Nam Priao','Bang Pakong','Ban Pho','Phanom Sarakham','Ratchasan','Sanam Chai Khet','Plaeng Yao','Tha Takiap','Khlong Khuean'],
  'Chon Buri': ['Mueang Chon Buri','Ban Bueng','Nong Yai','Bang Lamung','Phan Thong','Phanat Nikhom','Si Racha','Ko Si Chang','Sattahip','Bo Thong','Ko Chan'],
  'Trat': ['Mueang Trat','Khlong Yai','Khao Saming','Bo Rai','Laem Ngop','Ko Kut','Ko Chang'],
  'Chanthaburi': ['Mueang Chanthaburi','Khlung','Tha Mai','Pong Nam Ron','Makham','Laem Sing','Soi Dao','Kaeng Hang Maeo','Na Yai Am','Khao Khitchakut'],
  'Rayong': ['Mueang Rayong','Ban Chang','Klaeng','Wang Chan','Ban Khai','Pluak Daeng','Khao Chamao','Nikhom Phattana'],

  /* ── Northern Upper ── */
  'Chiang Mai': [
    'Mueang Chiang Mai','Chom Thong','Mae Chaem','Chiang Dao','Doi Saket','Mae Taeng','Mae Rim',
    'Samoeng','Fang','Mae Ai','Phrao','San Pa Tong','San Kamphaeng','San Sai','Hang Dong','Hot',
    'Doi Tao','Om Koi','Saraphi','Wiang Haeng','Chai Prakan','Mae Wang','Mae On','Doi Lo','Galyani Vadhana'
  ],
  'Chiang Rai': [
    'Mueang Chiang Rai','Wiang Chai','Chiang Khong','Thoeng','Phan','Pa Daet','Mae Chan',
    'Chiang Saen','Mae Sai','Mae Suai','Wiang Pa Pao','Phaya Mengrai','Wiang Kaen','Khun Tan',
    'Mae Fa Luang','Mae Lao','Wiang Chiang Rung','Doi Luang'
  ],
  'Nan': ['Mueang Nan','Mae Charim','Ban Luang','Na Noi','Pua','Tha Wang Pha','Wiang Sa','Thung Chang','Chiang Klang','Na Muen','Santi Suk','Bo Kluea','Song Khwae','Phu Phiang','Chaloem Phra Kiat'],
  'Phayao': ['Mueang Phayao','Chun','Chiang Kham','Chiang Muan','Dok Khamtai','Pong','Mae Chai','Phu Sang','Phu Kamyao'],
  'Phrae': ['Mueang Phrae','Rong Kwang','Long','Sung Men','Den Chai','Song','Wang Chin','Nong Muang Khai'],
  'Mae Hong Son': ['Mueang Mae Hong Son','Khun Yuam','Pai','Mae Sariang','Mae La Noi','Sop Moei','Pang Mapha'],
  'Lampang': ['Mueang Lampang','Mae Mo','Ko Kha','Soem Ngam','Ngao','Chae Hom','Wang Nuea','Hang Chat','Mueang Pan','Sop Prap','Mae Phrik','Mae Tha','Sung Men'],
  'Lamphun': ['Mueang Lamphun','Mae Tha','Ban Hong','Li','Thung Hua Chang','Pa Sang','Ban Thi','Wiang Nong Long'],

  /* ── Northern Lower ── */
  'Kamphaeng Phet': ['Mueang Kamphaeng Phet','Sai Ngam','Khlong Lan','Khanu Woralaksaburi','Khlong Khlung','Phran Kratai','Lan Krabue','Sai Thong Watthana','Pang Sila Thong','Bueng Samakkhi','Ko Samphrao'],
  'Tak': ['Mueang Tak','Ban Tak','Sam Ngao','Mae Ramat','Tha Song Yang','Mae Sot','Phop Phra','Umphang','Wang Chao'],
  'Nakhon Sawan': ['Mueang Nakhon Sawan','Khok Kruat','Chum Saeng','Nong Bua','Banphot Phisai','Kao Liao','Takhli','Tha Tako','Phaisali','Phayuha Khiri','Lat Yao','Tak Fa','Mae Wong','Mae Poen','Chum Ta Bong'],
  'Phichit': ['Mueang Phichit','Wang Sai Phun','Pho Prathap Chang','Taphan Hin','Bang Mun Nak','Pho Thale','Sam Ngam','Thap Khlo','Sak Lek','Bueng Na Rang','Dong Charoen','Wachirabarami'],
  'Phitsanulok': ['Mueang Phitsanulok','Nakhon Thai','Chat Trakan','Bang Rakam','Bang Krathum','Phrom Phiram','Wat Bot','Wang Thong','Noen Maprang'],
  'Phetchabun': ['Mueang Phetchabun','Chon Daen','Lom Sak','Lom Kao','Wichian Buri','Si Thep','Nong Phai','Bueng Sam Phan','Nam Nao','Wang Pong','Khao Kho'],
  'Sukhothai': ['Mueang Sukhothai','Ban Dan Lan Hoi','Khiri Mat','Kong Krailat','Si Satchanalai','Si Samrong','Sawankhalok','Si Nakhon','Thung Saliam'],
  'Uttaradit': ['Mueang Uttaradit','Tron','Tha Pla','Nam Pat','Fak Tha','Ban Khok','Phichai','Laplae','Thong Saen Khan'],

  /* ── Northeastern ── */
  'Kalasin': ['Mueang Kalasin','Na Mon','Kamalasai','Rong Kham','Kuchinarai','Khao Wong','Yang Talat','Huai Mek','Sahatsakhan','Kham Muang','Tha Khantho','Nong Kung Si','Somdet','Huai Phueng','Sam Chai','Na Khu','Don Chan','Khong Chai'],
  'Khon Kaen': ['Mueang Khon Kaen','Ban Fang','Phra Yuen','Nong Rua','Chum Phae','Si Chomphu','Nam Phong','Ubolratana','Kranuan','Ban Phai','Pueai Noi','Phon','Waeng Yai','Waeng Noi','Nong Song Hong','Phu Wiang','Mancha Khiri','Chonnabot','Khao Suan Kwang','Phu Pha Man','Sam Sung','Khok Pho Chai','Nong Na Kham','Ban Haet','Nong Suang','Wiang Kao'],
  'Chaiyaphum': ['Mueang Chaiyaphum','Ban Khwao','Khon San Warawa','Kaset Sombun','Nong Bua Daeng','Chatturat','Bamnet Narong','Nong Bua Ra Wai','Thep Sathit','Phu Khiao','Ban Thaen','Kaeng Khro','Khon San','Phakdi Chumphon','Noen Sa-nga','Sap Yai'],
  'Nakhon Phanom': ['Mueang Nakhon Phanom','Pla Pak','Tha Uthen','Ban Phaeng','That Phanom','Renu Nakhon','Na Kae','Si Songkhram','Na Wa','Phon Sawan','Na Thom','Wang Yang'],
  'Nakhon Ratchasima': [
    'Mueang Nakhon Ratchasima','Khon Buri','Soeng Sang','Khong','Ban Lueam','Chakkarat','Chok Chai',
    'Dan Khun Thot','Non Thai','Non Sung','Kham Sakaesaeng','Bua Yai','Prathai','Pak Thong Chai',
    'Phimai','Huai Thalaeng','Chum Phuang','Sung Noen','Kham Thale So','Sikhio','Pak Chong',
    'Nong Bun Mak','Kaeng Sanam Nang','Non Daeng','Wang Nam Khiao','Thepharak','Mueang Yang',
    'Phra Thong Kham','Lam Thamenchai','Bua Lai','Si Da','Chaloem Phra Kiat'
  ],
  'Bueng Kan': ['Mueang Bueng Kan','Phon Charoen','So Phisai','Seka','Pak Khat','Bueng Khong Long','Si Wilai','Bung Khla'],
  'Buri Ram': ['Mueang Buri Ram','Khu Mueang','Krasang','Nang Rong','Nong Ki','La Han Sai','Prakhon Chai','Ban Kruat','Phutthaisong','Lam Plai Mat','Satuek','Pakham','Na Pho','Nong Hong','Phlapphla Chai','Huai Rat','Non Suwan','Chamni','Ban Mai Chaiyaphot','Non Din Daeng','Ban Dan','Khae Dong','Chaloem Phra Kiat'],
  'Maha Sarakham': ['Mueang Maha Sarakham','Kae Dam','Kosum Phisai','Kantharawichai','Chiang Yuen','Borabue','Na Chueak','Phayakkaphum Phisai','Wapi Pathum','Na Dun','Yang Sisurat','Kut Rang','Chuen Chom'],
  'Mukdahan': ['Mueang Mukdahan','Nikhom Kham Soi','Don Tan','Dong Luang','Kham Cha-i','Wan Yai','Nong Sung'],
  'Yasothon': ['Mueang Yasothon','Sai Mun','Kut Chum','Kham Khuean Kaeo','Pa Tio','Maha Chana Chai','Kho Wang','Loeng Nok Tha','Thai Charoen'],
  'Roi Et': ['Mueang Roi Et','Kaset Wisai','Pathum Rat','Chaturaphak Phiman','Thawat Buri','Phanom Phrai','Phon Thong','Pho Chai','Nong Phok','Selaphum','Suwannaphum','Mueang Suang','Phon Sai','At Samat','Moei Wadi','Si Somdet','Changhan','Chiang Khwan','Nong Hi','Thung Khao Luang'],
  'Loei': ['Mueang Loei','Na Duang','Chiang Khan','Pak Chom','Dan Sai','Na Haeo','Phu Ruea','Tha Li','Wang Saphung','Phu Kradueng','Phu Luang','Pha Khao','Erawan','Nong Hin'],
  'Si Sa Ket': ['Mueang Si Sa Ket','Yang Chum Noi','Kantharalak','Kanthararom','Khukhan','Phai Bin','Prang Ku','Khun Han','Rasi Salai','Uthumphon Phisai','Bueng Bun','Huai Thap Than','Non Khun','Si Rattana','Nam Kliang','Wang Hin','Phu Sing','Mueang Chan','Benchalak','Phayuh','Pho Si Suwan','Sila Lat'],
  'Sakon Nakhon': ['Mueang Sakon Nakhon','Kusuman','Kut Bak','Phanna Nikhom','Phang Khon','Waritchaphum','Nikhom Nam Un','Wanon Niwat','Kham Ta Kla','Ban Muang','Akat Amnuai','Sawang Daen Din','Song Dao','Tao Ngoi','Khok Si Suphan','Charoen Sin','Phu Phan','Phon Na Kaeo'],
  'Surin': ['Mueang Surin','Chumphon Buri','Tha Tum','Chom Phra','Prasat','Kap Choeng','Rattana Buri','Sanom','Si Khoraphum','Sangkha','Lamduan','Samrong Thap','Buachet','Phanom Dong Rak','Si Narong','Khwao Sinarin','Non Narai'],
  'Nong Khai': ['Mueang Nong Khai','Tha Bo','Phon Phisai','Si Chiang Mai','Sangkhom','Sa Khrai','Fao Rai','Rattana Wapi','Pho Tak'],
  'Nong Bua Lam Phu': ['Mueang Nong Bua Lam Phu','Na Klang','Non Sang','Yalo','Si Bun Rueang','Suwannakhuha','Na Wang'],
  'Amnat Charoen': ['Mueang Amnat Charoen','Chanuman','Pathum Ratchawongsa','Phana','Senangkhanikhom','Hua Taphan','Lue Am Nat'],
  'Udon Thani': ['Mueang Udon Thani','Kut Chap','Nong Wua So','Kumphawapi','Non Sa-at','Nong Han','Thung Fon','Chai Wan','Si That','Wang Sam Mo','Ban Dung','Ban Phue','Nam Som','Phen','Sang Khom','Nong Saeng','Na Yung','Phibun Rak','Ku Kaeo','Prachak Sinlapakhom'],
  'Ubon Ratchathani': [
    'Mueang Ubon Ratchathani','Si Mueang Mai','Khong Chiam','Khuean Nakhon','Khemarat','Det Udom',
    'Na Chaluai','Nam Yuen','Buntharik','Trakan Phuet Phon','Kut Khao Pun','Muang Sam Sip',
    'Warin Chamrap','Phibun Mangsahan','Tan Sum','Pho Sai','Sam Rong','Don Mot Daeng',
    'Sirindhorn','Thung Si Udom','Na Yia','Na Tan','Lao Suea Kok','Sawang Wirawong','Nam Khun'
  ],

  /* ── Southern ── */
  'Krabi': ['Mueang Krabi','Khao Phanom','Ko Lanta','Khlong Thom','Ao Luek','Plai Phraya','Lam Thap','Nuea Khlong'],
  'Chumphon': ['Mueang Chumphon','Tha Sae','Pa Thio','Lang Suan','La-un','Phato','Sawi','Thung Tako'],
  'Trang': ['Mueang Trang','Kantang','Yan Ta Khao','Palian','Sikao','Huai Yot','Wang Wiset','Na Yong','Ratsada','Hat Samran'],
  'Nakhon Si Thammarat': ['Mueang Nakhon Si Thammarat','Phrom Khiri','Lan Saka','Chawang','Phipun','Chian Yai','Cha-uat','Tha Sala','Thung Song','Na Bon','Thung Yai','Pak Phanang','Ron Phibun','Sichon','Khanom','Hua Sai','Bang Khan','Tham Phannara','Chulabhorn','Phra Phrom','Nopphitam','Chang Klang','Chaloem Phra Kiat'],
  'Narathiwat': ['Mueang Narathiwat','Tak Bai','Ba Cho','Yi-ngo','Ra-ngae','Rueso','Si Sakhon','Waeng','Sukhirin','Su-ngai Kolok','Su-ngai Padi','Chanae','Cho-airong'],
  'Pattani': ['Mueang Pattani','Khok Pho','Nong Chik','Panare','Mayo','Thung Yang Daeng','Sai Buri','Mai Kaen','Yaring','Yarang','Kapho','Mae Lan'],
  'Phatthalung': ['Mueang Phatthalung','Kong Ra','Khao Chaison','Tamot','Khuan Khanun','Pak Prayun','Si Banphot','Pa Bon','Bang Kaeo','Pa Phayom','Si Nakharin'],
  'Phang Nga': ['Mueang Phang Nga','Ko Yao','Kapong','Takua Thung','Takua Pa','Khura Buri','Thai Mueang','Thap Put'],
  'Phuket': ['Mueang Phuket','Kathu','Thalang'],
  'Yala': ['Mueang Yala','Betong','Bannang Sata','Than To','Yaha','Raman','Kabang','Krong Pinang'],
  'Ranong': ['Mueang Ranong','La-un','Kapoe','Kra Buri','Suk Samran'],
  'Songkhla': ['Mueang Songkhla','Sathing Phra','Chana','Na Thawi','Thepha','Saba Yoi','Ranot','Krasae Sin','Rattaphum','Sadao','Hat Yai','Na Mom','Khuan Niang','Bang Klam','Singhanakhon','Khlong Hoi Khong'],
  'Satun': ['Mueang Satun','Khuan Don','Khuan Kalong','Tha Phae','La-ngu','Thung Wa','Manang'],
  'Surat Thani': ['Mueang Surat Thani','Kanchanadit','Don Sak','Ko Samui','Ko Pha-ngan','Chaiya','Tha Chana','Khiri Rat Nikhom','Ban Ta Khun','Phanom','Tha Chang','Ban Na San','Ban Na Doem','Khian Sa','Wiang Sa','Phrasaeng','Phunphin','Chai Buri','Vibhavadi'],
};

/* Lookup — exact match first, then case-insensitive */
function getThaiDistricts(province) {
  if (!province) return [];
  if (THAI_PROV_DIST[province]) return THAI_PROV_DIST[province];
  const lo = province.toLowerCase();
  const key = Object.keys(THAI_PROV_DIST).find(k => k.toLowerCase() === lo);
  return key ? THAI_PROV_DIST[key] : [];
}
