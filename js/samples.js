/* Sample invitations: Himachali Dham, Wedding, Rajwada Jharokha wedding, Pastel engagement, Ivory foil anniversary, Temple housewarming, Birthday, Corporate conference. window.IXSamples */
(function () {
  'use strict';
  const IX = window.IX, M = IX.model, art = (...a) => IXT.sampleArt(...a);
  const inDays = (n) => { const d = new Date(Date.now() + n * 86400e3); return d.toISOString().slice(0, 10); };
  const ev = (o) => Object.assign(M.newEvent(o.name), o);
  const T = (o) => Object.assign({ title: '', subtitle: '', hostName: '', familyName: '', welcome: '', message: '', instructions: '', extraInfo: '', thankyou: '' }, o);

  function dham() {
    const inv = M.newInvitation('festival', 'himalayan-dham');
    const d = inDays(45);
    Object.assign(inv, {
      slug: 'himachali-dham-sample', languages: ['en', 'hi'], defaultLang: 'en', paletteIndex: 0, layout: 'portrait',
      dressCode: 'Traditional Himachali attire – Kullu topi & pattu welcome',
      contact: { name: 'Rajeev Thakur', phone: '+91 98160 00000' },
      text: {
        en: T({
          title: 'Himachali Dham', subtitle: 'A traditional feast from the mountains', familyName: 'The Thakur Family, Mandi', hostName: 'Rajeev & Sunita Thakur',
          welcome: 'Jai Dev! With the blessings of our Kul Devta, we welcome you to share a traditional Dham with our family in the lap of the Himalayas.',
          message: '<p>On the auspicious occasion of our new home\'s <b>Griha Pravesh</b>, the Thakur family cordially invites you and your family to a traditional <b>Himachali Dham</b>.</p><p>The Dham will be cooked by our Botis in the age-old way and served on pattal, seated together on the floor, as our elders have always done.</p><p>Please come, bless us and enjoy the flavours of home.</p>',
          instructions: 'Dham is served seated on the floor in rows (pangat). Please arrive by 12:30 PM.\nParking is available at the school ground next to the venue.',
          extraInfo: 'Guests travelling from Shimla or Chandigarh: shared taxis leave Mandi bus stand every 30 minutes.',
          thankyou: 'Your presence will make our new beginning truly blessed. Dhanyavaad!',
        }),
        hi: T({
          title: 'हिमाचली धाम', subtitle: 'पहाड़ों का पारंपरिक भोज', familyName: 'ठाकुर परिवार, मंडी', hostName: 'राजीव एवं सुनीता ठाकुर',
          welcome: 'जय देव! कुल देवता के आशीर्वाद से हम आपको हिमालय की गोद में अपने परिवार के साथ पारंपरिक धाम में सादर आमंत्रित करते हैं।',
          message: '<p>हमारे नए घर के <b>गृह प्रवेश</b> के शुभ अवसर पर ठाकुर परिवार आपको सपरिवार पारंपरिक <b>हिमाचली धाम</b> में सादर आमंत्रित करता है।</p><p>धाम हमारे बोटी पारंपरिक विधि से बनाएंगे और पत्तल पर पंगत में परोसा जाएगा।</p><p>कृपया पधारें, आशीर्वाद दें और घर के स्वाद का आनंद लें।</p>',
          instructions: 'धाम पंगत में ज़मीन पर बैठाकर परोसा जाएगा। कृपया दोपहर 12:30 बजे तक पधारें।\nपार्किंग स्थल के पास स्कूल मैदान में उपलब्ध है।',
          thankyou: 'आपकी उपस्थिति से हमारी नई शुरुआत धन्य होगी। धन्यवाद!',
        }),
      },
      events: [
        ev({ name: 'Griha Pravesh Puja', date: d, start: '09:30', end: '11:30', venue: 'Thakur Niwas', address: 'Village Bhiuli, near Shiv Mandir', city: 'Mandi, Himachal Pradesh', pin: '175001', dressCode: 'Traditional' }),
        ev({ name: 'Dham (Community Feast)', date: d, start: '12:30', end: '15:30', venue: 'Thakur Niwas Courtyard', address: 'Village Bhiuli, near Shiv Mandir', city: 'Mandi, Himachal Pradesh', pin: '175001' }),
      ],
      highlightsTitle: 'Traditional Mandyali Dham Menu',
      highlights: [
        { icon: '🍚', title: 'Bhaat', desc: 'Steamed rice, the heart of every Dham' },
        { icon: '🫘', title: 'Madra', desc: 'Chickpeas slow-cooked in yoghurt & ghee' },
        { icon: '🥣', title: 'Sepu Vadi', desc: 'Urad-dal dumplings in spinach gravy' },
        { icon: '🍛', title: 'Rajmah', desc: 'Kidney beans the Pahadi way' },
        { icon: '🥘', title: 'Khatta (Kaddu)', desc: 'Sweet-sour pumpkin with tamarind' },
        { icon: '🍯', title: 'Mittha', desc: 'Sweet rice with dry fruits' },
      ],
    });
    inv.media.gallery = [{ ref: art('mountain', '#7a1f2e', '#c49a45', 'Dhauladhar range'), caption: 'Our village in the Dhauladhars' }, { ref: art('food', '#7a1f2e', '#c49a45', 'Dham on pattal'), caption: 'Dham served on pattal' }, { ref: art('family', '#7a1f2e', '#5d7a4a', 'Thakur family'), caption: 'The Thakur family' }];
    inv.hostsList = [{ ref: art('family', '#7a1f2e', '#5d7a4a'), name: 'Rajeev & Sunita Thakur', role: 'Hosts' }];
    inv.mainEventId = inv.events[1].id;
    inv.design.sections.highlights = true;
    inv.design.border = 'ornate'; inv.design.photoShape = 'arch';
    inv.design.sectionOrder = ['opening', 'welcome', 'message', 'countdown', 'schedule', 'highlights', 'venue', 'hosts', 'gallery', 'media', 'rsvp', 'instructions', 'thankyou'];
    inv.settings.rsvpDeadline = inDays(38); inv.settings.maxPerInvite = 8;
    return inv;
  }

  function wedding() {
    const inv = M.newInvitation('wedding', 'royal-maroon');
    const d = inDays(60);
    const v = { venue: 'The Grand Taj Hotel', address: 'Mansingh Road', city: 'New Delhi', pin: '110011' };
    Object.assign(inv, {
      slug: 'aarav-diya-wedding', languages: ['en', 'hi', 'pa'], defaultLang: 'en',
      dressCode: 'Indian festive', contact: { name: 'Vikram Mehra (Aarav\'s brother)', phone: '+91 98110 00000' },
      text: {
        en: T({ title: 'Aarav & Diya', subtitle: 'Invite you to celebrate their wedding', familyName: 'Together with their families', hostName: 'The Mehra & Kapoor Families',
          welcome: 'Two hearts, two families, one beautiful journey. We would be honoured to have you with us.',
          message: '<p>With the blessings of our elders and the grace of the Almighty,</p><p><b>Mr. &amp; Mrs. Suresh Mehra</b> and <b>Mr. &amp; Mrs. Anil Kapoor</b> request the pleasure of your company at the wedding of their children</p><p style="text-align:center"><b>Aarav</b> &amp; <b>Diya</b></p><p>Your presence and blessings will make our celebration complete.</p>',
          instructions: 'Valet parking is available at the hotel.\nNo boxed gifts please – your blessings are our gift.', thankyou: 'Thank you for being part of our story.' }),
        hi: T({ title: 'आरव और दिया', subtitle: 'आपको अपने विवाह समारोह में आमंत्रित करते हैं', familyName: 'परिवार सहित', hostName: 'मेहरा एवं कपूर परिवार',
          welcome: 'दो दिल, दो परिवार, एक सुंदर सफ़र। आपकी उपस्थिति हमारे लिए सम्मान होगी।',
          message: '<p>बड़ों के आशीर्वाद एवं ईश्वर की कृपा से,</p><p><b>श्री एवं श्रीमती सुरेश मेहरा</b> तथा <b>श्री एवं श्रीमती अनिल कपूर</b> अपनी संतान</p><p style="text-align:center"><b>आरव</b> एवं <b>दिया</b></p><p>के शुभ विवाह में आपको सपरिवार सादर आमंत्रित करते हैं।</p>' }),
        pa: T({ title: 'ਆਰਵ ਅਤੇ ਦੀਆ', subtitle: 'ਤੁਹਾਨੂੰ ਆਪਣੇ ਵਿਆਹ ਦੇ ਜਸ਼ਨ ਵਿੱਚ ਸੱਦਾ ਦਿੰਦੇ ਹਨ', familyName: 'ਪਰਿਵਾਰਾਂ ਸਮੇਤ', hostName: 'ਮਹਿਰਾ ਅਤੇ ਕਪੂਰ ਪਰਿਵਾਰ',
          message: '<p>ਵੱਡਿਆਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਅਤੇ ਵਾਹਿਗੁਰੂ ਦੀ ਕਿਰਪਾ ਨਾਲ,</p><p>ਮਹਿਰਾ ਅਤੇ ਕਪੂਰ ਪਰਿਵਾਰ ਤੁਹਾਨੂੰ <b>ਆਰਵ</b> ਅਤੇ <b>ਦੀਆ</b> ਦੇ ਸ਼ੁਭ ਵਿਆਹ ਵਿੱਚ ਪਰਿਵਾਰ ਸਮੇਤ ਸੱਦਾ ਦਿੰਦੇ ਹਨ।</p>' }),
      },
      events: [
        ev({ name: 'Mehendi', date: inDays(58), start: '16:00', end: '20:00', venue: 'Mehra Residence', address: '14 Prithviraj Road', city: 'New Delhi', pin: '110011', dressCode: 'Green & yellow' }),
        ev({ name: 'Haldi', date: inDays(59), start: '10:00', end: '13:00', venue: 'Mehra Residence', address: '14 Prithviraj Road', city: 'New Delhi', pin: '110011', dressCode: 'Yellow' }),
        ev(Object.assign({ name: 'Wedding Ceremony', date: d, start: '19:00', end: '23:30', dressCode: 'Indian festive' }, v)),
        ev(Object.assign({ name: 'Reception', date: inDays(61), start: '19:30', end: '23:00', dressCode: 'Formal / Indo-western' }, v)),
      ],
    });
    inv.mainEventId = inv.events[2].id;
    inv.media.cover = art('couple', '#7d1d2f', '#d4a557');
    inv.hostsList = [{ ref: art('couple', '#7d1d2f', '#e7b9b6'), name: 'Aarav Mehra', role: 'Groom' }, { ref: art('couple', '#d4a557', '#7d1d2f'), name: 'Diya Kapoor', role: 'Bride' }];
    inv.media.gallery = [1, 2, 3, 4].map((i) => ({ ref: art(i % 2 ? 'couple' : 'family', '#7d1d2f', '#d4a557', 'Photo ' + i), caption: '' }));
    inv.settings.rsvpDeadline = inDays(50); inv.settings.maxPerInvite = 5; inv.settings.maxGuestsTotal = 400;
    return inv;
  }

  function birthday() {
    const inv = M.newInvitation('birthday', 'confetti-party');
    Object.assign(inv, {
      slug: 'riya-5th-birthday', languages: ['en', 'hi'], defaultLang: 'en', contact: { name: 'Neha (Riya\'s mom)', phone: '+91 99880 00000' },
      text: {
        en: T({ title: 'Riya turns 5!', subtitle: 'Join us for cake, games & giggles', hostName: 'Neha & Arjun', welcome: 'Our little sunshine is turning five and we want you there! 🎈',
          message: '<p>Come celebrate <b>Riya\'s 5th birthday</b> with magic shows, a bouncy castle, and lots of cake! 🎂</p><p>Kids and grown-ups are equally welcome.</p>',
          instructions: 'Theme: Rainbow & Unicorns – dress up if you like!\nPlease let us know about any food allergies.' }),
        hi: T({ title: 'रिया हुई 5 साल की!', subtitle: 'केक, खेल और ढेर सारी मस्ती', message: '<p><b>रिया के 5वें जन्मदिन</b> पर जादू के खेल, बाउंसी कैसल और ढेर सारा केक! 🎂</p><p>बच्चे और बड़े, सब आमंत्रित हैं।</p>' }),
      },
      events: [ev({ name: 'Birthday Party', date: inDays(21), start: '16:00', end: '19:00', venue: 'Fun Zone Party Hall', address: 'Sector 17 Market', city: 'Chandigarh', pin: '160017', dressCode: 'Rainbow colours' })],
    });
    inv.media.cover = art('cake', '#ff5d8f', '#2ec4b6');
    inv.media.gallery = [{ ref: art('cake', '#ff5d8f', '#ffbf3c', 'Last year'), caption: 'Turning 4!' }, { ref: art('family', '#2ec4b6', '#ff5d8f'), caption: 'Family' }];
    inv.design.photoShape = 'circle'; inv.design.border = 'thin'; inv.design.animation = 'lively';
    inv.settings.maxPerInvite = 4; inv.settings.rsvpDeadline = inDays(17);
    return inv;
  }

  function corporate() {
    const inv = M.newInvitation('conference', 'conference-night');
    const d = inDays(75);
    const v = { venue: 'Bangalore International Exhibition Centre', address: '10th Mile, Tumkur Road', city: 'Bengaluru', pin: '562123' };
    Object.assign(inv, {
      slug: 'innovatex-summit-2026', layout: 'landscape', languages: ['en'], defaultLang: 'en', dressCode: 'Business casual',
      contact: { name: 'Events Desk – Priya Nair', phone: '+91 80000 00000' },
      text: { en: T({ title: 'InnovateX Summit 2026', subtitle: 'Where India\'s builders meet', familyName: 'Nimbus Technologies presents', hostName: 'Nimbus Technologies Pvt. Ltd.',
        welcome: 'Two days of keynotes, product deep-dives and conversations with the people shaping India\'s digital future.',
        message: '<p>Dear Colleague,</p><p><b>Nimbus Technologies</b> is pleased to invite you to <b>InnovateX Summit 2026</b>, our annual conference on AI, fintech and digital public infrastructure.</p><ul><li>12 keynote sessions</li><li>Hands-on product labs</li><li>Curated networking dinner</li></ul><p>Please confirm your participation below. Seats are limited.</p>',
        instructions: 'Carry a government photo ID for registration.\nWi-Fi details will be shared at the registration desk.', thankyou: 'We look forward to building the future together.' }) },
      events: [
        ev(Object.assign({ name: 'Registration & Breakfast', date: d, start: '08:30', end: '09:30' }, v)),
        ev(Object.assign({ name: 'Keynotes & Product Labs', date: d, start: '09:30', end: '17:30' }, v)),
        ev({ name: 'Networking Dinner', date: d, start: '19:30', end: '22:30', venue: 'Taj West End', address: '25 Race Course Road', city: 'Bengaluru', pin: '560001', dressCode: 'Smart casual' }),
      ],
      highlightsTitle: 'Agenda highlights',
      highlights: [
        { icon: '🎤', title: 'Opening keynote', desc: 'The next decade of Indian SaaS' },
        { icon: '🤖', title: 'AI product lab', desc: 'Build an agent in 60 minutes' },
        { icon: '💳', title: 'Fintech panel', desc: 'UPI, credit & the next billion' },
        { icon: '🍽', title: 'Networking dinner', desc: 'Meet 300+ founders & CXOs' },
      ],
    });
    inv.media.logo = art('logo', '#4cc9f0', '#7b61ff');
    inv.media.gallery = [{ ref: art('stage', '#0b1530', '#4cc9f0', 'Keynote stage'), caption: 'InnovateX 2025 keynote' }, { ref: art('venue', '#0b1530', '#7b61ff', 'BIEC'), caption: 'Venue' }];
    inv.mainEventId = inv.events[1].id;
    inv.design.sections.highlights = true; inv.design.sections.hosts = false; inv.design.border = 'thin'; inv.design.photoShape = 'rounded';
    inv.design.sectionOrder = ['opening', 'welcome', 'message', 'countdown', 'highlights', 'schedule', 'venue', 'gallery', 'media', 'rsvp', 'instructions', 'hosts', 'thankyou'];
    inv.settings.askChildren = false; inv.settings.askFood = true; inv.settings.maxPerInvite = 2; inv.settings.maxGuestsTotal = 500; inv.settings.rsvpDeadline = inDays(60);
    return inv;
  }

  function rajwada() {
    const inv = M.newInvitation('wedding', 'rajwada-jharokha');
    const d = inDays(80);
    const v = { venue: 'Samode Palace', address: 'Samode village, Chomu', city: 'Jaipur, Rajasthan', pin: '303806' };
    Object.assign(inv, {
      slug: 'ishita-vihaan-wedding', languages: ['en', 'hi', 'pa'], defaultLang: 'en', paletteIndex: 0, layout: 'portrait',
      dressCode: 'Royal Rajasthani – safa & leheriya welcome', contact: { name: 'Devendra Shekhawat (Ishita\'s uncle)', phone: '+91 94140 00000' },
      text: {
        en: T({ title: 'Ishita & Vihaan', subtitle: 'invite you to the royal celebration of their wedding', familyName: 'With the blessings of our elders', hostName: 'The Shekhawat & Bhandari Families',
          welcome: 'Padharo mhare des! Two families, one celebration under the Rajasthan sky. Your presence will make it complete.',
          message: '<p>With the blessings of our elders,</p><p><b>Smt. &amp; Shri Rajendra Singh Shekhawat</b> and <b>Smt. &amp; Shri Anil Bhandari</b> joyfully invite you to the wedding of</p><p style="text-align:center"><b>Ishita</b> &amp; <b>Vihaan</b></p><p>Come, be a part of the pheras, the music and the feast.</p>',
          instructions: 'Shuttles leave Hotel Clarks Amer every hour from 4 PM.\nPlease carry a light shawl – evenings in the desert are cool.',
          thankyou: 'Your blessings are the brightest light of our celebration.' }),
        hi: T({ title: 'इशिता और विहान', subtitle: 'अपने विवाह के शाही उत्सव में आपको आमंत्रित करते हैं', familyName: 'बड़ों के आशीर्वाद से', hostName: 'शेखावत एवं भंडारी परिवार',
          welcome: 'पधारो म्हारे देस! राजस्थान के आसमान तले दो परिवार, एक उत्सव। आपकी उपस्थिति से ही यह पूरा होगा।',
          message: '<p>बड़ों के आशीर्वाद से,</p><p><b>श्रीमती एवं श्री राजेन्द्र सिंह शेखावत</b> तथा <b>श्रीमती एवं श्री अनिल भंडारी</b> आपको</p><p style="text-align:center"><b>इशिता</b> एवं <b>विहान</b></p><p>के शुभ विवाह में सपरिवार सादर आमंत्रित करते हैं।</p>',
          thankyou: 'आपका आशीर्वाद ही हमारे उत्सव की सबसे सुंदर रोशनी है।' }),
        pa: T({ title: 'ਇਸ਼ਿਤਾ ਅਤੇ ਵਿਹਾਨ', subtitle: 'ਆਪਣੇ ਵਿਆਹ ਦੇ ਸ਼ਾਹੀ ਜਸ਼ਨ ਵਿੱਚ ਤੁਹਾਨੂੰ ਸੱਦਾ ਦਿੰਦੇ ਹਨ', familyName: 'ਵੱਡਿਆਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਨਾਲ', hostName: 'ਸ਼ੇਖਾਵਤ ਅਤੇ ਭੰਡਾਰੀ ਪਰਿਵਾਰ',
          welcome: 'ਦੋ ਪਰਿਵਾਰ, ਇੱਕ ਜਸ਼ਨ, ਰਾਜਸਥਾਨ ਦੇ ਅਸਮਾਨ ਹੇਠ। ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਨਾਲ ਹੀ ਇਹ ਪੂਰਾ ਹੋਵੇਗਾ।',
          thankyou: 'ਤੁਹਾਡਾ ਅਸ਼ੀਰਵਾਦ ਹੀ ਸਾਡੇ ਜਸ਼ਨ ਦੀ ਸਭ ਤੋਂ ਸੋਹਣੀ ਰੌਸ਼ਨੀ ਹੈ।' }),
      },
      events: [
        ev(Object.assign({ name: 'Mehendi & Sangeet', date: inDays(79), start: '17:00', end: '23:00', dressCode: 'Leheriya & bandhej' }, v)),
        ev(Object.assign({ name: 'Wedding Ceremony', date: d, start: '19:00', end: '23:30', dressCode: 'Royal Rajasthani' }, v)),
      ],
    });
    inv.mainEventId = inv.events[1].id;
    inv.design.sections.hosts = false; inv.design.border = 'ornate';
    inv.media.gallery = [1, 2, 3].map((i) => ({ ref: art(i % 2 ? 'couple' : 'family', '#7a1340', '#e2b55c', 'Photo ' + i), caption: '' }));
    inv.settings.rsvpDeadline = inDays(65); inv.settings.maxPerInvite = 5;
    return inv;
  }

  function pastel() {
    const inv = M.newInvitation('engagement', 'pastel-bloom');
    const v = { venue: 'The Tamarind Tree', address: 'Kanakapura Road', city: 'Bengaluru, Karnataka', pin: '560062' };
    Object.assign(inv, {
      slug: 'anaya-reyansh-engagement', languages: ['en', 'hi'], defaultLang: 'en', paletteIndex: 0, layout: 'portrait',
      dressCode: 'Pastels', contact: { name: 'Nisha Rao (Anaya\'s mother)', phone: '+91 98450 00000' },
      text: {
        en: T({ title: 'Anaya & Reyansh', subtitle: 'are getting engaged', familyName: 'Save the date', hostName: 'The Rao & Kulkarni Families',
          welcome: 'Come for the rings, stay for the mango lassi and a long, happy lunch in the garden.',
          message: '<p>With hearts full of joy, the <b>Rao</b> and <b>Kulkarni</b> families invite you to the ring ceremony of</p><p style="text-align:center"><b>Anaya</b> &amp; <b>Reyansh</b></p><p>Celebrate the first chapter of their story with us.</p>',
          thankyou: 'Thank you for celebrating with us.' }),
        hi: T({ title: 'अनाया और रेयांश', subtitle: 'की सगाई', familyName: 'तारीख़ याद रखें', hostName: 'राव एवं कुलकर्णी परिवार',
          welcome: 'अंगूठियों की रस्म के लिए आइए, और बगीचे में मैंगो लस्सी व लंबे, खुशनुमा भोज के लिए रुकिए।',
          message: '<p>खुशियों भरे दिल से राव एवं कुलकर्णी परिवार आपको <b>अनाया</b> और <b>रेयांश</b> की सगाई में सादर आमंत्रित करते हैं।</p>' }),
      },
      events: [ev(Object.assign({ name: 'Ring Ceremony', date: inDays(40), start: '10:30', end: '15:00', dressCode: 'Pastels' }, v))],
    });
    inv.design.sections.hosts = false;
    inv.settings.rsvpDeadline = inDays(30); inv.settings.maxPerInvite = 4;
    return inv;
  }

  function foilAnniversary() {
    const inv = M.newInvitation('anniversary', 'ivory-foil');
    Object.assign(inv, {
      slug: 'sunil-rekha-25', languages: ['en', 'hi'], defaultLang: 'en', paletteIndex: 0, layout: 'portrait',
      dressCode: 'Black tie / Indian formal', contact: { name: 'Kabir Malhotra (son)', phone: '+91 98100 00000' },
      text: {
        en: T({ title: 'Sunil & Rekha', subtitle: 'Twenty-five years of togetherness', familyName: 'Their children invite you to celebrate', hostName: 'Kabir & Tara Malhotra',
          welcome: 'Twenty-five years, two children, one beautiful story. Join us to raise a toast to Mum and Dad.',
          message: '<p>Please join us for an evening of music, memories and dinner as we celebrate the <b>silver wedding anniversary</b> of <b>Sunil &amp; Rekha Malhotra</b>.</p>',
          thankyou: 'Thank you for being part of their journey.' }),
        hi: T({ title: 'सुनील और रेखा', subtitle: 'साथ के पच्चीस वर्ष', familyName: 'उनके बच्चे आपको आमंत्रित करते हैं', hostName: 'कबीर एवं तारा मल्होत्रा',
          message: '<p><b>सुनील एवं रेखा मल्होत्रा</b> की विवाह की रजत जयंती पर संगीत, यादों और रात्रि भोज की एक शाम में आप सादर आमंत्रित हैं।</p>' }),
      },
      events: [ev({ name: 'Anniversary Dinner', date: inDays(28), start: '19:30', end: '23:00', venue: 'The Leela Palace', address: 'Diplomatic Enclave, Chanakyapuri', city: 'New Delhi', pin: '110023' })],
    });
    inv.design.sections.hosts = false;
    inv.settings.rsvpDeadline = inDays(20); inv.settings.maxPerInvite = 2;
    return inv;
  }

  function templeHousewarming() {
    const inv = M.newInvitation('housewarming', 'temple-gopuram');
    Object.assign(inv, {
      slug: 'iyer-gruhapravesam', languages: ['en', 'hi'], defaultLang: 'en', paletteIndex: 0, layout: 'portrait',
      dressCode: 'Traditional', contact: { name: 'Karthik Iyer', phone: '+91 94440 00000' },
      text: {
        en: T({ title: 'Gruhapravesam', subtitle: 'With the blessings of the divine, we step into our new home', familyName: 'Lakshmi & Karthik Iyer', hostName: 'The Iyer Family',
          welcome: 'Please join us for the Ganapathi Homam and a traditional lunch served on banana leaf.',
          message: '<p>With the blessings of our elders, <b>Lakshmi &amp; Karthik Iyer</b> invite you and your family to the <b>Gruhapravesam</b> of our new home.</p><p>Your presence and blessings will fill it with joy.</p>',
          instructions: 'Please arrive by 6:45 AM for the homam.\nLunch (vazhai ilai saapadu) will be served from 11:30 AM.',
          thankyou: 'Thank you for blessing our new beginning.' }),
        hi: T({ title: 'गृह प्रवेश', subtitle: 'प्रभु के आशीर्वाद से हम अपने नए घर में प्रवेश कर रहे हैं', familyName: 'लक्ष्मी एवं कार्तिक अय्यर', hostName: 'अय्यर परिवार',
          message: '<p>बड़ों के आशीर्वाद से <b>लक्ष्मी एवं कार्तिक अय्यर</b> आपको सपरिवार अपने नए घर के <b>गृह प्रवेश</b> में आमंत्रित करते हैं।</p>' }),
      },
      events: [
        ev({ name: 'Ganapathi Homam', date: inDays(33), start: '07:00', end: '10:30', venue: 'Sri Lakshmi Nilayam', address: '12, 3rd Cross Street, Mylapore', city: 'Chennai, Tamil Nadu', pin: '600004' }),
        ev({ name: 'Lunch', date: inDays(33), start: '11:30', end: '14:00', venue: 'Sri Lakshmi Nilayam', address: '12, 3rd Cross Street, Mylapore', city: 'Chennai, Tamil Nadu', pin: '600004' }),
      ],
    });
    inv.mainEventId = inv.events[0].id;
    inv.design.sections.hosts = false;
    inv.settings.rsvpDeadline = inDays(27); inv.settings.maxPerInvite = 6;
    return inv;
  }

  async function create(store) {
    const list = [dham(), wedding(), rajwada(), pastel(), foilAnniversary(), templeHousewarming(), birthday(), corporate()];
    for (const inv of list) {
      let slug = inv.slug, n = 2;
      while (!(await store.slugAvailable(slug, inv.id))) slug = inv.slug + '-' + n++;
      inv.slug = slug;
      const saved = await store.saveInvitation(inv);
      Object.assign(inv, { id: saved.id });
      await store.publish(inv);
      if (inv.category === 'wedding') {
        for (const [name, phone, allowed] of [['Sharma Ji & family', '9876500001', 4], ['Meena Aunty', '9876500002', 2], ['Rohit (college)', '9876500003', 1]])
          await store.saveGuest({ invitationId: inv.id, name, phone, email: '', allowed });
      }
    }
    return list;
  }
  window.IXSamples = { create, dham, wedding, rajwada, pastel, foilAnniversary, templeHousewarming, birthday, corporate };
})();
