/* Sample invitations: Himachali Dham, Wedding, Birthday, Corporate conference. window.IXSamples */
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

  async function create(store) {
    const list = [dham(), wedding(), birthday(), corporate()];
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
  window.IXSamples = { create, dham, wedding, birthday, corporate };
})();
